from fastapi import Query
from sqlalchemy.orm import Session

from app.services.activity_log import ActivityLogService


def _service(db: Session) -> ActivityLogService:
    return ActivityLogService(db)


def get_activity_logs(
    db: Session,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    entity_type: str | None = None,
    entity_id: str | None = None,
    performed_by: str | None = None,
):
    """Retrieve activity logs with optional filtering and pagination."""
    return _service(db).list_logs(
        offset=offset,
        limit=limit,
        entity_type=entity_type,
        entity_id=entity_id,
        performed_by=performed_by,
    )


def count_activity_logs(
    db: Session,
    entity_type: str | None = None,
    entity_id: str | None = None,
    performed_by: str | None = None,
) -> int:
    """Count activity logs matching filters."""
    return _service(db).count_logs(
        entity_type=entity_type,
        entity_id=entity_id,
        performed_by=performed_by,
    )
