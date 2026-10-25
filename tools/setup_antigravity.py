#!/usr/bin/env python3
"""First-run setup check for Gemini Argon in Antigravity (run before any task).

1. Skills: the canonical lock, the .agents/ adapters and the Antigravity budgets are current.
2. Prerequisites: node/uv/uvx/git on PATH, node_modules, the code graph, the Unity package pin.
3. MCP: starts every server of the workspace plugin .agents/plugins/uomd-mcp and lists its tools over stdio.

Usage:
  python tools/setup_antigravity.py                   # check everything (exit 1 on a failure)
  python tools/setup_antigravity.py --skip-mcp        # skills and prerequisites only
  python tools/setup_antigravity.py --install-global  # also merge the servers, with absolute paths, into
                                                      # ~/.gemini/config/mcp_config.json (backup first)
"""
from __future__ import annotations

import argparse
import json
import os
import queue
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / ".agents" / "plugins" / "uomd-mcp"
GLOBAL_MCP = Path.home() / ".gemini" / "config" / "mcp_config.json"
MCP_TIMEOUT_SECONDS = 180  # first uvx/uv run downloads the pinned server
UNITY_SERVER_PIN = "mcpforunityserver==10.3.0"
UNITY_PACKAGE_COMMIT = "aa5fc638d623f56178d50329d9ad8c541a57fe66"


def resolved_servers(plugin_dir: Path) -> dict[str, dict]:
    """The plugin's servers with ${PLUGIN_ROOT} expanded to absolute, normalized paths."""
    config = json.loads((plugin_dir / "mcp_config.json").read_text(encoding="utf-8"))
    root = str(plugin_dir.resolve())

    def expand(value: str) -> str:
        if "${PLUGIN_ROOT}" not in value:
            return value
        return os.path.normpath(value.replace("${PLUGIN_ROOT}", root))

    servers = {}
    for name, spec in config["mcpServers"].items():
        out = {"command": spec["command"], "args": [expand(a) for a in spec.get("args", [])]}
        if "cwd" in spec:
            out["cwd"] = expand(spec["cwd"])
        if "env" in spec:
            out["env"] = {k: expand(v) for k, v in spec["env"].items()}
        servers[name] = out
    return servers


def merge_global(existing: dict, servers: dict[str, dict]) -> dict:
    """Global config with our servers set; other servers are kept untouched."""
    merged = dict(existing)
    merged["mcpServers"] = {**existing.get("mcpServers", {}), **servers}
    return merged


def _reader(stream, lines: queue.Queue) -> None:
    for line in iter(stream.readline, b""):
        lines.put(line)


def list_tools(spec: dict, timeout: float = MCP_TIMEOUT_SECONDS) -> list[str]:
    """Start a stdio MCP server, run initialize + tools/list, return the tool names."""
    exe = shutil.which(spec["command"])
    if not exe:
        raise RuntimeError(f"'{spec['command']}' is not on PATH")
    stderr = tempfile.TemporaryFile()
    proc = subprocess.Popen([exe, *spec["args"]], cwd=spec.get("cwd"), env={**os.environ, **spec.get("env", {})}, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=stderr)
    lines: queue.Queue = queue.Queue()
    threading.Thread(target=_reader, args=(proc.stdout, lines), daemon=True).start()

    def send(message: dict) -> None:
        proc.stdin.write((json.dumps(message) + "\n").encode())
        proc.stdin.flush()

    def wait_for(request_id: int) -> dict:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            try:
                line = lines.get(timeout=1)
            except queue.Empty:
                if proc.poll() is not None:
                    stderr.seek(0)
                    tail = stderr.read().decode(errors="replace").strip().splitlines()[-2:]
                    raise RuntimeError(f"server exited with code {proc.returncode}: {' | '.join(tail)}")
                continue
            try:
                message = json.loads(line)
            except ValueError:
                continue  # a server may log to stdout before it speaks JSON-RPC
            if message.get("id") == request_id:
                if "error" in message:
                    raise RuntimeError(message["error"].get("message", "error"))
                return message["result"]
        raise RuntimeError(f"no answer within {timeout:.0f}s")

    try:
        send({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "uomd-setup", "version": "1"}}})
        wait_for(1)
        send({"jsonrpc": "2.0", "method": "notifications/initialized"})
        send({"jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        return [t["name"] for t in wait_for(2).get("tools", [])]
    finally:
        proc.kill()
        proc.wait()
        stderr.close()


def run_check(label: str, command: list[str]) -> bool:
    result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    last = (result.stdout.strip() or result.stderr.strip()).splitlines()[-1:] or [""]
    print(f"{'PASS' if result.returncode == 0 else 'FAIL'} {label}: {last[0]}")
    return result.returncode == 0


def check_skills() -> bool:
    py = sys.executable
    return all([
        run_check("skill lock", [py, "tools/bootstrap_skills.py", "--verify"]),
        run_check("Antigravity skill adapters", [py, "tools/sync_codex_skills.py", "--check"]),
        run_check("Antigravity budgets/agents/workflows", [py, "tools/install_ecc.py", "--check"]),
    ])


def check_prerequisites() -> bool:
    ok = True
    for tool in ("node", "uv", "uvx", "git"):
        found = shutil.which(tool)
        print(f"{'PASS' if found else 'FAIL'} {tool} on PATH{': ' + found if found else ''}")
        ok &= bool(found)
    tsx = ROOT / "node_modules" / "tsx" / "dist" / "cli.mjs"
    print(f"{'PASS' if tsx.is_file() else 'FAIL'} node_modules{'' if tsx.is_file() else ' missing: run npm ci'}")
    ok &= tsx.is_file()
    graph = ROOT / "graphify-out" / "graph.json"
    print(f"{'PASS' if graph.is_file() else 'WARN'} code graph{'' if graph.is_file() else ' missing: run bash tools/build_graph.sh (graphify MCP needs it)'}")
    manifest = (ROOT / "apps" / "unity" / "Packages" / "manifest.json").read_text(encoding="utf-8")
    pinned = UNITY_PACKAGE_COMMIT in manifest
    print(f"{'PASS' if pinned else 'FAIL'} com.coplaydev.unity-mcp pinned to v10.3.0 ({UNITY_PACKAGE_COMMIT[:8]})")
    ok &= pinned
    version = re.search(r"m_EditorVersion:\s*(\S+)", (ROOT / "apps" / "unity" / "ProjectSettings" / "ProjectVersion.txt").read_text(encoding="utf-8"))
    print(f"INFO Unity project: apps/unity, editor {version.group(1) if version else '?'} (open it in Unity Hub; MCP for Unity -> Transport stdio)")
    return ok


def check_mcp(servers: dict[str, dict]) -> bool:
    ok = True
    for name, spec in servers.items():
        if name == "graphify" and not Path(spec["args"][-1]).is_file():
            print(f"SKIP MCP {name}: no graph yet (bash tools/build_graph.sh)")
            continue
        try:
            tools = list_tools(spec)
            print(f"PASS MCP {name}: {len(tools)} tools ({', '.join(tools[:6])}{', ...' if len(tools) > 6 else ''})")
        except (RuntimeError, OSError) as error:
            print(f"FAIL MCP {name}: {error}")
            ok = False
    if "unityMCP" in servers:
        print("INFO unityMCP starting proves the server only; in Antigravity read mcpforunity://editor/state to prove the Editor link.")
    return ok


def install_global(servers: dict[str, dict]) -> None:
    existing = json.loads(GLOBAL_MCP.read_text(encoding="utf-8")) if GLOBAL_MCP.is_file() else {}
    if GLOBAL_MCP.is_file():
        backup = GLOBAL_MCP.with_name(f"mcp_config.backup-{time.strftime('%Y%m%d-%H%M%S')}.json")
        shutil.copy2(GLOBAL_MCP, backup)
        print(f"INFO backup: {backup}")
    GLOBAL_MCP.parent.mkdir(parents=True, exist_ok=True)
    GLOBAL_MCP.write_text(json.dumps(merge_global(existing, servers), indent=2) + "\n", encoding="utf-8")
    print(f"DONE wrote {', '.join(servers)} to {GLOBAL_MCP}. Disable the workspace plugin uomd-mcp in Antigravity's plugin "
          "settings so each server runs once, then restart Antigravity.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skip-mcp", action="store_true")
    parser.add_argument("--install-global", action="store_true")
    args = parser.parse_args()
    servers = resolved_servers(PLUGIN)
    ok = check_skills() & check_prerequisites()
    if not args.skip_mcp:
        ok &= check_mcp(servers)
    if args.install_global:
        install_global(servers)
    print("\nRESULT", "PASS" if ok else "FAIL", "- next: open Antigravity's MCP Servers list and confirm unityMCP, uomd-unity-live, graphify, chrome-devtools")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
