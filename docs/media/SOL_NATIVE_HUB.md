# Native Home, Company and Chapters foundation

**Continuation — 2026-10-27:** native companion/Team/Armory and Saved Actions presentation, plus durable companion/Sweep actions, are now implemented at local scope. [Current guide](SOL_COMPANY_AND_SWEEP.md). Earlier presentation limits in this document describe its original delivery. Live account, Android, human art and release acceptance remain open.

2026-10-27, D-35. `HomeScreen`, `RosterScreen` (the Company view) and `ChaptersScreen` retain their existing route IDs and
use the editable native `Resources/Rebuild/Hub.uxml` / `Hub.uss` frame. The normal first-install Finish/Continue path opens
this Home. Existing character details, Team, Armory, Invitations, Summon, Archive, Errands, Deeds, Trials, Mail, Shop,
Profile, Account, Saved Actions and Notices routes remain reachable. Their deeper screen rebuilds remain separate work.

Home links the next published stage through Chapters. Company shows authoritative owned companions, levels, copies,
shards and the active team, with the existing character/detail and formation routes. Large companies use a native scroll
view. Only the two rebuilt lead portraits are used; other companion rows use names/data without substituting historical
character artwork. Chapters shows the active release's chapter/node titles, Normal/Hard variants, actual progress, stars,
Ration and published stage costs. Story prerequisites require a clear; battle prerequisites require a star, matching the
provider. Unknown prerequisites/costs fail closed. Starting a stage uses the existing server-sessioned campaign flow and
its durable battle journal. Repeated entry taps are guarded.

The old hard-coded Silver/Calling Ember chapter-tier text is removed. The only displayed main balance is `eclipse_token`,
labelled Bell's Remains. Ration remains the stage-entry resource. This foundation does not add chapter-tier reward claims
or expose Sweep spending through the new browser. Sweep controls and durable Sweep recovery remain a subsequent complete
stage-action slice; no unsupported reward value or claim button is presented as a working feature.

## Account and freshness boundary

`UomdHubState` reads `/me`, `/wallet`, `/characters/mine`, the public roster for the active release, `/teams`, `/progress`
and `/flags`. It publishes a new read-only `UomdHubSnapshot` only after the complete response group passes validation.
These separate server reads are not a database transaction. The loaded time is shown, and the server rechecks authority,
party and costs when the player enters/submits a battle.

No PlayerPrefs/local cleared-node cache is used as account authority. Missing account data shows a dash, rather than an
invented balance. A valid empty wallet envelope means zero, as on the provider. A failed refresh can retain the previous
same-account snapshot, explicitly marked as previously loaded; stage entry waits for a successful refresh. Sign-out,
account/auth revision and release changes clear the displayed account state immediately. Generation, auth/release and
cancellation guards reject late responses, including an older request for the same player after a session refresh.
Leaving a screen cancels its outstanding reads. Portrait loads are shared per visible source and reject removed targets;
capture identities are rebuilt from the currently displayed images.

## Original visual asset

The built-in OpenAI `image_gen.imagegen` tool produced the new empty stone-shelter background. No Gemini image was used
as the finished hub plate, and no image/API CLI fallback, API key or paid external generation call was used.

- Native source: `content/generated/openai/sol_hub_shelter_01/source.png`, **1672×941**, retained without upscaling.
- Exact prompt: `content/generated/openai/sol_hub_shelter_01/prompt.txt`.
- Provider/prompt/textual canon-source hashes: `content/generated/openai/sol_hub_shelter_01/run.provenance.json`.
- Ingest specification: `content/specs/image/sol_hub_shelter_01.ingest.json`.
- QC/provenance record: `content/approved_art/entries/sol_hub_shelter_01.json`.
- Runtime: `art/bg_sol_hub_shelter.webp`, 358268 bytes at native dimensions; Unity consumes its exported decodable sibling.

The location interprets the known T-3 broken-roof roadside shelter, ash road and misty forest. It adds no characters or
new lore. UI panels, labels, buttons and scrollbars are live Toolkit elements, with no baked menu pixels. The existing
OpenAI Fadyme/Mahmut portraits retain their exact identity/source provenance. Automatic ingest QC passes; human approval,
the final native-2K target and physical-device visual acceptance remain open.

## Inspect and verify

Choose **hub/home**, **hub/company** or **hub/chapters** in **Window → UOMD → Production Review**. The real controllers run
with an explicit memory-only account fixture and blocked HTTP. `HubReview.Mode` supplies ready, empty, offline, long-list,
maintenance, campaign and low-Ration cases. Full campaign layout cases read the canonical local patch chapter index for
layout review; they do not claim that this patch is installed/published on the fixture's embedded release. Capture
metadata records the fixture mode and exact index source. Non-rebuilt detail routes are recorded as route probes in this
isolated review; Home/Company/Chapters navigation and the canonical T1 pre-story entry run their actual controllers.

The CLI review checks 1920×1080, 2400×1080 with simulated cutout/gesture insets and 1600×1200, visible navigation bounds,
scrolling, closed overlays, repeated taps, empty/error/stale/guest states, Normal/Hard costs and late account responses.
NavigationSubmit events are Editor evidence, not physical touch. Sources/capture hashes, executed checks and Editor
restoration are recorded in [scoped evidence](../evidence/sol-native-hub-2026-10-27.json). Live account/provider, Android,
human art and release gates remain open. Work is committed locally on main; the owner controls pushes/deployments.
