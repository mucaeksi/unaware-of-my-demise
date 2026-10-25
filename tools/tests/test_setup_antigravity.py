"""Antigravity setup: plugin path expansion and global config merge; stdlib only."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import setup_antigravity as setup

ROOT = Path(__file__).resolve().parents[2]


class ResolvedServersTest(unittest.TestCase):
    def test_plugin_paths_resolve_to_the_repository(self):
        servers = setup.resolved_servers(setup.PLUGIN)
        self.assertEqual(set(servers), {"unityMCP", "uomd-unity-live", "graphify", "chrome-devtools"})
        for spec in servers.values():
            self.assertEqual(Path(spec["cwd"]), ROOT)
        live = servers["uomd-unity-live"]["args"]
        self.assertTrue(Path(live[0]).name == "cli.mjs" and Path(live[1]) == ROOT / "tools" / "mcp_unity_live.ts")
        self.assertIn(setup.UNITY_SERVER_PIN, servers["unityMCP"]["args"])

    def test_plugin_matches_the_claude_mcp_pins(self):
        claude = json.loads((ROOT / ".mcp.json").read_text(encoding="utf-8"))["mcpServers"]
        servers = setup.resolved_servers(setup.PLUGIN)
        self.assertEqual(servers["unityMCP"]["args"], claude["unityMCP"]["args"])
        self.assertEqual(servers["unityMCP"]["env"], claude["unityMCP"]["env"])
        self.assertEqual(servers["graphify"]["args"][:-1], claude["graphify"]["args"][:-1])
        self.assertEqual(servers["graphify"]["env"], claude["graphify"]["env"])

    def test_expansion_leaves_plain_arguments(self):
        with tempfile.TemporaryDirectory() as tmp:
            plugin = Path(tmp) / ".agents" / "plugins" / "p"
            plugin.mkdir(parents=True)
            (plugin / "mcp_config.json").write_text(json.dumps({"mcpServers": {"s": {"command": "uvx", "args": ["--x", "${PLUGIN_ROOT}/../a.js"]}}}))
            spec = setup.resolved_servers(plugin)["s"]
            self.assertEqual(spec["args"][0], "--x")
            self.assertEqual(spec["args"][1], os.path.normpath(str(plugin.resolve()) + "/../a.js"))
            self.assertNotIn("cwd", spec)


class MergeGlobalTest(unittest.TestCase):
    def test_keeps_other_servers_and_settings(self):
        existing = {"mcpServers": {"other": {"command": "x"}, "unityMCP": {"command": "old"}}, "extra": 1}
        merged = setup.merge_global(existing, {"unityMCP": {"command": "uvx"}})
        self.assertEqual(merged["mcpServers"]["other"], {"command": "x"})
        self.assertEqual(merged["mcpServers"]["unityMCP"], {"command": "uvx"})
        self.assertEqual(merged["extra"], 1)
        self.assertEqual(existing["mcpServers"]["unityMCP"], {"command": "old"})

    def test_empty_config(self):
        self.assertEqual(setup.merge_global({}, {"a": {"command": "b"}}), {"mcpServers": {"a": {"command": "b"}}})


if __name__ == "__main__":
    unittest.main()
