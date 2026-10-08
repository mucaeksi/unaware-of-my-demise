# Content-signing public keys (INF-028, DEC-0029)

`<key_id>.pem` here is a public key the app trusts for signed content manifests (`ContentManifest.trusted_keys`).
Only public keys belong here. The matching private key lives only in the GitHub repository secret
`CONTENT_SIGNING_KEY` and is never committed, pasted into chat or logged.

The folder ships inside the app (`export_presets.cfg` include filter `data/keys/*.pem`) and cannot be changed by a
content patch (DEC-0028 allowlist): adding or rotating a key is an app release.

Registered keys:

| key_id | Algorithm | SHA-256 of the DER public key | Registered |
|---|---|---|---|
| `uomd-content-1` | RSA 3072 | `5c5978b9a605d64fd20a946a83ee7392fdc10ca905cf4015146a3ffe55441101` | 2026-10-05, owner decision D-09 (generated in Cloud Shell; private key offline + secret `CONTENT_SIGNING_KEY`) |
