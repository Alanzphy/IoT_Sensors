from datetime import date, datetime, timedelta
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field


def _require_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() != timedelta(0):
        raise ValueError("timestamp must be UTC")
    return value


UTCDateTime = Annotated[datetime, AfterValidator(_require_utc)]


class _WeatherModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class WeatherCoordinates(_WeatherModel):
    requested_latitude: float = Field(ge=-90, le=90, strict=True, allow_inf_nan=False)
    requested_longitude: float = Field(ge=-180, le=180, strict=True, allow_inf_nan=False)
    provider_latitude: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    provider_longitude: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)


class WeatherCurrent(_WeatherModel):
    observed_at: UTCDateTime
    temperature_2m: float = Field(strict=True, allow_inf_nan=False)
    relative_humidity_2m: float = Field(ge=0, le=100, strict=True, allow_inf_nan=False)
    wind_speed_10m: float = Field(ge=0, strict=True, allow_inf_nan=False)
    shortwave_radiation: float = Field(ge=0, strict=True, allow_inf_nan=False)
    weather_code: int = Field(ge=0, strict=True)


class WeatherToday(_WeatherModel):
    date: date
    precipitation_sum: float = Field(ge=0, strict=True, allow_inf_nan=False)
    et0_fao_evapotranspiration: float = Field(ge=0, strict=True, allow_inf_nan=False)


class WeatherUnits(_WeatherModel):
    temperature_2m: Literal["°C"] = "°C"
    relative_humidity_2m: Literal["%"] = "%"
    wind_speed_10m: Literal["km/h"] = "km/h"
    shortwave_radiation: Literal["W/m²"] = "W/m²"
    precipitation_sum: Literal["mm"] = "mm"
    et0_fao_evapotranspiration: Literal["mm"] = "mm"


class WeatherResponse(_WeatherModel):
    provider: str
    coordinates: WeatherCoordinates
    current: WeatherCurrent
    today: WeatherToday
    fetched_at: UTCDateTime
    units: WeatherUnits = Field(default_factory=WeatherUnits)
    cache_state: Literal["fresh", "stale"] = "fresh"
    cache_age_seconds: int = Field(default=0, ge=0)
