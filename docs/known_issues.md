# Known Issues

## Aktueller Stand

Derzeit sind keine akuten Blocker dokumentiert.

Die Anwendung ist für ein Schulprojekt in einem brauchbaren Zustand, hat aber einige bekannte technische Schulden und Grenzen.

## Bekannte Schwachstellen

### 1. Frontend-Paketinstallation kann an Rechten scheitern

- `npm install` kann fehlschlagen, wenn `src1/frontend/node_modules` oder Unterordner falsche Owner/Rechte haben (z. B. durch vorherige `sudo`-Runs)
- Fehlerbild: `EACCES: permission denied, mkdir ... node_modules/...`
- Fix (Linux): Owner auf den aktuellen User setzen und neu installieren
  - `sudo chown -R $USER:$USER src1/frontend/node_modules src1/frontend/package-lock.json`
  - danach `npm install`

### 2. Teilweise breite API-Module

- Lieferanten-, Bestell- und Wareneingangslogik liegt aktuell stark in `src1/backend/app/api/suppliers.py`
- fachlich wäre eine stärkere Trennung in eigene Service-/API-Module sauberer

### 3. Lagerbewegungen sind unveränderlich

- Lagerbewegungen sind jetzt bewusst **immutable**
- `PUT /movements/{id}` und `DELETE /movements/{id}` liefern `409 Conflict`
- Korrekturen erfolgen über neue `CORRECTION`-Bewegungen

### 4. Root-Repo enthält noch Legacy-Artefakte

- im Root-Bereich liegen noch ältere Template-Dateien und alte Tests
- sie sind nicht Teil des aktuellen `src1`-Produktkerns
- dadurch wirkt das Repo stellenweise redundanter als nötig

## Bewusste Limitationen

Diese Dinge sind derzeit nicht umgesetzt:

- Benutzerverwaltung oder Authentifizierung
- Rollen-/Rechtesystem
- Pagination ist für die zentralen Listenendpunkte vorhanden (offset/limit)
- Postgres oder andere produktionsnahe DB statt SQLite
- ausgebaute automatisierte Frontend-Tests

## Workarounds / Hinweise

### Für Entwicklung

- produktive Arbeit nur unter `src1/`

### Für Persistenz

- SQLite ist für das Projekt ausreichend
- für größere Datenmengen oder parallele Nutzung wäre eine robustere DB sinnvoll

## Empfohlene Bereinigung

Wenn das Repo noch sauberer werden soll, wären diese Schritte sinnvoll:

1. alte Template-Dateien im Root-Bereich weiter reduzieren
2. `App.tsx` in Feature-Komponenten zerlegen
3. Lieferanten-/Bestelllogik im Backend weiter entkoppeln

---

**Letzte Aktualisierung:** 2026-04-19
