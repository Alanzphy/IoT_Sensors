from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def create_audit_log(
    db: Session,
    *,
    user_id: int | None,
    action: str,
    entity: str,
    entity_id: str | None = None,
    detail: str | None = None,
) -> AuditLog:
    log = AuditLog(
        usuario_id=user_id,
        accion=action,
        entidad=entity,
        entidad_id=entity_id,
        detalle=detail,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
