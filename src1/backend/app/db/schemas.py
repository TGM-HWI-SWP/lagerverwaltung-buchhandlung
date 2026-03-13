from pydantic import BaseModel, Field


class BookBase(BaseModel):
    isbn: str = Field(..., max_length=32)
    title: str = Field(..., max_length=255)
    author: str = Field(..., max_length=255)
    publisher: str | None = Field(default=None, max_length=255)
    price: float


class BookCreate(BookBase):
    pass


class BookRead(BookBase):
    id: int

    class Config:
        from_attributes = True


class InventoryItemRead(BaseModel):
    id: int
    book_id: int
    quantity: int
    location: str | None = None

    class Config:
        from_attributes = True

