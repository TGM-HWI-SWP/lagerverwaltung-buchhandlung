# Test-Dokumentation

## Überblick

Die aktuellen Produkttests liegen unter:

- `src1/backend/tests/`

Diese Tests gehören zum aktuellen `src1`-Produktstand.

## Aktueller Stand

Derzeit existiert ein produktiver Backend-Test:

- `src1/backend/tests/test_sqlite_schema.py`

Dieser Test ist bewusst mit `unittest` geschrieben und läuft ohne zusätzliche Test-Abhängigkeiten.

## Was der aktuelle Test prüft

Der Schematest prüft unter anderem:

- frisches Ausführen des Seed-SQL auf einer leeren SQLite-Datenbank
- Existenz der zentralen Tabellen
- Seed-Daten für Bücher, Lieferanten und Bewegungen
- Mehrfach-Lieferanten über `book_suppliers`
- wichtige Constraints, z. B. bei Preisen und eindeutigen Buch-Lieferanten-Zuordnungen

## Tests ausführen

### Empfohlener Weg vom Repo-Root

```bash
python -m unittest -q src1.backend.tests.test_sqlite_schema
```

### Aus dem Backend-Ordner

```bash
cd src1/backend
python -m unittest -q tests.test_sqlite_schema
```

## Optionale Test-Tools

Im Backend-`pyproject.toml` sind zusätzlich Dev-Abhängigkeiten für `pytest` und `httpx` vorgesehen.

Das heißt:

- aktuelle Tests brauchen `pytest` nicht
- zukünftige API- und Integrationstests können mit `pytest` aufgebaut werden

## Empfohlene nächste Teststufen

### 1. Service-Tests

Sinnvoll für:

- `InventoryService`
- Bewegungsregeln
- Negativbestand verhindern
- `IN` / `OUT` / `CORRECTION`

### 2. API-Tests

Sinnvoll für:

- `POST /books`
- `POST /movements`
- `POST /purchase-orders`
- `POST /incoming-deliveries/{delivery_id}/book`

### 3. Persistenztests

Sinnvoll für:

- SQLite-Startmigration
- Seed-Verhalten bei bestehender DB
- Konsistenz zwischen `books`, `book_suppliers`, `purchase_orders` und `incoming_deliveries`

## Test-Zielbild

Für den aktuellen Produktstand wäre mittelfristig sinnvoll:

- Schematests
- Service-Tests
- API-Tests
- einige End-to-End-Workflows gegen eine isolierte SQLite-Testdatenbank

---

**Letzte Aktualisierung:** 2026-04-19
