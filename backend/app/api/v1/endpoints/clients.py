from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.client import ClientCreate, ClientResponse, ClientUpdate
from app.services import client as client_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[ClientResponse])
def list_clients(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    clients, total = client_service.list_clients(db, page, per_page)
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[ClientResponse.model_validate(c) for c in clients],
    )


@router.post("", response_model=ClientResponse, status_code=201)
def create_client(
    data: ClientCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client = client_service.create_client(db, data)
    return ClientResponse.model_validate(client)


@router.get("/{client_id}", response_model=ClientResponse)
def get_client(
    client_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client = client_service.get_client(db, client_id)
    return ClientResponse.model_validate(client)


@router.put("/{client_id}", response_model=ClientResponse)
def update_client(
    client_id: int,
    data: ClientUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client = client_service.update_client(db, client_id, data)
    return ClientResponse.model_validate(client)


@router.delete("/{client_id}", response_model=ClientResponse)
def delete_client(
    client_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    client = client_service.soft_delete_client(db, client_id)
    return ClientResponse.model_validate(client)
