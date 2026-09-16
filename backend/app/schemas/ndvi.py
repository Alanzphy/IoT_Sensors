import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

_UTC_Z_TIMESTAMP = re.compile(
    r"^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])"
    r"T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?Z$"
)


class NDVIEvent(BaseModel):
    """Validated edge-cloud v1 latest-point NDVI event."""

    model_config = ConfigDict(extra="forbid")

    irrigation_area_id: int = Field(ge=1, strict=True)
    ndvi: float = Field(ge=-1, le=1, strict=True)
    provider: str = Field(min_length=1)
    collection: Literal["sentinel-2-l2a"]
    scene_id: str = Field(min_length=1)
    scene_observed_at: str
    cloud_cover_percent: float = Field(ge=0, le=100, strict=True)
    sample_method: Literal["point"]

    @field_validator("scene_observed_at", mode="before")
    @classmethod
    def require_uppercase_utc_z(cls, value: Any) -> Any:
        if not isinstance(value, str) or _UTC_Z_TIMESTAMP.fullmatch(value) is None:
            raise ValueError(
                "scene_observed_at must be an ISO 8601 timestamp ending in uppercase Z"
            )
        try:
            datetime.strptime(value[:19], "%Y-%m-%dT%H:%M:%S")
        except ValueError as exc:
            raise ValueError("scene_observed_at must be a valid calendar timestamp") from exc
        return value


class NDVISnapshotResponse(NDVIEvent):
    """Contract-shaped latest-point NDVI response."""

    model_config = ConfigDict(from_attributes=True)

    irrigation_area_id: int = Field(ge=1, strict=True, validation_alias="area_riego_id")
    ndvi: float = Field(ge=-1, le=1, strict=True)
    provider: str = Field(min_length=1, validation_alias="proveedor")
    collection: Literal["sentinel-2-l2a"] = Field(validation_alias="coleccion")
    scene_id: str = Field(min_length=1, validation_alias="escena_id")
    scene_observed_at: str = Field(validation_alias="escena_observada_en")
    cloud_cover_percent: float = Field(
        ge=0, le=100, strict=True, validation_alias="cobertura_nubes_porcentaje"
    )
    sample_method: Literal["point"] = Field(validation_alias="metodo_muestreo")
