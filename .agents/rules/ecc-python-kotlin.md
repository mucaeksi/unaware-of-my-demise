# ECC 2.2.3 Python Tooling & Kotlin/Android Rules (`tools/` & `apps/android`)

> Full verbose rules live in `.claude/rules/ecc/python/` (Unity C#: the `unity-*` and `uomd-*` skills).

- **Python (`tools/*.py`)**: Follow PEP 8 with explicit type hints, `pathlib.Path`, deterministic UTF-8 (`newline="\n"`) file writes, symlink/path-traversal guards, and `unittest`/`pytest` verification without unapproved third-party packages.
- **Kotlin & Capacitor Android (`apps/android`)**: Prefer `val`, immutable collections, sealed classes/interfaces for state/results, and structured concurrency (`viewModelScope` / `lifecycleScope` with explicit cancellation handling; never `GlobalScope`). Keep native Billing, AdMob/UMP, and Play Integrity bridges behind clean repository/plugin boundaries.
