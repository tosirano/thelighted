//! # Restaurant Registry Contract
//!
//! On-chain registry for the multi-tenant restaurant platform.
//! Each restaurant registers here and receives a unique u64 ID that is
//! used as a foreign key in the Order and Payment contracts.
//!
//! ## Roles
//! - **Admin** – contract deployer; can suspend/unsuspend any restaurant.
//! - **Owner** – the wallet that registered a restaurant; can update its
//!   own restaurant metadata and permanently close it.

#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String, Symbol};

// ---------------------------------------------------------------------------
// Storage types
// ---------------------------------------------------------------------------

/// On-chain representation of a registered restaurant.
#[contracttype]
#[derive(Clone)]
pub struct Restaurant {
    /// Auto-incrementing unique identifier.
    pub id: u64,
    /// Stellar address of the restaurant owner.
    pub owner: Address,
    /// Human-readable restaurant name.
    pub name: String,
    /// URL-safe slug used for subdomain routing.
    pub slug: String,
    /// Whether the restaurant is accepting orders.
    pub is_active: bool,
    /// Ledger timestamp of registration.
    pub created_at: u64,
    /// Address that performed the last deactivation (None if currently active).
    pub deactivated_by: Option<Address>,
    /// Ledger timestamp of the last deactivation (None if currently active).
    pub deactivated_at: Option<u64>,
}

/// Storage key discriminants.
#[contracttype]
pub enum DataKey {
    /// Singleton: contract admin address.
    Admin,
    /// Singleton: total number of registered restaurants.
    Count,
    /// Per-restaurant data keyed by numeric ID.
    Restaurant(u64),
    /// Reverse lookup: owner address → restaurant ID.
    OwnerToId(Address),
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct RestaurantRegistry;

#[contractimpl]
impl RestaurantRegistry {
    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /// Initialise the registry.  Must be called once by the deployer.
    ///
    /// # Panics
    /// Panics if the contract has already been initialised.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Count, &0u64);
        env.storage().instance().extend_ttl(17_280, 17_280);
    }

    // -----------------------------------------------------------------------
    // Writes
    // -----------------------------------------------------------------------

    /// Register a new restaurant. The caller becomes the owner.
    ///
    /// # Returns
    /// The newly assigned restaurant ID (starts at 1).
    ///
    /// # Panics
    /// - If the owner already has a registered restaurant.
    pub fn register_restaurant(env: Env, owner: Address, name: String, slug: String) -> u64 {
        owner.require_auth();

        if env
            .storage()
            .persistent()
            .has(&DataKey::OwnerToId(owner.clone()))
        {
            panic!("owner already has a restaurant");
        }

        let count: u64 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let id: u64 = count + 1;

        let restaurant = Restaurant {
            id,
            owner: owner.clone(),
            name: name.clone(),
            slug: slug.clone(),
            is_active: true,
            created_at: env.ledger().timestamp(),
            deactivated_by: None,
            deactivated_at: None,
        };

        let ttl: u32 = 2_073_600;
        env.storage()
            .persistent()
            .set(&DataKey::Restaurant(id), &restaurant);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Restaurant(id), ttl, ttl);

        env.storage()
            .persistent()
            .set(&DataKey::OwnerToId(owner.clone()), &id);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::OwnerToId(owner.clone()), ttl, ttl);

        env.storage().instance().set(&DataKey::Count, &id);
        env.storage().instance().extend_ttl(17_280, 17_280);

        env.events().publish(
            (symbol_short!("register"), symbol_short!("rest")),
            (id, owner, name),
        );

        id
    }

    /// Update a restaurant's name and slug.
    ///
    /// Callable by the restaurant's own owner **or** the contract admin.
    pub fn update_restaurant(
        env: Env,
        caller: Address,
        restaurant_id: u64,
        name: String,
        slug: String,
    ) {
        caller.require_auth();

        let mut restaurant: Restaurant = env
            .storage()
            .persistent()
            .get(&DataKey::Restaurant(restaurant_id))
            .unwrap_or_else(|| panic!("restaurant not found"));

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != restaurant.owner && caller != admin {
            panic!("unauthorized");
        }

        restaurant.name = name.clone();
        restaurant.slug = slug;

        let ttl: u32 = 2_073_600;
        env.storage()
            .persistent()
            .set(&DataKey::Restaurant(restaurant_id), &restaurant);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Restaurant(restaurant_id), ttl, ttl);

        env.events().publish(
            (symbol_short!("update"), symbol_short!("rest")),
            (restaurant_id, name),
        );
    }

    /// Permanently close a restaurant. Only the restaurant's own owner may call this.
    ///
    /// This action is irreversible — the admin cannot reopen a voluntarily closed restaurant.
    ///
    /// # Panics
    /// - If `caller` is not the restaurant owner.
    pub fn owner_close_restaurant(env: Env, caller: Address, restaurant_id: u64) {
        caller.require_auth();

        let mut restaurant: Restaurant = env
            .storage()
            .persistent()
            .get(&DataKey::Restaurant(restaurant_id))
            .unwrap_or_else(|| panic!("restaurant not found"));

        if caller != restaurant.owner {
            panic!("unauthorized: only the restaurant owner can close their restaurant");
        }

        let now = env.ledger().timestamp();
        restaurant.is_active = false;
        restaurant.deactivated_by = Some(caller.clone());
        restaurant.deactivated_at = Some(now);

        let ttl: u32 = 2_073_600;
        env.storage()
            .persistent()
            .set(&DataKey::Restaurant(restaurant_id), &restaurant);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Restaurant(restaurant_id), ttl, ttl);

        env.events().publish(
            (symbol_short!("rest"), symbol_short!("close")),
            (restaurant_id, caller, now),
        );
    }

    /// Suspend a restaurant (recoverable). Only the contract admin may call this.
    ///
    /// # Panics
    /// - If `caller` is not the contract admin.
    pub fn admin_suspend_restaurant(
        env: Env,
        caller: Address,
        restaurant_id: u64,
        reason: Symbol,
    ) {
        caller.require_auth();

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic!("unauthorized: only the admin can suspend a restaurant");
        }

        let mut restaurant: Restaurant = env
            .storage()
            .persistent()
            .get(&DataKey::Restaurant(restaurant_id))
            .unwrap_or_else(|| panic!("restaurant not found"));

        let now = env.ledger().timestamp();
        restaurant.is_active = false;
        restaurant.deactivated_by = Some(caller.clone());
        restaurant.deactivated_at = Some(now);

        let ttl: u32 = 2_073_600;
        env.storage()
            .persistent()
            .set(&DataKey::Restaurant(restaurant_id), &restaurant);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Restaurant(restaurant_id), ttl, ttl);

        env.events().publish(
            (symbol_short!("rest"), symbol_short!("suspend")),
            (restaurant_id, caller, now, reason),
        );
    }

    /// Lift a suspension placed by the admin. Only the contract admin may call this.
    ///
    /// # Panics
    /// - If `caller` is not the contract admin.
    pub fn admin_unsuspend_restaurant(env: Env, caller: Address, restaurant_id: u64) {
        caller.require_auth();

        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if caller != admin {
            panic!("unauthorized: only the admin can unsuspend a restaurant");
        }

        let mut restaurant: Restaurant = env
            .storage()
            .persistent()
            .get(&DataKey::Restaurant(restaurant_id))
            .unwrap_or_else(|| panic!("restaurant not found"));

        let now = env.ledger().timestamp();
        restaurant.is_active = true;
        restaurant.deactivated_by = None;
        restaurant.deactivated_at = None;

        let ttl: u32 = 2_073_600;
        env.storage()
            .persistent()
            .set(&DataKey::Restaurant(restaurant_id), &restaurant);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Restaurant(restaurant_id), ttl, ttl);

        env.events().publish(
            (symbol_short!("rest"), symbol_short!("unsuspnd")),
            (restaurant_id, caller, now),
        );
    }

    // -----------------------------------------------------------------------
    // Reads (view)
    // -----------------------------------------------------------------------

    /// Fetch a restaurant by its numeric ID.
    pub fn get_restaurant(env: Env, restaurant_id: u64) -> Restaurant {
        env.storage()
            .persistent()
            .get(&DataKey::Restaurant(restaurant_id))
            .unwrap_or_else(|| panic!("restaurant not found"))
    }

    /// Return the restaurant ID owned by `owner`.
    pub fn get_owner_restaurant(env: Env, owner: Address) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::OwnerToId(owner))
            .unwrap_or_else(|| panic!("no restaurant for this owner"))
    }

    /// Total number of restaurants registered.
    pub fn get_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    /// Return the admin address.
    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::Env;

    fn setup() -> (Env, RestaurantRegistryClient<'static>) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(RestaurantRegistry, ());
        let client = RestaurantRegistryClient::new(&env, &contract_id);
        (env, client)
    }

    fn register_one(env: &Env, client: &RestaurantRegistryClient, admin: &Address) -> (Address, u64) {
        let owner = Address::generate(env);
        client.initialize(admin);
        let id = client.register_restaurant(
            &owner,
            &String::from_str(env, "Mama's Kitchen"),
            &String::from_str(env, "mamas-kitchen"),
        );
        (owner, id)
    }

    #[test]
    fn test_register_and_get() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let owner = Address::generate(&env);

        client.initialize(&admin);

        let id = client.register_restaurant(
            &owner,
            &String::from_str(&env, "Mama's Kitchen"),
            &String::from_str(&env, "mamas-kitchen"),
        );
        assert_eq!(id, 1);

        let rest = client.get_restaurant(&id);
        assert_eq!(rest.owner, owner);
        assert_eq!(rest.name, String::from_str(&env, "Mama's Kitchen"));
        assert!(rest.is_active);
        assert!(rest.deactivated_by.is_none());
        assert!(rest.deactivated_at.is_none());
    }

    #[test]
    fn test_update_restaurant() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let owner = Address::generate(&env);

        client.initialize(&admin);
        let id = client.register_restaurant(
            &owner,
            &String::from_str(&env, "Old Name"),
            &String::from_str(&env, "old-name"),
        );

        client.update_restaurant(
            &owner,
            &id,
            &String::from_str(&env, "New Name"),
            &String::from_str(&env, "new-name"),
        );

        let rest = client.get_restaurant(&id);
        assert_eq!(rest.name, String::from_str(&env, "New Name"));
    }

    // -----------------------------------------------------------------------
    // owner_close_restaurant
    // -----------------------------------------------------------------------

    #[test]
    fn test_owner_can_close_own_restaurant() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let (owner, id) = register_one(&env, &client, &admin);

        client.owner_close_restaurant(&owner, &id);

        let rest = client.get_restaurant(&id);
        assert!(!rest.is_active);
        assert_eq!(rest.deactivated_by, Some(owner));
        assert!(rest.deactivated_at.is_some());
    }

    #[test]
    #[should_panic(expected = "unauthorized: only the restaurant owner can close their restaurant")]
    fn test_admin_cannot_call_owner_close() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let (_owner, id) = register_one(&env, &client, &admin);

        // Admin tries to use the owner-only function — must panic
        client.owner_close_restaurant(&admin, &id);
    }

    // -----------------------------------------------------------------------
    // admin_suspend_restaurant / admin_unsuspend_restaurant
    // -----------------------------------------------------------------------

    #[test]
    fn test_admin_can_suspend_and_unsuspend() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let (_owner, id) = register_one(&env, &client, &admin);

        let reason = Symbol::new(&env, "policy");
        client.admin_suspend_restaurant(&admin, &id, &reason);

        let rest = client.get_restaurant(&id);
        assert!(!rest.is_active);
        assert_eq!(rest.deactivated_by, Some(admin.clone()));
        assert!(rest.deactivated_at.is_some());

        client.admin_unsuspend_restaurant(&admin, &id);

        let rest = client.get_restaurant(&id);
        assert!(rest.is_active);
        assert!(rest.deactivated_by.is_none());
        assert!(rest.deactivated_at.is_none());
    }

    #[test]
    #[should_panic(expected = "unauthorized: only the admin can suspend a restaurant")]
    fn test_owner_cannot_call_admin_suspend() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let (owner, id) = register_one(&env, &client, &admin);

        let reason = Symbol::new(&env, "policy");
        // Owner tries to use the admin-only suspend function — must panic
        client.admin_suspend_restaurant(&owner, &id, &reason);
    }

    // -----------------------------------------------------------------------
    // Legacy / other
    // -----------------------------------------------------------------------

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_init_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        client.initialize(&admin);
        client.initialize(&admin);
    }

    #[test]
    #[should_panic(expected = "owner already has a restaurant")]
    fn test_duplicate_owner_panics() {
        let (env, client) = setup();
        let admin = Address::generate(&env);
        let owner = Address::generate(&env);
        client.initialize(&admin);
        client.register_restaurant(
            &owner,
            &String::from_str(&env, "First"),
            &String::from_str(&env, "first"),
        );
        client.register_restaurant(
            &owner,
            &String::from_str(&env, "Second"),
            &String::from_str(&env, "second"),
        );
    }
}
