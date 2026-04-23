from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.time import normalize_optional_timestamp


# Pydantic-Schemas an der HTTP-Kante: validieren eingehende Requests und formen Responses.
# NICHT die ORM-Modelle (die liegen in db/models.py) und NICHT die Domain-Dataclasses (domain/models.py).


class BookSchema(BaseModel):
    """HTTP-Schema fuer Buecher - wird fuer Request-Body und Response-JSON verwendet."""

    model_config = ConfigDict(                                                  # from_attributes: ORM-Instanz direkt uebernehmen (model_validate(book))
        from_attributes=True,                                                   # populate_by_name: snake_case und camelCase beide akzeptieren
        populate_by_name=True,
    )

    id: str | None = None                                                       # None beim Anlegen - Server vergibt ID
    name: str
    author: str = ""
    description: str
    purchase_price: float = Field(validation_alias=AliasChoices("purchase_price", "purchasePrice"))  # Frontend schickt camelCase
    sell_price: float = Field(validation_alias=AliasChoices("sell_price", "sellingPrice"))           # Legacy-Alias: "sellingPrice"
    quantity: int = 0
    sku: str = ""
    category: str = ""
    supplier_id: str = Field(default="", validation_alias=AliasChoices("supplier_id", "supplierId"))
    created_at: str | None = None                                               # ISO-String, serverseitig gesetzt
    updated_at: str | None = None
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()                                              # Whitespace trimmen
        if not normalized:
            raise ValueError("Buchname darf nicht leer sein")
        return normalized

    @field_validator("author", "description", "sku", "category", "supplier_id", mode="before")
    @classmethod
    def normalize_string_fields(cls, value: str | None) -> str:
        return (value or "").strip()                                            # mode=before: None wird hier zu "" geschluckt, statt Type-Error

    @field_validator("notes", mode="before")
    @classmethod
    def normalize_optional_notes(cls, value: str | None) -> str | None:
        normalized = (value or "").strip()
        return normalized or None                                               # leerer String -> None, damit DB NULL statt '' hat

    @field_validator("purchase_price", "sell_price")
    @classmethod
    def validate_non_negative_price(cls, value: float) -> float:
        if value < 0:
            raise ValueError("Preis darf nicht negativ sein")                   # doppelte Sicherung zum CheckConstraint in models.py
        return value

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Bestand darf nicht negativ sein")
        return value

    @field_validator("created_at", "updated_at", mode="before")
    @classmethod
    def normalize_timestamps(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)                              # ISO-Format erzwingen (shared helper)


class MovementSchema(BaseModel):
    """HTTP-Schema fuer Lagerbewegungen (IN/OUT/CORRECTION)."""

    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    book_id: str
    book_name: str = ""                                                         # optional - Service ergaenzt aus Buch
    quantity_change: int
    movement_type: str  # IN, OUT, CORRECTION
    reason: str | None = None
    timestamp: str | None = None                                                # serverseitig gesetzt wenn leer
    performed_by: str = "system"

    @field_validator("book_id", mode="before")
    @classmethod
    def validate_book_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("book_id darf nicht leer sein")
        return normalized

    @field_validator("book_name", "performed_by", mode="before")
    @classmethod
    def normalize_required_strings(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("reason", mode="before")
    @classmethod
    def normalize_optional_reason(cls, value: str | None) -> str | None:
        normalized = (value or "").strip()
        return normalized or None                                               # leerer String -> None

    @field_validator("movement_type")
    @classmethod
    def validate_movement_type(cls, value: str) -> str:
        normalized = value.strip().upper()                                      # robust gegen "in"/"In"/"IN"
        if normalized not in {"IN", "OUT", "CORRECTION"}:
            raise ValueError("movement_type muss IN, OUT oder CORRECTION sein")
        return normalized

    @field_validator("quantity_change")
    @classmethod
    def validate_quantity_change(cls, value: int) -> int:
        if value == 0:
            raise ValueError("quantity_change darf nicht 0 sein")               # 0er-Bewegungen sinnlos, waere nur Rauschen in der Historie
        return value

    @field_validator("timestamp", mode="before")
    @classmethod
    def normalize_optional_timestamp_field(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)


class SupplierSchema(BaseModel):
    """HTTP-Schema fuer Lieferanten-Stammdaten."""

    model_config = ConfigDict(from_attributes=True)

    id: str = ""                                                                # leer beim Anlegen -> Service vergibt SXXX
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


class SupplierStockEntry(BaseModel):
    """Ein Buch im Bestand eines bestimmten Lieferanten (Antwort von /suppliers/{id}/stock)."""

    book_id: str
    book_name: str
    quantity: int
    price: float


class SupplierOrderRequest(BaseModel):
    """Request-Body fuer die (derzeit deaktivierte) Schnellbestellung /suppliers/{id}/order."""

    book_id: str
    quantity: int
    performed_by: str = "system"

    @field_validator("book_id", "performed_by", mode="before")
    @classmethod
    def normalize_supplier_order_strings(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("Pflichtfeld darf nicht leer sein")                # beide Felder muessen nach Trim Inhalt haben
        return normalized

    @field_validator("quantity")
    @classmethod
    def validate_supplier_order_quantity(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity muss größer als 0 sein")                 # Bestellmenge muss positiv sein
        return value


class PurchaseOrderSchema(BaseModel):
    """HTTP-Schema fuer eine Bestellung beim Lieferanten."""

    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    supplier_id: str
    supplier_name: str = ""                                                     # Snapshot - Service fuellt aus Lieferant falls leer
    book_id: str
    book_name: str = ""                                                         # Snapshot - Service fuellt aus Buch falls leer
    book_sku: str = ""
    unit_price: float = 0
    quantity: int
    delivered_quantity: int = 0
    status: str = "offen"                                                       # offen | teilgeliefert | geliefert
    created_at: str | None = None
    delivered_at: str | None = None

    @field_validator("supplier_id", "book_id", mode="before")
    @classmethod
    def validate_purchase_order_required_ids(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("Pflichtfeld darf nicht leer sein")
        return normalized

    @field_validator("supplier_name", "book_name", "book_sku", mode="before")
    @classmethod
    def normalize_purchase_order_strings(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("unit_price")
    @classmethod
    def validate_unit_price(cls, value: float) -> float:
        if value < 0:
            raise ValueError("unit_price darf nicht negativ sein")
        return value

    @field_validator("quantity", "delivered_quantity")
    @classmethod
    def validate_purchase_quantities(cls, value: int) -> int:
        if value < 0:
            raise ValueError("Mengen dürfen nicht negativ sein")
        return value

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()                                      # robust gegen Case (z.B. "Offen" -> "offen")
        if normalized not in {"offen", "teilgeliefert", "geliefert"}:
            raise ValueError("status muss offen, teilgeliefert oder geliefert sein")
        return normalized

    @field_validator("created_at", "delivered_at", mode="before")
    @classmethod
    def normalize_purchase_timestamps(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)

    @model_validator(mode="after")
    def validate_purchase_order_consistency(self) -> "PurchaseOrderSchema":
        """Cross-Field-Check: quantity > 0 und delivered_quantity darf quantity nicht ueberschreiten."""
        if self.quantity <= 0:
            raise ValueError("quantity muss größer als 0 sein")
        if self.delivered_quantity > self.quantity:
            raise ValueError("delivered_quantity darf nicht größer als quantity sein")
        return self


class ReceivePurchaseOrderRequest(BaseModel):
    """Request-Body fuer POST /purchase-orders/{id}/receive - nur Liefermenge noetig."""

    quantity: int

    @field_validator("quantity")
    @classmethod
    def validate_receive_quantity(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity muss größer als 0 sein")
        return value


class IncomingDeliverySchema(BaseModel):
    """HTTP-Schema fuer einen Wareneingang (gemeldet, aber noch nicht ins Lager gebucht)."""

    model_config = ConfigDict(from_attributes=True)

    id: str | None = None
    order_id: str
    supplier_id: str
    supplier_name: str = ""
    book_id: str
    book_name: str = ""
    quantity: int
    unit_price: float = 0
    received_at: str | None = None

    @field_validator("order_id", "supplier_id", "book_id", mode="before")
    @classmethod
    def validate_incoming_required_ids(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("Pflichtfeld darf nicht leer sein")
        return normalized

    @field_validator("supplier_name", "book_name", mode="before")
    @classmethod
    def normalize_incoming_strings(cls, value: str | None) -> str:
        return (value or "").strip()

    @field_validator("quantity")
    @classmethod
    def validate_incoming_quantity(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity muss größer als 0 sein")
        return value

    @field_validator("unit_price")
    @classmethod
    def validate_incoming_unit_price(cls, value: float) -> float:
        if value < 0:
            raise ValueError("unit_price darf nicht negativ sein")
        return value

    @field_validator("received_at", mode="before")
    @classmethod
    def normalize_received_at(cls, value: str | None) -> str | None:
        return normalize_optional_timestamp(value)


class BookIncomingDeliveryRequest(BaseModel):
    """Request-Body fuer POST /incoming-deliveries/{id}/book - wer bucht den Eingang ein."""

    performed_by: str = "system"

    @field_validator("performed_by", mode="before")
    @classmethod
    def normalize_book_incoming_delivery_request(cls, value: str | None) -> str:
        normalized = (value or "").strip()
        return normalized or "system"                                           # leer -> Fallback "system"
