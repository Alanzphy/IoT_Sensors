# User Authentication

## Purpose

Defines authentication and authorization for web users: JWT access + refresh tokens, two roles (admin, client), password recovery, and the multi-tenant ownership model that scopes clients to their own data.

## Requirements

### Requirement: Login and tokens

- The system SHALL authenticate users with email + password and issue a JWT access token plus a refresh token.
- The refresh token SHALL be persisted (`tokens_refresco`) and revoked on logout or password change.
- The frontend SHALL send the access token as `Authorization: Bearer <token>`.

#### Scenario: User logs in
- **WHEN** a user logs in with valid credentials
- **THEN** the API returns an access token and a persisted refresh token

#### Scenario: User logs out
- **WHEN** a user logs out
- **THEN** the refresh token is revoked and cannot be used again

### Requirement: Roles

- The system SHALL support exactly two user roles: `admin` and `cliente`.
- Admins SHALL access all clients/properties/areas and the admin management screens.
- Clients SHALL access only their own properties, areas, and readings (ownership enforced server-side).
- The API SHALL return 403 for cross-tenant access attempts.

#### Scenario: Client requests another client's data
- **WHEN** a client requests readings or areas that belong to another client
- **THEN** the API returns 403 and does not leak data

### Requirement: Node authentication is separate

- Node IoT authentication SHALL be fully separate from user authentication: fixed API keys via `X-API-Key`, no JWT.

#### Scenario: Node authenticates with API key
- **WHEN** a node sends a reading with `X-API-Key`
- **THEN** the backend validates the key against the nodes table without any JWT involvement

### Requirement: Password recovery

- The system SHALL support forgot/reset password flows (`/api/v1/auth/forgot-password`, `/api/v1/auth/reset-password`).
- Reset tokens SHALL be stored hashed (SHA-256), single-use, and rate-limited per email/IP.

#### Scenario: User resets password
- **WHEN** a user requests a password reset and follows the emailed link with a valid token
- **THEN** the password is updated and the reset token is invalidated