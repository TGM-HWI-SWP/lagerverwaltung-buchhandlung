# Architektur-Dokumentation

## Überblick

Der aktuelle Produktcode liegt in `src1/` und besteht aus:

- `src1/backend`: FastAPI, SQLAlchemy, SQLite
- `src1/frontend`: React, Vite, TypeScript

Das Projekt ist als kleine Buchhandlungsverwaltung aufgebaut. Fachlich deckt es Bücher, Lagerbewegungen, Lieferanten, Bestellungen, Wareneingänge und Verkaufsvorgänge ab.

## Zielbild

Die Architektur ist bewusst pragmatisch gehalten:

- dünne HTTP-Schicht
- fachliche Regeln in Services
- klare Trennung zwischen Contracts und konkreter Persistenz
- SQLite als einfache Standard-Datenbank

Das ist kein vollständig strenger Hexagonal- oder Clean-Architecture-Ansatz, aber die Trennung ist für das Projekt sinnvoll und gut wartbar.

## Backend-Architektur

```text
HTTP / FastAPI
  -> app/main.py
  -> app/api/*

Services / Use-Cases
  -> app/services/*

Contracts / Ports
  -> app/contracts/*

Adapters / Persistenz
  -> app/adapters/*

DB / Schemas / Session
  -> app/db/*
```

## Backend-Schichten

### `app/main.py`

Verantwortlich für:

- FastAPI-App
- zentrale Endpunkt-Definitionen
- CORS
- SQLite-Startlogik
- Seed-Logik
- leichte Schema-Migration für bestehende SQLite-Dateien

### `app/api/`

Enthält dünne Wrapper-Funktionen für den HTTP-Zugriff.

Wichtig:

- `books.py` delegiert an `BooksService`
- `inventory.py` delegiert an `InventoryService`
- `suppliers.py` enthält aktuell Lieferanten-, Bestell- und Wareneingangslogik mit DB-Zugriff

Hinweis:

- `suppliers.py` ist momentan funktional, aber etwas breiter als ideal
- langfristig könnte man Bestellungen und Wareneingänge in eigene Module oder Services auslagern

### `app/services/`

Zentrale Fachlogik:

- `BooksService`
- `InventoryService`

Aktuell sitzt die wichtigste Business-Regel im `InventoryService`:

- `IN`, `OUT`, `CORRECTION`
- Bestand darf nicht negativ werden
- Bewegung und Bestandsänderung werden zusammen persistiert

### `app/contracts/`

Definiert die Persistenz-Ports:

- `BookRepository`
- `MovementRepository`

Damit kann die Service-Schicht unabhängig von der konkreten Persistenz formuliert werden.

### `app/adapters/`

Implementiert die Ports mit SQLAlchemy:

- `SqlAlchemyBookRepository`
- `SqlAlchemyMovementRepository`

Zusätzlich liegt hier Hilfslogik für ID-Erzeugung und Pflege der Lieferanten-Zuordnung pro Buch.

### `app/db/`

Enthält:

- SQLAlchemy-Modelle
- Pydantic-Schemas
- Session/Engine
- Seed-SQL

Wichtige Dateien:

- `models.py`
- `schemas.py`
- `session.py`
- `buchhadlung.sql`

## Frontend-Architektur

Der Frontend-Einstieg liegt in:

- `src1/frontend/src/App.tsx`

Die Anwendung ist aktuell stark in einer zentralen App-Datei organisiert. Dort befinden sich:

- Navigation/Seitenzustand
- Datenladen über API
- Bestell- und Wareneingangs-Workflow
- Verkauf und mobile Verkaufsansicht
- Lieferanten-Ansicht

Zusätzlich gibt es bereits erste Feature-/UI-Bausteine unter:

- `src/features/`
- `src/components/ui/`
- `src/api/client.ts`

Bewertung:

- für das Projekt funktioniert der Aufbau
- langfristig wäre eine stärkere Aufteilung in Feature-Komponenten sinnvoll
- besonders `App.tsx` ist inzwischen groß und ein Kandidat für Refactoring

## Datenmodell

Die wichtigsten Tabellen sind:

- `books`
- `suppliers`
- `book_suppliers`
- `movements`
- `purchase_orders`
- `incoming_deliveries`

### Modellierungsentscheidung

`books.supplier_id` bleibt erhalten, obwohl es zusätzlich `book_suppliers` gibt.

Grund:

- bestehende UI-Flows arbeiten mit einem primären oder zuletzt genutzten Lieferanten
- `book_suppliers` bildet die eigentliche N:M-Beziehung ab

So bleibt das Modell rückwärtskompatibel, ohne auf Mehrfach-Lieferanten zu verzichten.

## Typischer Datenfluss

### Beispiel: Wareneingang einbuchen

```text
Frontend
  -> POST /incoming-deliveries/{delivery_id}/book
  -> main.py Endpoint
  -> app/api/suppliers.py
  -> Buchbestand erhöhen
  -> Einkaufspreis / Lieferant aktualisieren
  -> Buch-Lieferant-Zuordnung synchronisieren
  -> IN-Movement anlegen
  -> Incoming Delivery löschen
```

### Beispiel: Lagerbewegung anlegen

```text
Frontend / API Client
  -> POST /movements
  -> app/main.py
  -> app/api/inventory.py
  -> InventoryService.create_movement(...)
  -> Repository + DB Commit
```

## Stärken der aktuellen Architektur

- klarer produktiver Code-Bereich unter `src1/`
- Backend-Schichten sind grundsätzlich sauber getrennt
- Persistenz ist für das Projekt nachvollziehbar modelliert
- wichtige Lagerregeln sind zentral gekapselt
- Bestellung und Wareneingang sind jetzt persistent in der DB

## Aktuelle Schwächen / technische Schulden

- `App.tsx` ist zu groß und enthält zu viele Verantwortlichkeiten
- Lieferanten-/Bestelllogik liegt teilweise noch direkt in `app/api/suppliers.py`
- es gibt noch einige Legacy-/Template-Artefakte im Repo-Root

## Empfohlene nächste Schritte

1. Frontend in kleinere Feature-Dateien aufteilen
2. Lieferanten, Bestellungen und Wareneingänge in eigene Backend-Module/Services verschieben
3. Backend-Testabdeckung über reinen Schematest hinaus erweitern
4. übrige Legacy-/Template-Dateien im Root-Bereich weiter bereinigen

---

**Letzte Aktualisierung:** 2026-04-19
