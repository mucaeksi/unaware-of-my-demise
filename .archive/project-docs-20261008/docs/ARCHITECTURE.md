# Architecture

```text
Godot Android client
  ├─ core executable + initial assets
  ├─ login/session
  ├─ gacha UI
  └─ PatchManager
          │ HTTPS
          ▼
Backend API (Fastify) ───────────────► PostgreSQL
          │                                  │
          ├─ auth                            ├─ players
          ├─ gacha RNG + pity                ├─ wallets
          ├─ inventory                       ├─ inventory
          ├─ purchases                       ├─ banners/entries
          └─ admin                           ├─ pity/draws
                                             └─ audit

Patch CDN/object storage
  └─ patch_1.0.1.pck / patch_1.0.2.pck / ...

Admin web ───────────────────────────► Backend API
```

## Authority

Client: input, presentation, local cache, patch loading.

Server: account identity, currency, inventory, pity, gacha RNG, purchase verification, event timing and anti-abuse.

Database: source of truth.

## Patch releases

The initial release needs an immutable `base.pck`. Each later patch should be generated against the base plus every previous patch. Keep published PCK filenames immutable. A manifest should identify content version, URL, size and SHA-256; production should additionally sign the manifest and use object storage/CDN.

Do not use PCK patches to ship Android executable code. Keep executable/client logic in the Play-distributed app.
