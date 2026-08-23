## ADDED Requirements

### Requirement: Node API keys not exposed

- The system SHALL NOT return the node `api_key` in node listing or detail responses consumed by clients.
- The API key SHALL be returned only in the node creation response (so it can be handed to the operator once) and never in subsequent reads.

#### Scenario: Client lists nodes

- **WHEN** a client lists nodes or queries `/api/v1/nodes/geo`
- **THEN** the responses contain no `api_key` field