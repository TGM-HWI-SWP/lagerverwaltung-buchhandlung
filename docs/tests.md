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

GUI- Tests im ganzen Projekt, letzte Aktualisierung: 22.04.2026

Im Rahmen der Entwicklung der grafischen Benutzeroberfläche (GUI) wurden verschiedene Tests durchgeführt, um die Funktionalität und Benutzerfreundlichkeit sicherzustellen. Die Tests erfolgten hauptsächlich manuell, da der Fokus auf der korrekten Interaktion zwischen GUI und Businesslogik lag.

Zunächst wurden alle interaktiven Elemente der GUI überprüft. Dazu zählen insbesondere Buttons, Eingabefelder sowie Navigationsmöglichkeiten innerhalb der Anwendung. Es wurde getestet, ob Benutzeraktionen wie Klicks oder Eingaben korrekt erkannt und verarbeitet werden. Dabei zeigte sich, dass alle Buttons die vorgesehenen Funktionen auslösen und die Navigation zwischen den einzelnen Ansichten fehlerfrei funktioniert.

Ein weiterer wichtiger Bestandteil der Tests war die Überprüfung der Anbindung an die Businesslogik. Hierbei wurde kontrolliert, ob Aktionen in der GUI die entsprechenden Funktionen im Programmcode aufrufen. Beispielsweise wurde beim Auslösen bestimmter Aktionen überprüft, ob Daten korrekt verarbeitet, gespeichert oder verändert werden. Diese Tests verliefen erfolgreich, sodass eine korrekte Kommunikation zwischen GUI und Logik funktioniert haben.

Zusätzlich wurden verschiedene Randfälle getestet, um die Stabilität der Anwendung zu erhöhen. Dazu gehören unter anderem leere oder fehlerhafte Eingaben sowie ungültige Benutzeraktionen. In diesen Fällen reagiert die Anwendung erwartungsgemäß, beispielsweise durch Fehlermeldungen oder das Verhindern ungültiger Aktionen.