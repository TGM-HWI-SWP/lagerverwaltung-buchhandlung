from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.time import utc_now_iso
from app.db.models import ActivityLog


class ActivityLogService:
    def __init__(self, db: Session):
        self._db = db

    def list_logs(
        self,
        *,
        offset: int = 0,
        limit: int = 50,
        entity_type: str | None = None,
        entity_id: str | None = None,
        performed_by: str | None = None,
    ) -> list[ActivityLog]:
        q = self._db.query(ActivityLog)
        if entity_type:
            q = q.filter(ActivityLog.entity_type == entity_type)
        if entity_id:
            q = q.filter(ActivityLog.entity_id == entity_id)
        if performed_by:
            q = q.filter(ActivityLog.performed_by == performed_by)

        return (
            q.order_by(ActivityLog.timestamp.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )

    def count_logs(
        self,
        *,
        entity_type: str | None = None,
        entity_id: str | None = None,
        performed_by: str | None = None,
    ) -> int:
        q = self._db.query(func.count(ActivityLog.id))
        if entity_type:
            q = q.filter(ActivityLog.entity_type == entity_type)
        if entity_id:
            q = q.filter(ActivityLog.entity_id == entity_id)
        if performed_by:
            q = q.filter(ActivityLog.performed_by == performed_by)
        return int(q.scalar() or 0)


def write_activity_log(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str,
    performed_by: str | None = None,
    changes: str | None = None,
    reason: str | None = None,
    timestamp: datetime | None = None,
) -> ActivityLog:
    log = ActivityLog(
        id=f"AL-{uuid4().hex[:12].upper()}",
        timestamp=timestamp or datetime.fromisoformat(utc_now_iso()),
        performed_by=(performed_by or "system").strip() or "system",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        changes=changes,
        reason=reason,
    )
    db.add(log)
    return log
