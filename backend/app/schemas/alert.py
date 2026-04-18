from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AlertReadUpdate(BaseModel):
    read: bool = True


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    node_id: int = Field(validation_alias="nodo_id")
    irrigation_area_id: int = Field(validation_alias="area_riego_id")
    threshold_id: int | None = Field(default=None, validation_alias="umbral_id")
    type: str = Field(validation_alias="tipo")
    parameter: str | None = Field(default=None, validation_alias="parametro")
    detected_value: float | None = Field(
        default=None, validation_alias="valor_detectado"
    )
    severity: str = Field(validation_alias="severidad")
    message: str = Field(validation_alias="mensaje")
    timestamp: datetime = Field(validation_alias="marca_tiempo")
    read: bool = Field(validation_alias="leida")
    read_at: datetime | None = Field(default=None, validation_alias="leida_en")
    notified_email: bool = Field(validation_alias="notificada_email")
    notified_whatsapp: bool = Field(validation_alias="notificada_whatsapp")
    created_at: datetime = Field(validation_alias="creado_en")
    updated_at: datetime = Field(validation_alias="actualizado_en")


class InactivityScanResponse(BaseModel):
    scanned_nodes: int
    inactive_nodes: int
    created_alerts: int
    executed_at: datetime


class NotificationDispatchResponse(BaseModel):
    notifications_enabled: bool
    email_enabled: bool
    whatsapp_enabled: bool
    pending_alerts: int
    processed_alerts: int
    skipped_alerts: int
    emailed_alerts: int
    whatsapp_alerts: int
    email_failures: int
    whatsapp_failures: int
    executed_at: datetime
