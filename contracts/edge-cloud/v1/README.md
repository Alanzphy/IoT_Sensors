# Edge-cloud contract v1

IoT_Sensors owns this canonical contract. Agro.io vendors exact copies for validation. Version 1 carries telemetry and latest point NDVI as separate HTTPS events.

## Telemetry request

`POST /api/v1/readings`

| Item | Requirement |
|---|---|
| `Content-Type` | `application/json` |
| `X-API-Key` | API key assigned to the sending node; never put it in a fixture or log. |
| `X-Event-ID` | UUID generated once when the edge outbox event is created and reused unchanged for every retry. |
| Body | Must validate against [`telemetry.schema.json`](telemetry.schema.json). |

The body always contains the 12 dynamic values grouped as `soil`, `irrigation`, and `environmental`. Unavailable values are JSON `null`; zero means a measured zero. `timestamp` is the edge capture time in UTC with a literal `Z`. GPS, crop, area size, edge identity, radio metadata, and NDVI are excluded.

## Latest point NDVI request

`POST /api/v1/ndvi-snapshots`

| Item | Requirement |
|---|---|
| `Content-Type` | `application/json` |
| `X-API-Key` | API key for the node assigned to the target irrigation area. |
| Body | Must validate against [`ndvi.schema.json`](ndvi.schema.json). |

NDVI has no `X-Event-ID` requirement. Replay uses scene identity plus payload. Telemetry-only C2 owns `X-Event-ID` on `/api/v1/readings`. NDVI is independently mapped to `irrigation_area_id`. Version 1 stores and displays only the latest point sample with provider, Sentinel-2 collection/scene, scene time, cloud cover, and `sample_method=point`. Polygon sampling and NDVI history are deferred.

## Idempotency and responses

Telemetry idempotency is scoped by authenticated node, endpoint, and `X-Event-ID`. NDVI latest-point replay uses scene identity plus payload, not an event ID.

| Condition | Response | Persistence |
|---|---|---|
| First valid event | `201 Created` | Create one canonical record and bind its event ID. |
| Exact retry | `200 OK` | Return the existing record; create nothing. |
| Same event ID, different body | `409 Conflict` | Create nothing; edge marks the item blocked for operator review. |
| Invalid key | `401 Unauthorized` | Keep pending; stop automatic retries until configuration is corrected. |
| Invalid body/header | `422 Unprocessable Entity` | Keep blocked with bounded validation detail. |
| Timeout, `429`, or `5xx` | No acceptance | Keep pending and retry with bounded exponential backoff and jitter. |

The edge marks an item sent only after `200` or `201`. It must not regenerate the event ID after process restart, network loss, or timeout.

## Ordering and freshness

- Events may arrive late or out of order; canonical history uses the body timestamp.
- Dashboard “latest” and freshness use the greatest accepted capture timestamp for the mapped node, not HTTP arrival order.
- Every timestamp uses the anchored structure `YYYY-MM-DDTHH:MM:SS[.fraction]Z`, with calendar-like month/day ranges, 24-hour time, seconds, and uppercase `Z`. The schemas retain `format: date-time` as metadata but do not rely on an optional format checker. Application validation owns stricter calendar semantics, such as rejecting impossible month/day combinations, when required.

## Fixtures

| File | Expected result |
|---|---|
| `fixtures/telemetry.valid.json` | Valid telemetry with measured and unavailable values. |
| `fixtures/telemetry.invalid.json` | Invalid: timestamp is not serialized with `Z`. |
| `fixtures/telemetry.invalid-malformed-z.json` | Invalid: malformed text ends in `Z` but is not a timestamp. |
| `fixtures/ndvi.valid.json` | Valid latest point NDVI event. |
| `fixtures/ndvi.invalid.json` | Invalid: polygon sampling is not allowed in v1. |
| `fixtures/ndvi.invalid-malformed-z.json` | Invalid: malformed scene time ends in `Z`. |

Fixtures contain no credentials or production identifiers.
