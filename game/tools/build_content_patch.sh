#!/usr/bin/env bash
# Builds a content patch PCK against a base pack and refuses it unless it carries only data and imported art/audio
# (INF-027, tools/pck_inventory.py). The base is the pack of the app release the patch applies to (the same commit's
# `--export-pack`, kept with that release); the patch holds what changed since.
#
# Usage: GODOT=/path/to/godot game/tools/build_content_patch.sh <base.pck> <out.pck> [earlier patches, comma-separated]
# Writes <out.pck> and <out.pck>.inventory.json (every file with size, MD5 and SHA-256); prints the patch's SHA-256.
# Exit 1 when the patch would change code, scenes, resources that can hold script, or project settings (that change
# needs an app release instead) or the export fails; exit 3 when nothing changed since the base.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
base="$(realpath "${1:?usage: build_content_patch.sh <base.pck> <out.pck> [earlier patches]}")"
out="$(realpath -m "${2:?usage: build_content_patch.sh <base.pck> <out.pck> [earlier patches]}")"
earlier="${3:-}"
godot="${GODOT:?set GODOT to the pinned Godot binary}"
packs="${base}${earlier:+,${earlier}}"
mkdir -p "$(dirname "${out}")"
rm -f "${out}"
log="$(mktemp)"
trap 'rm -f "${log}"' EXIT
if ! "${godot}" --headless --path "${here}/.." --patches "${packs}" --export-patch "Content Full" "${out}" >"${log}" 2>&1; then
  if grep -q "No files or changes to export" "${log}"; then
    echo "nothing to patch: the project equals the base pack(s)"
    exit 3
  fi
  cat "${log}" >&2
  echo "::error::the patch export failed" >&2
  exit 1
fi
[[ -s "${out}" ]] || { cat "${log}" >&2; echo "::error::the export wrote no patch at ${out}" >&2; exit 1; }
python3 "${here}/../../tools/pck_inventory.py" "${out}" --patch-policy --base "${base}" --json "${out}.inventory.json"
echo "content patch ok: $(sha256sum "${out}" | cut -d' ' -f1)  $(python3 -c "import json,sys; print(len(json.load(open(sys.argv[1]))['files']))" "${out}.inventory.json") file(s)"
