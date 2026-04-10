from sqlalchemy.orm import Session

from app.adapters.sqlalchemy_repositories import SqlAlchemyBookRepository, SqlAlchemyMovementRepository
from app.db.models import Movement
from app.db.schemas import MovementSchema
from app.services.inventory import InventoryService


def get_all_movements(db: Session) -> list[Movement]:
    return InventoryService(
        db=db,
        books=SqlAlchemyBookRepository(db),
        movements=SqlAlchemyMovementRepository(db),
    ).list_movements()


def get_movement(db: Session, movement_id: str) -> Movement | None:
    return InventoryService(
        db=db,
        books=SqlAlchemyBookRepository(db),
        movements=SqlAlchemyMovementRepository(db),
    ).get_movement(movement_id)


def create_movement(db: Session, movement: MovementSchema) -> Movement:
    return InventoryService(
        db=db,
        books=SqlAlchemyBookRepository(db),
        movements=SqlAlchemyMovementRepository(db),
    ).create_movement(movement)


def update_movement(db: Session, movement_id: str, movement: MovementSchema) -> Movement | None:
    return InventoryService(
        db=db,
        books=SqlAlchemyBookRepository(db),
        movements=SqlAlchemyMovementRepository(db),
    ).update_movement(movement_id, movement)


def delete_movement(db: Session, movement_id: str) -> bool:
    return InventoryService(
        db=db,
        books=SqlAlchemyBookRepository(db),
        movements=SqlAlchemyMovementRepository(db),
    ).delete_movement(movement_id)
