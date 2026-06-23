//! # Order Contract
//!
//! Manages food orders placed by customers on the restaurant platform.
//! Orders progress through a well-defined lifecycle and emit events at each
//! transition so that off-chain indexers can stay in sync.
//!
//! ## Order lifecycle
//! ```text
//! Pending ──► Confirmed ──► Preparing ──► Ready ──► Delivered
//!    │              │
//!    └──────────────┴──────────────────────────────► Cancelled
//! ```
//!
//! ## Roles
//! - **Admin** – contract deployer; full control.
//! - **Restaurant owner** – confirms, updates, and marks orders as ready/delivered
//!   for orders belonging to their restaurant.
//! - **Customer** – places an order; can cancel while it is still `Pending`.

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, String, Vec,
};

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

/// On-chain menu item registration — the authoritative source of price truth.
#[contracttype]
#[derive(Clone)]
pub struct MenuItem {
    pub menu_item_id: u64,
    pub restaurant_id: u64,
    pub name: String,
    /// Authoritative price in stroops (1 XLM = 10_000_000 stroops).
    pub price: i128,
}

/// Price snapshot captured at order time — immutable historical record.
#[contracttype]
#[derive(Clone)]
pub struct MenuItemSnapshot {
    pub menu_item_id: u64,
    pub name: String,
    pub price_at_order: i128,
}

/// A single line-item in an order.
///
/// `unit_price` mirrors `snapshot.price_at_order` for convenience; the
/// snapshot is the authoritative record.
#[contracttype]
#[derive(Clone)]
pub struct OrderItem {
    /// Backend menu-item primary key for cross-system correlation.
    pub menu_item_id: u64,
    /// Snapshot of the item name at time of ordering.
    pub name: String,
    /// Number of portions ordered.
    pub quantity: u32,
    /// Authoritative price per unit captured from the on-chain registry at
    /// order time.  Caller-supplied values are ignored.
    pub unit_price: i128,
    /// Full snapshot: name + authoritative price at order time.
    pub snapshot: MenuItemSnapshot,
}

/// A complete order stored on-chain.
#[contracttype]
#[derive(Clone)]
pub struct Order {
    pub id: u64,
    pub restaurant_id: u64,
    pub customer: Address,
    pub items: Vec<OrderItem>,
    /// Sum of (quantity * snapshot.price_at_order) for all items, in stroops.
    pub total_amount: i128,
    pub status: OrderStatus,
    pub created_at: u64,
    pub updated_at: u64,
    /// Optional delivery/special instructions.
    pub notes: String,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[contracttype]
pub enum DataKey {
    Admin,
    Count,
    Order(u64),
    /// Ordered list of order IDs for a restaurant (for pagination off-chain).
    RestaurantOrders(u64),
    /// Ordered list of order IDs for a customer.
    CustomerOrders(Address),
    /// Menu item keyed by (restaurant_id, menu_item_id).
    MenuItem(u64, u64),
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct OrderContract;

#[contractimpl]
impl OrderContract {
    // -----------------------------------------------------------------------
    // Initialisation
    // -----------------------------------------------------------------------

    /// Deploy and initialise the order contract.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Count, &0u64);
        env.storage().instance().extend_ttl(17_280, 17_280);
    }

    // -----------------------------------------------------------------------
    // Menu registry (admin only)
    // -----------------------------------------------------------------------

    /// Register or update a menu item with its authoritative price.
    ///
    /// Only the admin may call this.  In production the restaurant registry
    /// could be consulted to allow restaurant owners to manage their own menus.
    pub fn register_menu_item(
        env: Env,
        caller: Address,
        restaurant_id: u64,
        menu_item_id: u64,
        name: String,
        price: i128,
    ) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);

        if price <= 0 {
            panic!("price must be positive");
        }

        let item = MenuItem {
            menu_item_id,
            restaurant_id,
            name,
            price,
        };

        let ttl: u32 = 2_073_600;
        env.storage()
            .persistent()
            .set(&DataKey::MenuItem(restaurant_id, menu_item_id), &item);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::MenuItem(restaurant_id, menu_item_id), ttl, ttl);
    }

    /// Remove a menu item from a restaurant's menu (admin only).
    pub fn remove_menu_item(
        env: Env,
        caller: Address,
        restaurant_id: u64,
        menu_item_id: u64,
    ) {
        caller.require_auth();
        Self::assert_admin_or_panic(&env, &caller);
        env.storage()
            .persistent()
            .remove(&DataKey::MenuItem(restaurant_id, menu_item_id));
    }

    /// Fetch a registered menu item.
    pub fn get_menu_item(env: Env, restaurant_id: u64, menu_item_id: u64) -> MenuItem {
        env.storage()
            .persistent()
            .get(&DataKey::MenuItem(restaurant_id, menu_item_id))
            .unwrap_or_else(|| panic!("item not on menu"))
    }

    // -----------------------------------------------------------------------
    // Customer actions
    // -----------------------------------------------------------------------

    /// Place a new order.
    ///
    /// For each item, the contract validates that `menu_item_id` belongs to
    /// `restaurant_id` in the on-chain registry and captures the authoritative
    /// price as a `MenuItemSnapshot`.  Any caller-supplied `unit_price` is
    /// ignored — the registry price is always used.
    ///
    /// # Arguments
    /// - `customer`       – wallet placing the order (must sign the tx).
    /// - `restaurant_id`  – target restaurant (registered in the registry).
    /// - `items`          – non-empty list of line items (only `menu_item_id`
    ///                      and `quantity` are read; `unit_price` is ignored).
    /// - `notes`          – optional delivery / allergy notes.
    ///
    /// # Returns
    /// The auto-assigned order ID.
    ///
    /// # Panics
    /// - `"order must contain at least one item"`
    /// - `"quantity must be greater than zero"`
    /// - `"item not on menu"` – if the item does not exist for this restaurant
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

        let ttl: u32 = 2_073_600;
        let mut validated_items: Vec<OrderItem> = vec![&env];
        let mut total: i128 = 0;

        for item in items.iter() {
            if item.quantity == 0 {
                panic!("quantity must be greater than zero");
            }

            // Validate item belongs to this restaurant and retrieve authoritative price.
            let menu_item: MenuItem = env
                .storage()
                .persistent()
                .get(&DataKey::MenuItem(restaurant_id, item.menu_item_id))
                .unwrap_or_else(|| panic!("item not on menu"));

            let price_at_order = menu_item.price;
            let snapshot = MenuItemSnapshot {
                menu_item_id: item.menu_item_id,
                name: menu_item.name.clone(),
                price_at_order,
            };

            let validated_item = OrderItem {
                menu_item_id: item.menu_item_id,
                name: menu_item.name,
                quantity: item.quantity,
                unit_price: price_at_order, // always from registry, never from caller
                snapshot,
            };

            total += price_at_order * item.quantity as i128;
            validated_items.push_back(validated_item);
        }

        let count: u64 = env.storage().instance().get(&DataKey::Count).unwrap_or(0);
        let id: u64 = count + 1;
        let now = env.ledger().timestamp();

        let order = Order {
            id,
            restaurant_id,
            customer: customer.clone(),
            items: validated_items,
            total_amount: total,
            status: OrderStatus::Pending,
            created_at: now,
            updated_at: now,
            notes,
        };

        env.storage().persistent().set(&DataKey::Order(id), &order);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Order(id), ttl, ttl);

        // Append to restaurant index.
        Self::append_to_list(&env, DataKey::RestaurantOrders(restaurant_id), id, ttl);
        // Append to customer index.
        Self::append_to_list(&env, DataKey::CustomerOrders(customer.clone()), id, ttl);

        env.storage().instance().set(&DataKey::Count, &id);
        env.storage().instance().extend_ttl(17_280, 17_280);

        env.events().publish(
            (symbol_short!("placed"), symbol_short!("order")),
            (id, restaurant_id, customer, total),
        );

        id
    }

    /// Cancel an order.
    ///
    /// - Customers may cancel while the order is `Pending`.
    /// - The admin may cancel at any time (for dispute resolution).
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

    // -----------------------------------------------------------------------
    // Restaurant / Admin actions
    // -----------------------------------------------------------------------

    /// Advance the order to the next status in the lifecycle.
    ///
    /// Only the contract admin may call this; in production you would add a
    /// check against the restaurant registry to allow restaurant owners too.
    ///
    /// Valid transitions (in order):
    /// `Pending → Confirmed → Preparing → Ready → Delivered`
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

    /// Directly set an order's status (admin only – for dispute resolution).
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

    // -----------------------------------------------------------------------
    // View functions
    // -----------------------------------------------------------------------

    /// Fetch a single order by ID.
    pub fn get_order(env: Env, order_id: u64) -> Order {
        Self::load_order(&env, order_id)
    }

    /// Return a list of order IDs for a restaurant.
    pub fn get_restaurant_orders(env: Env, restaurant_id: u64) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::RestaurantOrders(restaurant_id))
            .unwrap_or_else(|| vec![&env])
    }

    /// Return a list of order IDs for a customer.
    pub fn get_customer_orders(env: Env, customer: Address) -> Vec<u64> {
        env.storage()
            .persistent()
            .get(&DataKey::CustomerOrders(customer))
            .unwrap_or_else(|| vec![&env])
    }

    /// Total orders ever placed.
    pub fn get_count(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Count).unwrap_or(0)
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{vec, Env, String};

    /// Build a minimal OrderItem. `unit_price` is intentionally wrong to prove
    /// place_order ignores it and uses the registry price instead.
    fn make_item(env: &Env, id: u64, qty: u32) -> OrderItem {
        let snap = MenuItemSnapshot {
            menu_item_id: id,
            name: String::from_str(env, ""),
            price_at_order: 0,
        };
        OrderItem {
            menu_item_id: id,
            name: String::from_str(env, ""),
            quantity: qty,
            unit_price: 1, // deliberately wrong — should be ignored
            snapshot: snap,
        }
    }

    fn setup() -> (Env, OrderContractClient<'static>, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let cid = env.register(OrderContract, ());
        let client = OrderContractClient::new(&env, &cid);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, client, admin)
    }

    /// Register a menu item for a restaurant and return its registered price.
    fn register(
        client: &OrderContractClient,
        admin: &Address,
        env: &Env,
        restaurant_id: u64,
        item_id: u64,
        price: i128,
    ) {
        client.register_menu_item(
            admin,
            &restaurant_id,
            &item_id,
            &String::from_str(env, "Jollof Rice"),
            &price,
        );
    }

    // -----------------------------------------------------------------------
    // Price snapshot tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_place_order_uses_registry_price_not_caller_price() {
        let (env, client, admin) = setup();
        let customer = Address::generate(&env);

        // Register item with authoritative price 50_000_000 stroops.
        register(&client, &admin, &env, 1, 10, 50_000_000);

        // Customer submits unit_price=1 (far too low) — should be ignored.
        let items = vec![&env, make_item(&env, 10, 1)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));

        let order = client.get_order(&id);
        // Total must use registry price, not caller-supplied 1.
        assert_eq!(order.total_amount, 50_000_000);
        assert_eq!(order.items.get(0).unwrap().unit_price, 50_000_000);
        assert_eq!(order.items.get(0).unwrap().snapshot.price_at_order, 50_000_000);
    }

    #[test]
    fn test_snapshot_stored_in_order_item() {
        let (env, client, admin) = setup();
        let customer = Address::generate(&env);

        register(&client, &admin, &env, 1, 42, 7_000_000);

        let items = vec![&env, make_item(&env, 42, 2)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));

        let order = client.get_order(&id);
        let item = order.items.get(0).unwrap();
        assert_eq!(item.snapshot.menu_item_id, 42);
        assert_eq!(item.snapshot.price_at_order, 7_000_000);
        // Total = 2 × 7_000_000
        assert_eq!(order.total_amount, 14_000_000);
    }

    // -----------------------------------------------------------------------
    // Restaurant-scoped validation tests
    // -----------------------------------------------------------------------

    #[test]
    #[should_panic(expected = "item not on menu")]
    fn test_item_not_belonging_to_restaurant_panics() {
        let (env, client, admin) = setup();
        let customer = Address::generate(&env);

        // Register item 5 for restaurant 1, NOT for restaurant 2.
        register(&client, &admin, &env, 1, 5, 10_000_000);

        // Try to order item 5 for restaurant 2 → must panic.
        let items = vec![&env, make_item(&env, 5, 1)];
        client.place_order(&customer, &2, &items, &String::from_str(&env, ""));
    }

    #[test]
    #[should_panic(expected = "item not on menu")]
    fn test_unregistered_item_panics() {
        let (env, client, _admin) = setup();
        let customer = Address::generate(&env);

        // No items registered at all.
        let items = vec![&env, make_item(&env, 99, 1)];
        client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
    }

    // -----------------------------------------------------------------------
    // Existing behaviour preserved
    // -----------------------------------------------------------------------

    #[test]
    fn test_place_and_get_order() {
        let (env, client, admin) = setup();
        let customer = Address::generate(&env);

        register(&client, &admin, &env, 42, 1, 5_000_000);
        let items = vec![&env, make_item(&env, 1, 2)];
        let id = client.place_order(&customer, &42, &items, &String::from_str(&env, "No onions"));

        assert_eq!(id, 1);
        let order = client.get_order(&id);
        assert_eq!(order.total_amount, 10_000_000);
        assert_eq!(order.status, OrderStatus::Pending);
    }

    #[test]
    fn test_advance_status() {
        let (env, client, admin) = setup();
        let customer = Address::generate(&env);

        register(&client, &admin, &env, 1, 1, 7_000_000);
        let items = vec![&env, make_item(&env, 1, 1)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));

        client.advance_status(&admin, &id);
        assert_eq!(client.get_order(&id).status, OrderStatus::Confirmed);
        client.advance_status(&admin, &id);
        assert_eq!(client.get_order(&id).status, OrderStatus::Preparing);
        client.advance_status(&admin, &id);
        assert_eq!(client.get_order(&id).status, OrderStatus::Ready);
        client.advance_status(&admin, &id);
        assert_eq!(client.get_order(&id).status, OrderStatus::Delivered);
    }

    #[test]
    fn test_customer_cancel_pending() {
        let (env, client, admin) = setup();
        let customer = Address::generate(&env);

        register(&client, &admin, &env, 1, 2, 3_000_000);
        let items = vec![&env, make_item(&env, 2, 1)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));

        client.cancel_order(&customer, &id);
        assert_eq!(client.get_order(&id).status, OrderStatus::Cancelled);
    }

    #[test]
    #[should_panic(expected = "customers may only cancel pending orders")]
    fn test_customer_cannot_cancel_confirmed() {
        let (env, client, admin) = setup();
        let customer = Address::generate(&env);

        register(&client, &admin, &env, 1, 1, 5_000_000);
        let items = vec![&env, make_item(&env, 1, 1)];
        let id = client.place_order(&customer, &1, &items, &String::from_str(&env, ""));
        client.advance_status(&admin, &id);
        client.cancel_order(&customer, &id);
    }

    #[test]
    fn test_get_restaurant_orders() {
        let (env, client, admin) = setup();
        let customer = Address::generate(&env);

        register(&client, &admin, &env, 7, 1, 5_000_000);
        let items = vec![&env, make_item(&env, 1, 1)];
        client.place_order(&customer, &7, &items.clone(), &String::from_str(&env, ""));
        client.place_order(&customer, &7, &items, &String::from_str(&env, ""));

        let orders = client.get_restaurant_orders(&7);
        assert_eq!(orders.len(), 2);
    }
}
