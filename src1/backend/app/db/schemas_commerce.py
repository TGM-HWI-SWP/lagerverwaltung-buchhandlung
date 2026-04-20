from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.time import normalize_optional_timestamp


class CatalogProductSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sku: str
    title: str
    author: str = ""
    description: str = ""
    category: str = ""
    is_active: bool = True
    selling_price: float = 0
    reorder_point: int = 0
    created_at: str | None = None
    updated_at: str | None = None

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_timestamp_fields(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)


class CatalogProductCreateRequest(BaseModel):
    sku: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=255)
    author: str = ""
    description: str = ""
    category: str = ""
    selling_price: float = Field(ge=0)
    reorder_point: int = Field(default=0, ge=0)

    @field_validator("sku", "title", "author", "description", "category", mode="before")
    @classmethod
    def strip_text(cls, value: str | None) -> str:
        return (value or "").strip()


class CatalogProductUpdateRequest(BaseModel):
    title: str | None = None
    author: str | None = None
    description: str | None = None
    category: str | None = None
    is_active: bool | None = None
    selling_price: float | None = Field(default=None, ge=0)
    reorder_point: int | None = Field(default=None, ge=0)


class WarehouseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    name: str
    location_display_name: str = ""
    location_street: str = ""
    location_house_number: str = ""
    location_postcode: str = ""
    location_city: str = ""
    location_state: str = ""
    location_country: str = ""
    location_lat: str = ""
    location_lon: str = ""
    location_source: str = "manual"
    location_source_id: str = ""
    is_active: bool = True
    created_at: str | None = None

    @field_validator(
        "location_display_name",
        "location_street",
        "location_house_number",
        "location_postcode",
        "location_city",
        "location_state",
        "location_country",
        "location_lat",
        "location_lon",
        "location_source",
        "location_source_id",
        mode="before",
    )
    @classmethod
    def normalize_location_fields(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("created_at", mode="before")
    @classmethod
    def normalize_created_at(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)


class WarehouseCreateRequest(BaseModel):
    code: str = Field(min_length=1, max_length=32)
    name: str = Field(min_length=1, max_length=120)
    location_display_name: str = ""
    location_street: str = ""
    location_house_number: str = ""
    location_postcode: str = ""
    location_city: str = Field(min_length=1, max_length=120)
    location_state: str = ""
    location_country: str = Field(min_length=1, max_length=120)
    location_lat: str = ""
    location_lon: str = ""
    location_source: str = "manual"
    location_source_id: str = ""

    @field_validator("code", mode="before")
    @classmethod
    def normalize_code(cls, value: str | None) -> str:
        return (value or "").strip().upper()

    @field_validator("name", mode="before")
    @classmethod
    def normalize_name(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator(
        "location_display_name",
        "location_street",
        "location_house_number",
        "location_postcode",
        "location_city",
        "location_state",
        "location_country",
        "location_lat",
        "location_lon",
        "location_source",
        "location_source_id",
        mode="before",
    )
    @classmethod
    def normalize_location_strings(cls, value: str | None) -> str:
        return (value or "").strip()


class WarehouseUpdateRequest(BaseModel):
    name: str | None = None
    is_active: bool | None = None
    location_display_name: str | None = None
    location_street: str | None = None
    location_house_number: str | None = None
    location_postcode: str | None = None
    location_city: str | None = None
    location_state: str | None = None
    location_country: str | None = None
    location_lat: str | None = None
    location_lon: str | None = None
    location_source: str | None = None
    location_source_id: str | None = None

    @field_validator(
        "name",
        "location_display_name",
        "location_street",
        "location_house_number",
        "location_postcode",
        "location_city",
        "location_state",
        "location_country",
        "location_lat",
        "location_lon",
        "location_source",
        "location_source_id",
        mode="before",
    )
    @classmethod
    def normalize_optional_strings(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()


class StockEntrySchema(BaseModel):
    product_id: str
    sku: str
    title: str
    warehouse_code: str
    on_hand: int
    reserved: int
    reorder_point: int
    selling_price: float


class StockAdjustmentRequest(BaseModel):
    product_id: str
    warehouse_code: str = "STORE"
    quantity_delta: int
    reason: str = "Bestandskorrektur"

    @field_validator("product_id", "warehouse_code", "reason", mode="before")
    @classmethod
    def normalize_text(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("Pflichtfeld darf nicht leer sein")
        return normalized

    @field_validator("warehouse_code")
    @classmethod
    def normalize_warehouse_code(cls, value: str) -> str:
        return value.upper()


class StockLedgerEntrySchema(BaseModel):
    id: str
    product_id: str
    sku: str
    title: str
    warehouse_code: str
    quantity_delta: int
    movement_type: str
    reference_type: str
    reference_id: str
    reason: str
    performed_by: str
    created_at: str


class ProductSupplierSchema(BaseModel):
    supplier_id: str
    supplier_name: str
    supplier_sku: str = ""
    is_primary: bool = False
    last_purchase_price: float = 0


class ProductSupplierLinkRequest(BaseModel):
    supplier_id: str
    supplier_sku: str = ""
    is_primary: bool = False
    last_purchase_price: float = Field(default=0, ge=0)

    @field_validator("supplier_id", "supplier_sku", mode="before")
    @classmethod
    def normalize_supplier_fields(cls, value: str | None) -> str:
        return (value or "").strip()


class ProductSupplierUpsertRequest(BaseModel):
    links: list[ProductSupplierLinkRequest]


class DiscountRuleSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    rule_type: str
    value_type: str
    value: float
    min_order_amount: float
    stackable: bool
    is_active: bool


class DiscountRuleCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    rule_type: str = Field(pattern="^(SEASONAL|FIRST_CUSTOMER|CUSTOM)$")
    value_type: str = Field(pattern="^(PERCENT|FIXED)$")
    value: float = Field(ge=0)
    min_order_amount: float = Field(default=0, ge=0)
    stackable: bool = False


class SaleLineRequest(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)


class SaleCreateRequest(BaseModel):
    warehouse_code: str = "STORE"
    lines: list[SaleLineRequest]
    customer_reference: str = ""
    is_first_customer: bool = False
    custom_discount_amount: float = Field(default=0, ge=0)
    custom_discount_type: str = Field(default="FIXED", pattern="^(FIXED|PERCENT)$")


class SaleLineResponse(BaseModel):
    line_id: str
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    discount: float
    total: float


class AppliedDiscountResponse(BaseModel):
    description: str
    amount: float


class SaleOrderResponse(BaseModel):
    order_id: str
    order_number: str
    warehouse_code: str
    status: str
    created_at: str
    subtotal: float
    discount_total: float
    total: float
    lines: list[SaleLineResponse]
    discounts: list[AppliedDiscountResponse]


class ReturnLineRequest(BaseModel):
    sales_order_line_id: str
    quantity: int = Field(gt=0)
    exchange_product_id: str | None = None
    exchange_quantity: int = Field(default=0, ge=0)


class ReturnCreateRequest(BaseModel):
    reason: str = "Retour"
    lines: list[ReturnLineRequest]


class ReturnOrderResponse(BaseModel):
    return_id: str
    return_number: str
    refund_total: float


class PurchaseOrderLineCreateRequest(BaseModel):
    product_id: str
    quantity: int = Field(gt=0)
    unit_cost: float = Field(ge=0)


class PurchaseOrderCreateRequest(BaseModel):
    supplier_id: str
    notes: str = ""
    lines: list[PurchaseOrderLineCreateRequest]


class PurchaseOrderLineReceiveRequest(BaseModel):
    line_id: str
    receive_quantity: int = Field(gt=0)


class PurchaseOrderReceiveRequest(BaseModel):
    warehouse_code: str = "STORE"
    lines: list[PurchaseOrderLineReceiveRequest]


class PurchaseOrderLineResponse(BaseModel):
    line_id: str
    product_id: str
    product_title: str
    quantity: int
    received_quantity: int
    remaining_quantity: int
    unit_cost: float


class PurchaseOrderResponse(BaseModel):
    id: str
    order_number: str
    supplier_id: str
    supplier_name: str
    status: str
    ordered_at: str
    received_at: str | None = None
    lines: list[PurchaseOrderLineResponse]
