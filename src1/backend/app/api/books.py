from typing import List

from fastapi import APIRouter

from ..db.schemas import BookRead, BookCreate

router = APIRouter()


@router.get("/", response_model=List[BookRead])
async def list_books() -> List[BookRead]:
    """
    Placeholder endpoint for listing all books in the inventory.
    """
    # TODO: implement database access using SQLAlchemy session
    return []


@router.post("/", response_model=BookRead, status_code=201)
async def create_book(book: BookCreate) -> BookRead:
    """
    Placeholder endpoint for creating a new book.
    """
    # TODO: persist book in PostgreSQL and return created entity
    return BookRead(id=1, **book.model_dump())

