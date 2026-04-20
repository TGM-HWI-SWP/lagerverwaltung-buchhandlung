from sqlalchemy import Column, String, Text
from sqlalchemy.orm import declarative_base
from sqlalchemy.types import DateTime

Base = declarative_base()


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    contact = Column(String, nullable=False, default="")
    address = Column(String, nullable=False, default="")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False)


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True)
    timestamp = Column(DateTime, nullable=False)
    performed_by = Column(String, nullable=False, default="system")
    action = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    changes = Column(Text, nullable=True)
    reason = Column(String, nullable=True)
