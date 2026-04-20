# Known Issues

## Aktueller Stand

Es sind keine akuten Blocker dokumentiert. Der neue Katalog-/Stock-/Ledger-Stack ist lauffähig, hat aber für ein Schulprojekt erwartbare Restschulden.

## Bekannte Schwachstellen

### 1. Zentrale Orchestrierungsdateien bleiben groß

- `src1/backend/app/main.py` bündelt viele Endpunkte
- `src1/backend/app/services/commerce.py` bündelt viele Use-Cases
- `src1/frontend/src/App.tsx` ist weiterhin zentrale Orchestrierung

### 2. PDF-Export hängt von `matplotlib` ab

- Wenn `matplotlib` lokal nicht installiert ist, funktioniert nur der PDF-Export nicht
- Das Backend selbst startet trotzdem, weil der Import bewusst lazy erfolgt

### 3. Testabdeckung ist noch schmal

- der SQLite-Schematest deckt nur die Datenbasis ab
- End-to-End- und API-Tests für Einkauf, Wareneingang, Verkauf und Retouren fehlen noch

### 4. Historische Repo-Dateien existieren weiterhin

- im Root und in einigen Doku-Dateien liegen noch Projekt- und Lernartefakte
- sie gehören nicht zum produktiven Kern unter `src1/`

---

**Letzte Aktualisierung:** 2026-04-20
