from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


ThresholdParameter = Literal[
    "soil.conductivity",
    "soil.temperature",
    "soil.humidity",
    "soil.water_potential",
    "irrigation.active",
    "irrigation.accumulated_liters",
    "irrigation.flow_per_minute",
    "environmental.temperature",
    "environmental.relative_humidity",
    "environmental.wind_speed",
    "environmental.solar_radiation",
    "environmental.eto",
]

ThresholdSeverity = Literal["info", "warning", "critical"]


class ThresholdCreate(BaseModel):
    irrigation_area_id: int
    parameter: ThresholdParameter
    min_value: float | None = None
    max_value: float | None = None
    severity: ThresholdSeverity = "warning"
    active: bool = True

    @model_validator(mode="after")
    def validate_range(self):
        if self.min_value is None and self.max_value is None:
            raise ValueError("min_value or max_value is required")
        if (
            self.min_value is not None
            and self.max_value is not None
            and self.min_value > self.max_value
        ):
            raise ValueError("min_value cannot be greater than max_value")
        return self


class ThresholdUpdate(BaseModel):
    irrigation_area_id: int | None = None
    parameter: ThresholdParameter | None = None
    min_value: float | None = None
    max_value: float | None = None
    severity: ThresholdSeverity | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def validate_range(self):
        if (
            self.min_value is not None
            and self.max_value is not None
            and self.min_value > self.max_value
        ):
            raise ValueError("min_value cannot be greater than max_value")
        return self


class ThresholdResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    irrigation_area_id: int = Field(validation_alias="area_riego_id")
    parameter: str = Field(validation_alias="parametro")
    min_value: float | None = Field(default=None, validation_alias="rango_min")
    max_value: float | None = Field(default=None, validation_alias="rango_max")
    severity: str = Field(validation_alias="severidad")
    active: bool = Field(validation_alias="activo")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")
