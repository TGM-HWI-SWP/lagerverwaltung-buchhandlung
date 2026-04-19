from __future__ import annotations

from sqlalchemy import Boolean, CheckConstraint, Column, String, Text

from app.db.models import Base


class StaffUser(Base):
    __tablename__ = "staff_users"
    __table_args__ = (
        CheckConstraint("pin_hash <> ''", name="ck_staff_users_pin_hash_non_empty"),
    )

    id = Column(String, primary_key=True)
    username = Column(String, nullable=False, unique=True)
    display_name = Column(String, nullable=False)
    avatar_image = Column(Text, nullable=False, default="")
    role = Column(String, nullable=False, default="cashier")  # cashier | admin
    pin_hash = Column(String, nullable=False)
    password_hash = Column(String, nullable=False, default="")
    is_active = Column(Boolean, nullable=False, default=True)
