# Isolated Godot study installation — 2026-10-09

Pinned native Skeleton2D demo (MIT), Phantom Camera 0.11.0.3 addon (MIT), and Universal Transition Shader (CC0). SOURCES.json preserves copied upstream byte hashes, revision and notices. Open each project's project.godot with the pinned Godot 4.7.2, separately from game/.

Skeleton2D retains the official demo unchanged; GBot and its rig are MIT technical examples, not Fadyme art. Phantom Camera has a separate study-only manager autoload and no editor-plugin activation; activating its original plugin would restart that study editor. The original addon is complete and unpatched. The transition study uses only the original shader/mask with a new Compatibility/portrait project; the upstream project defaults to Forward+ and contains an author's local movie path, so that project configuration was not copied.

Run study checks with `Godot --path <study-directory> --script verify.gd` after import. Evidence and exact limitations are in docs/art/GODOT_SHARED_INSTALL_REPORT_2026-10-09_TR.md. These projects are outside game/ and never its export input. They have no game navigation, clock, audio or gameplay bindings. Runtime promotion belongs to Claude after a specific accepted handoff. No new Fadyme art/rig, final audio, font swap or optional bulk installation is claimed.
