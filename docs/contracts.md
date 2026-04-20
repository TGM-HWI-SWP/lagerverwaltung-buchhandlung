# Schnittstellen-Dokumentation

## Öffentliche Produkt-API

Das aktuelle Produkt verwendet ausschließlich die neue Fachsprache für Katalog, Lagerorte, Bestände und Ledger.

### Katalog

- `GET /catalog-products`
- `GET /catalog-products/{product_id}`
- `POST /catalog-products`
- `PUT /catalog-products/{product_id}`
- `DELETE /catalog-products/{product_id}`

Wichtige Felder:

- `sku`
- `title`
- `author`
- `description`
- `category`
- `selling_price`
- `reorder_point`
- `is_active`

### Lagerorte und Bestand

- `GET /warehouses`
- `POST /warehouses`
- `PUT /warehouses/{warehouse_id}`
- `GET /stock-items`
- `POST /stock-adjustments`
- `GET /stock-ledger`

Wichtig:

- aktueller Bestand kommt nur aus `stock_items`
- Historie kommt nur aus `stock_ledger_entries`
- `stock_adjustments` akzeptiert positive und negative `quantity_delta`
- `warehouses` enthalten strukturierte Standortfelder wie `location_city`, `location_country`, `location_lat` und `location_lon`

### Lieferanten

- `GET /suppliers`
- `POST /suppliers`
- `GET /product-suppliers/{product_id}`
- `PUT /product-suppliers/{product_id}`

`product_suppliers` bildet die N:M-Beziehung zwischen Produkt und Lieferant.
`suppliers` enthalten zusätzlich strukturierte Standortfelder sowie eine kombinierte `address`-Anzeige.

### Standortsuche

- `GET /locations/search?q=...`

Der Endpunkt liefert normalisierte Standortvorschläge aus einer OSM-/Nominatim-Suche.
Er dient nur als Hilfsfunktion für Formulare; manuelle Eingabe bleibt zulässig.

### Einkauf

- `GET /purchase-orders`
- `POST /purchase-orders`
- `POST /purchase-orders/{order_id}/receive`

Bestellungen bestehen aus mehreren Zeilen:

- `product_id`
- `quantity`
- `unit_cost`

Wareneingang bucht Mengen gezielt je `line_id` in einen `warehouse_code`.

### Verkauf und Retouren

- `GET /sales-orders`
- `POST /sales-orders`
- `POST /sales-orders/{order_id}/returns`

Wichtig:

- Verkaufspreis kommt aus `product_prices`
- Verkäufe reduzieren den Bestand im gewählten Lagerort
- Retouren erzeugen Gegeneinträge im Ledger

### Reports und Exporte

- `GET /reports/stock-pdf`
- `GET /export/catalog-products`
- `GET /export/stock-ledger`
- `GET /export/purchase-orders`

## Nicht mehr produktiv

Diese Altpfade gehören nicht mehr zum öffentlichen Contract:

- `/books`
- `/movements`
- `/inventory`
- altes einfaches `purchase_orders`
- `/incoming-deliveries`

## Rollenmodell

- `admin`: Katalog, Lagerorte, Einkauf, Lieferanten, Mitarbeiter
- `cashier`: Verkauf, Retouren, eigene produktive Leseflüsse

---

**Letzte Aktualisierung:** 2026-04-20
