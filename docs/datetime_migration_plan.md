# DateTime Migration Plan (SQLite)

Ziel: Zeitstempelspalten im SQLite-Schema langfristig konsistenter machen (SQLAlchemy `DateTime`), ohne bestehende Datenbanken zu zerstören.

## Ausgangslage

Aktuell sind Zeitstempel in folgenden Tabellen als `TEXT/VARCHAR` gespeichert:

- `books.created_at`, `books.updated_at`
- `movements.timestamp`
- `suppliers.created_at`
- `purchase_orders.created_at`, `purchase_orders.delivered_at`
- `incoming_deliveries.received_at`
- `book_suppliers.created_at`, `book_suppliers.updated_at`
- `activity_logs.timestamp`

Das ist in SQLite üblich, erschwert aber saubere Date-Queries/Indexierung.

## Prinzip (SQLite-sicher)

SQLite kann Spaltentypen nicht zuverlässig via `ALTER COLUMN` ändern.
Die robuste Strategie ist:

1. Neue Spalten anlegen (z. B. `created_at_dt`)
2. Werte aus alten ISO-Strings backfillen
3. Indizes auf den neuen Spalten anlegen
4. (Optional) View/Compat-Phase
5. Später: Tabellen-Rebuild (nur wenn wirklich nötig)

## Minimale Phase 1 (ohne Rebuild)

Für jede relevante Spalte:

- `ALTER TABLE ... ADD COLUMN <col>_dt DATETIME` (SQLite speichert trotzdem TEXT, aber SQLAlchemy kann `DateTime` nutzen)
- Backfill:
  - Wenn Werte ISO-8601 sind: `UPDATE ... SET <col>_dt = <col> WHERE <col>_dt IS NULL AND <col> IS NOT NULL`
  - Falls lokale Formate existieren: vorher im Backend normalisieren (bereits über `core/time.py`)
- Optionaler CHECK, wo möglich (SQLite CHECK funktioniert, aber keine echte DATETIME-Validierung)

## Phase 2 (sauber, mit Rebuild)

Wenn wir wirklich auf "echte" Spalten wechseln wollen:

- Neue Tabelle mit finalem Schema anlegen
- Daten rüberkopieren (inkl. Casting/Normalisierung)
- Alte Tabelle droppen, neue umbenennen

Das ist migrationsintensiv und sollte erst passieren, wenn:

- Tests/Backups vorhanden sind
- keine produktiven DBs ohne Backup existieren

## Empfehlung für dieses Repo

- Kurzfristig: so lassen, aber alle neuen Timestamps konsequent als ISO-UTC schreiben (ist bereits so).
- Mittelfristig: Phase-1 Spalten + Indizes für Query-Performance (ohne Tabellenrebuild).
- Langfristig: Wechsel auf PostgreSQL, wenn Multi-User/Skalierung ein Thema wird.
