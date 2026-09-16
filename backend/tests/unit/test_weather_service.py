import asyncio
from datetime import UTC, datetime, timedelta

import pytest

from app.services.weather import (
    OpenMeteoAdapter,
    WeatherConfigurationError,
    WeatherDisabledError,
    WeatherProviderError,
    WeatherService,
    WeatherUnavailableError,
)


def _payload():
    return {
        "latitude": 28.63,
        "longitude": -106.08,
        "current": {
            "time": "2026-09-15T16:00",
            "temperature_2m": 27.4,
            "relative_humidity_2m": 41.0,
            "wind_speed_10m": 12.2,
            "shortwave_radiation": 612.0,
            "weather_code": 2,
        },
        "current_units": {
            "temperature_2m": "°C",
            "relative_humidity_2m": "%",
            "wind_speed_10m": "km/h",
            "shortwave_radiation": "W/m²",
            "weather_code": "wmo code",
        },
        "daily": {
            "time": ["2026-09-15"],
            "precipitation_sum": [1.7],
            "et0_fao_evapotranspiration": [5.3],
        },
        "daily_units": {
            "precipitation_sum": "mm",
            "et0_fao_evapotranspiration": "mm",
        },
    }


class _Response:
    def __init__(self, payload=None, status_code=200):
        self.payload = _payload() if payload is None else payload
        self.status_code = status_code

    def json(self):
        return self.payload


class _Client:
    def __init__(self, response=None, error=None):
        self.response = response or _Response()
        self.error = error
        self.calls = []

    async def get(self, url, *, params, timeout):
        self.calls.append((url, params, timeout))
        if self.error:
            raise self.error
        return self.response


def test_adapter_builds_commercial_request_and_maps_provider_payload():
    client = _Client()
    fetched_at = datetime(2026, 9, 15, 16, 5, tzinfo=UTC)
    adapter = OpenMeteoAdapter(client, "https://customer-api.open-meteo.com/", "test-key", 8)
    result = asyncio.run(adapter.fetch(28.63, -106.08, fetched_at))

    url, params, timeout = client.calls[0]
    assert url == "https://customer-api.open-meteo.com/v1/forecast"
    assert params["apikey"] == "test-key"
    assert params["timezone"] == "UTC"
    assert params["current"] == (
        "temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation,weather_code"
    )
    assert params["daily"] == "precipitation_sum,et0_fao_evapotranspiration"
    assert timeout == 8
    assert result.provider == "open-meteo"
    assert result.coordinates.requested_latitude == 28.63
    assert result.coordinates.provider_longitude == -106.08
    assert result.current.observed_at == datetime(2026, 9, 15, 16, 0, tzinfo=UTC)
    assert result.today.et0_fao_evapotranspiration == 5.3
    assert result.fetched_at == fetched_at
    assert result.units.wind_speed_10m == "km/h"


@pytest.mark.parametrize(
    "client",
    [
        _Client(response=_Response(status_code=503)),
        _Client(response=_Response(payload={"current": {}})),
        _Client(error=TimeoutError()),
    ],
)
def test_adapter_translates_non_success_malformed_and_network_failures(client):
    adapter = OpenMeteoAdapter(client, "https://customer-api.open-meteo.com", "key", 5)
    with pytest.raises(WeatherProviderError):
        asyncio.run(adapter.fetch(28.0, -106.0, datetime(2026, 9, 15, tzinfo=UTC)))


def _service():
    now = [datetime(2026, 9, 15, 16, 0, tzinfo=UTC)]
    client = _Client()
    adapter = OpenMeteoAdapter(client, "https://customer-api.open-meteo.com", "key", 5)
    return now, client, WeatherService(adapter, enabled=True, clock=lambda: now[0])


def test_cache_is_fresh_for_fifteen_minutes_and_keyed_by_coordinates():
    now, client, service = _service()

    asyncio.run(service.get_weather(28.0, -106.0))
    now[0] += timedelta(minutes=14)
    cached = asyncio.run(service.get_weather(28.0, -106.0))
    asyncio.run(service.get_weather(28.001, -106.0))

    assert cached.cache_state == "fresh"
    assert cached.cache_age_seconds == 840
    assert [call[1]["latitude"] for call in client.calls] == [28.0, 28.001]


def test_refresh_failure_uses_stale_cache_only_through_sixty_minutes():
    now, client, service = _service()
    asyncio.run(service.get_weather(28.0, -106.0))
    client.error = TimeoutError()

    now[0] += timedelta(minutes=16)
    stale = asyncio.run(service.get_weather(28.0, -106.0))
    assert stale.cache_state == "stale"
    assert stale.cache_age_seconds == 960

    now[0] += timedelta(minutes=45)
    with pytest.raises(WeatherUnavailableError):
        asyncio.run(service.get_weather(28.0, -106.0))


def test_disabled_and_missing_commercial_configuration_fail_without_request():
    client = _Client()
    adapter = OpenMeteoAdapter(client, "", "", 5)
    with pytest.raises(WeatherDisabledError):
        asyncio.run(WeatherService(adapter, enabled=False).get_weather(28.0, -106.0))
    with pytest.raises(WeatherConfigurationError):
        asyncio.run(WeatherService(adapter, enabled=True).get_weather(28.0, -106.0))
    assert client.calls == []
