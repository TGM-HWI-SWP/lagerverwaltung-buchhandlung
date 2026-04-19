from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CatalogProductSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sku: str
    title: str
    author: str = ""
    description: str = ""
    category: str = ""
    is_active: bool = True


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
    reorder_point: int | None = Field(default=None, ge=0)


class StockEntrySchema(BaseModel):
    product_id: str
    sku: str
    title: str
    warehouse_code: str
    on_hand: int
    reserved: int
    reorder_point: int


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
    lines: list[SaleLineRequest]
    customer_reference: str = ""
    is_first_customer: bool = False
    custom_discount_amount: float = Field(default=0, ge=0)


class SaleLineResponse(BaseModel):
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


class PurchaseOrderReceiveLineRequest(BaseModel):
    line_id: str
    receive_quantity: int = Field(gt=0)


class PurchaseOrderReceiveRequest(BaseModel):
    warehouse_code: str = "STORE"
    lines: list[PurchaseOrderReceiveLineRequest]


class PurchaseOrderResponse(BaseModel):
    id: str
    order_number: str
    supplier_id: str
    status: str
