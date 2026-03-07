from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.models.client import Client
from app.models.property import Property
from app.models.user import User
from app.schemas.client import ClientCreate, ClientUpdate


def get_client(db: Session, client_id: int) -> Client:
    client = db.execute(
        select(Client)
        .options(joinedload(Client.user))
        .where(Client.id == client_id, Client.eliminado_en.is_(None))
    ).scalar_one_or_none()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id {client_id} not found",
        )
    return client


def list_clients(db: Session, page: int, per_page: int) -> tuple[list[Client], int]:
    query = (
        select(Client)
        .options(joinedload(Client.user))
        .where(Client.eliminado_en.is_(None))
    )
    count_query = (
        select(func.count()).select_from(Client).where(Client.eliminado_en.is_(None))
    )
    total = db.execute(count_query).scalar() or 0
    clients = list(
        db.execute(
            query.order_by(Client.id).offset((page - 1) * per_page).limit(per_page)
        )
        .unique()
        .scalars()
    )
    return clients, total


def create_client(db: Session, data: ClientCreate) -> Client:
    # Check email uniqueness
    existing = db.execute(
        select(User).where(User.correo == data.email)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Email '{data.email}' already registered",
        )

    # Create user + client atomically
    user = User(
        correo=data.email,
        contrasena_hash=hash_password(data.password),
        nombre_completo=data.full_name,
        rol="cliente",
        activo=True,
    )
    db.add(user)
    db.flush()

    client = Client(
        usuario_id=user.id,
        nombre_empresa=data.company_name,
        telefono=data.phone,
        direccion=data.address,
    )
    db.add(client)
    db.commit()
    db.refresh(client)
    # Load user relationship
    _ = client.user
    return client


def update_client(db: Session, client_id: int, data: ClientUpdate) -> Client:
    client = get_client(db, client_id)
    update_data = data.model_dump(exclude_unset=True)

    if "company_name" in update_data:
        client.nombre_empresa = update_data["company_name"]
    if "phone" in update_data:
        client.telefono = update_data["phone"]
    if "address" in update_data:
        client.direccion = update_data["address"]

    db.commit()
    db.refresh(client)
    return client


def soft_delete_client(db: Session, client_id: int) -> Client:
    client = get_client(db, client_id)

    # Cascade soft-delete to user
    client.user.eliminado_en = func.now()
    client.user.activo = False

    # Cascade soft-delete to properties
    properties = list(
        db.execute(
            select(Property).where(
                Property.cliente_id == client_id,
                Property.eliminado_en.is_(None),
            )
        ).scalars()
    )
    for prop in properties:
        prop.eliminado_en = func.now()

    client.eliminado_en = func.now()
    db.commit()
    db.refresh(client)
    return client
