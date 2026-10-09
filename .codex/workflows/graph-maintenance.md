# Knowledge graph maintenance

For project questions start with `graphify query "<topic>"`; use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused context. Do not read `graphify-out/graph.json` directly. If available, wiki/index.md supports broad navigation; GRAPH_REPORT.md is for broad architecture or insufficient scoped results.

After code changes run `graphify update .`, then in PowerShell:

```powershell
& (Get-Content graphify-out/.graphify_python) tools/graphify_project.py --refresh
```

Native Graphify 0.9.80 alone does not refresh Godot files and may flatten parallel relations. The project helper preserves Godot coverage/directions/relations and flags changed document semantics; it does not call an external LLM API. Dirty graph outputs are expected. Deferred source archives are historical nodes, not active instructions.

For Linux/cloud use the Python environment where `graphifyy==0.9.80` is installed:

```bash
python3 tools/graphify_project.py --refresh
```

The saved interpreter path is environment-local; a path from another machine is
not a runnable cloud interpreter. Generated dependency/cache folders are excluded
by the helper even when repository Git ignore rules are disabled.

The helper also rebuilds `graph.html` from the final Godot-aware graph and
`fadyme.html` from Fadyme source nodes plus direct neighbors. Both use the
pinned local renderer in `tools/vendor/vis-network-9.1.6/` and need no CDN.
The large overview is aggregated by community; CLI queries retain full detail.
See `docs/GRAPHIFY_REVIEW_2026-10-09.md` for browser evidence and semantic limits.
