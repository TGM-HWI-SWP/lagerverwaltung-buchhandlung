# Known Issues

## Aktueller Stand

Derzeit sind keine akuten Blocker dokumentiert.

Die Anwendung ist für ein Schulprojekt in einem brauchbaren Zustand, hat aber einige bekannte technische Schulden und Grenzen.

## Bekannte Schwachstellen

### 1. Große zentrale Frontend-Datei

- `src1/frontend/src/App.tsx` ist inzwischen sehr umfangreich
- mehrere Verantwortlichkeiten liegen noch in einer Datei
- das erschwert Wartung, Review und gezielte UI-Tests

### 2. Teilweise breite API-Module

- Lieferanten-, Bestell- und Wareneingangslogik liegt aktuell stark in `src1/backend/app/api/suppliers.py`
- fachlich wäre eine stärkere Trennung in eigene Service-/API-Module sauberer

### 3. Bewegungen sind bewusst unveränderlich

- `update_movement` und `delete_movement` sind vor Release absichtlich gesperrt
- Korrekturen sollen per Gegenbewegung erfolgen, damit Historie und Bestand konsistent bleiben

### 4. Teilweise redundante Root-Dokumentation

- im Root-Bereich liegen noch ältere Template-Dateien und alte Tests
- sie sind nicht Teil des aktuellen `src1`-Produktkerns
- dadurch wirkt das Repo stellenweise redundanter als nötig

## Bewusste Limitationen

Diese Dinge sind derzeit nicht umgesetzt:

- Benutzerverwaltung oder Authentifizierung
- Rollen-/Rechtesystem
- Pagination oder größere Listenoptimierung
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
