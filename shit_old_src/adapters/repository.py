"""Repository Adapter - In-Memory und persistente Implementierungen"""

from typing import Dict, List, Optional

from ..domain.product import Product
from ..domain.warehouse import Movement
from ..ports import RepositoryPort


class InMemoryRepository(RepositoryPort):
    """In-Memory Repository - schnell für Tests und schnelle Prototypen"""

    def __init__(self):
        self.products: Dict[str, Product] = {}
        self.movements: List[Movement] = []

    def save_product(self, product: Product) -> None:
        """Produkt im Memory speichern"""
        self.products[product.id] = product

    def load_product(self, product_id: str) -> Optional[Product]:
        """Produkt aus Memory laden"""
        return self.products.get(product_id)

    def load_all_products(self) -> Dict[str, Product]:
        """Alle Produkte aus Memory laden"""
        return self.products.copy()

    def delete_product(self, product_id: str) -> None:
        """Produkt aus Memory löschen"""
        if product_id in self.products:
            del self.products[product_id]

    def save_movement(self, movement: Movement) -> None:
        """Bewegung im Memory speichern"""
        self.movements.append(movement)

    def load_movements(self) -> List[Movement]:
        """Alle Bewegungen aus Memory laden"""
        return self.movements.copy()


class RepositoryFactory:
    """Factory für Repository-Instanzen"""

    @staticmethod
    def create_repository(repository_type: str = "memory") -> RepositoryPort:
        """
        Repository basierend auf Typ erstellen

        Args:
            repository_type: "memory" oder andere (z.B. "sqlite", "json")

        Returns:
            RepositoryPort Instanz
        """
        if repository_type == "memory":
            return InMemoryRepository()
        else:
            raise ValueError(f"Unbekannter Repository-Typ: {repository_type}")
