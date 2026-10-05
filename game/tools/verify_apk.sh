#!/usr/bin/env bash
# Verifies an exported APK against the brief (G2.3, G7): package id, min/target SDK, 64-bit ARM only, the
# permission list, the UomdNative plugin registration (Google sign-in, INF-017), 16 KB zip alignment and 16 KB ELF
# segment alignment of every native library.
# Usage: verify_apk.sh <apk> [allowed permissions, space separated; default: the game's allowlist below]
# Needs ANDROID_HOME (build-tools with aapt2 and zipalign) and readelf.
set -euo pipefail
apk="${1:?usage: verify_apk.sh <apk> [allowed permissions...]}"
shift || true
# The game's whole permission allowlist (INF-018, INF-036/DEC-0038); a new library that merges in anything else fails here.
#   INTERNET: the game API. DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION: androidx.core's app-private signature permission.
#   com.android.vending.BILLING: Play Billing (the Eclipse Blessing).
#   AD_ID, ACCESS_NETWORK_STATE, WAKE_LOCK, FOREGROUND_SERVICE: Google Mobile Ads and its WorkManager (rewarded ads).
#   ACCESS_ADSERVICES_AD_ID/ATTRIBUTION/TOPICS: Google Mobile Ads' Android Privacy Sandbox defaults.
# Play Console's Data safety form must declare the advertising ID while AD_ID is here (docs/OWNER_DECISIONS.md D-18).
default_allowed=(
  android.permission.INTERNET
  io.github.mucaeksi.unawareofmydemise.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
  com.android.vending.BILLING
  com.google.android.gms.permission.AD_ID
  android.permission.ACCESS_NETWORK_STATE
  android.permission.WAKE_LOCK
  android.permission.FOREGROUND_SERVICE
  android.permission.ACCESS_ADSERVICES_AD_ID
  android.permission.ACCESS_ADSERVICES_ATTRIBUTION
  android.permission.ACCESS_ADSERVICES_TOPICS
)
if [[ $# -gt 0 ]]; then allowed=("$@"); else allowed=("${default_allowed[@]}"); fi
: "${ANDROID_HOME:?set ANDROID_HOME to the Android SDK}"
tools="$(ls -d "${ANDROID_HOME}"/build-tools/* | sort -V | tail -1)"
fail=0
say() { printf '%s\n' "$*"; }
bad() { say "FAIL: $*"; fail=1; }

badging="$("${tools}/aapt2" dump badging "${apk}" 2>/dev/null)"
package="$(sed -n "s/^package: name='\([^']*\)'.*/\1/p" <<<"${badging}")"
min_sdk="$(sed -n "s/^minSdkVersion:'\([0-9]*\)'.*/\1/p" <<<"${badging}")"
target_sdk="$(sed -n "s/^targetSdkVersion:'\([0-9]*\)'.*/\1/p" <<<"${badging}")"
native="$(sed -n "s/^native-code: //p" <<<"${badging}")"
say "package=${package} minSdk=${min_sdk} targetSdk=${target_sdk} native-code=${native} size=$(stat -c %s "${apk}") bytes"
[[ "${package}" == "io.github.mucaeksi.unawareofmydemise" ]] || bad "applicationId is ${package}"
[[ "${min_sdk}" == "28" ]] || bad "minSdk is ${min_sdk}, expected 28"
[[ "${target_sdk}" == "36" ]] || bad "targetSdk is ${target_sdk}, expected 36"
[[ "${native}" == "'arm64-v8a'" ]] || bad "native-code is ${native}, expected only arm64-v8a"

mapfile -t permissions < <(sed -n "s/^uses-permission: name='\([^']*\)'.*/\1/p" <<<"${badging}" | sort)
say "permissions: ${permissions[*]:-(none)}"
for permission in "${permissions[@]}"; do
  found=0
  for ok in "${allowed[@]}"; do [[ "${permission}" == "${ok}" ]] && found=1; done
  [[ ${found} -eq 1 ]] || bad "unexpected permission ${permission}"
done

if "${tools}/zipalign" -c -P 16 -v 4 "${apk}" >/tmp/zipalign.$$ 2>&1; then say "zipalign -P 16: ok"; else tail -5 /tmp/zipalign.$$; bad "zip is not 16 KB aligned"; fi
rm -f /tmp/zipalign.$$

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT
unzip -q -o "${apk}" 'lib/*' -d "${work}"
libs=0
while IFS= read -r lib; do
  libs=$((libs + 1))
  aligns="$(readelf -lW "${lib}" | awk '$1=="LOAD"{print $NF}' | sort -u | tr '\n' ' ')"
  say "  ${lib#"${work}"/}: LOAD align ${aligns}"
  for align in ${aligns}; do
    (( align >= 0x4000 )) || bad "${lib#"${work}"/} has a LOAD segment aligned to ${align}"
  done
done < <(find "${work}/lib" -name '*.so' | sort)
[[ ${libs} -gt 0 ]] || bad "no native libraries found"

manifest="$("${tools}/aapt2" dump xmltree --file AndroidManifest.xml "${apk}" 2>/dev/null)"
if grep -q '"io.github.mucaeksi.uomd.UomdNative"' <<<"${manifest}"; then
  say "UomdNative plugin: registered"
else
  bad "the UomdNative plugin is not registered (game/tools/build_uomd_native.sh before the export)"
fi
[[ ${fail} -eq 0 ]] && say "APK verification passed" || { say "APK verification FAILED"; exit 1; }
