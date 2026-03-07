from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class CropCycleCreate(BaseModel):
    irrigation_area_id: int
    start_date: date
    end_date: date | None = None


class CropCycleUpdate(BaseModel):
    start_date: date | None = None
    end_date: date | None = None


class CropCycleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    irrigation_area_id: int = Field(validation_alias="area_riego_id")
    start_date: date = Field(validation_alias="fecha_inicio")
    end_date: date | None = Field(default=None, validation_alias="fecha_fin")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")
