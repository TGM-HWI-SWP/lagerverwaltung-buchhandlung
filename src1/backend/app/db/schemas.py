from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.time import normalize_optional_timestamp


class LocationFieldsMixin(BaseModel):
    address: str = ""
    location_display_name: str = ""
    location_street: str = ""
    location_house_number: str = ""
    location_postcode: str = ""
    location_city: str = ""
    location_state: str = ""
    location_country: str = ""
    location_lat: str = ""
    location_lon: str = ""
    location_source: str = "manual"
    location_source_id: str = ""

    @field_validator(
        "address",
        "location_display_name",
        "location_street",
        "location_house_number",
        "location_postcode",
        "location_city",
        "location_state",
        "location_country",
        "location_lat",
        "location_lon",
        "location_source",
        "location_source_id",
        mode="before",
    )
    @classmethod
    def normalize_location_strings(cls, value: str | None) -> str:
        return (value or "").strip()


class SupplierSchema(LocationFieldsMixin):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    contact: str = ""
    notes: str | None = None
    created_at: str | None = None

    @field_validator("id", "contact", mode="before")
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


class SupplierCreateRequest(LocationFieldsMixin):
    id: str = ""
    name: str = Field(min_length=1, max_length=160)
    contact: str = ""
    notes: str | None = None

    @field_validator("id", "contact", mode="before")
    @classmethod
    def normalize_optional_strings(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("name")
    @classmethod
    def normalize_supplier_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Lieferantenname darf nicht leer sein")
        return normalized

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_optional_notes(cls, value: str | None) -> str | None:
        normalized = (value or "").strip()
        return normalized or None


class LocationSearchResultSchema(BaseModel):
    display_name: str = ""
    street: str = ""
    house_number: str = ""
    postcode: str = ""
    city: str = ""
    state: str = ""
    country: str = ""
    lat: str = ""
    lon: str = ""
    source: str = "nominatim"
    source_id: str = ""
