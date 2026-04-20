## Release- / Merge-Checkliste

### Backend (`src1/backend`)

- [ ] `uvicorn app.main:app` startet ohne Traceback
- [ ] `GET /health` antwortet erfolgreich
- [ ] `GET /books` liefert Daten
- [ ] `POST /movements` ändert den Bestand erwartungsgemäß
- [ ] Auth-Flows funktionieren:
  - [ ] Bootstrap-Admin
  - [ ] Kassierer-Login per PIN
  - [ ] Admin-Login per Passwort
- [ ] `docs/contracts.md` stimmt mit dem aktuellen Produkt-Contract überein

### Frontend (`src1/frontend`)

- [ ] `npm run dev` startet
- [ ] Bücherliste lädt
- [ ] Lagerbewegung kann erstellt werden
- [ ] Bestellung und Wareneingang funktionieren
- [ ] Login-Ansicht ist bedienbar

### Dokumentation

- [ ] `README.md` Quickstart stimmt
- [ ] `docs/architecture.md` beschreibt den aktuellen Stand
- [ ] `docs/tests.md` ist nicht irreführend
- [ ] `docs/known_issues.md` nennt keine veralteten Aussagen
- [ ] `docs/changelog_kattner.md` ist bis `HEAD` aktualisiert
