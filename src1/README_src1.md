## Buchhandlungsverwaltung – Code-Struktur (`src1`)

Diese README beschreibt die grobe Struktur für das Schulprojekt mit **FastAPI + PostgreSQL (Backend)** und **React + Vite (Frontend)**.  
Alle Dateien sind absichtlich nur *grob* angelegt, damit klar ist, wo später welcher Teil der Aufgabenstellung umgesetzt wird.

---

### 1. Backend – `src1/backend/app`

- **`main.py`**
  - Einstiegspunkt für die FastAPI-Anwendung.
  - Richtet CORS ein (für das React-Frontend).
  - Endpunkte:
    - `GET /health` – einfacher Health-Check.
    - bindet Router:
      - `/books` (Bücherverwaltung)
      - `/inventory` (Lagerbestand).

- **`api/`**
  - **`__init__.py`** – markiert das API-Paket; hier können später weitere Router ergänzt werden.
  - **`books.py`**
    - Router für alles rund um Bücher (Buchstammdaten).
    - Platzhalter-Endpunkte:
      - `GET /books` – soll später alle Bücher aus der Datenbank liefern.
      - `POST /books` – soll später ein neues Buch anlegen.
    - Verwendet Pydantic-Schemas aus `db/schemas.py`.
  - **`inventory.py`**
    - Router für Lagerbestand (welches Buch, wie viele Stück, wo gelagert).
    - Platzhalter-Endpunkt:
      - `GET /inventory` – soll später eine Übersicht mit Beständen liefern.

- **`db/`**
  - **`models.py`**
    - SQLAlchemy-Models für PostgreSQL:
      - `Book` – Buchstammdaten (ISBN, Titel, Autor, Verlag, Preis, …).
      - `InventoryItem` – Lagerzeile (Buch-Referenz, Menge, Lagerort, …).
  - **`schemas.py`**
    - Pydantic-Schemas für die API (Request/Response-Objekte):
      - `BookBase`, `BookCreate`, `BookRead`.
      - `InventoryItemRead`.
  - **`session.py`**
    - Erstellt den SQLAlchemy-`engine` und `SessionLocal` basierend auf der Konfiguration.
    - Stellt `get_db()` als Dependency für FastAPI-Endpunkte bereit.

- **`core/`**
  - **`config.py`**
    - `Settings`-Klasse (über `pydantic_settings`) mit:
      - `app_name`
      - `database_url` (PostgreSQL-URL).
    - Liest später Werte aus einer `.env`-Datei.

---

### 2. Frontend – `src1/frontend/src`

- **`main.tsx`**
  - Einstiegspunkt der React-Anwendung (Vite-Standard).
  - Rendert die `App`-Komponente in das `root`-Element.

- **`App.tsx`**
  - Sehr einfache App-Shell:
    - Header mit Projekttitel.
    - Zwei Hauptbereiche:
      - „Bücher“ – bindet `BookList`.
      - „Lagerbestand“ – bindet `InventoryOverview`.
  - Später können hier Routing, Layout, Navigation etc. ergänzt werden.

- **`features/books/BookList.tsx`**
  - Platzhalter-Komponente für die Anzeige aller Bücher.
  - Aktuell nur Beispiel-Daten.
  - Später:
    - Holt die Buchliste über das Backend (`GET /books`).
    - Zeigt Filter/Suche an (z. B. nach Titel, Autor, ISBN).

- **`features/inventory/InventoryOverview.tsx`**
  - Platzhalter-Komponente für die Lagerübersicht.
  - Zeigt aktuell eine Beispiel-Tabelle.
  - Später:
    - Holt Bestandsdaten über das Backend (`GET /inventory`).
    - Zeigt Menge, Lagerort, evtl. Mindestbestand/Bestellvorschläge.

- **`api/client.ts`**
  - Sehr einfacher, zentraler API-Client für das Frontend.
  - `apiGet<T>(path: string)` ruft `http://localhost:8000{path}` auf.
  - Später:
    - Erweiterung für Fehlerbehandlung, Loading-Status, Authentifizierung, etc.

---

### 3. Wie ihr weiterarbeiten könnt

- **Backend**
  - In `api/books.py` und `api/inventory.py` schrittweise echte Logik einbauen (mit `get_db()` und den SQLAlchemy-Models).
  - Datenbank-Schema erweitern (z. B. Kunden, Bestellungen), indem ihr neue Models und Router ergänzt.

- **Frontend**
  - In `BookList` und `InventoryOverview` echte API-Aufrufe über `api/client.ts` einbauen.
  - UI verbessern (Design, Formulare zum Anlegen/Ändern von Daten).

Diese Struktur ist bewusst nah an gängigen Projekt-Strukturen gehalten und sollte der Lehrkraft gut zeigen, wo welcher Teil der Aufgabenstellung umgesetzt wird.

