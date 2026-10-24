#!/usr/bin/env bash
# One-time Unity install on a fresh Ubuntu 22.04/24.04 cloud VM (x86_64).
# Usage: bash apps/unity/cloud/setup_linux.sh
set -euo pipefail

UNITY_VERSION="${UNITY_VERSION:-6000.0.58f2}"
UNITY_CHANGESET="${UNITY_CHANGESET:-92dee566b325}"

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git git-lfs xvfb libgconf-2-4 libglu1-mesa || \
  sudo apt-get install -y ca-certificates curl gnupg git git-lfs xvfb libglu1-mesa

# Node 22 for npm run export:unity (content bundle exporter)
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Unity Hub (official apt repo)
if ! command -v unityhub >/dev/null; then
  curl -fsSL https://hub.unity3d.com/linux/keys/public | gpg --dearmor | sudo tee /usr/share/keyrings/Unity_Technologies_ApS.gpg >/dev/null
  echo "deb [signed-by=/usr/share/keyrings/Unity_Technologies_ApS.gpg] https://hub.unity3d.com/linux/repos/deb stable main" | \
    sudo tee /etc/apt/sources.list.d/unityhub.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y unityhub
fi

# Editor + Android module (child modules = Android SDK/NDK + OpenJDK bundled with this editor)
xvfb-run -a unityhub --no-sandbox --headless install \
  --version "$UNITY_VERSION" --changeset "$UNITY_CHANGESET" \
  --module android --childModules

EDITOR_DIR="$HOME/Unity/Hub/Editor/$UNITY_VERSION/Editor"
SDK_DIR="$EDITOR_DIR/Data/PlaybackEngines/AndroidPlayer/SDK"
JDK_DIR="$EDITOR_DIR/Data/PlaybackEngines/AndroidPlayer/OpenJDK"

# Billing 8 / Credential Manager 1.5 / Ads 24 need API 35; batchmode cannot prompt to download it.
SDKMANAGER="$(find "$SDK_DIR/cmdline-tools" -name sdkmanager -type f | head -n1)"
yes | JAVA_HOME="$JDK_DIR" "$SDKMANAGER" --sdk_root="$SDK_DIR" "platforms;android-35" "build-tools;35.0.0" >/dev/null

echo "Unity installed: $EDITOR_DIR/Unity"
echo "Next: activate a license (see apps/unity/cloud/README.md), then run: bash apps/unity/cloud/unity_ci.sh all"
