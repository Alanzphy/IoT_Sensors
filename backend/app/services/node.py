import secrets

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.schemas.node import NodeCreate, NodeUpdate


def _generate_api_key() -> str:
    """Generate a unique API key for a node."""
    return f"ak_{secrets.token_hex(16)}"


def get_node(db: Session, node_id: int) -> Node:
    node = db.execute(
        select(Node).where(Node.id == node_id, Node.eliminado_en.is_(None))
    ).scalar_one_or_none()
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node with id {node_id} not found",
        )
    return node


def list_nodes(
    db: Session,
    page: int,
    per_page: int,
    irrigation_area_id: int | None = None,
) -> tuple[list[Node], int]:
    query = select(Node).where(Node.eliminado_en.is_(None))
    count_query = (
        select(func.count()).select_from(Node).where(Node.eliminado_en.is_(None))
    )
    if irrigation_area_id is not None:
        query = query.where(Node.area_riego_id == irrigation_area_id)
        count_query = count_query.where(Node.area_riego_id == irrigation_area_id)

    total = db.execute(count_query).scalar() or 0
    items = list(
        db.execute(
            query.order_by(Node.id).offset((page - 1) * per_page).limit(per_page)
        ).scalars()
    )
    return items, total


def create_node(db: Session, data: NodeCreate) -> Node:
    # Validate irrigation area exists
    area = db.execute(
        select(IrrigationArea).where(
            IrrigationArea.id == data.irrigation_area_id,
            IrrigationArea.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if area is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Irrigation area with id {data.irrigation_area_id} not found",
        )

    # Check 1:1 constraint — area must not already have a node
    existing_node = db.execute(
        select(Node).where(
            Node.area_riego_id == data.irrigation_area_id,
            Node.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if existing_node:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Irrigation area {data.irrigation_area_id} already has a node assigned",
        )

    node = Node(
        area_riego_id=data.irrigation_area_id,
        api_key=_generate_api_key(),
        numero_serie=data.serial_number,
        nombre=data.name,
        latitud=data.latitude,
        longitud=data.longitude,
        activo=data.is_active,
    )
    db.add(node)
    db.commit()
    db.refresh(node)
    return node


def update_node(db: Session, node_id: int, data: NodeUpdate) -> Node:
    node = get_node(db, node_id)
    update_data = data.model_dump(exclude_unset=True)

    if "serial_number" in update_data:
        node.numero_serie = update_data["serial_number"]
    if "name" in update_data:
        node.nombre = update_data["name"]
    if "latitude" in update_data:
        node.latitud = update_data["latitude"]
    if "longitude" in update_data:
        node.longitud = update_data["longitude"]
    if "is_active" in update_data:
        node.activo = update_data["is_active"]

    db.commit()
    db.refresh(node)
    return node


def soft_delete_node(db: Session, node_id: int) -> Node:
    node = get_node(db, node_id)
    node.eliminado_en = func.now()
    node.activo = False
    db.commit()
    db.refresh(node)
    return node
