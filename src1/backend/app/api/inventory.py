from sqlalchemy.orm import Session

from app.adapters.schema_mappers import movement_from_schema
from app.api.deps import inventory_service
from app.db.schemas import MovementSchema
from app.domain import models as dm


def get_all_movements(db: Session) -> list[dm.Movement]:
    return inventory_service(db).list_movements()


def get_movement(db: Session, movement_id: str) -> dm.Movement | None:
    return inventory_service(db).get_movement(movement_id)


def create_movement(db: Session, movement: MovementSchema) -> dm.Movement:
    return inventory_service(db).create_movement(movement_from_schema(movement))


def update_movement(db: Session, movement_id: str, movement: MovementSchema) -> dm.Movement | None:
    return inventory_service(db).update_movement(movement_id, movement_from_schema(movement))


def delete_movement(db: Session, movement_id: str) -> bool:
    return inventory_service(db).delete_movement(movement_id)
