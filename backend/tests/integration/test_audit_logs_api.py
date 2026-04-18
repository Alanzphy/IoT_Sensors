"""Integration tests for /api/v1/audit-logs."""


class TestAuditLogsApi:
    def test_list_requires_auth(self, client):
        resp = client.get("/api/v1/audit-logs")
        assert resp.status_code == 401

    def test_client_cannot_list_audit_logs(self, client, client_headers):
        resp = client.get("/api/v1/audit-logs", headers=client_headers)
        assert resp.status_code == 403

    def test_admin_can_list_and_filter_audit_logs(
        self,
        client,
        admin_headers,
        admin_user,
        sample_irrigation_area,
    ):
        create_threshold_resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "soil.humidity",
                "min_value": 40.0,
                "severity": "warning",
            },
        )
        assert create_threshold_resp.status_code == 201

        list_resp = client.get(
            f"/api/v1/audit-logs?entity=threshold&action=create&user_id={admin_user.id}",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200

        body = list_resp.json()
        assert body["total"] >= 1
        first = body["data"][0]
        assert first["entity"] == "threshold"
        assert first["action"] == "create"
        assert first["user_id"] == admin_user.id

    def test_admin_can_get_audit_log_detail(
        self,
        client,
        admin_headers,
        sample_irrigation_area,
    ):
        create_threshold_resp = client.post(
            "/api/v1/thresholds",
            headers=admin_headers,
            json={
                "irrigation_area_id": sample_irrigation_area.id,
                "parameter": "environmental.eto",
                "max_value": 7.0,
                "severity": "critical",
            },
        )
        assert create_threshold_resp.status_code == 201

        list_resp = client.get(
            "/api/v1/audit-logs?entity=threshold&action=create&page=1&per_page=1",
            headers=admin_headers,
        )
        assert list_resp.status_code == 200
        assert list_resp.json()["total"] >= 1
        log_id = list_resp.json()["data"][0]["id"]

        detail_resp = client.get(
            f"/api/v1/audit-logs/{log_id}",
            headers=admin_headers,
        )
        assert detail_resp.status_code == 200
        detail = detail_resp.json()
        assert detail["id"] == log_id
        assert detail["entity"] == "threshold"
        assert detail["user"] is not None
        assert detail["user"]["role"] == "admin"

    def test_get_nonexistent_audit_log_returns_404(self, client, admin_headers):
        resp = client.get("/api/v1/audit-logs/999999", headers=admin_headers)
        assert resp.status_code == 404
