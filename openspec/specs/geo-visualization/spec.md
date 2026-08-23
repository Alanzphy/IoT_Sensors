# Geospatial Visualization

## Purpose

Defines the geospatial capability: exposing node locations with ownership scoping and rendering interactive maps (client and admin) with freshness state layers and clustering.

## Requirements

### Requirement: Geo endpoint

- The system SHALL expose `GET /api/v1/nodes/geo` returning node locations (lat/long) with filters and ownership by role.
- Clients SHALL only see their own nodes; admins SHALL filter globally by client/property/area.

#### Scenario: Client requests geo data
- **WHEN** a client requests /api/v1/nodes/geo
- **THEN** only their nodes with GPS are returned

### Requirement: Client map

- The client map SHALL render markers for the client's nodes over MapLibre GL with the OpenFreeMap base style (configurable URL).
- Nodes without GPS SHALL be listed in a "nodes without GPS" fallback panel instead of breaking the map.
- The map SHALL show last reading timestamp and minutes since update per node (freshness), with a persistent status legend.

#### Scenario: Node without GPS
- **WHEN** a client node has no coordinates
- **THEN** the map still renders and the node appears in the "nodes without GPS" panel

### Requirement: Admin map

- The admin map SHALL render all nodes with global hierarchical filters (client → property → area).
- The admin map SHALL support marker and clustering modes, with layers by freshness state (fresh / late / no reading).

#### Scenario: Admin clusters dense areas
- **WHEN** an admin views the map with many nodes in a region
- **THEN** nodes are clustered and uncluster on interaction

### Requirement: Loading strategy

- Map routes SHALL be lazy-loaded and conditionally prefetched from navigation (desktop and mobile) to keep first-load performance.
- Frontend build SHALL chunk heavy modules (maps, charts, router, radix) separately.

#### Scenario: First visit to maps
- **WHEN** a user first navigates to a map route
- **THEN** the map chunk loads lazily without blocking the rest of the app