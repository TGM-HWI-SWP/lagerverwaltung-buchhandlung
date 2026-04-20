# Lagerverwaltung Buchhandlung

Buchhandlungsverwaltung mit FastAPI-Backend, React-Frontend und einem fachlich getrennten Modell für Katalog, Bestand und Historie.

Der aktuelle Produktcode liegt unter `src1/`.

- Backend: `src1/backend`
- Frontend: `src1/frontend`
- Dokumentation: `docs/`

## Fachliches Modell

Die Anwendung trennt bewusst:

- `catalog_products` für Stammdaten
- `warehouses` und `stock_items` für aktuellen Bestand je Lagerort
- `stock_ledger_entries` für jede Bestandsänderung
- `purchase_orders_v2` und `purchase_order_v2_lines` für Einkauf
- `sales_orders` und `sales_order_lines` für Verkauf
- `return_orders` für Retouren

Damit wird Bestand nicht mehr im Produktstamm gespeichert.

## Funktionen

- Katalogprodukte mit Preisen und Lieferantenbezügen verwalten
- mehrere Lagerorte führen
- Bestände je Lagerort korrigieren und im Ledger nachverfolgen
- mehrzeilige Einkaufsbestellungen anlegen
- Wareneingänge direkt in einen Lagerort einbuchen
- Verkäufe und Retouren buchen
- Rollenbasiertes Login für Kasse und Admin
- strukturierte Standorte für Lieferanten und Lagerorte pflegen
- OSM-basiertes Standort-Autocomplete mit manueller Fallback-Eingabe
- PDF- und CSV-Exporte

## Stack

- Backend: FastAPI, SQLAlchemy, Pydantic v2
- Datenbank:
  - lokal standardmäßig SQLite
  - in Docker Compose PostgreSQL 16
- Frontend: React, Vite, TypeScript, TailwindCSS, Recharts

## Schnellstart

### Docker Compose

```bash
docker compose up --build
```

Danach erreichbar:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API-Doku: `http://localhost:8000/docs`

### Lokal

Backend:

```bash
cd src1/backend
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd src1/frontend
npm install
npm run dev
```

## Wichtige Endpunkte

- `GET /catalog-products`
- `POST /catalog-products`
- `GET /warehouses`
- `GET /stock-items`
- `POST /stock-adjustments`
- `GET /stock-ledger`
- `GET /suppliers`
- `GET /purchase-orders`
- `POST /purchase-orders`
- `POST /purchase-orders/{order_id}/receive`
- `GET /sales-orders`
- `POST /sales-orders`
- `POST /sales-orders/{order_id}/returns`
- `GET /locations/search`
- `GET /reports/stock-pdf`
- `GET /export/catalog-products`
- `GET /export/stock-ledger`
- `GET /export/purchase-orders`

## Authentifizierung

- Bootstrap eines ersten Admins über `POST /auth/bootstrap-admin`; frische Seed-Daten enthalten bewusst keine Demo-Logins
- Kassierer melden sich per PIN an
- Admins melden sich per Benutzername und Passwort an
- Die Kassenliste enthält bewusst nur Benutzer mit Rolle `cashier`

## Tests

Vom Repo-Root:

```bash
python -m unittest -q src1.backend.tests.test_sqlite_schema
```

Frontend-Build:

```bash
cd src1/frontend
npm run build
```

## Dokumentation

- [src1/README_src1.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/src1/README_src1.md)
- [src1/backend/README.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/src1/backend/README.md)
- [docs/architecture.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/architecture.md)
- [docs/contracts.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/contracts.md)
- [docs/tests.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/tests.md)
- [docs/known_issues.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/known_issues.md)

## Lizenz

Schulprojekt im Rahmen der TGM.
