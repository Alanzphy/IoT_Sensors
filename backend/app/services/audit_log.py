from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

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


def get_audit_log(db: Session, audit_log_id: int) -> AuditLog:
    log = db.execute(
        select(AuditLog)
        .options(joinedload(AuditLog.user))
        .where(AuditLog.id == audit_log_id)
    ).scalar_one_or_none()
    if log is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Audit log with id {audit_log_id} not found",
        )
    return log


def list_audit_logs(
    db: Session,
    page: int,
    per_page: int,
    user_id: int | None = None,
    action: str | None = None,
    entity: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> tuple[list[AuditLog], int]:
    conditions = []

    if user_id is not None:
        conditions.append(AuditLog.usuario_id == user_id)
    if action is not None:
        conditions.append(AuditLog.accion == action)
    if entity is not None:
        conditions.append(AuditLog.entidad == entity)
    if start_date is not None:
        conditions.append(
            AuditLog.creado_en >= datetime.combine(start_date, datetime.min.time())
        )
    if end_date is not None:
        conditions.append(
            AuditLog.creado_en <= datetime.combine(end_date, datetime.max.time())
        )

    total = (
        db.execute(
            select(func.count()).select_from(AuditLog).where(*conditions)
        ).scalar()
        or 0
    )

    items = list(
        db.execute(
            select(AuditLog)
            .options(joinedload(AuditLog.user))
            .where(*conditions)
            .order_by(AuditLog.creado_en.desc(), AuditLog.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).scalars()
    )
    return items, total
