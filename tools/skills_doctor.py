#!/usr/bin/env python3
"""Static / runtime availability check (never starts servers or installs dependencies)."""
import json, pathlib, shutil, sys
root=pathlib.Path(__file__).resolve().parents[1]
cfg=json.loads((root/".mcp.json").read_text())
entries=list((root/".claude"/"skills").glob("*/SKILL.md"))
print("README:", (root/"README.md").exists())
print("Narrative on this branch:", (root/"narrative").is_dir())
print("Skills installed:", len(entries))
print("MCP declarations:", ", ".join(cfg["mcpServers"]))
for cmd in ("node","npx","python3","uv","git"):
    print(cmd + ":", shutil.which(cmd) or "MISSING")
for p in entries:
    data=p.read_text(encoding="utf-8")
    if not data.startswith("---") or "name:" not in data or "description:" not in data:
        print("INVALID skill header:",p);sys.exit(1)
print("Static validation PASS. MCP availability and browser calls require separate live tests.")
