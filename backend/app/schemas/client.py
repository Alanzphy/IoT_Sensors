from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import UserResponse


class ClientCreate(BaseModel):
    email: str
    password: str
    full_name: str
    company_name: str
    phone: str | None = None
    address: str | None = None


class ClientUpdate(BaseModel):
    email: str | None = None
    full_name: str | None = None
    company_name: str | None = None
    phone: str | None = None
    address: str | None = None


class ClientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int = Field(validation_alias="usuario_id")
    company_name: str = Field(validation_alias="nombre_empresa")
    phone: str | None = Field(default=None, validation_alias="telefono")
    address: str | None = Field(default=None, validation_alias="direccion")
    user: UserResponse | None = None
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")
