#!/usr/bin/env bash
# Signs a content-release manifest (INF-028, DEC-0029) and proves the signature with the public key the app ships.
#
# Usage: CONTENT_SIGNING_KEY="$(secret PEM)" tools/sign_content_manifest.sh <manifest.json>
# Writes <manifest.json>.sig: RSA PKCS#1 v1.5 over SHA-256 of the exact manifest bytes (what ContentManifest verifies).
# The private key comes only from the environment (GitHub secret CONTENT_SIGNING_KEY, environment production); it is
# written to a private temporary file for openssl and removed on exit. The manifest's key_id must name a public key
# committed at game/data/keys/<key_id>.pem (UOMD_KEYS_DIR overrides the directory, for tests), and that key must verify
# the new signature, or nothing is published.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="${1:?usage: sign_content_manifest.sh <manifest.json>}"
: "${CONTENT_SIGNING_KEY:?set CONTENT_SIGNING_KEY to the PEM private key (never commit it)}"
key_id="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["key_id"])' "${manifest}")"
[[ "${key_id}" =~ ^[a-z0-9-]+$ ]] || { echo "::error::invalid key_id '${key_id}'" >&2; exit 1; }
keys="${UOMD_KEYS_DIR:-${root}/game/data/keys}"
public="${keys}/${key_id}.pem"
[[ -f "${public}" ]] || { echo "::error::no public key ${public}: the app could not verify this manifest" >&2; exit 1; }
umask 077
private="$(mktemp)"
trap 'rm -f "${private}"' EXIT
printf '%s\n' "${CONTENT_SIGNING_KEY}" > "${private}"
openssl dgst -sha256 -sign "${private}" -out "${manifest}.sig" "${manifest}"
openssl dgst -sha256 -verify "${public}" -signature "${manifest}.sig" "${manifest}" >/dev/null \
  || { rm -f "${manifest}.sig"; echo "::error::the signing key does not match ${public}" >&2; exit 1; }
echo "signed ${manifest} with ${key_id}"
