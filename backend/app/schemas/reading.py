from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


# ---------- Input sub-schemas (sensor payload) ----------


class SoilData(BaseModel):
    conductivity: float | None = None
    temperature: float | None = None
    humidity: float | None = None
    water_potential: float | None = None


class IrrigationData(BaseModel):
    active: bool | None = None
    accumulated_liters: float | None = None
    flow_per_minute: float | None = None


class EnvironmentalData(BaseModel):
    temperature: float | None = None
    relative_humidity: float | None = None
    wind_speed: float | None = None
    solar_radiation: float | None = None
    eto: float | None = None


class ReadingCreate(BaseModel):
    timestamp: datetime
    soil: SoilData
    irrigation: IrrigationData
    environmental: EnvironmentalData


# ---------- Response sub-schemas (from ORM) ----------


class SoilResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    conductivity: float | None = Field(default=None, validation_alias="conductividad")
    temperature: float | None = Field(default=None, validation_alias="temperatura")
    humidity: float | None = Field(default=None, validation_alias="humedad")
    water_potential: float | None = Field(
        default=None, validation_alias="potencial_hidrico"
    )


class IrrigationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    active: bool | None = Field(default=None, validation_alias="activo")
    accumulated_liters: float | None = Field(
        default=None, validation_alias="litros_acumulados"
    )
    flow_per_minute: float | None = Field(
        default=None, validation_alias="flujo_por_minuto"
    )


class EnvironmentalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    temperature: float | None = Field(default=None, validation_alias="temperatura")
    relative_humidity: float | None = Field(
        default=None, validation_alias="humedad_relativa"
    )
    wind_speed: float | None = Field(default=None, validation_alias="velocidad_viento")
    solar_radiation: float | None = Field(
        default=None, validation_alias="radiacion_solar"
    )
    eto: float | None = None


# ---------- Top-level response schemas ----------


class ReadingCreateResponse(BaseModel):
    """Returned after a successful sensor POST."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int = Field(validation_alias="nodo_id")
    timestamp: datetime = Field(validation_alias="marca_tiempo")
    created_at: datetime = Field(validation_alias="creado_en")


class ReadingResponse(BaseModel):
    """Full reading with nested categories (for history/latest)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int = Field(validation_alias="nodo_id")
    timestamp: datetime = Field(validation_alias="marca_tiempo")
    soil: SoilResponse | None = None
    irrigation: IrrigationResponse | None = None
    environmental: EnvironmentalResponse | None = None
