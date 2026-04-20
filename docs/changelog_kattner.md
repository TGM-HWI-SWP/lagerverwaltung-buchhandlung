# Changelog - Kattner

Persönliches Changelog für Kattner, Rolle: Backend/Integration (FastAPI ↔ React).

---

## [v0.1] - 2026-03-27

### Implementiert

- Backend `src1` lauffähig gemacht und Frontend angebunden (FastAPI + SQLite + React/Vite)
- SQLAlchemy-DB-Session ergänzt (`app/db/session.py`) mit `engine`, `SessionLocal`, `get_db`
- Konfiguration erweitert: `database_url` mit Default auf SQLite
- Books-CRUD umgesetzt
- Autor-Feld für Bücher ergänzt
- Movements-CRUD mit Bestandslogik umgesetzt
- Root-Endpoint `GET /` und `GET /health` ergänzt
- CORS für lokale Dev-URLs erweitert
- `GET /inventory` für Inventar-Summary ergänzt
- erste lauffähige UI-Anbindung für Bücher und Lagerbewegungen

### Tests geschrieben

- Keine (Fokus lag auf lauffähiger Integration und End-to-End-Verbindung)

### Commits

```text
(frühe Grundarbeiten wurden in diesem persönlichen Changelog nicht commitgenau nachgetragen)
```

### Mergekonflikt(e)

- Keine

---

## [v0.2] - 2026-04-10

### Implementiert

- Backend-Architektur in Contracts, Adapters und Services gegliedert
- `books.py` und `inventory.py` als dünne HTTP-Schicht refactored
- Dokumentation an den tatsächlichen Produktstand unter `src1/` angepasst
- Repository-Metadokumente modernisiert

### Tests geschrieben

- Keine neuen Tests

### Commits

```text
9ea8eda Backend: introduce contracts/adapters/services layering
9b6135b Docs: align architecture/contracts with FastAPI backend
36abd11 Docs: refresh README and repo meta docs
```

### Mergekonflikt(e)

- Keine

---

## [v0.3] - 2026-04-18

### Implementiert

- Datenbankstruktur für `src1/backend` deutlich verbessert
- Tabelle `book_suppliers` für Mehrfach-Lieferanten pro Buch ergänzt
- zusätzliche Constraints und Indizes ergänzt
- persistente Bestellungen und Wareneingänge eingeführt
- Frontend für Bestellungen, Wareneingang, Verkauf und Lieferanten überarbeitet
- Contracts-Dokumentation erweitert

### Tests geschrieben

- neuer SQLite-Schematest für frische DBs und Seed-Daten

### Commits

```text
c1c4535 Improve database schema
4853888 Improve supplier backend logic
ddb986b Update order, supplier and sales views
9ca0de0 Add schema test and update docs
54a94b1 Update docs and remove legacy tests
```

### Mergekonflikt(e)

- Keine

---

## [v0.4] - 2026-04-19

### Implementiert

- Backend-Validierung deutlich verbessert
- Zeitstempel-Handling vereinheitlicht
- Lieferanten-, Bestell- und Wareneingangslogik stärker in Services gebündelt
- Frontend-UX bei Einstellungen und Fehlermeldungen verbessert
- Dokumentation zu Validierung und Services ergänzt

### Tests geschrieben

- Keine neuen Tests in dieser Runde

### Commits

```text
89fae0b Improve settings and delete messages
90251c3 Improve backend validation and timestamps
acd2c33 Move supplier logic into services
8dcab42 Update docs for validation and services
0479e0b Polish UI and Docker dev setup
```

---

## [v0.5] - 2026-04-19

### Implementiert

- Repo wieder lauffähig gemacht
- Seed-SQL-Dateiname korrigiert
- Error-Handling, Pagination und Movement-Immutability gehärtet
- Frontend-Struktur mit `MenuButton` und `ErrorBoundary` verbessert
- Build-Probleme und Audit-Themen im Frontend bereinigt
- Dokumentation zu Setup, Known Issues und Changelog erweitert

### Commits

```text
cae1d3c docs: update README, known issues, and changelog
2e3118a backend: stabilize API errors, pagination, and immutability
562d929 frontend: split features and add error boundary
c86f89d frontend: fix build and apply audit updates
7495a2d docs: clarify setup and add datetime migration plan
e292840 backend: add datetime columns and migrate on startup
2b8f857 docs: drop datetime migration plan after implementation
531d08e docs: update Kattner changelog for v0.5 commits
```

### Mergekonflikt(e)

- Keine

---

## [v0.6] - 2026-04-19 bis 2026-04-20

### Implementiert

- rollenbasiertes Login mit Admin- und Kassenfluss ergänzt
- Login-Screen und Admin-Verwaltung im Frontend aufgebaut
- Aktivitäts-Log und Demo-Daten-Flows ergänzt
- Arbeitsbereiche für Katalog, Lager, Bestellung und Verkauf weiter ausgebaut
- größere Commerce- und Auth-Erweiterungen integriert

### Commits

```text
eae2fee backend: add staff login and role-based auth
2d790f7 frontend: add staff login screen and bearer auth
e3a3ed8 backend: fix datetime writes and attribute actions to staff
1725e59 frontend: fix sales page table header styles
61f9c37 Add demo data seeding and activity logging
956695c Restructure catalog, inventory, and cashier workspace
6270de5 Add commerce backend and staff auth platform
62c0327 Add staff login and admin management frontend
```

---

## [v0.7] - 2026-04-20

### Implementiert

- Backend-Start und Datenbank-Bootstrap stabilisiert
- Legacy-Auth-Pfad entfernt
- Frontend-Bestell- und Settings-Flows vereinfacht
- Repo-Defaults und Dokumentation für die Abgabe bereinigt

### Commits

```text
13bac23 Stabilize backend startup and remove legacy auth path
87b49d2 Simplify frontend ordering and settings flows
eab8d48 Refresh docs and repository defaults for submission
```

### Bedeutung für die Abgabe

- vor der finalen Abgabe wurde bewusst vereinfacht statt weiter ausgebaut
- unnötige Redundanz wurde entfernt
- Start, Doku und Produktumfang wurden auf einen besser erklärbaren Stand gebracht

---

## [v0.8] - 2026-04-20

### Implementiert

- vollständigen Wechsel vom alten Buch-/Bestandsmodell auf getrennten Katalog-, Lagerort- und Ledger-Stack umgesetzt
- neues Schema mit `catalog_products`, `warehouses`, `stock_items`, `stock_ledger_entries` und `product_suppliers` produktiv gemacht
- Einkauf auf mehrzeilige `purchase_orders_v2` umgestellt
- Verkauf und Retouren an den neuen Lagerort-Bestand angebunden
- Frontend sichtbar auf Katalog, Bestände & Ledger, Einkauf, Wareneingang und Verkauf je Lagerort umgebaut

### Commits

```text
8221e57 Refactor database bootstrap to catalog stock and ledger model
5692a5d Migrate frontend to catalog warehouse stock and purchase order flows
f76a974 Polish docs tests and cleanup after catalog stock migration
```

### Bedeutung für die Abgabe

- kein paralleles Altmodell mehr im Produktkern
- neue Fachsprache ist in Datenbank, Backend und UI konsistent
- das Projekt ist dadurch besser erklärbar und näher an einer sauberen Lagerarchitektur

---

## [v0.9] - 2026-04-20

### Implementiert

- Bootstrap- und Login-Flow gehärtet und Seed-Demo-Logins entfernt
- strukturierte Standorte für Lieferanten und Lagerorte eingeführt
- OSM-basiertes Standort-Autocomplete mit manuellem Fallback ergänzt
- Settings-Fluss und Dokumentation nach dem Standort-Rollout bereinigt

### Tests geschrieben

- SQLite-Schematest um Standortspalten erweitert
- separater Unit-Test für die Nominatim-Normalisierung ergänzt

### Commits

```text
ff105c5 Harden bootstrap auth and remove seeded demo logins
df33488 Add structured locations to suppliers and warehouses
8450df4 Add OpenStreetMap location autocomplete with manual fallback
```

### Bedeutung für die Abgabe

- Login und Erstsetup sind jetzt glaubwürdiger und ohne Fake-Zugänge
- Lieferanten und Lagerorte sind fachlich besser modelliert
- echte Ortsvorschläge erleichtern die Eingabe, ohne das Produkt von externer Verfügbarkeit abhängig zu machen

---

## Zusammenfassung

**Gesamt implementierte Schwerpunkte:** getrenntes Katalog-/Stock-/Ledger-Modell, Multi-Warehouse-Bestand, SQLite/PostgreSQL-Setup, rollenbasierte Authentifizierung, strukturierte Standorte mit OSM-Autocomplete, mehrzeilige Einkaufsbestellungen, Wareneingang je Lagerort, Verkauf und Retouren, Aktivitäts-Log, UI für Katalog, Lager, Einkauf, Wareneingang, Verkauf, Lieferanten und Administration  
**Gesamt geschriebene Tests:** 2 produktive Python-Testsuiten  
**Gesamt erfasste Commits in diesem Changelog:** 39  
**Größte Herausforderung:** Das Datenmodell zwischen Frontend, API und Persistenz konsistent weiterzuentwickeln, ohne den bestehenden `src1`-Flow zu zerbrechen  
**Schönste Code-Idee:** Die automatische Pflege der Buch-Lieferanten-Zuordnung beim Persistieren statt reiner Einzel-FK-Logik

---

**Changelog erstellt von:** Kattner  
**Letzte Aktualisierung:** 2026-04-20
