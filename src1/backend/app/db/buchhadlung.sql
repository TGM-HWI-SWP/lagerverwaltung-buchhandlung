

-- Produkte-Tabelle
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL,
    purchase_price NUMERIC NOT NULL CHECK (purchase_price >= 0),
    sell_price NUMERIC NOT NULL CHECK (sell_price >= 0),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    sku TEXT DEFAULT '',
    category TEXT DEFAULT '',
    supplier_id TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    notes TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

-- Lagerbewegungen-Tabelle
CREATE TABLE IF NOT EXISTS movements (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    book_name TEXT NOT NULL,
    quantity_change INTEGER NOT NULL,
    movement_type TEXT NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'CORRECTION')),
    reason TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    performed_by TEXT NOT NULL DEFAULT 'system',
    FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Lieferanten-Tabelle
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS book_suppliers (
    id TEXT PRIMARY KEY,
    book_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    supplier_sku TEXT NOT NULL DEFAULT '',
    is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
    last_purchase_price NUMERIC NOT NULL DEFAULT 0 CHECK (last_purchase_price >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE (book_id, supplier_id),
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    book_id TEXT NOT NULL,
    book_name TEXT NOT NULL,
    book_sku TEXT DEFAULT '',
    unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    delivered_quantity INTEGER NOT NULL DEFAULT 0 CHECK (delivered_quantity >= 0),
    status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'teilgeliefert', 'geliefert')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    delivered_at TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE TABLE IF NOT EXISTS incoming_deliveries (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    supplier_id TEXT NOT NULL,
    supplier_name TEXT NOT NULL,
    book_id TEXT NOT NULL,
    book_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
    received_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (order_id) REFERENCES purchase_orders(id),
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE INDEX IF NOT EXISTS ix_books_supplier_id ON books (supplier_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_books_sku_non_empty ON books (sku) WHERE sku <> '';
CREATE INDEX IF NOT EXISTS ix_movements_book_id ON movements (book_id);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_supplier_id ON purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS ix_purchase_orders_book_id ON purchase_orders (book_id);
CREATE INDEX IF NOT EXISTS ix_incoming_deliveries_order_id ON incoming_deliveries (order_id);
CREATE INDEX IF NOT EXISTS ix_incoming_deliveries_book_id ON incoming_deliveries (book_id);
CREATE INDEX IF NOT EXISTS ix_book_suppliers_supplier_id ON book_suppliers (supplier_id);
CREATE INDEX IF NOT EXISTS ix_book_suppliers_book_id ON book_suppliers (book_id);


-- ============================================
-- Bücher
-- ============================================

INSERT INTO books (id, name, author, description, purchase_price, sell_price, quantity, sku, category, supplier_id, created_at, updated_at, notes) VALUES
('B001', 'Der Herr der Ringe', 'J.R.R. Tolkien', 'Fantasy-Epos von J.R.R. Tolkien', 20.99, 29.99, 15, 'ISBN-978-3-608-93981-2', 'Fantasy', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B002', 'Harry Potter und der Stein der Weisen', 'J.K. Rowling', 'Erster Band der Harry-Potter-Reihe von J.K. Rowling', 10.49, 14.99, 25, 'ISBN-978-3-551-35401-3', 'Fantasy', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B003', '1984', 'George Orwell', 'Dystopischer Roman von George Orwell', 9.09, 12.99, 10, 'ISBN-978-3-548-23410-0', 'Dystopie', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B004', 'Die Verwandlung', 'Franz Kafka', 'Erzählung von Franz Kafka', 5.95, 8.50, 7, 'ISBN-978-3-15-009900-1', 'Klassiker', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), 'Schulklassiker'),
('B005', 'Faust I', 'Johann Wolfgang von Goethe', 'Tragödie von Johann Wolfgang von Goethe', 4.89, 6.99, 20, 'ISBN-978-3-15-000001-5', 'Klassiker', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), 'Pflichtlektüre'),
('B006', 'Der kleine Prinz', 'Antoine de Saint-Exupéry', 'Erzählung von Antoine de Saint-Exupéry', 6.99, 9.99, 30, 'ISBN-978-3-7306-0816-5', 'Kinderbuch', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B007', 'Sapiens: Eine kurze Geschichte der Menschheit', 'Yuval Noah Harari', 'Sachbuch von Yuval Noah Harari', 11.89, 16.99, 12, 'ISBN-978-3-421-04595-9', 'Sachbuch', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B008', 'Clean Code', 'Robert C. Martin', 'Handbuch für agile Software-Entwicklung von Robert C. Martin', 24.49, 34.99, 5, 'ISBN-978-0-13-235088-4', 'Fachbuch', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), 'Beliebtes IT-Buch'),
('B009', 'Das Parfum', 'Patrick Süskind', 'Roman von Patrick Süskind', 8.39, 11.99, 8, 'ISBN-978-3-257-22800-7', 'Roman', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B010', 'Die unendliche Geschichte', 'Michael Ende', 'Fantasyroman von Michael Ende', 9.45, 13.50, 18, 'ISBN-978-3-522-20260-9', 'Fantasy', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B011', 'Dummy Buch 1', 'Dummy Author', 'Eine Dummy-Beschreibung für Testzwecke', 15.00, 19.99, 5, 'DUMMY-001', 'Test', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), 'Dummy-Daten'),
('B012', 'Dummy Buch 2', 'Dummy Author 2', 'Eine weitere Dummy-Beschreibung', 20.00, 24.99, 3, 'DUMMY-002', 'Test', 'S002', datetime('now', 'localtime'), datetime('now', 'localtime'), 'Dummy-Daten');

-- ============================================
-- Lagerbewegungen
-- ============================================

INSERT INTO movements (id, book_id, book_name, quantity_change, movement_type, reason, timestamp, performed_by) VALUES
('M001', 'B001', 'Der Herr der Ringe', 20, 'IN', 'Erstlieferung', datetime('now', '-7 days', 'localtime'), 'David'),
('M002', 'B002', 'Harry Potter und der Stein der Weisen', 30, 'IN', 'Erstlieferung', datetime('now', '-7 days', 'localtime'), 'David'),
('M003', 'B003', '1984', 15, 'IN', 'Erstlieferung', datetime('now', '-6 days', 'localtime'), 'David'),
('M004', 'B001', 'Der Herr der Ringe', -5, 'OUT', 'Verkauf', datetime('now', '-5 days', 'localtime'), 'Markus'),
('M005', 'B002', 'Harry Potter und der Stein der Weisen', -5, 'OUT', 'Verkauf', datetime('now', '-4 days', 'localtime'), 'Markus'),
('M006', 'B003', '1984', -3, 'OUT', 'Verkauf', datetime('now', '-3 days', 'localtime'), 'Jakub'),
('M007', 'B004', 'Die Verwandlung', 10, 'IN', 'Nachbestellung', datetime('now', '-3 days', 'localtime'), 'David'),
('M008', 'B004', 'Die Verwandlung', -3, 'OUT', 'Verkauf', datetime('now', '-2 days', 'localtime'), 'Tristan'),
('M009', 'B006', 'Der kleine Prinz', 30, 'IN', 'Erstlieferung', datetime('now', '-2 days', 'localtime'), 'David'),
('M010', 'B003', '1984', -2, 'CORRECTION', 'Inventur - beschädigte Exemplare', datetime('now', '-1 days', 'localtime'), 'Markus');

-- ============================================
-- Lieferanten
-- ============================================

INSERT INTO suppliers (id, name, contact, address, notes, created_at) VALUES
('S001', 'Buchgroßhandel Wien GmbH', 'kontakt@bgh-wien.at', 'Mariahilfer Straße 100, 1060 Wien', 'Hauptlieferant für alle Bücher', datetime('now', 'localtime')),
('S002', 'Thalia', 'Thalia@thalia.at', 'Mariahilfer Straße 30, 1060 Wien', 'Bücherlieferant', datetime('now', 'localtime'));

INSERT INTO book_suppliers (id, book_id, supplier_id, supplier_sku, is_primary, last_purchase_price, created_at, updated_at) VALUES
('BS001', 'B001', 'S001', 'ISBN-978-3-608-93981-2', 1, 20.99, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS002', 'B002', 'S001', 'ISBN-978-3-551-35401-3', 1, 10.49, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS003', 'B003', 'S001', 'ISBN-978-3-548-23410-0', 1, 9.09, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS004', 'B004', 'S001', 'ISBN-978-3-15-009900-1', 1, 5.95, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS005', 'B005', 'S001', 'ISBN-978-3-15-000001-5', 1, 4.89, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS006', 'B006', 'S001', 'ISBN-978-3-7306-0816-5', 1, 6.99, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS007', 'B007', 'S001', 'ISBN-978-3-421-04595-9', 1, 11.89, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS008', 'B008', 'S001', 'ISBN-978-0-13-235088-4', 1, 24.49, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS009', 'B009', 'S001', 'ISBN-978-3-257-22800-7', 1, 8.39, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS010', 'B010', 'S001', 'ISBN-978-3-522-20260-9', 1, 9.45, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS011', 'B001', 'S002', 'THALIA-DRR-001', 0, 21.49, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS012', 'B003', 'S002', 'THALIA-1984-001', 0, 9.59, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS013', 'B008', 'S002', 'THALIA-CC-001', 0, 25.49, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS014', 'B011', 'S001', 'DUMMY-S001-001', 1, 15.00, datetime('now', 'localtime'), datetime('now', 'localtime')),
('BS015', 'B012', 'S002', 'DUMMY-S002-002', 1, 20.00, datetime('now', 'localtime'), datetime('now', 'localtime'));
