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
    location_display_name = Column(String, nullable=False, default="")
    location_street = Column(String, nullable=False, default="")
    location_house_number = Column(String, nullable=False, default="")
    location_postcode = Column(String, nullable=False, default="")
    location_city = Column(String, nullable=False, default="")
    location_state = Column(String, nullable=False, default="")
    location_country = Column(String, nullable=False, default="")
    location_lat = Column(String, nullable=False, default="")
    location_lon = Column(String, nullable=False, default="")
    location_source = Column(String, nullable=False, default="manual")
    location_source_id = Column(String, nullable=False, default="")
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
