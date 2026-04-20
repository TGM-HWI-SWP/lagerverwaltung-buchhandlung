CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    notes TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    timestamp TEXT NOT NULL,
    performed_by TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    changes TEXT,
    reason TEXT
);

CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    avatar_image TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'cashier',
    pin_hash TEXT NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    CONSTRAINT ck_staff_users_pin_hash_non_empty CHECK (pin_hash <> '')
);

CREATE TABLE IF NOT EXISTS catalog_products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_prices (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    price_type TEXT NOT NULL DEFAULT 'standard' CHECK (price_type IN ('standard', 'seasonal', 'custom')),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    currency TEXT NOT NULL DEFAULT 'EUR',
    valid_from TEXT,
    valid_to TEXT,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES catalog_products(id)
);

CREATE TABLE IF NOT EXISTS warehouses (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_items (
    id TEXT PRIMARY KEY,
    warehouse_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    on_hand INTEGER NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
    reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    reorder_point INTEGER NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
    updated_at TEXT NOT NULL,
    UNIQUE (warehouse_id, product_id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    FOREIGN KEY (product_id) REFERENCES catalog_products(id)
);

CREATE TABLE IF NOT EXISTS stock_ledger_entries (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    warehouse_id TEXT NOT NULL,
    quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
    movement_type TEXT NOT NULL,
    reference_type TEXT NOT NULL DEFAULT '',
    reference_id TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL DEFAULT '',
    performed_by TEXT NOT NULL DEFAULT 'system',
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES catalog_products(id),
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE IF NOT EXISTS product_suppliers (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    supplier_sku TEXT NOT NULL DEFAULT '',
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    last_purchase_price NUMERIC NOT NULL DEFAULT 0 CHECK (last_purchase_price >= 0),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (product_id, supplier_id),
    FOREIGN KEY (product_id) REFERENCES catalog_products(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS discount_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('SEASONAL', 'FIRST_CUSTOMER', 'CUSTOM')),
    value_type TEXT NOT NULL CHECK (value_type IN ('PERCENT', 'FIXED')),
    value NUMERIC NOT NULL CHECK (value >= 0),
    min_order_amount NUMERIC NOT NULL DEFAULT 0 CHECK (min_order_amount >= 0),
    stackable INTEGER NOT NULL DEFAULT 0 CHECK (stackable IN (0, 1)),
    active_from TEXT,
    active_to TEXT,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_orders_v2 (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    supplier_id TEXT NOT NULL,
    created_by_user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ORDERED' CHECK (status IN ('ORDERED', 'PARTIAL_RECEIVED', 'RECEIVED')),
    notes TEXT NOT NULL DEFAULT '',
    ordered_at TEXT NOT NULL,
    received_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (created_by_user_id) REFERENCES staff_users(id)
);

CREATE TABLE IF NOT EXISTS purchase_order_v2_lines (
    id TEXT PRIMARY KEY,
    purchase_order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    received_quantity INTEGER NOT NULL DEFAULT 0 CHECK (received_quantity >= 0),
    unit_cost NUMERIC NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
    FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders_v2(id),
    FOREIGN KEY (product_id) REFERENCES catalog_products(id)
);

CREATE TABLE IF NOT EXISTS sales_orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    cashier_user_id TEXT NOT NULL,
    customer_reference TEXT NOT NULL DEFAULT '',
    warehouse_code TEXT NOT NULL DEFAULT 'STORE',
    is_first_customer INTEGER NOT NULL DEFAULT 0 CHECK (is_first_customer IN (0, 1)),
    subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_total NUMERIC NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
    total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    created_at TEXT NOT NULL,
    FOREIGN KEY (cashier_user_id) REFERENCES staff_users(id)
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
    id TEXT PRIMARY KEY,
    sales_order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    line_discount NUMERIC NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
    line_total NUMERIC NOT NULL DEFAULT 0 CHECK (line_total >= 0),
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (product_id) REFERENCES catalog_products(id)
);

CREATE TABLE IF NOT EXISTS sales_order_discounts (
    id TEXT PRIMARY KEY,
    sales_order_id TEXT NOT NULL,
    rule_id TEXT,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0 CHECK (amount >= 0),
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (rule_id) REFERENCES discount_rules(id)
);

CREATE TABLE IF NOT EXISTS return_orders (
    id TEXT PRIMARY KEY,
    return_number TEXT NOT NULL UNIQUE,
    sales_order_id TEXT NOT NULL,
    processed_by_user_id TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    refund_total NUMERIC NOT NULL DEFAULT 0 CHECK (refund_total >= 0),
    created_at TEXT NOT NULL,
    FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
    FOREIGN KEY (processed_by_user_id) REFERENCES staff_users(id)
);

CREATE TABLE IF NOT EXISTS return_order_lines (
    id TEXT PRIMARY KEY,
    return_order_id TEXT NOT NULL,
    sales_order_line_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    refund_amount NUMERIC NOT NULL DEFAULT 0 CHECK (refund_amount >= 0),
    exchange_product_id TEXT,
    exchange_quantity INTEGER NOT NULL DEFAULT 0 CHECK (exchange_quantity >= 0),
    FOREIGN KEY (return_order_id) REFERENCES return_orders(id),
    FOREIGN KEY (sales_order_line_id) REFERENCES sales_order_lines(id),
    FOREIGN KEY (exchange_product_id) REFERENCES catalog_products(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    actor_user_id TEXT,
    payload TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    FOREIGN KEY (actor_user_id) REFERENCES staff_users(id)
);

CREATE INDEX IF NOT EXISTS ix_catalog_products_title ON catalog_products (title);
CREATE INDEX IF NOT EXISTS ix_product_prices_product_id ON product_prices (product_id);
CREATE INDEX IF NOT EXISTS ix_stock_items_product_id ON stock_items (product_id);
CREATE INDEX IF NOT EXISTS ix_stock_items_warehouse_id ON stock_items (warehouse_id);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_product_id ON stock_ledger_entries (product_id);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_warehouse_id ON stock_ledger_entries (warehouse_id);
CREATE INDEX IF NOT EXISTS ix_stock_ledger_created_at ON stock_ledger_entries (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_product_suppliers_product_id ON product_suppliers (product_id);
CREATE INDEX IF NOT EXISTS ix_product_suppliers_supplier_id ON product_suppliers (supplier_id);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_v2_status ON purchase_orders_v2 (status);
CREATE INDEX IF NOT EXISTS ix_purchase_order_v2_lines_order_id ON purchase_order_v2_lines (purchase_order_id);
CREATE INDEX IF NOT EXISTS ix_sales_orders_created_at ON sales_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS ix_sales_order_lines_order_id ON sales_order_lines (sales_order_id);
CREATE INDEX IF NOT EXISTS ix_activity_logs_timestamp ON activity_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS ix_activity_logs_entity ON activity_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_events_created_at ON audit_events (created_at DESC);

INSERT INTO suppliers (id, name, contact, address, notes, created_at) VALUES
('S001', 'Buchgroßhandel Wien GmbH', 'kontakt@bgh-wien.at', 'Mariahilfer Straße 100, 1060 Wien', 'Hauptlieferant für den Kernkatalog', '2026-04-20T08:00:00+00:00'),
('S002', 'Thalia Partnervertrieb', 'partner@thalia.at', 'Mariahilfer Straße 30, 1060 Wien', 'Alternativer Lieferant für Bestseller', '2026-04-20T08:00:00+00:00'),
('S003', 'Campus Fachbuch Versand', 'info@campus-fachbuch.at', 'Favoritenstraße 12, 1040 Wien', 'Fach- und IT-Bücher', '2026-04-20T08:00:00+00:00');

INSERT INTO staff_users (id, username, display_name, avatar_image, role, pin_hash, password_hash, is_active) VALUES
('U-DEMO001', 'kasse.demo', 'Demo Kasse', '', 'cashier', 'demo-pin-hash', '', 1),
('U-DEMO002', 'admin.demo', 'Demo Admin', '', 'admin', 'demo-admin-pin', 'demo-admin-password-hash', 1);

INSERT INTO warehouses (id, code, name, is_active, created_at) VALUES
('WH-STORE', 'STORE', 'Verkaufsfläche', 1, '2026-04-20T08:00:00+00:00'),
('WH-BACK', 'BACK', 'Lager hinten', 1, '2026-04-20T08:00:00+00:00'),
('WH-EVENT', 'EVENT', 'Eventlager', 1, '2026-04-20T08:00:00+00:00');

INSERT INTO catalog_products (id, sku, title, author, description, category, is_active, created_at, updated_at) VALUES
('CP001', 'ISBN-9783608939812', 'Der Herr der Ringe', 'J. R. R. Tolkien', 'Fantasy-Epos in hochwertiger Ausgabe.', 'Fantasy', 1, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('CP002', 'ISBN-9783551354013', 'Harry Potter und der Stein der Weisen', 'J. K. Rowling', 'Erster Band der Reihe.', 'Fantasy', 1, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('CP003', 'ISBN-9783548234100', '1984', 'George Orwell', 'Dystopie über Überwachung und Macht.', 'Dystopie', 1, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('CP004', 'ISBN-9783150099001', 'Die Verwandlung', 'Franz Kafka', 'Klassiker für Schule und Literaturkurs.', 'Klassiker', 1, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('CP005', 'ISBN-9780132350884', 'Clean Code', 'Robert C. Martin', 'Leitfaden für saubere Softwareentwicklung.', 'Fachbuch', 1, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('CP006', 'ISBN-9783421045959', 'Sapiens', 'Yuval Noah Harari', 'Kurze Geschichte der Menschheit.', 'Sachbuch', 1, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00');

INSERT INTO product_prices (id, product_id, price_type, amount, currency, valid_from, valid_to, priority, is_active, created_at) VALUES
('PR001', 'CP001', 'standard', 29.99, 'EUR', NULL, NULL, 0, 1, '2026-04-20T08:00:00+00:00'),
('PR002', 'CP002', 'standard', 14.99, 'EUR', NULL, NULL, 0, 1, '2026-04-20T08:00:00+00:00'),
('PR003', 'CP003', 'standard', 12.99, 'EUR', NULL, NULL, 0, 1, '2026-04-20T08:00:00+00:00'),
('PR004', 'CP004', 'standard', 8.50, 'EUR', NULL, NULL, 0, 1, '2026-04-20T08:00:00+00:00'),
('PR005', 'CP005', 'standard', 34.99, 'EUR', NULL, NULL, 0, 1, '2026-04-20T08:00:00+00:00'),
('PR006', 'CP006', 'standard', 16.99, 'EUR', NULL, NULL, 0, 1, '2026-04-20T08:00:00+00:00');

INSERT INTO stock_items (id, warehouse_id, product_id, on_hand, reserved, reorder_point, updated_at) VALUES
('ST001', 'WH-STORE', 'CP001', 8, 0, 3, '2026-04-20T08:00:00+00:00'),
('ST002', 'WH-BACK', 'CP001', 12, 0, 5, '2026-04-20T08:00:00+00:00'),
('ST003', 'WH-STORE', 'CP002', 15, 0, 4, '2026-04-20T08:00:00+00:00'),
('ST004', 'WH-BACK', 'CP003', 10, 0, 3, '2026-04-20T08:00:00+00:00'),
('ST005', 'WH-STORE', 'CP004', 4, 0, 3, '2026-04-20T08:00:00+00:00'),
('ST006', 'WH-BACK', 'CP004', 6, 0, 3, '2026-04-20T08:00:00+00:00'),
('ST007', 'WH-STORE', 'CP005', 3, 0, 2, '2026-04-20T08:00:00+00:00'),
('ST008', 'WH-BACK', 'CP005', 7, 0, 2, '2026-04-20T08:00:00+00:00'),
('ST009', 'WH-STORE', 'CP006', 9, 0, 3, '2026-04-20T08:00:00+00:00'),
('ST010', 'WH-EVENT', 'CP006', 5, 0, 1, '2026-04-20T08:00:00+00:00');

INSERT INTO product_suppliers (id, product_id, supplier_id, supplier_sku, is_primary, last_purchase_price, created_at, updated_at) VALUES
('PS001', 'CP001', 'S001', 'BGH-RINGE', 1, 20.99, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('PS002', 'CP001', 'S002', 'THALIA-RINGE', 0, 21.49, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('PS003', 'CP002', 'S001', 'BGH-HP1', 1, 10.49, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('PS004', 'CP003', 'S001', 'BGH-1984', 1, 9.09, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('PS005', 'CP004', 'S001', 'BGH-KAFKA', 1, 5.95, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('PS006', 'CP005', 'S003', 'CAMPUS-CC', 1, 24.49, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00'),
('PS007', 'CP006', 'S001', 'BGH-SAPIENS', 1, 11.89, '2026-04-20T08:00:00+00:00', '2026-04-20T08:00:00+00:00');

INSERT INTO discount_rules (id, name, rule_type, value_type, value, min_order_amount, stackable, active_from, active_to, is_active, created_at) VALUES
('DR001', 'Frühlingsrabatt', 'SEASONAL', 'PERCENT', 10, 0, 0, NULL, NULL, 1, '2026-04-20T08:00:00+00:00'),
('DR002', 'Erstkundenbonus', 'FIRST_CUSTOMER', 'PERCENT', 5, 0, 1, NULL, NULL, 1, '2026-04-20T08:00:00+00:00');

INSERT INTO stock_ledger_entries (id, product_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, reason, performed_by, created_at) VALUES
('LG001', 'CP001', 'WH-STORE', 8, 'INITIAL_LOAD', 'seed', 'seed-001', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00'),
('LG002', 'CP001', 'WH-BACK', 12, 'INITIAL_LOAD', 'seed', 'seed-002', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00'),
('LG003', 'CP002', 'WH-STORE', 15, 'INITIAL_LOAD', 'seed', 'seed-003', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00'),
('LG004', 'CP003', 'WH-BACK', 10, 'INITIAL_LOAD', 'seed', 'seed-004', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00'),
('LG005', 'CP004', 'WH-STORE', 4, 'INITIAL_LOAD', 'seed', 'seed-005', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00'),
('LG006', 'CP004', 'WH-BACK', 6, 'INITIAL_LOAD', 'seed', 'seed-006', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00'),
('LG007', 'CP005', 'WH-STORE', 3, 'INITIAL_LOAD', 'seed', 'seed-007', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00'),
('LG008', 'CP005', 'WH-BACK', 7, 'INITIAL_LOAD', 'seed', 'seed-008', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00'),
('LG009', 'CP006', 'WH-STORE', 9, 'INITIAL_LOAD', 'seed', 'seed-009', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00'),
('LG010', 'CP006', 'WH-EVENT', 5, 'INITIAL_LOAD', 'seed', 'seed-010', 'Startbestand', 'system', '2026-04-20T08:00:00+00:00');

INSERT INTO purchase_orders_v2 (id, order_number, supplier_id, created_by_user_id, status, notes, ordered_at, received_at) VALUES
('PO2001', 'PO2-20260420-001', 'S001', 'U-DEMO002', 'PARTIAL_RECEIVED', 'Nachschub für Fantasy und Klassiker', '2026-04-20T08:30:00+00:00', NULL),
('PO2002', 'PO2-20260420-002', 'S003', 'U-DEMO002', 'ORDERED', 'Fachbuch-Aktion', '2026-04-20T09:00:00+00:00', NULL);

INSERT INTO purchase_order_v2_lines (id, purchase_order_id, product_id, quantity, received_quantity, unit_cost) VALUES
('POL2001', 'PO2001', 'CP001', 6, 3, 20.99),
('POL2002', 'PO2001', 'CP004', 8, 4, 5.95),
('POL2003', 'PO2002', 'CP005', 10, 0, 24.49);

INSERT INTO sales_orders (id, order_number, cashier_user_id, customer_reference, warehouse_code, is_first_customer, subtotal, discount_total, total, status, created_at) VALUES
('SO001', 'SO-20260420-001', 'U-DEMO001', '', 'STORE', 0, 29.99, 0, 29.99, 'COMPLETED', '2026-04-20T10:00:00+00:00');

INSERT INTO sales_order_lines (id, sales_order_id, product_id, product_name, quantity, unit_price, line_discount, line_total) VALUES
('SL001', 'SO001', 'CP001', 'Der Herr der Ringe', 1, 29.99, 0, 29.99);

INSERT INTO stock_ledger_entries (id, product_id, warehouse_id, quantity_delta, movement_type, reference_type, reference_id, reason, performed_by, created_at) VALUES
('LG011', 'CP001', 'WH-STORE', -1, 'SALE', 'sales_order', 'SO001', 'Verkauf', 'U-DEMO001', '2026-04-20T10:00:00+00:00');

INSERT INTO audit_events (id, event_type, entity_type, entity_id, actor_user_id, payload, created_at) VALUES
('AE001', 'seed_loaded', 'system', 'seed-20260420', NULL, '{"seed":"catalog-stock-ledger"}', '2026-04-20T08:00:00+00:00');

INSERT INTO activity_logs (id, timestamp, performed_by, action, entity_type, entity_id, changes, reason) VALUES
('AL001', '2026-04-20T08:00:00+00:00', 'system', 'SEED_LOADED', 'system', 'seed-20260420', '{"seed":"catalog-stock-ledger"}', 'Initiales Demo-Setup');
