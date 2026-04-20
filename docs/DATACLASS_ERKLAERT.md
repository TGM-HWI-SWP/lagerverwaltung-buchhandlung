# `@dataclass` kurz erklärt

Dieses Dokument ist ein internes Lern- und Hilfsdokument. Es gehört nicht zum eigentlichen Produkt-Contract der Buchhandlungsverwaltung, bleibt aber als kompakte Erklärung im Repo erhalten.

## Wozu `@dataclass`?

`@dataclass` reduziert Boilerplate für einfache Datenobjekte. Python erzeugt automatisch unter anderem:

- `__init__()`
- `__repr__()`
- `__eq__()`

Dadurch werden Klassen mit vielen Feldern deutlich kürzer und leichter lesbar.

## Einfaches Beispiel

```python
from dataclasses import dataclass

@dataclass
class Product:
    id: str
    name: str
    price: float
    quantity: int = 0
```

Das ersetzt in vielen Fällen eine deutlich längere manuelle Klasse.

## Typischer Vorteil

Ohne `@dataclass` müsste man Konstruktor, String-Darstellung und Vergleichslogik oft selbst schreiben. Für reine Datencontainer ist das meist unnötige Wiederholung.

## `field(default_factory=...)`

Für veränderliche Standardwerte wie Listen oder Dictionaries sollte `default_factory` verwendet werden:

```python
from dataclasses import dataclass, field

@dataclass
class Product:
    tags: list[str] = field(default_factory=list)
```

So bekommt jede Instanz ihre eigene Liste.

## `__post_init__()`

Wenn nach dem automatischen Konstruktor noch Validierung oder Zusatzlogik nötig ist, kann `__post_init__()` verwendet werden:

```python
from dataclasses import dataclass

@dataclass
class Product:
    id: str
    price: float

    def __post_init__(self) -> None:
        if self.price < 0:
            raise ValueError("Preis darf nicht negativ sein")
```

## Einordnung für dieses Repo

- `@dataclass` ist ein Python-Sprachfeature und keine zentrale Architekturentscheidung dieses Projekts.
- Für die eigentliche Produktlogik werden hier vor allem SQLAlchemy-Modelle und Pydantic-Schemas verwendet.
- Dieses Dokument dient nur als ergänzende Lernnotiz.
