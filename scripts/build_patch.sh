#!/usr/bin/env bash
set -euo pipefail
VERSION="${1:?content version}"
BASE_PACK="${BASE_PACK:?set BASE_PACK to the immutable initial-release base.pck}"
PREVIOUS_PATCHES="${PREVIOUS_PATCHES:-}"
GODOT_BIN="${GODOT_BIN:-godot}"
OUT="../patch/files/patch_${VERSION}.pck"
mkdir -p ../patch/files
PACKS=("$BASE_PACK")
IFS=',' read -ra EXTRA <<< "$PREVIOUS_PATCHES"
for p in "${EXTRA[@]}"; do [[ -n "$p" ]] && PACKS+=("$p"); done
PATCH_LIST=$(IFS=,; echo "${PACKS[*]}")
"$GODOT_BIN" --headless --path ../game --patches "$PATCH_LIST" --export-patch "Android" "$OUT"
sha256sum "$OUT"
