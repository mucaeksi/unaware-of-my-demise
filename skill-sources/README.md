# Curated upstream skill archives
Place **the exact uploaded ZIP files** in this directory (preserve their filenames, contents and extensions). Then run `python3 tools/bootstrap_skills.py`, or push them to `main` to trigger the GitHub Actions bootstrap. Checksums are pinned in the installer; unknown or altered archives will not be executed or installed. A failed check should be resolved by investigation, not bypassing validation.

Required for the complete offline bundle:
- `UOMD_Claude_Phaser_Toolkit_2026-10-10.zip`
- `awesome-gamedev-agent-skills-1.1.0.zip`

Optional source/provenance archives (the toolkit already includes selected skill content; external MCP packages are installed at runtime instead):
- `ponytail-5.1.0.zip`
- `ui-ux-pro-max-skill-2.15.0.zip`
- `graphify-0.9.84.zip`
- `context7--upstash-context7-mcp-4.3.0.zip`
- `chrome-devtools-mcp-chrome-devtools-mcp-v1.10.1.zip`

Do not unzip complete third-party Node/Python repositories inside the game. No upstream hook is automatically enabled.

The installer additionally downloads **28 official Phaser 4 SKILL.md files directly from a pinned commit of `phaserjs/phaser`**, not from the third-party skills-hub mirror. This step needs internet access. GitHub ZIP storage is convenient but grows git history; once the pinned skill files are committed, retain archives only if you need reproducible offline audits.

Current branch note: as observed before this bootstrap, `main` was empty; the earlier Godot/Narrative files were on other branches. The bootstrap **does not move, delete or pretend to restore Narrative.**
