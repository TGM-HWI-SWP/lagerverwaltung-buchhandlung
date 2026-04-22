from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Book:
    id: str
    name: str
    description: str
    purchase_price: float
    sell_price: float
    created_at: str
    updated_at: str
    author: str = ""
    quantity: int = 0
    sku: str = ""
    category: str = ""
    supplier_id: str = ""
    notes: str | None = None


@dataclass
class Movement:
    id: str
    book_id: str
    book_name: str
    quantity_change: int
    movement_type: str
    timestamp: str
    reason: str | None = None
    performed_by: str = "system"


@dataclass
class Supplier:
    id: str
    name: str
    created_at: str
    contact: str = ""
    address: str = ""
    notes: str | None = None


@dataclass
class PurchaseOrder:
    id: str
    supplier_id: str
    supplier_name: str
    book_id: str
    book_name: str
    quantity: int
    created_at: str
    book_sku: str = ""
    unit_price: float = 0.0
    delivered_quantity: int = 0
    status: str = "offen"
    delivered_at: str | None = None


@dataclass
class IncomingDelivery:
    id: str
    order_id: str
    supplier_id: str
    supplier_name: str
    book_id: str
    book_name: str
    quantity: int
    received_at: str
    unit_price: float = 0.0


@dataclass
class BookSupplierLink:
    id: str
    book_id: str
    supplier_id: str
    created_at: str
    updated_at: str
    supplier_sku: str = ""
    is_primary: bool = False
    last_purchase_price: float = 0.0


@dataclass
class SupplierStockEntry:
    book_id: str
    book_name: str
    quantity: int
    price: float
