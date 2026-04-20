# Tests

## Aktueller Stand

Der aktuelle technische Gegencheck für die Abgabe besteht aus:

- SQLite-Schematest für das neue V2-Modell
- Frontend-Produktionsbuild

## Backend

Der zentrale Test liegt in:

- `src1/backend/tests/test_sqlite_schema.py`

Geprüft werden unter anderem:

- frische Initialisierung des neuen Schemas
- Seed-Daten für `catalog_products`, `warehouses`, `stock_items` und `product_suppliers`
- strukturierte Standortspalten für Lieferanten und Lagerorte
- mehrzeilige Purchase Orders
- Constraints für Preise und eindeutige Lieferantenlinks

Ausführen:

```bash
python -m unittest -q src1.backend.tests.test_sqlite_schema
```

Zusätzlicher Backend-Test:

- `src1/backend/tests/test_location_search.py`

Geprüft werden:

- Normalisierung von Nominatim-Antworten
- leere Rückgabe bei zu kurzer Suche
- robustes Verhalten bei API-Fehlern

## Frontend

Der Frontend-Build dient als technischer Integrationscheck:

```bash
cd src1/frontend
npm run build
```

## Sinnvolle nächste Tests

- API-Tests für `POST /stock-adjustments`
- API-Tests für `POST /purchase-orders/{order_id}/receive`
- API-Tests für `POST /sales-orders`
- API-Tests für `POST /sales-orders/{order_id}/returns`

---

**Letzte Aktualisierung:** 2026-04-20
