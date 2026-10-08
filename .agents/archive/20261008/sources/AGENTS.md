# Godot development

- This is a Godot 4.7.2 project. Its Godot project root is `game/`.
- Godot AI MCP is the preferred interface for live Godot Editor operations.
- Before manually editing complex `.tscn` or `.tres` resources, prefer the appropriate Godot AI editor tools when available.
- After meaningful scene, UI, gameplay, navigation, animation, or resource changes, validate the result in the real Godot Editor/runtime.
- Use Godot AI logs, runtime execution, editor inspection, and screenshots when relevant.
- Do not mark a feature complete only because the source code parses.
- Preserve existing user work.
- Never invent story canon when project documentation does not contain the information.
- Do not silently replace working project architecture without a technical reason.
- Use Godot AI MCP for editor-aware operations whenever it is safer than raw text editing.

# Current local scope

- Work locally. Do not push to GitHub until the owner explicitly changes this instruction.
- Continue with Entry only; the owner chooses the next screen.
- Treat the secondary Production folder as a read-only creative source.
- Preserve the project-wide strict typing checks and unrelated plugins.

# Owner workflow preference

- Keep the existing Godot Editor and live runtime open across UI phases and sessions; prefer editor hot reload and refreshing controls over restarting the game window.
- Keep a reusable native Local UI Preview window open for the owner to follow changes. Use `scripts/art_review/preview_session.gd` in the editor's live runtime; refresh after each validated phase. Preview operations use local sample data.
- Minimize the editor only when live editor/runtime tools remain reliable; otherwise leave it visible. Restart only for a concrete parse/debugger/lifecycle problem, and explain the reason.
- Run unattended test tools headlessly; capture UI evidence through the existing runtime rather than repeatedly launching visible Godot windows.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.
Do NOT read graphify-out/graph.json directly. Use graphify query "<topic>" to retrieve relevant graph nodes.
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

This map also includes Godot-specific extraction. Native Graphify 0.9.80 does not
refresh `.gd`, `.tscn`, `.tres`, or `.gdshader`, and its update path can flatten
parallel relations. After the native update, rebuild the complete map with
`& (Get-Content graphify-out/.graphify_python) tools/graphify_project.py --refresh`.
The project helper preserves direction, distinct relations, file coverage, and
unchanged document fragments. Changed document semantics are flagged for review;
the helper does not call an external LLM API.
