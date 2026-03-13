from typing import List

from fastapi import APIRouter

from ..db.schemas import InventoryItemRead

router = APIRouter()


@router.get("/", response_model=List[InventoryItemRead])
async def list_inventory() -> List[InventoryItemRead]:
    """
    Placeholder endpoint for listing inventory entries (book + stock information).
    """
    # TODO: implement query that joins books with stock levels
    return []

