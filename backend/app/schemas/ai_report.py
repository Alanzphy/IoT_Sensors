from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AIReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int = Field(validation_alias="cliente_id")
    irrigation_area_id: int | None = Field(default=None, validation_alias="area_riego_id")
    range_start: datetime = Field(validation_alias="rango_inicio")
    range_end: datetime = Field(validation_alias="rango_fin")
    status: str = Field(validation_alias="estado")
    summary: str | None = Field(default=None, validation_alias="resumen")
    findings: str | None = Field(default=None, validation_alias="hallazgos")
    recommendation: str | None = Field(default=None, validation_alias="recomendacion")
    generation_metadata: str | None = Field(
        default=None, validation_alias="metadatos_generacion"
    )
    error_detail: str | None = Field(default=None, validation_alias="error_detalle")
    generated_at: datetime | None = Field(default=None, validation_alias="generado_en")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")


class AIReportGenerateRequest(BaseModel):
    client_id: int | None = None
    irrigation_area_id: int | None = None
    start_datetime: datetime | None = None
    end_datetime: datetime | None = None
    notify: bool = True
    force: bool = False

    @model_validator(mode="after")
    def validate_range(self):
        if (self.start_datetime is None) ^ (self.end_datetime is None):
            raise ValueError(
                "start_datetime and end_datetime must be provided together"
            )
        return self


class AIReportGenerateResponse(BaseModel):
    generated_count: int
    skipped_count: int
    failed_count: int
    report_ids: list[int]
    range_start: datetime
    range_end: datetime
    executed_at: datetime
