import hashlib
import json
import shutil
import tempfile
import unittest
from pathlib import Path

from h0_harness import CONTRACT_DIRECTORY, RADIO_FRAME_LIMIT_BYTES, HarnessError, generate_batch, load_contract_reference


class H0HarnessTests(unittest.TestCase):
    def test_supported_batches_match_the_contract_and_serial_boundary(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for node_count in (1, 8, 16):
                with self.subTest(node_count=node_count):
                    output = root / str(node_count)
                    batch = generate_batch(node_count, "integration-001", output)
                    lines = (output / "serial-input.txt").read_text(encoding="utf-8").splitlines()

                    self.assertEqual(batch["expected_counts"]["logical_events"], node_count)
                    self.assertEqual(batch["expected_counts"]["serial_lines"], node_count * 2)
                    self.assertEqual(len({event["node_code"] for event in batch["events"]}), node_count)
                    self.assertEqual(len(lines), node_count * 2)
                    reference = batch["contract_reference"]
                    self.assertEqual(reference["dynamic_field_count"], 12)
                    self.assertTrue(reference["ndvi_excluded"])
                    self.assertNotIn("ndvi", json.dumps(reference["dynamic_fields"]).lower())
                    self.assertEqual(
                        reference["fixture_sha256"],
                        hashlib.sha256(
                            (CONTRACT_DIRECTORY / "fixtures" / "telemetry.valid.json").read_bytes()
                        ).hexdigest(),
                    )
                    self.assertNotIn("expected_canonical_telemetry", json.dumps(batch))

                    for index, event in enumerate(batch["events"], start=1):
                        self.assertNotIn("event_id", event)
                        self.assertRegex(event["node_code"], r"^H[0-9A-F]{4}$")

                        rxframe, bare_json = lines[(index - 1) * 2 : index * 2]
                        prefix, rssi, snr, frame = rxframe.split("|", 3)
                        mesh = frame.split("|", 6)
                        self.assertEqual((prefix, rssi, snr), ("RXFRAME", "-70", "7.5"))
                        self.assertEqual(mesh[:3], ["M1", event["node_code"], "*"])
                        self.assertEqual(mesh[3:6], [str(event["mesh_message_id"]), "4", "DATA"])
                        self.assertEqual(json.loads(mesh[6]), event["raw_edge_payload"])
                        self.assertEqual(json.loads(bare_json), event["raw_edge_payload"])
                        self.assertEqual(len(frame.encode("utf-8")), event["radio_frame_bytes"])
                        self.assertLess(event["radio_frame_bytes"], RADIO_FRAME_LIMIT_BYTES)

                    self.assertEqual(
                        batch["boundary_facts"]["maximum_generated_radio_frame_bytes"],
                        max(event["radio_frame_bytes"] for event in batch["events"]),
                    )

    def test_same_run_is_byte_stable_and_reuses_node_event_identity(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = generate_batch(8, "stable-run", root / "first")
            second = generate_batch(8, "stable-run", root / "second")
            one_node = generate_batch(1, "stable-run", root / "one")
            other_run = generate_batch(1, "other-run", root / "other")

            self.assertEqual((root / "first" / "batch.json").read_bytes(), (root / "second" / "batch.json").read_bytes())
            self.assertEqual(
                (root / "first" / "serial-input.txt").read_bytes(),
                (root / "second" / "serial-input.txt").read_bytes(),
            )
            self.assertEqual(first["events"][0]["logical_capture_key"], second["events"][0]["logical_capture_key"])
            self.assertEqual(first["events"][0]["logical_capture_key"], one_node["events"][0]["logical_capture_key"])
            self.assertNotEqual(first["events"][0]["logical_capture_key"], other_run["events"][0]["logical_capture_key"])
            self.assertNotEqual(first["events"][0]["mesh_message_id"], other_run["events"][0]["mesh_message_id"])

    def test_rejects_unsupported_counts_and_changed_evidence(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with self.assertRaises(HarnessError):
                generate_batch(2, "run", root / "unsupported")

            for filename in ("serial-input.txt", "batch.json"):
                with self.subTest(filename=filename):
                    output = root / filename
                    generate_batch(1, "run", output)
                    (output / filename).write_text("changed\n", encoding="utf-8")
                    with self.assertRaises(HarnessError):
                        generate_batch(1, "run", output)

    def test_fails_fast_when_contract_assumptions_change(self):
        with tempfile.TemporaryDirectory() as temporary:
            copied = Path(temporary) / "v1"
            shutil.copytree(CONTRACT_DIRECTORY, copied)
            fixture_path = copied / "fixtures" / "telemetry.valid.json"
            fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
            fixture["ndvi"] = 0.8
            fixture_path.write_text(json.dumps(fixture), encoding="utf-8")

            with self.assertRaisesRegex(HarnessError, "only timestamp and the three categories"):
                load_contract_reference(copied)

            fixture.pop("ndvi")
            fixture_path.write_text(json.dumps(fixture), encoding="utf-8")
            schema_path = copied / "telemetry.schema.json"
            schema = json.loads(schema_path.read_text(encoding="utf-8"))
            schema["properties"]["soil"]["required"].remove("humidity")
            schema_path.write_text(json.dumps(schema), encoding="utf-8")

            with self.assertRaisesRegex(HarnessError, "soil required fields changed"):
                load_contract_reference(copied)


if __name__ == "__main__":
    unittest.main()
