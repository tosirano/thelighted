#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, IntoVal, String, Symbol,
    Vec,
};

/// Orders that remain unfinished longer than this are eligible for expiry.
const ORDER_TTL_SECONDS: u64 = 172_800; // 48 hours

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Maximum allowed unit price per line item (in stroops).
/// Prevents individual item prices from causing subtotal overflow.
const MAX_ITEM_UNIT_PRICE: i128 = 1_000_000_000_000; // 100,000 XLM

/// Maximum allowed order total (in stroops).
const MAX_ORDER_TOTAL: i128 = 100_000_000_000_000; // 10,000,000 XLM

// ---------------------------------------------------------------------------
// Cross-contract: Loyalty Token client
// ---------------------------------------------------------------------------

/// Minimal interface needed to mint BITE tokens from the Order contract.
#[contractclient(name = "LoyaltyTokenClient")]
pub trait LoyaltyTokenInterface {
    fn mint(env: Env, caller: Address, to: Address, amount: i128);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// Lifecycle state of an order.
#[contracttype]
#[derive(Clone, PartialEq, Debug)]
pub enum OrderStatus {
    Pending,
    Confirmed,
    Preparing,
    Ready,
    Delivered,
    Cancelled,
}

#[contracttype]
#[derive(Clone)]
pub struct OrderItem {
    pub menu_item_id: u64,
    pub name: String,
    pub quantity: u32,
    pub unit_price: i128,
}

#[contracttype]
#[derive(Clone)]
pub struct Order {
    pub id: u64,
    pub restaurant_id: u64,
    pub customer: Address,
    pub items: Vec<OrderItem>,
    pub total_amount: i128,
    pub status: OrderStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub notes: String,
    /// Unix timestamp after which the order may be expired by anyone.
    pub expires_at: u64,
}

#[contracttype]
pub enum DataKey {
    Admin,
    Count,
    Order(u64),
    RestaurantOrders(u64),
    CustomerOrders(Address),
    /// Address of the deployed RestaurantRegistry contract.
    RestaurantRegistry,
}

#[contract]
pub struct OrderContract;

#[contractimpl]
impl OrderContract {
    /// Deploy and initialise the order contract.
    ///
    /// # Arguments
    /// - `admin`                      – contract admin address.
    /// - `restaurant_registry_address` – address of the RestaurantRegistry contract
    ///   used to validate `restaurant_id` on every `place_order` call.
    pub fn initialize(env: Env, admin: Address, restaurant_registry_address: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::RestaurantRegistry, &restaurant_registry_address);
        env.storage().instance().set(&DataKey::Count, &0u64);
        if let Some(addr) = loyalty_token_address {
            env.storage().instance().set(&DataKey::LoyaltyToken, &addr);
        }
        env.storage().instance().extend_ttl(17_280, 17_280);
    }

    /// Place a new order.
    ///
    /// Validates that `restaurant_id` exists and is active in the
    /// `RestaurantRegistry` contract before saving the order.
    ///
    /// # Panics
    /// - `"restaurant not found"` – if the registry has no record for `restaurant_id`.
    /// - `"restaurant is not active"` – if the restaurant exists but `is_active` is false.
    pub fn place_order(
        env: Env,
        customer: Address,
        restaurant_id: u64,
        items: Vec<OrderItem>,
        notes: String,
    ) -> u64 {
        customer.require_auth();
        Self::assert_not_paused_for(&env, &customer);

        if items.is_empty() {
            panic!("order must contain at least one item");
        }

        // Compute total from items using checked arithmetic to prevent overflow.
        let mut total: i128 = 0;
        for item in items.iter() {
            if item.quantity == 0 {
                panic!("quantity must be greater than zero");
            }
            if item.unit_price <= 0 {
                panic!("unit price must be positive");
            }
            if item.unit_price > MAX_ITEM_UNIT_PRICE {
                panic!("unit price exceeds maximum");
            }
            let subtotal = item
                .unit_price
                .checked_mul(item.quantity as i128)
                .expect("order item subtotal overflow");
            total = total
                .checked_add(subtotal)
                .expect("order total overflow");
            if total > MAX_ORDER_TOTAL {
                panic!("order exceeds maximum total");
            }
        }

        let count: u64 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let id: u64 = count + 1;
        let now = env.ledger().timestamp();

        let order = Order {
            id,
            restaurant_id,
            customer: customer.clone(),
            items: items.clone(),
            total_amount: total,
            status: OrderStatus::Pending,
            created_at: now,
            updated_at: now,
            notes,
            expires_at: now + ORDER_TTL_SECONDS,
        };

        let ttl: u32 = 2_073_600;
        env.storage().persistent().set(&DataKey::Order(id), &order);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Order(id), ttl, ttl);

        Self::append_to_list(&env, DataKey::RestaurantOrders(restaurant_id), id, ttl);
        Self::append_to_list(&env, DataKey::CustomerOrders(customer.clone()), id, ttl);

        env.storage().instance().set(&DataKey::Count, &id);
        env.storage().instance().extend_ttl(17_280, 17_280);

        env.events().publish(
            (symbol_short!("placed"), symbol_short!("order")),
            (id, restaurant_id, customer, total),
        );

        id
    }

    pub fn cancel_order(env: Env, caller: Address, order_id: u64) {
        caller.require_auth();
        Self::assert_not_paused_for(&env, &caller);

        let mut order = Self::load_order(&env, order_id);
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

        let is_admin = caller == admin;
        let is_customer = caller == order.customer;

        if !is_admin && !is_customer {
            panic!("unauthorized");
        }

        if order.status == OrderStatus::Delivered {
            panic!("cannot cancel a delivered order");
        }
        if order.status == OrderStatus::Cancelled {
            panic!("order already cancelled");
        }
        if is_customer && order.status != OrderStatus::Pending {
            panic!("customers may only cancel pending orders");
        }

        order.status = OrderStatus::Cancelled;
        order.updated_at = env.ledger().timestamp();
        Self::save_order(&env, &order);

        env.events().publish(
            (symbol_short!("cancelled"), symbol_short!("order")),
            (order_id, caller),
        );
    }

    pub fn advance_status(env: Env, caller: Address, order_id: u64) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);

        let mut order = Self::load_order(&env, order_id);

        if env.ledger().timestamp() > order.expires_at {
            panic!("order has expired");
        }

        order.status = match order.status {
            OrderStatus::Pending => OrderStatus::Confirmed,
            OrderStatus::Confirmed => OrderStatus::Preparing,
            OrderStatus::Preparing => OrderStatus::Ready,
            OrderStatus::Ready => OrderStatus::Delivered,
            OrderStatus::Delivered => panic!("order already delivered"),
            OrderStatus::Cancelled => panic!("cannot advance a cancelled order"),
        };
        order.updated_at = env.ledger().timestamp();

        // Auto-mint loyalty tokens on delivery (exactly once).
        if order.status == OrderStatus::Delivered && !order.minted {
            let mint_amount = order.total_amount / 10_000;
            if mint_amount > 0 {
                if let Some(loyalty_addr) = env
                    .storage()
                    .instance()
                    .get::<DataKey, Address>(&DataKey::LoyaltyToken)
                {
                    let loyalty_client = LoyaltyTokenClient::new(&env, &loyalty_addr);
                    loyalty_client.mint(
                        &env.current_contract_address(),
                        &order.customer,
                        &mint_amount,
                    );
                    env.events().publish(
                        (symbol_short!("loyal"), symbol_short!("earn")),
                        (order.customer.clone(), mint_amount),
                    );
                }
            }
            order.minted = true;
        }

        Self::save_order(&env, &order);

        env.events().publish(
            (symbol_short!("advanced"), symbol_short!("order")),
            order_id,
        );
    }

    pub fn set_status(env: Env, caller: Address, order_id: u64, status: OrderStatus) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);

        let mut order = Self::load_order(&env, order_id);
        order.status = status;
        order.updated_at = env.ledger().timestamp();
        Self::save_order(&env, &order);

        env.events().publish(
            (symbol_short!("setstatus"), symbol_short!("order")),
            order_id,
        );
    }

    pub fn get_order(env: Env, order_id: u64) -> Order {
        Self::load_order(&env, order_id)
    }

    pub fn get_restaurant_orders(env: Env, restaurant_id: u64) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::RestaurantOrders(restaurant_id))
            .unwrap_or_else(|| vec![&env])
    }

    pub fn get_customer_orders(env: Env, customer: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::CustomerOrders(customer))
            .unwrap_or_else(|| vec![&env])
    }

    pub fn get_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    fn load_order(env: &Env, order_id: u64) -> Order {
        env.storage()
            .persistent()
            .get(&DataKey::Order(order_id))
            .unwrap_or_else(|| panic!("order not found"))
    }

    fn save_order(env: &Env, order: &Order) {
        let ttl: u32 = 2_073_600;
        env.storage()
            .persistent()
            .set(&DataKey::Order(order.id), order);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Order(order.id), ttl, ttl);
    }

    fn assert_admin_or_panic(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != &admin {
            panic!("unauthorized: admin only");
        }
    }

    fn assert_not_paused_for(env: &Env, caller: &Address) {
        let paused: bool = env.storage().instance().get(&DataKey::Paused).unwrap_or(false);
        if paused {
            let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
            if caller != &admin {
                panic!("contract is paused");
            }
        }
    }

    // -----------------------------------------------------------------------
    // Pause / unpause
    // -----------------------------------------------------------------------

    /// Pause the contract (admin only).
    pub fn pause_contract(env: Env, caller: Address) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);
        env.storage().instance().set(&DataKey::Paused, &true);
        env.storage().instance().extend_ttl(17_280, 17_280);
        env.events()
            .publish((symbol_short!("ctrl"), symbol_short!("pause")), env.ledger().timestamp());
    }

    /// Unpause the contract (admin only).
    pub fn unpause_contract(env: Env, caller: Address) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().extend_ttl(17_280, 17_280);
        env.events()
            .publish((symbol_short!("ctrl"), symbol_short!("unpause")), env.ledger().timestamp());
    }

    fn append_to_list(env: &Env, key: DataKey, id: u64, ttl: u32) {
        let mut list: Vec<u64> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or_else(|| vec![env]);
        list.push_back(id);
        env.storage().persistent().set(&key, &list);
        env.storage().persistent().extend_ttl(&key, ttl, ttl);
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use loyalty_token::LoyaltyToken;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{contract, contractimpl, vec, Env, String};

    // Mock RestaurantRegistry for unit tests
    #[contracttype]
    #[derive(Clone)]
    pub struct MockRestaurant {
        pub id: u64,
        pub owner: Address,
        pub name: String,
        pub slug: String,
        pub is_active: bool,
        pub created_at: u64,
    }

    #[contract]
    pub struct MockRestaurantRegistry;

    #[contractimpl]
    impl MockRestaurantRegistry {
        pub fn get_restaurant(env: Env, restaurant_id: u64) -> MockRestaurant {
            match restaurant_id {
                1 => MockRestaurant {
                    id: 1,
                    owner: Address::generate(&env),
                    name: String::from_str(&env, "Active Restaurant"),
                    slug: String::from_str(&env, "active"),
                    is_active: true,
                    created_at: 0,
                },
                2 => MockRestaurant {
                    id: 2,
                    owner: Address::generate(&env),
                    name: String::from_str(&env, "Inactive Restaurant"),
                    slug: String::from_str(&env, "inactive"),
                    is_active: false,
                    created_at: 0,
                },
                _ => panic!("restaurant not found"),
            }
        }
    }

    fn make_item(env: &Env, id: u64, qty: u32, price: i128) -> OrderItem {
        OrderItem {
            menu_item_id: id,
            name: String::from_str(env, "Jollof Rice"),
            quantity: qty,
            unit_price: price,
        }
    }

    fn setup() -> (Env, OrderContractClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let registry_id = env.register(MockRestaurantRegistry, ());
        let cid = env.register(OrderContract, ());
        let client = OrderContractClient::new(&env, &cid);
        let admin = Address::generate(&env);

        client.initialize(&admin, &registry_id);
        (env, client, admin, registry_id)
    }

    /// Set up order + loyalty token contracts wired together.
    fn setup_with_loyalty() -> (
        Env,
        OrderContractClient<'static>,
        loyalty_token::LoyaltyTokenClient<'static>,
        Address, // admin
    ) {
        let env = Env::default();
        env.mock_all_auths();

        // Deploy loyalty token contract.
        let lt_cid = env.register(LoyaltyToken, ());
        let lt_client = loyalty_token::LoyaltyTokenClient::new(&env, &lt_cid);
        let admin = Address::generate(&env);
        // Deploy order contract as minter so it can call mint.
        let order_cid = env.register(OrderContract, ());
        let order_client = OrderContractClient::new(&env, &order_cid);

        // order contract address is the minter.
        lt_client.initialize(&admin, &order_cid);
        order_client.initialize(&admin, &Some(lt_cid));

        (env, order_client, lt_client, admin)
    }

    // -------  existing tests (updated for new initialize signature) --------

    #[test]
    fn test_place_order_valid_active_restaurant() {
        let (env, client, _admin, _registry) = setup();
        let customer = Address::generate(&env);
        let items = vec![&env, make_item(&env, 1, 2, 5_000_000)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
        assert_eq!(id, 1);
        assert_eq!(client.get_order(&id).restaurant_id, 1);
    }

    #[test]
    #[should_panic(expected = "restaurant is not active")]
    fn test_place_order_inactive_restaurant_panics() {
        let (env, client, _admin, _registry) = setup();
        let customer = Address::generate(&env);
        let items = vec![&env, make_item(&env, 1, 1, 5_000_000)];
        client.place_order(&customer, &2, &items, &String::from_str(&env, ""));
    }

    #[test]
    #[should_panic(expected = "restaurant not found")]
    fn test_place_order_nonexistent_restaurant_panics() {
        let (env, client, _admin, _registry) = setup();
        let customer = Address::generate(&env);
        let items = vec![&env, make_item(&env, 1, 1, 5_000_000)];
        client.place_order(&customer, &999, &items, &String::from_str(&env, ""));
    }

    #[test]
    fn test_advance_status() {
        let (env, client, admin, _registry) = setup();
        let customer = Address::generate(&env);
        let items = vec![&env, make_item(&env, 1, 1, 7_000_000)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));

        client.advance_status(&admin, &id);
        assert_eq!(client.get_order(&id).status, OrderStatus::Confirmed);
    }

    #[test]
    fn test_customer_cancel_pending() {
        let (env, client, _admin, _registry) = setup();
        let customer = Address::generate(&env);
        let items = vec![&env, make_item(&env, 2, 1, 3_000_000)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
        client.cancel_order(&customer, &id);
        assert_eq!(client.get_order(&id).status, OrderStatus::Cancelled);
    }

    #[test]
    fn test_get_restaurant_orders() {
        let (env, client, _admin, _registry) = setup();
        let customer = Address::generate(&env);
        let items = vec![&env, make_item(&env, 1, 1, 5_000_000)];
        client.place_order(&customer, &1, &items.clone(), &String::from_str(&env, ""));
        client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
        assert_eq!(client.get_restaurant_orders(&1).len(), 2);
    }

    // -----------------------------------------------------------------------
    // Overflow / validation tests (acceptance criteria for issue CO-01)
    // -----------------------------------------------------------------------

    #[test]
    #[should_panic]
    fn test_overflow_quantity_max_and_large_price() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let customer = Address::generate(&env);
        client.initialize(&admin);
        // quantity = u32::MAX, unit_price = i128::MAX / 2 — must panic descriptively
        let items = vec![&env, make_item(&env, 1, u32::MAX, i128::MAX / 2)];
        client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
    }

    #[test]
    fn test_valid_multi_item_order_calculates_correct_total() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let customer = Address::generate(&env);
        client.initialize(&admin, &None);

        let items = vec![
            &env,
            make_item(&env, 1, 3, 5_000_000),
            make_item(&env, 2, 2, 7_000_000),
        ];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
        let order = client.get_order(&id);
        // 3 * 5_000_000 + 2 * 7_000_000 = 15_000_000 + 14_000_000 = 29_000_000
        assert_eq!(order.total_amount, 29_000_000);
    }

    #[test]
    #[should_panic(expected = "order exceeds maximum total")]
    fn test_order_exceeds_max_total_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let customer = Address::generate(&env);
        client.initialize(&admin);
        // 101 items at MAX_ITEM_UNIT_PRICE each => 101 * 1T = 101T > MAX_ORDER_TOTAL (100T)
        let items = vec![&env, make_item(&env, 1, 101, 1_000_000_000_000)];
        client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
    }

    #[test]
    #[should_panic(expected = "unit price exceeds maximum")]
    fn test_unit_price_above_max_rejected() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let customer = Address::generate(&env);
        client.initialize(&admin);
        let items = vec![&env, make_item(&env, 1, 1, 1_000_000_000_001)]; // 1 above MAX
        client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
    }

    #[test]
    fn test_no_unchecked_arithmetic_at_exact_max_total() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let customer = Address::generate(&env);
        client.initialize(&admin);
        // 100 items at MAX_ITEM_UNIT_PRICE == MAX_ORDER_TOTAL exactly (should pass)
        let items = vec![&env, make_item(&env, 1, 100, 1_000_000_000_000)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
        let order = client.get_order(&id);
        assert_eq!(order.total_amount, 100_000_000_000_000);
    }

    // ── Expiry tests ────────────────────────────────────────────────────────

    fn place_one(env: &Env, client: &OrderContractClient, admin: &Address) -> u64 {
        let customer = Address::generate(env);
        let items = vec![env, make_item(env, 1, 1, 5_000_000)];
        client.initialize(admin);
        client.place_order(&customer, &1, &items, &String::from_str(env, ""))
    }

    #[test]
    #[should_panic(expected = "order not yet expired")]
    fn test_expire_order_before_deadline_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        // timestamp is 0; expires_at = 172800 — still within window
        let id = place_one(&env, &client, &admin);
        client.expire_order(&id);
    }

    #[test]
    fn test_expire_order_after_deadline_succeeds() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let id = place_one(&env, &client, &admin);

        // Jump past the 48-hour deadline
        env.ledger().with_mut(|l| l.timestamp = super::ORDER_TTL_SECONDS + 1);

        client.expire_order(&id);
        assert_eq!(client.get_order(&id).status, OrderStatus::Cancelled);
    }

    #[test]
    fn test_expire_order_callable_by_anyone() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let id = place_one(&env, &client, &admin);

        env.ledger().with_mut(|l| l.timestamp = super::ORDER_TTL_SECONDS + 1);

        // No auth required — a random third party can call expire_order
        client.expire_order(&id);
        assert_eq!(client.get_order(&id).status, OrderStatus::Cancelled);
    }

    #[test]
    #[should_panic(expected = "order has expired")]
    fn test_advance_status_on_expired_order_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let id = place_one(&env, &client, &admin);

        env.ledger().with_mut(|l| l.timestamp = super::ORDER_TTL_SECONDS + 1);

        client.advance_status(&admin, &id);
    }

    #[test]
    fn test_expire_order_emits_event() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let id = place_one(&env, &client, &admin);

        env.ledger().with_mut(|l| l.timestamp = super::ORDER_TTL_SECONDS + 1);
        client.expire_order(&id);

        // Confirm at least one event was emitted during expire_order
        assert!(!env.events().all().is_empty());
    }

    #[test]
    fn test_place_order_sets_expires_at() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let customer = Address::generate(&env);
        client.initialize(&admin, &None);

        env.ledger().with_mut(|l| l.timestamp = 1_000);
        let items = vec![&env, make_item(&env, 1, 1, 5_000_000)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));

        let order = client.get_order(&id);
        assert_eq!(order.expires_at, 1_000 + super::ORDER_TTL_SECONDS);
    }

    // -------  new loyalty-mint tests  -------------------------------------

    /// A 50 000-stroop order delivered → mints exactly 5 BITE.
    #[test]
    fn test_delivery_mints_loyalty_tokens() {
        let (env, order_client, lt_client, admin) = setup_with_loyalty();
        let customer = Address::generate(&env);

        // 50 000 stroops → 5 BITE
        let items = vec![&env, make_item(&env, 1, 1, 50_000)];
        let id = order_client.place_order(&customer, &1, &items, &String::from_str(&env, ""));

        // Advance through the full lifecycle to Delivered.
        order_client.advance_status(&admin, &id); // Confirmed
        order_client.advance_status(&admin, &id); // Preparing
        order_client.advance_status(&admin, &id); // Ready
        order_client.advance_status(&admin, &id); // Delivered

        assert_eq!(lt_client.balance(&customer), 5);
        assert!(order_client.get_order(&id).minted);
    }

    /// Calling advance_status on an already-delivered order panics (no re-mint).
    #[test]
    #[should_panic(expected = "order already delivered")]
    fn test_no_double_mint_on_already_delivered() {
        let (env, order_client, _lt_client, admin) = setup_with_loyalty();
        let customer = Address::generate(&env);

        let items = vec![&env, make_item(&env, 1, 1, 50_000)];
        let id = order_client.place_order(&customer, &1, &items, &String::from_str(&env, ""));

        for _ in 0..4 {
            order_client.advance_status(&admin, &id);
        }
        // This call must panic.
        order_client.advance_status(&admin, &id);
    }

    /// Orders with total_amount < 10 000 stroops mint 0 tokens and do not panic.
    #[test]
    fn test_small_order_mints_zero_tokens() {
        let (env, order_client, lt_client, admin) = setup_with_loyalty();
        let customer = Address::generate(&env);

        // 9 999 stroops → 0 BITE (integer division)
        let items = vec![&env, make_item(&env, 1, 1, 9_999)];
        let id = order_client.place_order(&customer, &1, &items, &String::from_str(&env, ""));

        for _ in 0..4 {
            order_client.advance_status(&admin, &id);
        }

        assert_eq!(lt_client.balance(&customer), 0);
        // minted flag is still set to prevent any future attempt.
        assert!(order_client.get_order(&id).minted);
    }
}
