from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = Field(pattern=r"^(admin|cliente)$")
    is_active: bool = True


class UserUpdate(BaseModel):
    email: str | None = None
    password: str | None = None
    full_name: str | None = None
    role: str | None = Field(default=None, pattern=r"^(admin|cliente)$")
    is_active: bool | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str = Field(validation_alias="correo")
    full_name: str = Field(validation_alias="nombre_completo")
    role: str = Field(validation_alias="rol")
    is_active: bool = Field(validation_alias="activo")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")
