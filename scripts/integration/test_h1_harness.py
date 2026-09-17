import copy
import json
import unittest
from pathlib import Path

from h1_harness import HarnessError, build_plan

MANIFESTS = Path(__file__).parent / "manifests"


def _load(nodes):
    return json.loads((MANIFESTS / f"h1-{nodes}-node{'s' if nodes > 1 else ''}.json").read_text())


def _resolved_manifest():
    manifest = _load(1)
    manifest["contract_ref"] = "git:" + "a" * 40
    for index, key in enumerate(manifest["packet_refs"]):
        manifest["packet_refs"][key] = "git:" + f"{index + 1:040x}"
    for index, key in enumerate(manifest["dependency_refs"]):
        manifest["dependency_refs"][key] = "sha256:" + f"{index + 1:064x}"
    manifest["command_adapters"] = {
        "edge_capture": "adapter://edge-capture",
        "cloud_submit": "adapter://cloud-submit",
        "cloud_verify": "adapter://cloud-verify",
    }
    manifest["nodes"][0].update(
        cloud_area_id=101, cloud_node_id=201, api_key_secret_ref="secret://h1/H0001"
    )
    return manifest


class H1HarnessTests(unittest.TestCase):
    def test_all_templates_are_valid_redacted_and_completely_blocked(self):
        for count in (1, 8, 16):
            with self.subTest(count=count):
                manifest = _load(count)
                plan = build_plan(manifest)
                self.assertEqual(plan["status"], "blocked")
                self.assertEqual(plan["node_count"], count)
                self.assertEqual(len(plan["blockers"]), 12 + count * 3)
                self.assertTrue(all(reason.startswith("unresolved:") for reason in plan["blockers"]))
                text = json.dumps(manifest)
                self.assertNotIn('"api_key":', text)
                self.assertTrue(all(node["api_key_secret_ref"].startswith("PENDING_") for node in manifest["nodes"]))

    def test_duplicate_id_and_secret_values_are_rejected(self):
        manifest = _load(8)
        manifest["nodes"][1]["cloud_node_id"] = manifest["nodes"][0]["cloud_node_id"]
        manifest["nodes"][2]["api_key_secret_ref"] = "ak_live_12345678901234567890"
        manifest["api_key"] = "ak_live_12345678901234567890"
        with self.assertRaisesRegex(HarnessError, "duplicate cloud_node_id") as raised:
            build_plan(manifest)
        self.assertNotIn("ak_live_", str(raised.exception))
        with self.assertRaisesRegex(HarnessError, "redacted reference"):
            build_plan({**_load(1), "nodes": [manifest["nodes"][2]]})
        with self.assertRaisesRegex(HarnessError, "raw secret field"):
            build_plan({**_load(1), "api_key": "ak_live_12345678901234567890"})

    def test_plan_is_byte_stable_and_contains_empty_bounded_evidence_shape(self):
        manifest = _load(16)
        first = json.dumps(build_plan(manifest), sort_keys=True)
        second = json.dumps(build_plan(copy.deepcopy(manifest)), sort_keys=True)
        self.assertEqual(first, second)
        evidence = build_plan(manifest)["evidence_record_shape"]
        self.assertEqual(evidence["status"], "not_run")
        self.assertEqual(evidence["output"]["max_bytes"], 65536)
        self.assertIsNone(evidence["output"]["sha256"])
        self.assertEqual(evidence["assertions"], [])

    def test_execution_fails_closed_with_placeholders_or_without_runner(self):
        unresolved = build_plan(_load(1), execute=True)
        resolved = build_plan(_resolved_manifest(), execute=True)
        self.assertEqual(unresolved["status"], "blocked")
        self.assertGreater(len(unresolved["blockers"]), 1)
        self.assertEqual(resolved["blockers"], ["execution:command adapter runner is not configured"])
        self.assertEqual(resolved["status"], "blocked")


if __name__ == "__main__":
    unittest.main()
