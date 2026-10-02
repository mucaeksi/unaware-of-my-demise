# Game Toolchain

Pinned starter version: Godot 4.7.2 stable.

Android export target: API 36.

## Development model

Development is cloud-only through Claude Code Cloud and GitHub.
Do not assume a permanent local Godot Editor or local backend is available.

## CI/build

GitHub Actions is the primary build/test system.
The Godot project should be made compatible with headless/cloud validation and Android AAB export.

## Target runtime

- Cloudflare Workers
- Neon PostgreSQL
- Cloudflare R2
- Next.js admin

Update engine/toolchain versions deliberately and re-test when changing them.
