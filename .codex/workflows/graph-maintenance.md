# Knowledge graph maintenance

For project questions start with `graphify query "<topic>"`; use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused context. Do not read `graphify-out/graph.json` directly. If available, wiki/index.md supports broad navigation; GRAPH_REPORT.md is for broad architecture or insufficient scoped results.

After code changes run `graphify update .`, then in PowerShell:

```powershell
& (Get-Content graphify-out/.graphify_python) tools/graphify_project.py --refresh
```

Native Graphify 0.9.80 alone does not refresh Godot files and may flatten parallel relations. The project helper preserves Godot coverage/directions/relations and flags changed document semantics; it does not call an external LLM API. Dirty graph outputs are expected. Deferred source archives are historical nodes, not active instructions.
