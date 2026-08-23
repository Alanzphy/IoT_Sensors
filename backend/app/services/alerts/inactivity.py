from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.models.alert import Alert
from app.models.node import Node
from app.models.reading import Reading

from app.services.alerts.queries import create_alert


def _has_inactivity_alert_for_current_outage(
    db: Session,
    *,
    node_id: int,
    last_reading_at: datetime,
) -> bool:
    existing = db.execute(
        select(Alert.id).where(
            Alert.nodo_id == node_id,
            Alert.tipo == "inactivity",
            Alert.marca_tiempo >= last_reading_at,
        )
    ).scalar_one_or_none()
    return existing is not None
def scan_inactivity_alerts(
    db: Session,
    *,
    minutes_without_data: int = 20,
    node_id: int | None = None,
    irrigation_area_id: int | None = None,
) -> dict[str, int | datetime]:
    now_utc = utc_now()
    inactive_delta = timedelta(minutes=minutes_without_data)

    query = select(Node).where(
        Node.eliminado_en.is_(None),
        Node.activo.is_(True),
    )
    if node_id is not None:
        query = query.where(Node.id == node_id)
    if irrigation_area_id is not None:
        query = query.where(Node.area_riego_id == irrigation_area_id)

    nodes = list(db.execute(query).scalars())

    inactive_nodes = 0
    created_alerts = 0

    for node in nodes:
        last_reading_at = db.execute(
            select(func.max(Reading.marca_tiempo)).where(Reading.nodo_id == node.id)
        ).scalar_one_or_none()
        if last_reading_at is None:
            continue

        if now_utc - last_reading_at < inactive_delta:
            continue

        inactive_nodes += 1

        if _has_inactivity_alert_for_current_outage(
            db,
            node_id=node.id,
            last_reading_at=last_reading_at,
        ):
            continue

        elapsed_minutes = int((now_utc - last_reading_at).total_seconds() // 60)
        create_alert(
            db,
            node_id=node.id,
            irrigation_area_id=node.area_riego_id,
            threshold_id=None,
            alert_type="inactivity",
            parameter=None,
            detected_value=None,
            severity="critical",
            message=(
                f"Node without data for {elapsed_minutes} minutes. "
                f"Last reading at {last_reading_at.isoformat()}"
            ),
            timestamp=now_utc,
        )
        created_alerts += 1

    if created_alerts > 0:
        db.commit()

    return {
        "scanned_nodes": len(nodes),
        "inactive_nodes": inactive_nodes,
        "created_alerts": created_alerts,
        "executed_at": now_utc,
    }
