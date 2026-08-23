"""Tests de integración para /api/v1/crop-cycles."""

from datetime import date

import pytest

from app.core.security import hash_password
from app.models.client import Client
from app.models.crop_cycle import CropCycle
from app.models.irrigation_area import IrrigationArea
from app.models.property import Property
from app.models.user import User


class TestListCropCycles:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/crop-cycles")
        assert resp.status_code == 401

    def test_list_success(self, client, admin_headers, sample_crop_cycle):
        resp = client.get("/api/v1/crop-cycles", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["total"] >= 1

    def test_list_filter_by_irrigation_area(self, client, admin_headers, sample_crop_cycle, sample_irrigation_area):
        resp = client.get(
            f"/api/v1/crop-cycles?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert all(c["irrigation_area_id"] == sample_irrigation_area.id for c in data["data"])


class TestListCropCyclesClientScoping:
    def _create_foreign_client_cycle(self, db, sample_crop_type):
        """Crea un cliente externo con predio, área y ciclo ajeno al cliente de prueba."""
        foreign_user = User(
            correo="crop-foreign@test.com",
            contrasena_hash=hash_password("foreignpass"),
            nombre_completo="Cliente Externo",
            rol="cliente",
            activo=True,
        )
        db.add(foreign_user)
        db.flush()

        foreign_client = Client(
            usuario_id=foreign_user.id,
            nombre_empresa="Empresa Externa SA",
            telefono="555-0099",
            direccion="Calle Externa 456",
        )
        db.add(foreign_client)
        db.flush()

        foreign_property = Property(
            cliente_id=foreign_client.id,
            nombre="Predio Externo",
            ubicacion="Sonora, MX",
        )
        db.add(foreign_property)
        db.flush()

        foreign_area = IrrigationArea(
            predio_id=foreign_property.id,
            tipo_cultivo_id=sample_crop_type.id,
            nombre="Area Externa",
            tamano_area=7.0,
        )
        db.add(foreign_area)
        db.flush()

        foreign_cycle = CropCycle(
            area_riego_id=foreign_area.id,
            fecha_inicio=date(2026, 3, 1),
            fecha_fin=None,
        )
        db.add(foreign_cycle)
        db.commit()
        db.refresh(foreign_cycle)
        return foreign_cycle

    def test_client_list_without_filter_does_not_see_foreign_cycles(
        self,
        client,
        client_headers,
        db,
        sample_crop_type,
        sample_crop_cycle,
    ):
        foreign_cycle = self._create_foreign_client_cycle(db, sample_crop_type)

        resp = client.get("/api/v1/crop-cycles", headers=client_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        ids = {cycle["id"] for cycle in data["data"]}
        assert sample_crop_cycle.id in ids
        assert foreign_cycle.id not in ids

    def test_client_list_with_own_area_filter_still_works(
        self,
        client,
        client_headers,
        db,
        sample_crop_type,
        sample_crop_cycle,
        sample_irrigation_area,
    ):
        self._create_foreign_client_cycle(db, sample_crop_type)

        resp = client.get(
            f"/api/v1/crop-cycles?irrigation_area_id={sample_irrigation_area.id}",
            headers=client_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert all(
            cycle["irrigation_area_id"] == sample_irrigation_area.id
            for cycle in data["data"]
        )

    def test_client_list_with_foreign_area_filter_returns_403(
        self,
        client,
        client_headers,
        db,
        sample_crop_type,
    ):
        foreign_cycle = self._create_foreign_client_cycle(db, sample_crop_type)

        resp = client.get(
            f"/api/v1/crop-cycles?irrigation_area_id={foreign_cycle.area_riego_id}",
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestCreateCropCycle:
    def test_create_active_cycle_success(self, client, admin_headers, sample_irrigation_area):
        resp = client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": sample_irrigation_area.id, "start_date": "2026-01-01"},
            headers=admin_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["start_date"] == "2026-01-01"
        assert data["end_date"] is None

    def test_create_second_active_cycle_returns_409(self, client, admin_headers, sample_irrigation_area):
        client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": sample_irrigation_area.id, "start_date": "2026-01-01"},
            headers=admin_headers,
        )
        resp = client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": sample_irrigation_area.id, "start_date": "2026-06-01"},
            headers=admin_headers,
        )
        assert resp.status_code == 409

    def test_create_invalid_area_returns_404(self, client, admin_headers):
        resp = client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": 99999, "start_date": "2026-01-01"},
            headers=admin_headers,
        )
        assert resp.status_code == 404

    def test_create_requires_admin(self, client, client_headers, sample_irrigation_area):
        resp = client.post(
            "/api/v1/crop-cycles",
            json={"irrigation_area_id": sample_irrigation_area.id, "start_date": "2026-01-01"},
            headers=client_headers,
        )
        assert resp.status_code == 403


class TestGetCropCycle:
    def test_get_success(self, client, admin_headers, sample_crop_cycle):
        resp = client.get(f"/api/v1/crop-cycles/{sample_crop_cycle.id}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["id"] == sample_crop_cycle.id

    def test_get_nonexistent_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/crop-cycles/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestUpdateCropCycle:
    def test_close_cycle(self, client, admin_headers, sample_crop_cycle):
        resp = client.put(
            f"/api/v1/crop-cycles/{sample_crop_cycle.id}",
            json={"end_date": "2026-06-30"},
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["end_date"] == "2026-06-30"


class TestDeleteCropCycle:
    def test_delete_cycle(self, client, admin_headers, sample_irrigation_area):
        created = client.post(
            "/api/v1/crop-cycles",
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "start_date": "2025-01-01",
                "end_date": "2025-12-31",
            },
            headers=admin_headers,
        ).json()
        resp = client.delete(f"/api/v1/crop-cycles/{created['id']}", headers=admin_headers)
        assert resp.status_code == 200
        resp2 = client.get(f"/api/v1/crop-cycles/{created['id']}", headers=admin_headers)
        assert resp2.status_code == 404
