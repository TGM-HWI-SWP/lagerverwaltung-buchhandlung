# `src1` Produktstand

`src1/` enthält den aktuellen Abgabe- und Produktcode.

## Struktur

- `backend/`: FastAPI, SQLAlchemy, Auth, Katalog-, Lager- und Verkaufslogik
- `frontend/`: React/Vite-Frontend für Katalog, Lagerorte, Einkauf, Wareneingang und Verkauf

## Fachlicher Kern

Dieses Teilprojekt verwendet kein altes `books + quantity`-Modell mehr.

Stattdessen gilt:

- Katalogprodukt = Stammdaten
- Stock Item = aktueller Bestand je Lagerort
- Stock Ledger = unveränderliche Historie

## Start

Backend:

```bash
cd src1/backend
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd src1/frontend
npm run dev
```
