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

## Zusammenfassung

**Gesamt implementierte Features:** Backend-CRUD + DB-Session + SQLite + CORS + Root/Health + Inventory-Summary + minimale Book-Create/Delete UI + Vite-Fix  
**Gesamt geschriebene Tests:** 0  
**Gesamt Commits:** (nicht nachgetragen)  
**Größte Herausforderung:** Container-Devserver Crash durch defekte sourcemap sowie API↔UI Datenmodell-Angleichung.  
**Schönste Code-Zeile:** Auto-ID/Zeiten bei `create_book` (UUID + UTC-Timestamp).

---

**Changelog erstellt von:** Kattner  
**Letzte Aktualisierung:** 2026-03-27

