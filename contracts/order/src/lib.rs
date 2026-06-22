#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, IntoVal, String, Symbol,
    Vec,
};

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

        if items.is_empty() {
            panic!("order must contain at least one item");
        }

        // Cross-contract validation against the RestaurantRegistry.
        let registry_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::RestaurantRegistry)
            .expect("registry not set");

        let get_restaurant_sym = Symbol::new(&env, "get_restaurant");
        let restaurant_args = (restaurant_id,).into_val(&env);

        // `get_restaurant` panics with "restaurant not found" if unknown.
        #[contracttype]
        #[derive(Clone)]
        struct Restaurant {
            id: u64,
            owner: Address,
            name: String,
            slug: String,
            is_active: bool,
            created_at: u64,
        }

        let restaurant: Restaurant = env
            .invoke_contract(&registry_addr, &get_restaurant_sym, restaurant_args);

        if !restaurant.is_active {
            panic!("restaurant is not active");
        }

        let mut total: i128 = 0;
        for item in items.iter() {
            if item.quantity == 0 {
                panic!("quantity must be greater than zero");
            }
            if item.unit_price <= 0 {
                panic!("unit price must be positive");
            }
            total += item.unit_price * item.quantity as i128;
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

        order.status = match order.status {
            OrderStatus::Pending => OrderStatus::Confirmed,
            OrderStatus::Confirmed => OrderStatus::Preparing,
            OrderStatus::Preparing => OrderStatus::Ready,
            OrderStatus::Ready => OrderStatus::Delivered,
            OrderStatus::Delivered => panic!("order already delivered"),
            OrderStatus::Cancelled => panic!("cannot advance a cancelled order"),
        };
        order.updated_at = env.ledger().timestamp();
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
}
