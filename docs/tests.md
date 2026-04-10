# Test-Dokumentation

## Übersicht

Dieses Dokument beschreibt die Test-Strategie und Test-Struktur des Projekts.

**Wichtig:** Das Repository enthält derzeit zwei “Generationen”:

- **Aktuelles Produkt (FastAPI Backend + React Frontend):** `src1/`
- **Alte Projektvorlage (PyQt/Domain Template):** Teile der Root-Tests unter `tests/` beziehen sich noch darauf

Diese Doku bezieht sich primär auf das **aktuelle Backend** unter `src1/backend/`.

## Test-Anatomie

### Unit Tests

**Ziel:** Einzelne Komponenten isoliert testen (ohne externe Abhängigkeiten)

**Empfohlener Speicherort (Backend):** `src1/backend/tests/unit/`

#### Typische Unit-Test-Ziele (Backend)

- Services:
  - `BooksService` (delegiert, eher dünn)
  - `InventoryService` (Regeln: OUT/IN/CORRECTION, Bestand darf nicht negativ werden)
- Contracts:
  - Repositories via Test-Doubles/Mocks (`Protocol`-Spec)

### Integration Tests

**Ziel:** Mehrere Komponenten zusammen testen

**Empfohlener Speicherort (Backend):** `src1/backend/tests/integration/`

#### Typische Integration-Test-Ziele (Backend)

- FastAPI Endpoints per `httpx` TestClient
- SQLAlchemy + SQLite (isolierte DB pro Test)
- End-to-End: `POST /books` → `POST /movements` → `GET /inventory`

## Test-Fixtures

```python
@pytest.fixture
def service():
    """Beispiel: Service mit Fake-Repositories oder Test-DB"""
    ...
```

## Test-Ausführung

### Alle Tests
```bash
pytest tests/ -v
```

### Backend-Tests (empfohlen)

Wenn du Tests unter `src1/backend/tests/` anlegst:

```bash
cd src1/backend
pytest -q
```

### Nur Unit Tests
```bash
pytest tests/unit/ -v
```

### Nur Integration Tests
```bash
pytest tests/integration/ -v
```

### Mit Coverage
```bash
pytest --cov=src tests/ --cov-report=html
```

Für das Backend:

```bash
cd src1/backend
pytest --cov=app --cov-report=term-missing
```

### Einzelnen Test ausführen
```bash
pytest tests/unit/test_domain.py::TestProduct::test_product_creation -v
```

## Coverage-Ziele

- **Domain Layer:** 100% Abdeckung
- **Services:** 95%+ Abdeckung
- **Adapters:** 90%+ Abdeckung
- **UI:** Manuelle Tests (GUI-Tests optional)

## Test-Naming-Konvention

```
test_<component>_<action>_<expected_result>

Beispiele:
- test_product_creation()                        ✓
- test_product_validation_negative_price()       ✓
- test_warehouse_service_add_to_stock()          ✓
- test_full_workflow()                           ✓
```

## Fehler-Test-Patterns

### Exception-Tests
```python
def test_update_quantity_insufficient(self):
    product = Product(..., quantity=5)
    with pytest.raises(ValueError):
        product.update_quantity(-10)
```

### Assertion-Patterns
```python
def test_add_to_stock(self, service):
    service.add_to_stock("P001", 3)
    product = service.get_product("P001")
    assert product.quantity == 8
```

## Test-Daten

### Dummy-Produkte
```python
service.create_product(
    product_id="P001",
    name="Test Laptop",
    description="High-End Laptop",
    price=1200.0,
    category="Elektronik",
    initial_quantity=5
)
```

### Bewegungen
Werden automatisch erstellt bei:
- `add_to_stock()` → Movement mit Typ "IN"
- `remove_from_stock()` → Movement mit Typ "OUT"

## CI/CD-Integration (Optional)

Zukünftig können Tests automatisiert werden:

```yaml
# .github/workflows/tests.yml (Beispiel für GitHub Actions)
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: 3.10
      - run: pip install -e . && pip install -e ".[dev]"
      - run: pytest --cov=src
```

## Mockings & Stubs

### In-Memory Repository als Test-Adapter
```python
repository = InMemoryRepository()  # Statt echte Datenbank
service = WarehouseService(repository)
```

### Zukünftig: Mock-Objects
```python
from unittest.mock import Mock
mock_repository = Mock(spec=RepositoryPort)
mock_repository.load_product.return_value = test_product
service = WarehouseService(mock_repository)
```

## Test-Wartung

### Hinzufügen neuer Tests
1. Feature implementieren
2. Test schreiben (Test-First oder nach)
3. Test ausführen und bestätigen
4. In Git committen

```bash
git commit -m "Test: Add test_product_validation_empty_name"
git commit -m "Feat: Implement empty name validation"
```

### Test-Refactoring
- Tests sollten wartbar sein
- DRY-Prinzip auch bei Tests
- Fixtures verwenden für Wiederverwendung

## Known Issues & TODOs

- [ ] Backend-Tests unter `src1/backend/tests/` konsolidieren (statt Template-Tests in Root)
- [ ] API Contract Tests (Schemas/Validation)
- [ ] Performance-Tests für große Datenmengen
- [ ] Concurrency/Stress Tests (optional)

## Test-Metriken

Ziel pro Milestone:

| Milestone | Unit-Tests | Integration | Coverage |
|-----------|-----------|-------------|----------|
| v0.2      | 5+        | 1           | 80%+     |
| v0.3      | 10+       | 3           | 85%+     |
| v0.5      | 15+       | 5           | 90%+     |
| v1.0      | 20+       | 8           | 95%+     |

---

**Letzte Aktualisierung:** 2026-04-10
**Version:** 0.2
