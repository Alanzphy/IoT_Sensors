# H0 offline integration harness

H0 creates deterministic input evidence for later one-, 8-, and 16-node integration runs. It reproduces the current compact ESP32 `s1/s2/s3` payload and CatWAN textual serial boundary without hardware, network, databases, services, credentials, or third-party packages.

## Generate evidence

```bash
python3 scripts/integration/h0_harness.py \
  --nodes 8 \
  --run-id integration-001 \
  --output-dir /tmp/iot-h0-8
```

The node count must be `1`, `8`, or `16`. The run ID produces stable logical capture keys and mesh message IDs. These are harness identities, not cloud event IDs. JP's future telemetry outbox must assign and persist the actual `X-Event-ID` used by `/api/v1/readings`; H1 must record that observed ID and prove it is reused after a forced failure.

The output directory contains:

- `batch.json`: compact raw payloads, stable capture/mesh identities, exact counts, frame byte lengths, recorded boundary facts, and one `contract_reference` containing canonical schema/fixture paths, fixture SHA-256, root/category fields, the 12-field count, and the NDVI-exclusion check. The reference contains no expected mapped values or timestamp and is not a mapper oracle.
- `serial-input.txt`: two physical lines per logical event, matching the current central output: one `RXFRAME` carrying a sub-255-byte seven-part `M1` DATA frame from an `H%04X` node to `*`, followed by the duplicate compact JSON payload.

Existing evidence is never replaced with different content. Repeating the same command is allowed; changing inputs requires a new output directory.

## Verify

```bash
python3 -m unittest discover -s scripts/integration -p 'test_h0_harness.py' -v
```

H0 proves deterministic offline generation against the currently observed firmware packet guard, compact payload shape, node/destination defaults, central serial duplication, parser grammar, and canonical contract shape/reference. It does not predict how JP's mapper will derive values or timestamps. The boundary facts in `batch.json` are observations, not a third contract; revalidate H0 against the Agro.io firmware and parser before H1 whenever those sources change.

H0 does **not** prove physical radio/serial delivery, duplicate suppression, canonical mapping, outbox event-ID assignment, HTTPS delivery, idempotency, retries, MySQL, Dokploy, or hardware behavior. Those belong to later implementation and H1 evidence.

## H1 orchestration scaffold

H1 validates redacted 1/8/16-node bindings and emits a deterministic plan plus an empty, bounded evidence-record shape. It does not run or simulate teammate capabilities, map telemetry, contact cloud services, or claim rows/retries/NDVI/deployment success. Templates remain blocked until every `PENDING_*` reference is replaced with approved immutable refs, redacted secret references, real cloud IDs, and real command adapters produced by the accepted teammate units.

```bash
python3 -m unittest discover -s scripts/integration -p 'test_h1_harness.py' -v
python3 scripts/integration/h1_harness.py --manifest scripts/integration/manifests/h1-1-node.json --plan-only
python3 scripts/integration/h1_harness.py --manifest scripts/integration/manifests/h1-8-nodes.json --plan-only
python3 scripts/integration/h1_harness.py --manifest scripts/integration/manifests/h1-16-nodes.json --plan-only
```

Plan-only mode exits successfully for valid redacted templates while reporting every unresolved prerequisite under machine-readable `status: blocked`. Omitting `--plan-only` requests execution and fails closed until prerequisites are resolved and a real command-adapter runner is configured. Evidence records may later contain only bounded output paths/digests, commands, immutable refs, timestamps, exit status, node counts, and assertions—never credentials or unbounded command output.
