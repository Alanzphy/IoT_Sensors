from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.property import Property
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.node import NodeCreate, NodeResponse, NodeUpdate
from app.services import node as node_service

router = APIRouter()


def _get_client_area_ids(user: User, db: Session) -> list[int]:
    client = db.execute(
        select(Client).where(
            Client.usuario_id == user.id, Client.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if client is None:
        return []
    prop_ids = list(
        db.execute(
            select(Property.id).where(
                Property.cliente_id == client.id,
                Property.eliminado_en.is_(None),
            )
        ).scalars()
    )
    if not prop_ids:
        return []
    return list(
        db.execute(
            select(IrrigationArea.id).where(
                IrrigationArea.predio_id.in_(prop_ids),
                IrrigationArea.eliminado_en.is_(None),
            )
        ).scalars()
    )


def _check_node_ownership(user: User, db: Session, node_id: int) -> None:
    if user.rol == "admin":
        return
    node = node_service.get_node(db, node_id)
    area_ids = _get_client_area_ids(user, db)
    if node.area_riego_id not in area_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this node",
        )


@router.get("", response_model=PaginatedResponse[NodeResponse])
def list_nodes(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    irrigation_area_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin" and irrigation_area_id is not None:
        area_ids = _get_client_area_ids(current_user, db)
        if irrigation_area_id not in area_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this irrigation area",
            )

    items, total = node_service.list_nodes(db, page, per_page, irrigation_area_id)
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[NodeResponse.model_validate(n) for n in items],
    )


@router.post("", response_model=NodeResponse, status_code=201)
def create_node(
    data: NodeCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    node = node_service.create_node(db, data)
    return NodeResponse.model_validate(node)


@router.get("/{node_id}", response_model=NodeResponse)
def get_node(
    node_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_node_ownership(current_user, db, node_id)
    node = node_service.get_node(db, node_id)
    return NodeResponse.model_validate(node)


@router.put("/{node_id}", response_model=NodeResponse)
def update_node(
    node_id: int,
    data: NodeUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    node = node_service.update_node(db, node_id, data)
    return NodeResponse.model_validate(node)


@router.delete("/{node_id}", response_model=NodeResponse)
def delete_node(
    node_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    node = node_service.soft_delete_node(db, node_id)
    return NodeResponse.model_validate(node)
