#!/usr/bin/env bash
# Exports the signed release AAB (INF-040) with the pinned Godot, then proves what it is (INF-041): bundletool
# validates it and turns it into the universal APK a device would get, and game/tools/verify_apk.sh checks that APK
# (package, min/target SDK, arm64-v8a only, permission allowlist, UomdNative plugin, 16 KB zip and ELF alignment).
# Also writes the base pack of this build (the immutable base content patches apply to, DEC-0028/0031) and a
# provenance file with every hash.
#
# Needs: GODOT, JAVA_HOME (JDK 17), ANDROID_HOME, the export templates, the UomdNative AARs, BUNDLETOOL (a jar), and
# the upload key from the environment, never from a file in the repository:
#   UPLOAD_KEYSTORE           path to the upload keystore (decoded from a secret by the caller)
#   UPLOAD_KEY_ALIAS, UPLOAD_KEYSTORE_PASSWORD
#   VERSION_CODE              a positive integer, higher than every release before (Play refuses anything else)
#   VERSION_NAME              e.g. 0.1.0
# Usage: build_android_release.sh <out-dir>     → <out-dir>/uomd-<code>.aab, base-<code>.pck, provenance-<code>.json
set -euo pipefail
game_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
out_dir="$(realpath -m "${1:?usage: build_android_release.sh <out-dir>}")"
: "${GODOT:?set GODOT}" "${JAVA_HOME:?set JAVA_HOME}" "${ANDROID_HOME:?set ANDROID_HOME}" "${BUNDLETOOL:?set BUNDLETOOL to bundletool-all.jar}"
: "${UPLOAD_KEYSTORE:?set UPLOAD_KEYSTORE}" "${UPLOAD_KEY_ALIAS:?set UPLOAD_KEY_ALIAS}" "${UPLOAD_KEYSTORE_PASSWORD:?set UPLOAD_KEYSTORE_PASSWORD}"
: "${VERSION_CODE:?set VERSION_CODE}" "${VERSION_NAME:?set VERSION_NAME}"
[[ "${VERSION_CODE}" =~ ^[1-9][0-9]{0,8}$ ]] || { echo "VERSION_CODE must be a positive integer" >&2; exit 2; }
[[ "${VERSION_NAME}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "VERSION_NAME must look like 1.2.3" >&2; exit 2; }
mkdir -p "${out_dir}"
aab="${out_dir}/uomd-${VERSION_CODE}.aab"
base="${out_dir}/base-${VERSION_CODE}.pck"

# The versionCode lives in two places that must agree: the export preset (what Play sees) and the project setting the
# client reports to the server (X-Client-Version-Code, the release gate). This working copy is changed, never committed.
sed -i -E "s/^version\/code=.*/version\/code=${VERSION_CODE}/; s/^version\/name=.*/version\/name=\"${VERSION_NAME}\"/" "${game_dir}/export_presets.cfg"
if grep -q '^release/version_code=' "${game_dir}/project.godot"; then
  sed -i -E "s/^release\/version_code=.*/release\/version_code=${VERSION_CODE}/" "${game_dir}/project.godot"
else
  echo "project.godot has no uomd release/version_code setting" >&2; exit 2
fi

# Debug-keystore editor settings and the Gradle template come from the debug script's setup; release signing from the
# environment (Godot reads GODOT_ANDROID_KEYSTORE_RELEASE_* at export).
"${game_dir}/tools/build_android_debug.sh" "${out_dir}/.debug-for-setup.apk" >/dev/null
rm -f "${out_dir}/.debug-for-setup.apk"
export GODOT_ANDROID_KEYSTORE_RELEASE_PATH="${UPLOAD_KEYSTORE}"
export GODOT_ANDROID_KEYSTORE_RELEASE_USER="${UPLOAD_KEY_ALIAS}"
export GODOT_ANDROID_KEYSTORE_RELEASE_PASSWORD="${UPLOAD_KEYSTORE_PASSWORD}"
rm -f "${aab}"
"${GODOT}" --headless --path "${game_dir}" --export-release "Android AAB" "${aab}"
[[ -s "${aab}" ]] || { echo "the export did not produce ${aab}" >&2; exit 1; }
"${GODOT}" --headless --path "${game_dir}" --export-pack "Android" "${base}" >/dev/null 2>&1
[[ -s "${base}" ]] || { echo "the base pack was not written" >&2; exit 1; }

# Signed with the upload key, and nothing else.
# (-strict is not used: it also fails on the missing timestamp and on JarInputStream ordering warnings that every AAB
# produces; Play re-signs with the app signing key anyway. What matters is that the signature verifies and is ours.)
"${JAVA_HOME}/bin/jarsigner" -verify "${aab}" 2>/dev/null | grep -q "^jar verified" || { echo "the AAB signature does not verify" >&2; exit 1; }
upload_sha256="$("${JAVA_HOME}/bin/keytool" -list -v -keystore "${UPLOAD_KEYSTORE}" -storepass "${UPLOAD_KEYSTORE_PASSWORD}" -alias "${UPLOAD_KEY_ALIAS}" | sed -n 's/^\s*SHA256: //p' | head -n1)"
signer_sha256="$("${JAVA_HOME}/bin/keytool" -printcert -jarfile "${aab}" | sed -n 's/^\s*SHA256: //p' | head -n1)"
[[ -n "${signer_sha256}" && "${signer_sha256}" == "${upload_sha256}" ]] || { echo "the AAB is not signed with the upload key" >&2; exit 1; }

# What a device installs: bundletool's universal APK, checked like the debug APK.
"${JAVA_HOME}/bin/java" -jar "${BUNDLETOOL}" validate --bundle="${aab}" >/dev/null
work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
"${JAVA_HOME}/bin/java" -jar "${BUNDLETOOL}" build-apks --bundle="${aab}" --output="${work}/universal.apks" --mode=universal \
  --ks="${UPLOAD_KEYSTORE}" --ks-key-alias="${UPLOAD_KEY_ALIAS}" --ks-pass="pass:${UPLOAD_KEYSTORE_PASSWORD}"
unzip -q -o "${work}/universal.apks" universal.apk -d "${work}"
"${game_dir}/tools/verify_apk.sh" "${work}/universal.apk"
build_tools="$(ls -d "${ANDROID_HOME}"/build-tools/* | sort -V | tail -1)"
version_line="$("${build_tools}/aapt2" dump badging "${work}/universal.apk" 2>/dev/null | sed -n "s/^package: .*versionCode='\([0-9]*\)'.*versionName='\([^']*\)'.*/\1 \2/p" | head -n1)"
[[ "${version_line}" == "${VERSION_CODE} ${VERSION_NAME}" ]] || { echo "the APK reports version ${version_line}, expected ${VERSION_CODE} ${VERSION_NAME}" >&2; exit 1; }

python3 - "${out_dir}/provenance-${VERSION_CODE}.json" <<PY
import hashlib, json, os, sys
digest = lambda path: hashlib.sha256(open(path, "rb").read()).hexdigest()
json.dump({
    "version_code": int(os.environ["VERSION_CODE"]),
    "version_name": os.environ["VERSION_NAME"],
    "commit": os.environ.get("GITHUB_SHA", ""),
    "godot": open(os.path.join("${game_dir}", "GODOT_VERSION")).read().strip(),
    "aab": {"file": os.path.basename("${aab}"), "sha256": digest("${aab}"), "bytes": os.path.getsize("${aab}")},
    "base_pack": {"file": os.path.basename("${base}"), "sha256": digest("${base}"), "bytes": os.path.getsize("${base}")},
    "upload_certificate_sha256": "${upload_sha256}",
}, open(sys.argv[1], "w"), indent=2)
PY
echo "release ${VERSION_CODE} (${VERSION_NAME}): $(sha256sum "${aab}" | cut -d' ' -f1)  $(basename "${aab}")"
