//! # Loyalty Token Contract  (BITE)
//!
//! A SEP-41 compatible fungible token that powers the restaurant platform's
//! customer loyalty programme.
//!
//! ## Token details
//! | Field   | Value          |
//! |---------|----------------|
//! | Name    | Bite Rewards   |
//! | Symbol  | BITE           |
//! | Decimals| 7              |
//!
//! ## Earning BITE
//! The admin (or an authorised minter - typically the Order contract) calls
//! `mint` after an order is marked *Delivered*.  A suggested policy is:
//! **1 BITE per 10 000 stroops (0.001 XLM) spent**.
//!
//! ## Redeeming BITE
//! A customer `burn`s their BITE tokens and the backend applies a discount to
//! the next order.  The redemption rate is managed off-chain.
//!
//! ## SEP-41 surface
//! Implements the full `token::Interface` trait so the token appears correctly
//! in Stellar wallets.

#![no_std]

/// Minimum ledger window for a non-zero allowance (~24 h at 5-second close time).
const MIN_APPROVAL_VALIDITY_LEDGERS: u32 = 17_280;
/// Maximum ledger window for an allowance (~1 year).
const MAX_APPROVAL_VALIDITY_LEDGERS: u32 = 6_307_200;

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String};

// Storage keys
#[contracttype]
pub enum DataKey {
    /// The platform admin who controls minting.
    Admin,
    /// Proposed but not yet confirmed new admin (two-step transfer).
    PendingAdmin,
    /// Optional secondary minter (e.g. the Order contract address).
    Minter,
    /// Total tokens in circulation.
    TotalSupply,
    /// Per-account balances.
    Balance(Address),
    /// Allowances: (owner, spender) -> (amount, expiration_ledger).
    Allowance(Address, Address),
    /// Whether the contract is paused.
    Paused,
}

// Token metadata (stored once at init)
#[contracttype]
#[derive(Clone)]
pub struct TokenMeta {
    pub name: String,
    pub symbol: String,
    pub decimals: u32,
}

#[contracttype]
pub enum MetaKey {
    Meta,
}

// Allowance helper struct
#[contracttype]
#[derive(Clone)]
pub struct AllowanceData {
    pub amount: i128,
    pub expiration_ledger: u32,
}

// Contract
#[contract]
pub struct LoyaltyToken;

#[contractimpl]
impl LoyaltyToken {
    // Initialisation

    /// Deploy the BITE token.
    ///
    /// # Arguments
    /// - `admin`  - address with mint authority.
    /// - `minter` - optional secondary minter (pass `admin` to disable).
    pub fn initialize(env: Env, admin: Address, minter: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Minter, &minter);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);
        env.storage().instance().set(
            &MetaKey::Meta,
            &TokenMeta {
                name: String::from_str(&env, "Bite Rewards"),
                symbol: String::from_str(&env, "BITE"),
                decimals: 7,
            },
        );
        env.storage().instance().extend_ttl(17_280, 17_280);
    }

    // Admin / Minter actions

    /// Mint `amount` BITE to `to`.  Only callable by admin or minter.
    pub fn mint(env: Env, caller: Address, to: Address, amount: i128) {
        caller.require_auth();
        Self::assert_admin_or_minter(&env, &caller);
        Self::assert_not_paused_for(&env, &caller);

        if amount <= 0 {
            panic!("amount must be positive");
        }

        let new_balance = Self::balance_of(&env, &to) + amount;
        Self::set_balance(&env, &to, new_balance);

        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply + amount));
        env.storage().instance().extend_ttl(17_280, 17_280);

        env.events()
            .publish((symbol_short!("mint"), symbol_short!("BITE")), (to, amount));
    }

    // -----------------------------------------------------------------------
    // Pause / unpause
    // -----------------------------------------------------------------------

    /// Pause the contract (admin only). All state-mutating calls by non-admins
    /// will be rejected while paused.
    pub fn pause_contract(env: Env, caller: Address) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);
        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage().instance().extend_ttl(17_280, 17_280);
        env.events().publish(
            (symbol_short!("ctrl"), symbol_short!("pause")),
            env.ledger().timestamp(),
        );
    }

    /// Unpause the contract (admin only).
    pub fn unpause_contract(env: Env, caller: Address) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().extend_ttl(17_280, 17_280);
        env.events().publish(
            (symbol_short!("ctrl"), symbol_short!("unpause")),
            env.ledger().timestamp(),
        );
    }

    /// Update the authorised minter address (admin only).
    pub fn set_minter(env: Env, caller: Address, new_minter: Address) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);
        env.storage().instance().set(&DataKey::Minter, &new_minter);
        env.storage().instance().extend_ttl(17_280, 17_280);
    }

    /// Step 1: propose a new admin. Does NOT change the active admin.
    ///
    /// Emits `(symbol_short!("admin"), symbol_short!("proposed"))`.
    /// The new admin must call `accept_admin` to take effect.
    pub fn transfer_admin(env: Env, caller: Address, new_admin: Address) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);
        env.storage()
            .instance()
            .set(&DataKey::PendingAdmin, &new_admin);
        env.storage().instance().extend_ttl(17_280, 17_280);
        env.events().publish(
            (symbol_short!("admin"), symbol_short!("proposed")),
            (caller, new_admin),
        );
    }

    /// Step 2: accept a pending admin transfer. Caller must be `PendingAdmin`.
    ///
    /// Promotes caller to `Admin`, clears `PendingAdmin`,
    /// and emits `(symbol_short!("admin"), symbol_short!("accepted"))`.
    pub fn accept_admin(env: Env, caller: Address) {
        caller.require_auth();
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .expect("not pending admin");
        if caller != pending {
            panic!("not pending admin");
        }
        env.storage().instance().set(&DataKey::Admin, &caller);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        env.storage().instance().extend_ttl(17_280, 17_280);
        env.events()
            .publish((symbol_short!("admin"), symbol_short!("accepted")), caller);
    }

    /// Cancel a pending admin transfer. Only the current admin may call this.
    ///
    /// Clears `PendingAdmin` without changing the active admin.
    pub fn cancel_transfer(env: Env, caller: Address) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);
        env.storage().instance().remove(&DataKey::PendingAdmin);
        env.storage().instance().extend_ttl(17_280, 17_280);
    }

    // SEP-41 token interface

    /// Return the token balance of `account`.
    pub fn balance(env: Env, account: Address) -> i128 {
        Self::balance_of(&env, &account)
    }

    /// Transfer `amount` BITE from `from` to `to`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::assert_not_paused_for(&env, &from);
        Self::do_transfer(&env, &from, &to, amount);
    }

    /// Return the current allowance for `spender` to spend on behalf of `from`.
    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        Self::get_allowance(&env, &from, &spender)
    }

    /// Approve `spender` to transfer up to `amount` on behalf of `from`.
    ///
    /// `expiration_ledger` is the **last ledger** at which the approval is valid
    /// (inclusive). The allowance returns 0 on `expiration_ledger + 1`.
    /// Pass `0` for both `amount` and `expiration_ledger` to revoke.
    ///
    /// Non-zero approvals must satisfy:
    ///   `current + MIN_APPROVAL_VALIDITY_LEDGERS <= expiration_ledger <= current + MAX_APPROVAL_VALIDITY_LEDGERS`
    pub fn approve(
        env: Env,
        from: Address,
        spender: Address,
        amount: i128,
        expiration_ledger: u32,
    ) {
        from.require_auth();
        Self::assert_not_paused_for(&env, &from);
        if amount < 0 {
            panic!("allowance amount cannot be negative");
        }
        if amount > 0 {
            let current = env.ledger().sequence();
            if expiration_ledger < current.saturating_add(MIN_APPROVAL_VALIDITY_LEDGERS) {
                panic!("expiration too soon");
            }
            if expiration_ledger > current.saturating_add(MAX_APPROVAL_VALIDITY_LEDGERS) {
                panic!("expiration too far in the future");
            }
        }
        let data = AllowanceData {
            amount,
            expiration_ledger,
        };
        let ttl = expiration_ledger.saturating_sub(env.ledger().sequence());
        env.storage()
            .temporary()
            .set(&DataKey::Allowance(from.clone(), spender.clone()), &data);
        if ttl > 0 {
            env.storage().temporary().extend_ttl(
                &DataKey::Allowance(from.clone(), spender.clone()),
                ttl,
                ttl,
            );
        }
        env.events().publish(
            (symbol_short!("approve"), symbol_short!("BITE")),
            (from, spender, amount, expiration_ledger),
        );
    }

    /// Transfer `amount` on behalf of `from` using a prior allowance.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        Self::assert_not_paused_for(&env, &spender);

        let current = Self::get_allowance(&env, &from, &spender);
        if current < amount {
            panic!("insufficient allowance");
        }

        // Decrement allowance.
        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let mut data: AllowanceData =
            env.storage()
                .temporary()
                .get(&allowance_key)
                .unwrap_or(AllowanceData {
                    amount: 0,
                    expiration_ledger: 0,
                });
        data.amount -= amount;
        env.storage().temporary().set(&allowance_key, &data);

        Self::do_transfer(&env, &from, &to, amount);
    }

    /// Burn `amount` BITE from `from`'s account.
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        Self::assert_not_paused_for(&env, &from);
        Self::do_burn(&env, &from, amount);
    }

    /// Burn `amount` BITE from `from` using a spender's allowance.
    pub fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        Self::assert_not_paused_for(&env, &spender);

        let current = Self::get_allowance(&env, &from, &spender);
        if current < amount {
            panic!("insufficient allowance");
        }

        let allowance_key = DataKey::Allowance(from.clone(), spender.clone());
        let mut data: AllowanceData =
            env.storage()
                .temporary()
                .get(&allowance_key)
                .unwrap_or(AllowanceData {
                    amount: 0,
                    expiration_ledger: 0,
                });
        data.amount -= amount;
        env.storage().temporary().set(&allowance_key, &data);

        Self::do_burn(&env, &from, amount);
    }

    // Token metadata (SEP-41)

    pub fn name(env: Env) -> String {
        let meta: TokenMeta = env.storage().instance().get(&MetaKey::Meta).unwrap();
        meta.name
    }

    pub fn symbol(env: Env) -> String {
        let meta: TokenMeta = env.storage().instance().get(&MetaKey::Meta).unwrap();
        meta.symbol
    }

    pub fn decimals(env: Env) -> u32 {
        let meta: TokenMeta = env.storage().instance().get(&MetaKey::Meta).unwrap();
        meta.decimals
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    // Private helpers

    fn balance_of(env: &Env, account: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(account.clone()))
            .unwrap_or(0)
    }

    fn set_balance(env: &Env, account: &Address, amount: i128) {
        let ttl: u32 = 2_073_600;
        env.storage()
            .persistent()
            .set(&DataKey::Balance(account.clone()), &amount);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Balance(account.clone()), ttl, ttl);
    }

    fn do_transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
        if amount <= 0 {
            panic!("transfer amount must be positive");
        }
        let from_bal = Self::balance_of(env, from);
        if from_bal < amount {
            panic!("insufficient balance");
        }
        Self::set_balance(env, from, from_bal - amount);
        Self::set_balance(env, to, Self::balance_of(env, to) + amount);

        env.events().publish(
            (symbol_short!("transfer"), symbol_short!("BITE")),
            (from.clone(), to.clone(), amount),
        );
    }

    fn do_burn(env: &Env, from: &Address, amount: i128) {
        if amount <= 0 {
            panic!("burn amount must be positive");
        }
        let bal = Self::balance_of(env, from);
        if bal < amount {
            panic!("insufficient balance");
        }
        Self::set_balance(env, from, bal - amount);

        let supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(supply - amount));
        env.storage().instance().extend_ttl(17_280, 17_280);

        env.events().publish(
            (symbol_short!("burn"), symbol_short!("BITE")),
            (from.clone(), amount),
        );
    }

    fn get_allowance(env: &Env, from: &Address, spender: &Address) -> i128 {
        let data: Option<AllowanceData> = env
            .storage()
            .temporary()
            .get(&DataKey::Allowance(from.clone(), spender.clone()));

        match data {
            None => 0,
            Some(d) => {
                // expiration_ledger is inclusive: the allowance is valid through
                // and including that ledger; it returns 0 on expiration_ledger + 1.
                if env.ledger().sequence() > d.expiration_ledger {
                    0
                } else {
                    d.amount
                }
            }
        }
    }

    fn assert_admin_or_panic(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != &admin {
            panic!("unauthorized: admin only");
        }
    }

    fn assert_not_paused_for(env: &Env, caller: &Address) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
            if caller != &admin {
                panic!("contract is paused");
            }
        }
    }

    fn assert_admin_or_minter(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        let minter: Address = env.storage().instance().get(&DataKey::Minter).unwrap();
        if caller != &admin && caller != &minter {
            panic!("unauthorized: admin or minter only");
        }
    }
}

// Tests
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn setup() -> (Env, LoyaltyTokenClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let cid = env.register(LoyaltyToken, ());
        let client = LoyaltyTokenClient::new(&env, &cid);
        let admin = Address::generate(&env);
        client.initialize(&admin, &admin); // admin is also minter
        (env, client, admin)
    }

    #[test]
    fn test_metadata() {
        let (env, client, _admin) = setup();
        assert_eq!(client.name(), String::from_str(&env, "Bite Rewards"));
        assert_eq!(client.symbol(), String::from_str(&env, "BITE"));
        assert_eq!(client.decimals(), 7u32);
    }

    #[test]
    fn test_mint_and_balance() {
        let (env, client, admin) = setup();
        let user = Address::generate(&env);

        client.mint(&admin, &user, &1_000_000);
        assert_eq!(client.balance(&user), 1_000_000);
        assert_eq!(client.total_supply(), 1_000_000);
    }

    #[test]
    fn test_transfer() {
        let (env, client, admin) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.mint(&admin, &alice, &500_000);
        client.transfer(&alice, &bob, &200_000);

        assert_eq!(client.balance(&alice), 300_000);
        assert_eq!(client.balance(&bob), 200_000);
    }

    #[test]
    fn test_approve_and_transfer_from() {
        let (env, client, admin) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.mint(&admin, &alice, &1_000_000);

        // Use MIN_APPROVAL_VALIDITY_LEDGERS to satisfy the minimum window.
        let expiry = env.ledger().sequence() + 17_280;
        client.approve(&alice, &bob, &300_000, &expiry);
        assert_eq!(client.allowance(&alice, &bob), 300_000);

        client.transfer_from(&bob, &alice, &bob, &100_000);
        assert_eq!(client.balance(&bob), 100_000);
        assert_eq!(client.allowance(&alice, &bob), 200_000);
    }

    #[test]
    fn test_burn() {
        let (env, client, admin) = setup();
        let user = Address::generate(&env);

        client.mint(&admin, &user, &500_000);
        client.burn(&user, &200_000);

        assert_eq!(client.balance(&user), 300_000);
        assert_eq!(client.total_supply(), 300_000);
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_transfer_overdraft_panics() {
        let (env, client, admin) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.mint(&admin, &alice, &100_000);
        client.transfer(&alice, &bob, &200_000);
    }

    #[test]
    #[should_panic(expected = "unauthorized: admin or minter only")]
    fn test_unauthorised_mint_panics() {
        let (env, client, _admin) = setup();
        let rando = Address::generate(&env);
        client.mint(&rando, &rando, &1_000_000);
    }

    // Two-step admin transfer tests

    #[test]
    fn test_transfer_admin_does_not_change_active_admin() {
        let (env, client, admin) = setup();
        let new_admin = Address::generate(&env);
        // propose but do not accept
        client.transfer_admin(&admin, &new_admin);
        // old admin can still mint
        let user = Address::generate(&env);
        client.mint(&admin, &user, &100);
        assert_eq!(client.balance(&user), 100);
    }

    #[test]
    fn test_happy_path_propose_accept_old_admin_locked_out() {
        let (env, client, admin) = setup();
        let new_admin = Address::generate(&env);

        // Step 1: propose
        client.transfer_admin(&admin, &new_admin);

        // Step 2: accept
        client.accept_admin(&new_admin);

        // new admin can mint
        let user = Address::generate(&env);
        client.mint(&new_admin, &user, &500);
        assert_eq!(client.balance(&user), 500);
    }

    #[test]
    #[should_panic(expected = "unauthorized: admin only")]
    fn test_old_admin_cannot_mint_after_accept() {
        let (env, client, admin) = setup();
        let new_admin = Address::generate(&env);
        client.transfer_admin(&admin, &new_admin);
        client.accept_admin(&new_admin);

        // old admin should fail
        let user = Address::generate(&env);
        client.mint(&admin, &user, &100);
    }

    #[test]
    #[should_panic(expected = "not pending admin")]
    fn test_accept_admin_wrong_address_panics() {
        let (env, client, admin) = setup();
        let new_admin = Address::generate(&env);
        let rando = Address::generate(&env);

        client.transfer_admin(&admin, &new_admin);
        // rando tries to accept
        client.accept_admin(&rando);
    }

    #[test]
    fn test_cancel_transfer_clears_pending_admin() {
        let (env, client, admin) = setup();
        let new_admin = Address::generate(&env);

        // propose then cancel
        client.transfer_admin(&admin, &new_admin);
        client.cancel_transfer(&admin);

        // old admin still active
        let user = Address::generate(&env);
        client.mint(&admin, &user, &100);
        assert_eq!(client.balance(&user), 100);
    }

    #[test]
    #[should_panic(expected = "not pending admin")]
    fn test_accept_after_cancel_panics() {
        let (env, client, admin) = setup();
        let new_admin = Address::generate(&env);
        client.transfer_admin(&admin, &new_admin);
        client.cancel_transfer(&admin);
        // accept should now panic since PendingAdmin is cleared
        client.accept_admin(&new_admin);
    }

    #[test]
    #[should_panic(expected = "expiration too soon")]
    fn test_approve_expiry_too_soon_panics() {
        let (env, client, admin) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.mint(&admin, &alice, &1_000_000);
        // expiry is only 1 ledger ahead - below MIN_APPROVAL_VALIDITY_LEDGERS
        let bad_expiry = env.ledger().sequence() + 1;
        client.approve(&alice, &bob, &100_000, &bad_expiry);
    }

    #[test]
    fn test_approve_minimum_valid_expiry() {
        let (env, client, admin) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.mint(&admin, &alice, &1_000_000);
        let min_expiry = env.ledger().sequence() + 17_280;
        client.approve(&alice, &bob, &100_000, &min_expiry);
        assert_eq!(client.allowance(&alice, &bob), 100_000);
    }

    #[test]
    fn test_allowance_valid_at_expiry_ledger() {
        let (env, client, admin) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.mint(&admin, &alice, &1_000_000);
        let current = env.ledger().sequence();
        let expiry = current + 17_280;
        client.approve(&alice, &bob, &100_000, &expiry);
        // Advance to the exact expiration ledger - allowance must still be valid (inclusive).
        env.ledger().with_mut(|li| li.sequence_number = expiry);
        assert_eq!(client.allowance(&alice, &bob), 100_000);
    }

    #[test]
    fn test_allowance_zero_after_expiry_ledger() {
        let (env, client, admin) = setup();
        let alice = Address::generate(&env);
        let bob = Address::generate(&env);
        client.mint(&admin, &alice, &1_000_000);
        let current = env.ledger().sequence();
        let expiry = current + 17_280;
        client.approve(&alice, &bob, &100_000, &expiry);
        // Advance one ledger past expiry - allowance must return 0.
        env.ledger().with_mut(|li| li.sequence_number = expiry + 1);
        assert_eq!(client.allowance(&alice, &bob), 0);
    }
}
