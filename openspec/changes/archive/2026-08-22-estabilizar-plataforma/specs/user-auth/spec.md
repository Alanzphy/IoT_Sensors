## ADDED Requirements

### Requirement: Login rate limiting

- The system SHALL limit login attempts per email and IP within a configurable window (`LOGIN_RATE_LIMIT_WINDOW_MINUTES`, `LOGIN_RATE_LIMIT_MAX_ATTEMPTS`).
- When the limit is exceeded, `POST /api/v1/auth/login` SHALL respond 429.

#### Scenario: Brute force attempt

- **WHEN** more than the allowed login attempts happen for the same email within the window
- **THEN** the API responds 429 until the window expires

### Requirement: CORS and secret key hardening

- CORS origins SHALL be configurable via `CORS_ORIGINS` (comma-separated env).
- `allow_credentials` SHALL only be enabled when origins are explicit (never with `*`).
- The application SHALL refuse to start with a known-default `SECRET_KEY` unless `DEBUG=true`.

#### Scenario: Production starts with default secret

- **WHEN** the backend starts with `DEBUG=false` and the default `SECRET_KEY`
- **THEN** startup fails with a clear error instead of signing JWTs with a known key

### Requirement: Self profile endpoint

- The system SHALL expose `GET /api/v1/users/me` and `PATCH /api/v1/users/me` authenticated by the current user (admin or client).
- `PATCH` SHALL allow updating the full name; the email SHALL be read-only.

#### Scenario: Client updates their name

- **WHEN** a client PATCHes their profile name
- **THEN** the response returns the updated user without exposing other users

## MODIFIED Requirements

### Requirement: Roles

- The system SHALL support exactly two user roles: `admin` and `cliente`.
- Admins SHALL access all clients/properties/areas and the admin management screens.
- Clients SHALL access only their own properties, areas, and readings (ownership enforced server-side).
- The API SHALL return 403 for cross-tenant access attempts.
- Crop cycle listings without an `irrigation_area_id` filter SHALL be scoped to the client's own areas (clients SHALL NOT see other clients' cycles).

#### Scenario: Client requests another client's data

- **WHEN** a client requests readings or areas that belong to another client
- **THEN** the API returns 403 and does not leak data

#### Scenario: Client lists crop cycles without filter

- **WHEN** a client calls `GET /api/v1/crop-cycles` without filters
- **THEN** only the cycles of their own areas are returned