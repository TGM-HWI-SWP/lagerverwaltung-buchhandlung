## Release / Merge Checklist

### Backend (`src1/backend`)

- [ ] `uvicorn app.main:app` startet ohne Traceback
- [ ] Endpunkte reagieren:
  - [ ] `GET /health`
  - [ ] `GET /books`
  - [ ] `POST /movements` (Bestand ändert sich erwartungsgemäß)
- [ ] `docs/contracts.md` stimmt mit Code unter `app/contracts/` überein

### Frontend (`src1/frontend`)

- [ ] `npm run dev` startet
- [ ] Bücherliste lädt
- [ ] Lagerbewegung kann erstellt werden

### Docs

- [ ] `README.md` Quickstart stimmt
- [ ] `docs/architecture.md` beschreibt den aktuellen Stand
- [ ] `docs/tests.md` ist nicht irreführend (Template vs aktuelles Produkt)

