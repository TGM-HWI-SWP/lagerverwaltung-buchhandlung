from pydantic import BaseModel


class BookSchema(BaseModel):
    id: str | None = None
    name: str
    author: str = ""
    description: str
    price: float
    quantity: int = 0
    sku: str = ""
    category: str = ""
    created_at: str | None = None
    updated_at: str | None = None
    notes: str | None = None

    class Config:
        from_attributes = True


class MovementSchema(BaseModel):
    id: str | None = None
    book_id: str
    book_name: str = ""
    quantity_change: int
    movement_type: str  # IN, OUT, CORRECTION
    reason: str | None = None
    timestamp: str | None = None
    performed_by: str = "system"

    class Config:
        from_attributes = True
