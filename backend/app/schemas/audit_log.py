from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AuditLogUserSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str = Field(validation_alias="correo")
    full_name: str = Field(validation_alias="nombre_completo")
    role: str = Field(validation_alias="rol")


class AuditLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = Field(default=None, validation_alias="usuario_id")
    action: str = Field(validation_alias="accion")
    entity: str = Field(validation_alias="entidad")
    entity_id: str | None = Field(default=None, validation_alias="entidad_id")
    detail: str | None = Field(default=None, validation_alias="detalle")
    created_at: datetime = Field(validation_alias="creado_en")
    user: AuditLogUserSummary | None = None
