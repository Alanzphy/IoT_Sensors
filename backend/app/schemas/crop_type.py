from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CropTypeCreate(BaseModel):
    name: str
    description: str | None = None


class CropTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class CropTypeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = Field(validation_alias="nombre")
    description: str | None = Field(default=None, validation_alias="descripcion")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")


class CropTypeBrief(BaseModel):
    """Minimal crop type info for embedding in other responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str = Field(validation_alias="nombre")
