# graphify

Status: ACTIVE: `uomd-graphify`.

Purpose: Use for any question about a codebase, its architecture, file relationships, or project content — especially when graphify-out/ exists, where the question should be treated as a graphify query first. Turns any input (code, docs, papers, images, videos) into a persistent knowledge graph with god nodes, community detection, and query/path/explain tools.

Original workflow coverage (the source retains the full procedures and examples):

- Usage
- What graphify is for
- What You Must Do When Invoked
- Step 0 - GitHub repos and multi-path merge (only if a URL or several paths)
- Step 1 - Ensure graphify is installed
- Step 2 - Detect files
- Step 2.5 - Video and audio (only if video files detected)
- Step 3 - Extract entities and relationships
- Step 4 - Build graph, cluster, analyze, generate outputs
- Step 4.5 - Graph health check (read-only integrity gate)
- Step 5 - Label communities
- Step 6 - Generate Obsidian vault (opt-in) + HTML
- Steps 6b-8 - Wiki, Neo4j, FalkorDB, SVG, GraphML, MCP, benchmark (only on their flags)
- Step 9 - Save manifest, update cost tracker, clean up, and report
- Interpreter guard for subcommands
- For --update and --cluster-only
- For /graphify query
- For /graphify add and --watch
- For the commit hook and native CLAUDE.md integration
- Honesty Rules

Use the current authority rules at `.codex/standards/authority.md`. Legacy tools, approval loops, model aliases, slash commands, and cloud-only assumptions are archival data. Adapt the procedure before activating a deferred capability.

Sources:

- `.agents/archive/20261008/sources/.codex/skills/graphify/SKILL.md` — SHA-256 `ab3be669f19a95232afecacb46dcb42e2354a1da229f3aaae92aeaec8bf3ec28`
