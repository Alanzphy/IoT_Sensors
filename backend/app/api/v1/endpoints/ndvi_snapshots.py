from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.authz import validate_area_access
from app.core.deps import get_current_user, validate_api_key
from app.db.session import get_db
from app.models.node import Node
from app.models.user import User
from app.schemas.ndvi import NDVIEvent, NDVISnapshotResponse
from app.services import irrigation_area as area_service
from app.services import ndvi as ndvi_service

router = APIRouter()


@router.post(
    "",
    response_model=NDVISnapshotResponse,
    status_code=status.HTTP_201_CREATED,
    responses={status.HTTP_200_OK: {"model": NDVISnapshotResponse}},
)
def ingest_latest_ndvi(
    data: NDVIEvent,
    response: Response,
    node: Node = Depends(validate_api_key),
    db: Session = Depends(get_db),
):
    if node.area_riego_id != data.irrigation_area_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Node is not assigned to this irrigation area",
        )

    area = area_service.get_irrigation_area(db, node.area_riego_id)
    try:
        result = ndvi_service.store_latest_ndvi_with_result(db, area, data)
    except ndvi_service.NDVIAreaMismatchError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Irrigation area with id {node.area_riego_id} not found",
        ) from exc
    except ndvi_service.NDVIStaleError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc
    except ndvi_service.NDVIConflictError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc

    db.commit()
    db.refresh(result.snapshot)
    response.status_code = (
        status.HTTP_201_CREATED if result.action == "created" else status.HTTP_200_OK
    )
    response.headers["X-NDVI-Write-Result"] = result.action
    return NDVISnapshotResponse.model_validate(result.snapshot)


@router.get("/latest", response_model=NDVISnapshotResponse)
def get_latest_ndvi(
    irrigation_area_id: int = Query(..., ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    validate_area_access(current_user, db, irrigation_area_id)
    area_service.get_irrigation_area(db, irrigation_area_id)
    snapshot = ndvi_service.get_latest_ndvi(db, irrigation_area_id)
    if snapshot is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Latest NDVI snapshot not found",
        )
    return NDVISnapshotResponse.model_validate(snapshot)
