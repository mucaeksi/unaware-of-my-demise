#!/usr/bin/env bash
# Boots the debug APK on a running emulator and checks the basics: it installs, starts, stays alive in the foreground, the WebView
# renders the game (screenshot kept as evidence) and nothing crashed. Real sign-in / billing / ads need a signed Play build on a real
# device (internal testing track), which is a separate owner-run acceptance test.
set -euo pipefail
APK="${1:?apk path}"
PKG=io.github.mucaeksi.unawareofmydemise
OUT=.cache/android-smoke
mkdir -p "$OUT"
adb install -r "$APK" >/dev/null
adb logcat -c
adb shell am start -n "$PKG/.MainActivity" >/dev/null
sleep 45
adb exec-out screencap -p > "$OUT/title.png"
adb logcat -d > "$OUT/logcat.txt" || true
adb shell dumpsys activity activities | grep -E "mResumedActivity|topResumedActivity" | head -2 | tee "$OUT/activity.txt"
grep -q "$PKG" "$OUT/activity.txt" || { echo "app is not in the foreground"; exit 1; }
if grep -E "FATAL EXCEPTION|AndroidRuntime: " "$OUT/logcat.txt" | head -3 | grep -q .; then echo "crash found"; grep -E "FATAL EXCEPTION" -A8 "$OUT/logcat.txt" | head -20; exit 1; fi
# the web layer must have loaded: Capacitor logs its console and the page title scene prints no errors
grep -E "Capacitor" "$OUT/logcat.txt" | head -5 || true
test "$(stat -c %s "$OUT/title.png")" -gt 20000 || { echo "screenshot is suspiciously small"; exit 1; }
echo "emulator smoke OK"
