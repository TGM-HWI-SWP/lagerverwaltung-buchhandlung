

-- Produkte-Tabelle
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    purchase_price REAL NOT NULL CHECK (purchase_price >= 0),
    sell_price REAL NOT NULL CHECK (sell_price >= 0),
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
('B010', 'Die unendliche Geschichte', 'Michael Ende', 'Fantasyroman von Michael Ende', 9.45, 13.50, 18, 'ISBN-978-3-522-20260-9', 'Fantasy', 'S001', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL);

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
('S001', 'Buchgrosshandel Wien GmbH', 'kontakt@bgh-wien.at', 'Mariahilfer Strasse 100, 1060 Wien', 'Hauptlieferant fuer alle Buecher', datetime('now', 'localtime')),
('S002', 'Thalia', 'Thalia@thalia.at', 'Mariahilfer Strasse 30, 1060 Wien', 'Bücherlieferant', datetime('now', 'localtime'));

