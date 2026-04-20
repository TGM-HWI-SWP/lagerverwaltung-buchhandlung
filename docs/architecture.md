# Architektur-Dokumentation

## Überblick

Der aktuelle Produktcode liegt in `src1/` und trennt fachlich drei Kernebenen:

- Katalog
- Bestand je Lagerort
- Bestands-Historie

## Zielbild

Die Architektur bleibt pragmatisch, ist jetzt aber fachlich deutlich sauberer als vorher:

- HTTP-Schicht in `app/main.py`
- zentrale Use-Cases in `app/services/commerce.py`
- Auth und Activity als getrennte Hilfsbereiche
- Datenmodell mit `catalog_products`, `stock_items` und `stock_ledger_entries`

## Backend

Wichtige produktive Bereiche:

- `app/main.py`: öffentliche API
- `app/services/commerce.py`: Katalog, Lager, Einkauf, Verkauf, Retouren
- `app/core/bootstrap.py`: Start, Schema-Erzeugung, SQLite-Seed
- `app/core/location_search.py`: OSM-/Nominatim-Suche mit normalisiertem Antwortformat
- `app/db/models.py`: Supplier und Activity-Log
- `app/db/models_commerce.py`: Produktiver Katalog-/Stock-/Sales-Stack
- `app/db/models_auth.py`: Mitarbeiter und Rollen

## Datenmodell

### Katalog

- `catalog_products`
- `product_prices`
- `product_suppliers`

Ein Produkt enthält nur Stammdaten und Aktiv-Status. Verkaufspreise liegen separat in `product_prices`.

### Lager

- `warehouses`
- `stock_items`

Aktueller Bestand liegt ausschließlich in `stock_items` pro Lagerort.
Lagerorte und Lieferanten tragen zusätzlich strukturierte Standortfelder inklusive Stadt, Land und optionalen Koordinaten.

### Historie

- `stock_ledger_entries`
- `audit_events`
- `activity_logs`

Jede Bestandsänderung wird im Ledger als eigener Eintrag gespeichert.

### Einkauf und Verkauf

- `purchase_orders_v2`
- `purchase_order_v2_lines`
- `sales_orders`
- `sales_order_lines`
- `return_orders`
- `return_order_lines`

## Standortsuche

- `GET /locations/search` nutzt eine OSM-basierte Nominatim-Suche
- Treffer werden im Backend normalisiert, damit das Frontend keine externe API-Struktur kennen muss
- wenn die Suche scheitert, bleibt manuelle Pflege der Standortfelder möglich

## Frontend

Das Frontend verwendet jetzt dieselbe Fachsprache wie das Backend:

- Katalog
- Bestände & Ledger
- Einkauf
- Wareneingang
- Verkauf
- Lieferanten

Dadurch muss im UI nicht mehr zwischen altem Buch-/Bewegungsmodell und neuer Lagerlogik übersetzt werden.

## Stärken

- klar getrennte Fachbegriffe
- Multi-Warehouse ist sichtbar und produktiv
- Ledger statt impliziter Bestandsänderungen
- Einkauf ist mehrzeilig modelliert

## Restliche technische Schulden

- `app/main.py` bündelt weiterhin viele Endpunkte
- `commerce.py` ist die zentrale Orchestrierungsdatei und damit entsprechend groß
- historische Root-Dokumente liegen weiterhin im Repo, auch wenn sie nicht mehr produktiv sind

---

**Letzte Aktualisierung:** 2026-04-20
