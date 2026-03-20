from sqlalchemy.orm import Session

from app.db.models import Movement
from app.db.schemas import MovementSchema


def get_all_movements(db: Session) -> list[Movement]:
    """Alle Lagerbewegungen abrufen."""
    pass


def get_movement(db: Session, movement_id: str) -> Movement | None:
    """Eine Lagerbewegung per ID abrufen."""
    pass


def create_movement(db: Session, movement: MovementSchema) -> Movement:
    """Neue Lagerbewegung anlegen."""
    pass


def update_movement(db: Session, movement_id: str, movement: MovementSchema) -> Movement | None:
    """Lagerbewegung aktualisieren."""
    pass


def delete_movement(db: Session, movement_id: str) -> bool:
    """Lagerbewegung löschen. Gibt True zurück wenn erfolgreich."""
    pass
