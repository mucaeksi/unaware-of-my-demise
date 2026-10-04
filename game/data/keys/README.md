# Content-signing public keys (INF-028, DEC-0029)

`<key_id>.pem` here is a public key the app trusts for signed content manifests (`ContentManifest.trusted_keys`).
Only public keys belong here. The matching private key lives only in the GitHub secret `CONTENT_SIGNING_KEY`
(environment `production`) and is never committed, pasted into chat or logged.

The folder ships inside the app (`export_presets.cfg` include filter `data/keys/*.pem`) and cannot be changed by a
content patch (DEC-0028 allowlist): adding or rotating a key is an app release.

No key is registered yet (owner decision D-09), so the app trusts no manifest and installs no patch.
