---
paths:
  - "game/networking/**"
  - "game/**/network/**"
  - "**/*.gd"
---

# Network Code Rules

- Server is AUTHORITATIVE for all gameplay-critical state — never trust the client
- All network messages must be versioned for forward/backward compatibility
- Client/server synchronization must be designed explicitly from the game mode; do not assume rollback/prediction is required for a non-real-time gacha game.
- Handle disconnection, reconnection, and host migration gracefully
- Rate-limit all network logging to prevent log flooding
- All networked values must specify replication strategy: reliable/unreliable, frequency, interpolation
- Bandwidth budget: define and track per-message-type bandwidth usage
- Security: validate all incoming packet sizes and field ranges
