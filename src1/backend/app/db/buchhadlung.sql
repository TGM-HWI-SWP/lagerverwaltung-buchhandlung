

-- Produkte-Tabelle
CREATE TABLE IF NOT EXISTS books (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL CHECK (price >= 0),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    sku TEXT DEFAULT '',
    category TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    notes TEXT
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

-- ============================================
-- Dummy-Daten: Produkte (Bücher)
-- ============================================

INSERT INTO books (id, name, author, description, price, quantity, sku, category, created_at, updated_at, notes) VALUES
('B001', 'Der Herr der Ringe', 'J.R.R. Tolkien', 'Fantasy-Epos von J.R.R. Tolkien', 29.99, 15, 'ISBN-978-3-608-93981-2', 'Fantasy', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B002', 'Harry Potter und der Stein der Weisen', 'J.K. Rowling', 'Erster Band der Harry-Potter-Reihe von J.K. Rowling', 14.99, 25, 'ISBN-978-3-551-35401-3', 'Fantasy', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B003', '1984', 'George Orwell', 'Dystopischer Roman von George Orwell', 12.99, 10, 'ISBN-978-3-548-23410-0', 'Dystopie', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B004', 'Die Verwandlung', 'Franz Kafka', 'Erzählung von Franz Kafka', 8.50, 7, 'ISBN-978-3-15-009900-1', 'Klassiker', datetime('now', 'localtime'), datetime('now', 'localtime'), 'Schulklassiker'),
('B005', 'Faust I', 'Johann Wolfgang von Goethe', 'Tragödie von Johann Wolfgang von Goethe', 6.99, 20, 'ISBN-978-3-15-000001-5', 'Klassiker', datetime('now', 'localtime'), datetime('now', 'localtime'), 'Pflichtlektüre'),
('B006', 'Der kleine Prinz', 'Antoine de Saint-Exupéry', 'Erzählung von Antoine de Saint-Exupéry', 9.99, 30, 'ISBN-978-3-7306-0816-5', 'Kinderbuch', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B007', 'Sapiens: Eine kurze Geschichte der Menschheit', 'Yuval Noah Harari', 'Sachbuch von Yuval Noah Harari', 16.99, 12, 'ISBN-978-3-421-04595-9', 'Sachbuch', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B008', 'Clean Code', 'Robert C. Martin', 'Handbuch für agile Software-Entwicklung von Robert C. Martin', 34.99, 5, 'ISBN-978-0-13-235088-4', 'Fachbuch', datetime('now', 'localtime'), datetime('now', 'localtime'), 'Beliebtes IT-Buch'),
('B009', 'Das Parfum', 'Patrick Süskind', 'Roman von Patrick Süskind', 11.99, 8, 'ISBN-978-3-257-22800-7', 'Roman', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL),
('B010', 'Die unendliche Geschichte', 'Michael Ende', 'Fantasyroman von Michael Ende', 13.50, 18, 'ISBN-978-3-522-20260-9', 'Fantasy', datetime('now', 'localtime'), datetime('now', 'localtime'), NULL);

-- ============================================
-- Dummy-Daten: Lagerbewegungen
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
