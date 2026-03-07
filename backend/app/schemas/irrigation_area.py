from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.crop_type import CropTypeBrief


class IrrigationAreaCreate(BaseModel):
    property_id: int
    crop_type_id: int
    name: str
    area_size: float | None = None


class IrrigationAreaUpdate(BaseModel):
    crop_type_id: int | None = None
    name: str | None = None
    area_size: float | None = None


class IrrigationAreaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    property_id: int = Field(validation_alias="predio_id")
    crop_type_id: int = Field(validation_alias="tipo_cultivo_id")
    name: str = Field(validation_alias="nombre")
    area_size: float | None = Field(default=None, validation_alias="tamano_area")
    crop_type: CropTypeBrief | None = None
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")
