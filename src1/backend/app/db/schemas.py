from pydantic import BaseModel, ConfigDict, field_validator

from app.core.time import normalize_optional_timestamp


class SupplierSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    contact: str = ""
    address: str = ""
    notes: str | None = None
    created_at: str | None = None

    @field_validator("id", "contact", "address", mode="before")
    @classmethod
    def normalize_supplier_strings(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("name")
    @classmethod
    def validate_supplier_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Lieferantenname darf nicht leer sein")
        return normalized

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_supplier_notes(cls, value: str | None) -> str | None:
        normalized = (value or "").strip()
        return normalized or None

    @field_validator("created_at", mode="before")
    @classmethod
    def normalize_supplier_created_at(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)
