from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    clients,
    crop_cycles,
    crop_types,
    irrigation_areas,
    nodes,
    properties,
    readings,
    users,
)

api_v1_router = APIRouter()

api_v1_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_v1_router.include_router(users.router, prefix="/users", tags=["Users"])
api_v1_router.include_router(clients.router, prefix="/clients", tags=["Clients"])
api_v1_router.include_router(
    properties.router, prefix="/properties", tags=["Properties"]
)
api_v1_router.include_router(
    crop_types.router, prefix="/crop-types", tags=["Crop Types"]
)
api_v1_router.include_router(
    irrigation_areas.router, prefix="/irrigation-areas", tags=["Irrigation Areas"]
)
api_v1_router.include_router(
    crop_cycles.router, prefix="/crop-cycles", tags=["Crop Cycles"]
)
api_v1_router.include_router(nodes.router, prefix="/nodes", tags=["Nodes"])
api_v1_router.include_router(readings.router, prefix="/readings", tags=["Readings"])
