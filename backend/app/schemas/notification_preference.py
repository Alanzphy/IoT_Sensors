from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationPreferenceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int = Field(validation_alias="cliente_id")
    irrigation_area_id: int = Field(validation_alias="area_riego_id")
    alert_type: str = Field(validation_alias="tipo_alerta")
    severity: str = Field(validation_alias="severidad")
    channel: str = Field(validation_alias="canal")
    enabled: bool = Field(validation_alias="habilitado")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")


class NotificationPreferenceUpsertItem(BaseModel):
    irrigation_area_id: int
    alert_type: str
    severity: str
    channel: str
    enabled: bool


class NotificationPreferenceBulkUpsertRequest(BaseModel):
    items: list[NotificationPreferenceUpsertItem]


class NotificationPreferenceBulkUpsertResponse(BaseModel):
    created: int
    updated: int
    data: list[NotificationPreferenceResponse]
