from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class BookSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str | None = None
    name: str
    author: str = ""
    description: str
    purchase_price: float = Field(validation_alias=AliasChoices("purchase_price", "purchasePrice"))
    sell_price: float = Field(validation_alias=AliasChoices("sell_price", "sellingPrice"))
    quantity: int = 0
    sku: str = ""
    category: str = ""
    supplier_id: str = Field(default="", validation_alias=AliasChoices("supplier_id", "supplierId"))
    created_at: str | None = None
    updated_at: str | None = None
    notes: str | None = None


class MovementSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    book_id: str
    book_name: str = ""
    quantity_change: int
    movement_type: str  # IN, OUT, CORRECTION
    reason: str | None = None
    timestamp: str | None = None
    performed_by: str = "system"


class SupplierSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    contact: str = ""
    address: str = ""
    notes: str | None = None
    created_at: str | None = None


class SupplierStockEntry(BaseModel):
    book_id: str
    book_name: str
    quantity: int
    price: float


class SupplierOrderRequest(BaseModel):
    book_id: str
    quantity: int
    performed_by: str = "system"


class PurchaseOrderSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    supplier_id: str
    supplier_name: str = ""
    book_id: str
    book_name: str = ""
    book_sku: str = ""
    unit_price: float = 0
    quantity: int
    delivered_quantity: int = 0
    status: str = "offen"
    created_at: str | None = None
    delivered_at: str | None = None


class ReceivePurchaseOrderRequest(BaseModel):
    quantity: int


class IncomingDeliverySchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    order_id: str
    supplier_id: str
    supplier_name: str = ""
    book_id: str
    book_name: str = ""
    quantity: int
    unit_price: float = 0
    received_at: str | None = None


class BookIncomingDeliveryRequest(BaseModel):
    performed_by: str = "system"
