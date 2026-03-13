"""Warehouse Domain Model"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, Optional

from .product import Product


@dataclass
class Movement:
    """Bewegungsprotokoll-Eintrag für Lagerbestände"""

    id: str
    product_id: str
    product_name: str
    quantity_change: int
    movement_type: str  # z.B. "IN", "OUT", "CORRECTION"
    reason: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    performed_by: str = "system"


class Warehouse:
    """Verwaltungsklasse für das Lager"""

    def __init__(self, name: str):
        self.name = name
        self.products: Dict[str, Product] = {}
        self.movements: list[Movement] = []

    def add_product(self, product: Product) -> None:
        """Produkt zum Lager hinzufügen"""
        if product.id in self.products:
            raise ValueError(f"Produkt mit ID {product.id} existiert bereits")
        self.products[product.id] = product

    def get_product(self, product_id: str) -> Optional[Product]:
        """Produkt nach ID abrufen"""
        return self.products.get(product_id)

    def record_movement(self, movement: Movement) -> None:
        """Lagerbewegung protokollieren"""
        if movement.product_id not in self.products:
            raise ValueError(
                f"Produkt mit ID {movement.product_id} existiert nicht"
            )
        self.movements.append(movement)

    def get_total_inventory_value(self) -> float:
        """Gesamtwert aller Bestände berechnen"""
        return sum(product.get_total_value() for product in self.products.values())

    def get_inventory_report(self) -> Dict[str, dict]:
        """
        Lagerbestandsbericht erstellen

        Returns:
            Dictionary mit Produktinformationen
        """
        return {
            product_id: {
                "name": product.name,
                "quantity": product.quantity,
                "price": product.price,
                "total_value": product.get_total_value(),
            }
            for product_id, product in self.products.items()
        }
