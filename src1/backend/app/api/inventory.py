from fastapi import Query
from sqlalchemy.orm import Session

from app.adapters.sqlalchemy_repositories import SqlAlchemyBookRepository, SqlAlchemyMovementRepository
from app.db.models import Movement
from app.db.schemas import MovementSchema
from app.services.inventory import InventoryService


def _service(db: Session) -> InventoryService:
    return InventoryService(
        db=db,
        books=SqlAlchemyBookRepository(db),
        movements=SqlAlchemyMovementRepository(db),
    )


def get_all_movements(
    db: Session,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[Movement]:
    return _service(db).list_movements_paginated(offset=offset, limit=limit)


def get_movement(db: Session, movement_id: str) -> Movement | None:
    return _service(db).get_movement(movement_id)


def create_movement(db: Session, movement: MovementSchema) -> Movement:
    return _service(db).create_movement(movement)


def update_movement(db: Session, movement_id: str, movement: MovementSchema) -> Movement | None:
    return _service(db).update_movement(movement_id, movement)


def delete_movement(db: Session, movement_id: str) -> bool:
    return _service(db).delete_movement(movement_id)
