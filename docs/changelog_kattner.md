# Changelog - Kattner

Persönliches Changelog für Kattner, Rolle: Backend/Integration (FastAPI ↔ React)

---

## [v0.1] - 2026-03-27

### Implementiert
- Backend `src1` lauffähig gemacht und Frontend angebunden (FastAPI + SQLite + React/Vite).
- SQLAlchemy DB-Session ergänzt (`app/db/session.py`) inkl. `engine`, `SessionLocal`, `get_db`.
- Konfiguration erweitert: `database_url` mit Default auf SQLite (`sqlite:///./buchhandlung.db`) in `app/core/config.py`.
- Books-CRUD in `app/api/books.py` umgesetzt (GET/POST/PUT/DELETE).
- Book-Erstellung verbessert: `id` wird automatisch erzeugt (UUID), `created_at/updated_at` werden automatisch gesetzt; Update setzt `updated_at` neu.
- Books erweitert um **Autor**:
  - DB-Spalte `author` im Model ergänzt
  - SQLite Auto-Migration per `ALTER TABLE ... ADD COLUMN author ...` beim Backend-Start (für bestehende `buchhandlung.db`)
- Movements-CRUD in `app/api/inventory.py` umgesetzt inkl. Bestandslogik:
  - Validierung `movement_type` (`IN`, `OUT`, `CORRECTION`)
  - verhindert negative Bestände
  - auto `id`/`timestamp`, `book_name` wird ergänzt, Buchbestand wird aktualisiert
- API-Qualität: Root-Endpoint `GET /` ergänzt sowie `GET /health`.
- CORS erweitert für lokale Dev-URLs (auch `127.0.0.1`), damit React → API funktioniert.
- Zusatzendpoint `GET /inventory` für Inventar-Summary (Titel/Units/Low-Stock Liste).
- Frontend stabilisiert: Vite-Devserver Crash durch kaputtes `lucide-react` sourcemap im Container umgangen (Vite `optimizeDeps.exclude`).
- Minimale UI-Funktionalität ergänzt, damit man echte Daten anlegen kann:
  - “Neues Buch” Formular in der Lageransicht
  - Speichern via `POST /books`, Löschen via `DELETE /books/{id}`, danach Reload der Liste
  - Formular erweitert um Autor-Feld
  - Placeholder/Hinweise bei Preis/Bestand verbessert (EUR/Stück)
- Repo-Hygiene:
  - `docs/changelog_template.md` → `docs/changelog_kattner.md`
  - `.gitignore` vereinfacht/erweitert (venv, caches, logs, SQLite `*.db/*.sqlite*`)

### Tests geschrieben
- Keine (Fokus lag auf lauffähiger Integration und End-to-End Verbindung).

### Commits
```
- (noch keine Commits in diesem Changelog festgehalten)
```

### Mergekonflikt(e)
- Keine

---

## [v0.2] - 2026-04-10

### Implementiert
- Backend-Architektur bereinigt und “verständlich” gemacht durch klare Schichten:
  - `app/contracts/` (Ports als `Protocol`)
  - `app/adapters/` (SQLAlchemy Repository Implementierungen)
  - `app/services/` (Use-Cases, inkl. fachlicher Lagerbewegungs-Regeln)
- Bestehende API-Module `app/api/books.py` und `app/api/inventory.py` so refactored, dass sie nur noch an Services delegieren (thin HTTP layer).
- Dokumentation an das **tatsächliche** Produkt unter `src1/` angepasst:
  - Architektur/Contracts beschreiben jetzt FastAPI + SQLAlchemy Setup statt die alte Template-Struktur.
  - Test-Doku klärt “Template vs aktuelles Produkt” und empfiehlt Struktur für neue Backend-Tests.
- Repository-Doku modernisiert:
  - `README.md` auf Docker- und Local-Setup aktualisiert (Backend/Frontend Quickstart).
  - Index/Workflow/Checklist/Template-Info ergänzt/aktualisiert.

### Tests geschrieben
- Keine neuen Tests (Refactoring + Doku-Konsolidierung).

### Commits
```
- 9ea8eda Backend: introduce contracts/adapters/services layering
- 9b6135b Docs: align architecture/contracts with FastAPI backend
- 36abd11 Docs: refresh README and repo meta docs
```

### Mergekonflikt(e)
- Keine

---

## [v0.3] - 2026-04-18

### Implementiert
- Datenbankstruktur für `src1/backend` deutlich verbessert:
  - neue Tabelle `book_suppliers` für Mehrfach-Lieferanten pro Buch
  - stärkere Constraints für Mengen/Preise/Status
  - zusätzliche Indizes für häufige Relationen
  - Geldfelder auf numerische Typen/sauberere Checks ausgerichtet
- SQLite-Startlogik/Migration erweitert:
  - bestehende Datenbanken können die neue Lieferanten-Zuordnung beim Start nachziehen
  - Seed-SQL an das tatsächliche Schema angepasst
- Lieferanten-/Bestell-Backend erweitert:
  - persistente Bestellungen (`purchase_orders`)
  - persistente Wareneingänge (`incoming_deliveries`)
  - Zuordnung Buch ↔ Lieferant wird bei Anlage/Update/Wareneingang mitgeführt
  - Lieferantenbestand nutzt die neue Zuordnungstabelle statt nur `books.supplier_id`
- Frontend `App.tsx` umfassend überarbeitet:
  - Bestellungen, Wareneingang, Warenausgang/Verkauf und Lieferantenbereich angepasst
  - Bestell- und Lieferdaten von lokalem Browser-Storage auf Backend-Persistenz umgestellt
  - Einbuchungs- und Teil-Liefer-Workflows an neue API-Endpunkte angebunden
  - mobile Verkaufsansicht ergänzt
- Contracts-Dokumentation erweitert und an die neue Persistenz-/DB-Struktur angepasst

### Tests geschrieben
- Neuer SQLite-Schematest für frische DBs und Seed-Daten:
  - `src1/backend/tests/test_sqlite_schema.py`
- Test deckt zusätzlich Constraints und Mehrfach-Lieferanten-Zuordnungen ab

### Commits
```
- c1c4535 Improve database schema
- 4853888 Improve supplier backend logic
- ddb986b Update order, supplier and sales views
```

### Noch offen / nicht committed in diesem Moment
- `docs/contracts.md` aktualisiert
- `src1/backend/tests/test_sqlite_schema.py` neu angelegt
- geplanter Commit-Text dafür: `Add schema test and update docs`

### Mergekonflikt(e)
- Keine

---

## [v0.4] - 2026-04-19

### Implementiert
- Backend-Validierung deutlich verbessert:
  - stärkere Pydantic-v2-Validierung in `src1/backend/app/db/schemas.py`
  - Pflichtfelder, Mengen, Preise und Statuswerte werden früher abgefangen
  - optionale Zeitfelder werden auf konsistente ISO-UTC-Werte normalisiert
- Zeitstempel-Handling vereinheitlicht:
  - neue Hilfslogik in `src1/backend/app/core/time.py`
  - Backend verwendet konsistenter UTC-ISO-Zeitstempel statt gemischter Formate
- Schichtentrennung weiter verbessert:
  - Lieferanten-, Bestell- und Wareneingangslogik in `src1/backend/app/services/suppliers.py` gebündelt
  - `src1/backend/app/api/suppliers.py` wieder dünner gemacht
  - `src1/backend/app/api/inventory.py` per gemeinsamer Service-Fabrik bereinigt
- Kleine UX-/Fehlerverbesserungen im Frontend:
  - Währungseinstellung entfernt
  - freundlichere Fehlermeldungen beim Löschen
  - Löschbestätigung und Datenansicht-Settings sinnvoller gemacht

### Tests geschrieben
- Keine neuen Tests in dieser Runde (bewusst ausgelassen)

### Commits
```
- 89fae0b Improve settings and delete messages
- 90251c3 Improve backend validation and timestamps
- acd2c33 Move supplier logic into services
```

### Mergekonflikt(e)
- Keine

---

## [v0.5] - 2026-04-23

### Implementiert
- Contract-Doku an den tatsächlichen Port-/Unit-of-Work-Stand angepasst:
  - zusätzliche Persistenz-Ports dokumentiert
  - reale Signaturen (`add/update`, `next_id`, `UnitOfWork`) nachgezogen
- Release-nahe Fachregeln im Backend festgezogen:
  - `update_movement` und `delete_movement` sind jetzt bewusst gesperrt
  - Korrekturen sollen über Gegenbewegungen statt nachträglicher Historienänderung laufen
- Beschaffungsfluss fachlich vereinheitlicht:
  - alter Direktweg `order_from_supplier(...)` im Service deaktiviert
  - verbindlicher Ablauf ist jetzt `purchase_orders -> receive -> incoming_deliveries -> book`
- Repo-Hygiene verbessert:
  - irreführende Altdateien im Root entfernt (`pyproject.toml`, `INDEX.md`, `TEMPLATE_INFO.md`, `src1/README_src1.md`)
  - `.gitignore` um `*.tsbuildinfo` ergänzt
- kleine Contract-Verbesserung:
  - Lieferanten können über das Schema ohne feste ID vom Client angelegt werden
  - Supplier-Order-Request validiert Mengen jetzt strenger

### Tests geschrieben
- Service-/Flow-Test für deaktivierten Direktbestellweg ergänzt
- Service-Tests für gesperrtes `update_movement` und `delete_movement` ergänzt

### Commits
```
- (noch nicht committed in diesem Changelog festgehalten)
```

### Mergekonflikt(e)
- Keine

---

## Zusammenfassung

**Gesamt implementierte Features:** Backend-CRUD + DB-Session + SQLite + CORS + Root/Health + Inventory-Summary + Service/Adapter-Struktur + persistente Bestell-/Wareneingangslogik + Mehrfach-Lieferanten im DB-Modell + breiter UI-Ausbau fuer Bestellung/Wareneingang/Verkauf/Lieferanten + stärkere Validierung + festgezogene Release-Regeln fuer Movements/Bestellfluss  
**Gesamt geschriebene Tests:** SQLite-Schematest plus Service-/Flow-Tests fuer zentrale Backend-Regeln  
**Gesamt Commits:** 9 erfasst, letzter lokaler Arbeitsstand noch nicht als Commit nachgetragen  
**Größte Herausforderung:** Datenmodell zwischen Frontend, API und SQLite konsistent weiterentwickeln, ohne den bestehenden `src1`-Flow zu zerbrechen.  
**Schönste Code-Zeile:** automatische Pflege der Buch-Lieferanten-Zuordnung beim Persistieren statt reiner Einzel-FK-Logik.

---

**Changelog erstellt von:** Kattner  
**Letzte Aktualisierung:** 2026-04-23
