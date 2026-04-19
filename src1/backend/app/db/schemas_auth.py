from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str
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
