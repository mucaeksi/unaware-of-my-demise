# ASSET INVENTORY

The inventory should be machine-readable where possible.

Recommended fields:

| Field | Meaning |
|---|---|
| ID | Stable inventory ID |
| Source Path | Original LEGACY path |
| Filename | Original filename |
| Category | IMAGE/AUDIO/VIDEO/FONT/DATA/OTHER |
| Extension | File extension |
| Size Bytes | Exact size |
| SHA256 | Provenance/hash |
| Width | Images only |
| Height | Images only |
| Alpha | Images where detectable |
| Duration Sec | Audio/video where detectable |
| Channels | Audio where detectable |
| Sample Rate | Audio where detectable |
| Likely Role | Portrait/Sprite/UI/Voice/Music/SFX/etc. |
| Related Character | When supported by evidence |
| Related Story Element | When supported by evidence |
| Duplicate Candidate | YES/NO |
| Destination | Proposed new path |
| Action | MIGRATE/REFACTOR/ARCHIVE/etc. |
| Status | Exact project status label |
| Confidence | HIGH/MEDIUM/LOW |
| Evidence | Source note |

Do not use “unknown” as a reason to discard an asset. Use UNKNOWN status and preserve it.
