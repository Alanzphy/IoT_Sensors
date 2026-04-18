"""Integration tests for /api/v1/thresholds and /api/v1/alerts."""

from datetime import UTC, datetime, timedelta

SENSOR_PAYLOAD = {
    "timestamp": "2026-04-01T10:00:00Z",
    "soil": {
        "conductivity": 2.5,
        "temperature": 22.3,
        "humidity": 45.6,
        "water_potential": -0.8,
    },
    "irrigation": {
        "active": True,
        "accumulated_liters": 1250.0,
        "flow_per_minute": 8.3,
    },
    "environmental": {
        "temperature": 28.1,
        "relative_humidity": 55.0,
        "wind_speed": 12.5,
        "solar_radiation": 650.0,
        "eto": 5.2,
    },
}


class TestThresholdsApi:
    def test_admin_can_create_threshold(
        self,
        client,
        admin_headers,
        sample_irrigation_area,
    ):
        resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "soil.humidity",
                "min_value": 40.0,
                "max_value": 80.0,
                "severity": "warning",
                "active": True,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["irrigation_area_id"] == sample_irrigation_area.id
        assert data["parameter"] == "soil.humidity"

    def test_client_cannot_create_threshold(
        self,
        client,
        client_headers,
        sample_irrigation_area,
    ):
        resp = client.post(
            "/api/v1/thresholds",
            headers=client_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "soil.humidity",
                "min_value": 40.0,
                "severity": "warning",
            },
        )
        assert resp.status_code == 403

    def test_cannot_create_duplicate_threshold(
        self,
        client,
        admin_headers,
        sample_irrigation_area,
    ):
        payload = {
            "irrigation_area_id": sample_irrigation_area.id,
            "parameter": "environmental.eto",
            "max_value": 7.0,
            "severity": "critical",
        }
        first = client.post("/api/v1/thresholds", headers=admin_headers, json=payload)
        assert first.status_code == 201

        second = client.post("/api/v1/thresholds", headers=admin_headers, json=payload)
        assert second.status_code == 409


class TestAlertsApi:
    def _create_threshold(self, client, admin_headers, area_id):
        resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": area_id,
                "parameter": "soil.humidity",
                "min_value": 50.0,
                "severity": "critical",
            },
        )
        assert resp.status_code == 201
        return resp.json()

    def test_ingest_breach_creates_alert(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
    ):
        self._create_threshold(client, admin_headers, sample_irrigation_area.id)

        payload = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T11:00:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 35.0,
            },
        }
        ingest = client.post("/api/v1/readings", headers=node_headers, json=payload)
        assert ingest.status_code == 201

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        data = list_resp.json()
        assert data["total"] == 1
        alert = data["data"][0]
        assert alert["type"] == "threshold"
        assert alert["parameter"] == "soil.humidity"
        assert alert["severity"] == "critical"

    def test_duplicate_alerts_are_deduplicated_in_10_minutes_window(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
    ):
        self._create_threshold(client, admin_headers, sample_irrigation_area.id)

        payload1 = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T12:00:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 30.0,
            },
        }
        payload2 = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T12:05:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 32.0,
            },
        }

        first = client.post("/api/v1/readings", headers=node_headers, json=payload1)
        second = client.post("/api/v1/readings", headers=node_headers, json=payload2)
        assert first.status_code == 201
        assert second.status_code == 201

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] == 1

    def test_mark_alert_read(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
    ):
        self._create_threshold(client, admin_headers, sample_irrigation_area.id)

        payload = {
            **SENSOR_PAYLOAD,
            "timestamp": "2026-04-01T13:00:00Z",
            "soil": {
                **SENSOR_PAYLOAD["soil"],
                "humidity": 33.0,
            },
        }
        ingest = client.post("/api/v1/readings", headers=node_headers, json=payload)
        assert ingest.status_code == 201

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}",
            headers=admin_headers,
        )
        alert_id = list_resp.json()["data"][0]["id"]

        patch_resp = client.patch(
            f"/api/v1/alerts/{alert_id}/read",
            headers=admin_headers,
            json={"read": True},
        )
        assert patch_resp.status_code == 200
        updated = patch_resp.json()
        assert updated["read"] is True
        assert updated["read_at"] is not None


class TestInactivityAlertsApi:
    def _iso_utc(self, dt: datetime) -> str:
        return dt.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    def test_admin_scan_creates_inactivity_alert_for_stale_node(
        self,
        client,
        admin_headers,
        node_headers,
        sample_irrigation_area,
    ):
        stale_ts = datetime.now(UTC) - timedelta(minutes=30)
        ingest = client.post(
            "/api/v1/readings",
            headers=node_headers,
            json={
                **SENSOR_PAYLOAD,
                "timestamp": self._iso_utc(stale_ts),
            },
        )
        assert ingest.status_code == 201

        scan_resp = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=admin_headers,
        )
        assert scan_resp.status_code == 200
        summary = scan_resp.json()
        assert summary["scanned_nodes"] == 1
        assert summary["inactive_nodes"] == 1
        assert summary["created_alerts"] == 1

        list_resp = client.get(
            f"/api/v1/alerts?irrigation_area_id={sample_irrigation_area.id}&alert_type=inactivity",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] == 1

    def test_scan_does_not_duplicate_same_outage(
        self,
        client,
        admin_headers,
        node_headers,
    ):
        stale_ts = datetime.now(UTC) - timedelta(minutes=35)
        ingest = client.post(
            "/api/v1/readings",
            headers=node_headers,
            json={
                **SENSOR_PAYLOAD,
                "timestamp": self._iso_utc(stale_ts),
            },
        )
        assert ingest.status_code == 201

        first_scan = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=admin_headers,
        )
        second_scan = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=admin_headers,
        )
        assert first_scan.status_code == 200
        assert second_scan.status_code == 200
        assert first_scan.json()["created_alerts"] == 1
        assert second_scan.json()["created_alerts"] == 0

    def test_scan_skips_recent_node(
        self,
        client,
        admin_headers,
        node_headers,
    ):
        recent_ts = datetime.now(UTC) - timedelta(minutes=5)
        ingest = client.post(
            "/api/v1/readings",
            headers=node_headers,
            json={
                **SENSOR_PAYLOAD,
                "timestamp": self._iso_utc(recent_ts),
            },
        )
        assert ingest.status_code == 201

        scan_resp = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=admin_headers,
        )
        assert scan_resp.status_code == 200
        summary = scan_resp.json()
        assert summary["scanned_nodes"] == 1
        assert summary["inactive_nodes"] == 0
        assert summary["created_alerts"] == 0

    def test_client_cannot_scan_inactivity(
        self,
        client,
        client_headers,
    ):
        resp = client.post(
            "/api/v1/alerts/scan-inactivity?minutes_without_data=20",
            headers=client_headers,
        )
        assert resp.status_code == 403
