from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NodeCreate(BaseModel):
    irrigation_area_id: int
    serial_number: str | None = None
    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool = True


class NodeUpdate(BaseModel):
    serial_number: str | None = None
    name: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    is_active: bool | None = None


class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    irrigation_area_id: int = Field(validation_alias="area_riego_id")
    api_key: str
    serial_number: str | None = Field(default=None, validation_alias="numero_serie")
    name: str | None = Field(default=None, validation_alias="nombre")
    latitude: float | None = Field(default=None, validation_alias="latitud")
    longitude: float | None = Field(default=None, validation_alias="longitud")
    is_active: bool = Field(validation_alias="activo")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")
