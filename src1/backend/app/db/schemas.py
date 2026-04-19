from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.time import normalize_optional_timestamp


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

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Buchname darf nicht leer sein")
        return normalized

    @field_validator("author", "description", "sku", "category", "supplier_id", mode="before")
    @classmethod
    def normalize_string_fields(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_optional_notes(cls, value: str | None) -> str | None:
        normalized = (value or "").strip()
        return normalized or None

    @field_validator("purchase_price", "sell_price")
    @classmethod
    def validate_non_negative_price(cls, value: float) -> float:
        if value < 0:
            raise ValueError("Preis darf nicht negativ sein")
        return value

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Bestand darf nicht negativ sein")
        return value

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_timestamps(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)


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

    @field_validator("book_id", mode="before")
    @classmethod
    def validate_book_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("book_id darf nicht leer sein")
        return normalized

    @field_validator("book_name", "performed_by", mode="before")
    @classmethod
    def normalize_required_strings(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_optional_reason(cls, value: str | None) -> str | None:
        normalized = (value or "").strip()
        return normalized or None

    @field_validator("movement_type")
    @classmethod
    def validate_movement_type(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized not in {"IN", "OUT", "CORRECTION"}:
            raise ValueError("movement_type muss IN, OUT oder CORRECTION sein")
        return normalized

    @field_validator("quantity_change")
    @classmethod
    def validate_quantity_change(cls, value: int) -> int:
        if value == 0:
            raise ValueError("quantity_change darf nicht 0 sein")
        return value

    @field_validator("timestamp", mode="before")
    @classmethod
    def normalize_optional_timestamp_field(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)


class SupplierSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    contact: str = ""
    address: str = ""
    notes: str | None = None
    created_at: str | None = None

    @field_validator("id", "contact", "address", mode="before")
    @classmethod
    def normalize_supplier_strings(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("name")
    @classmethod
    def validate_supplier_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Lieferantenname darf nicht leer sein")
        return normalized

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_supplier_notes(cls, value: str | None) -> str | None:
        normalized = (value or "").strip()
        return normalized or None

    @field_validator("created_at", mode="before")
    @classmethod
    def normalize_supplier_created_at(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)


class SupplierStockEntry(BaseModel):
    book_id: str
    book_name: str
    quantity: int
    price: float


class SupplierOrderRequest(BaseModel):
    book_id: str
    quantity: int
    performed_by: str = "system"

    @field_validator("book_id", "performed_by", mode="before")
    @classmethod
    def normalize_supplier_order_strings(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("Pflichtfeld darf nicht leer sein")
        return normalized


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

    @field_validator("supplier_id", "book_id", mode="before")
    @classmethod
    def validate_purchase_order_required_ids(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("Pflichtfeld darf nicht leer sein")
        return normalized

    @field_validator("supplier_name", "book_name", "book_sku", mode="before")
    @classmethod
    def normalize_purchase_order_strings(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("unit_price")
    @classmethod
    def validate_unit_price(cls, value: float) -> float:
        if value < 0:
            raise ValueError("unit_price darf nicht negativ sein")
        return value

    @field_validator("quantity", "delivered_quantity")
    @classmethod
    def validate_purchase_quantities(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Mengen dürfen nicht negativ sein")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"offen", "teilgeliefert", "geliefert"}:
            raise ValueError("status muss offen, teilgeliefert oder geliefert sein")
        return normalized

    @field_validator("created_at", "delivered_at", mode="before")
    @classmethod
    def normalize_purchase_timestamps(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)

    @model_validator(mode="after")
    def validate_purchase_order_consistency(self) -> "PurchaseOrderSchema":
        if self.quantity <= 0:
            raise ValueError("quantity muss größer als 0 sein")
        if self.delivered_quantity > self.quantity:
            raise ValueError("delivered_quantity darf nicht größer als quantity sein")
        return self


class ReceivePurchaseOrderRequest(BaseModel):
    quantity: int

    @field_validator("quantity")
    @classmethod
    def validate_receive_quantity(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity muss größer als 0 sein")
        return value


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

    @field_validator("order_id", "supplier_id", "book_id", mode="before")
    @classmethod
    def validate_incoming_required_ids(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("Pflichtfeld darf nicht leer sein")
        return normalized

    @field_validator("supplier_name", "book_name", mode="before")
    @classmethod
    def normalize_incoming_strings(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("quantity")
    @classmethod
    def validate_incoming_quantity(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity muss größer als 0 sein")
        return value

    @field_validator("unit_price")
    @classmethod
    def validate_incoming_unit_price(cls, value: float) -> float:
        if value < 0:
            raise ValueError("unit_price darf nicht negativ sein")
        return value

    @field_validator("received_at", mode="before")
    @classmethod
    def normalize_received_at(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)


class BookIncomingDeliveryRequest(BaseModel):
    performed_by: str = "system"

    @field_validator("performed_by", mode="before")
    @classmethod
    def normalize_book_incoming_delivery_request(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        return normalized or "system"


class ActivityLogSchema(BaseModel):
     model_config = ConfigDict(from_attributes=True)

     id: str | None = None
     timestamp: str
     performed_by: str = "system"
     action: str
     entity_type: str
     entity_id: str
     changes: str | None = None
     reason: str | None = None
