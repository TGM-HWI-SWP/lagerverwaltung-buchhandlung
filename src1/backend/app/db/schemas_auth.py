from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class AdminLoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=12, max_length=128)


class CashierPinLoginRequest(BaseModel):
    user_id: str
    pin: str = Field(min_length=4, max_length=16)


class LoginResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str
    display_name: str
    role: str


class WhoAmIResponse(BaseModel):
    user_id: str
    username: str
    display_name: str
    role: str


class StaffUserSummary(BaseModel):
    id: str
    username: str
    display_name: str
    role: str
    avatar_image: str = ""


class StaffUserCreateRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    display_name: str = Field(min_length=2, max_length=120)
    pin: str = Field(min_length=4, max_length=16)
    role: str = Field(default="cashier")
    password: str = Field(default="", max_length=128)
    avatar_image: str = Field(default="", max_length=4_000_000)


class BootstrapStatusResponse(BaseModel):
    setup_required: bool


class BootstrapAdminRequest(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    display_name: str = Field(min_length=2, max_length=120)
    pin: str = Field(min_length=4, max_length=4)
    password: str = Field(min_length=12, max_length=128)
    avatar_image: str = Field(default="", max_length=4_000_000)


class StaffUserUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=120)
    pin: str | None = Field(default=None, min_length=4, max_length=16)
    role: str | None = Field(default=None)
    password: str | None = Field(default=None, max_length=128)
    avatar_image: str | None = Field(default=None, max_length=4_000_000)
    is_active: bool | None = Field(default=None)
