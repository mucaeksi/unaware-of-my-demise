# Sol story expression sets — 2026-10-26

Six new built-in OpenAI image edits extend the two composed masters to four candidate poses per lead. All native sources are **1024×1536**, with real transparent alpha; ingested runtime exports are **768×1152**. These are integration candidates, with human QC pending and native-2K/device acceptance open.

| Character | Pose | Source and exact submitted prompt |
| --- | --- | --- |
| Fadyme | Resolve | [Source](../../content/generated/openai/sol_fadyme_vn_resolve/source.png), [prompt](../../content/generated/openai/sol_fadyme_vn_resolve/prompt.txt) |
| Fadyme | Warm | [Source](../../content/generated/openai/sol_fadyme_vn_warm/source.png), [correction prompt](../../content/generated/openai/sol_fadyme_vn_warm/prompt.txt) |
| Fadyme | Wry | [Source](../../content/generated/openai/sol_fadyme_vn_wry/source.png), [prompt](../../content/generated/openai/sol_fadyme_vn_wry/prompt.txt) |
| Mahmut | Dry humor | [Source](../../content/generated/openai/sol_mahmut_vn_dry_humor/source.png), [prompt](../../content/generated/openai/sol_mahmut_vn_dry_humor/prompt.txt) |
| Mahmut | Protective resolve | [Source](../../content/generated/openai/sol_mahmut_vn_protective_resolve/source.png), [prompt](../../content/generated/openai/sol_mahmut_vn_protective_resolve/prompt.txt) |
| Mahmut | Watchful | [Source](../../content/generated/openai/sol_mahmut_vn_watchful/source.png), [prompt](../../content/generated/openai/sol_mahmut_vn_watchful/prompt.txt) |

Each folder contains `run.provenance.json`: actual native dimensions, source hash, exact submitted prompt, reference roles/hashes, original tool artifact and provider. The existing OpenAI composed master is the identity/crop/costume edit target. No undisclosed model or dollar cost is invented. Fadyme's first warm attempt retained a third hand; that image, its exact prompt and rejected-attempt provenance remain beside the corrected source. Seven built-in calls produced the six selected assets. No Gemini/provider API generation was run.

Open **Window → UOMD → Production Review**. The browser has nineteen candidates / 453 records. Selecting a new pose selects its own `portrait/<character>/<pose>` scenario; the two original character scenarios still show composed masters. Choose `/authored` to follow canonical emotion aliases in the real T1 Story controller. Select a canonical line and restart/show it. Seeking reconstructs both actors' prior expressions without playing skipped dialogue; stale texture loads cannot overwrite a newer pose.

The review routes are Editor-only. Normal authored story portrait mappings stay unchanged until the new stage paintings and narrative UI are integrated. Historical background/UI remain explicitly labeled references. The old panel can cover the lower bell/cloth, and tablet presentation retains its existing letterboxing; these are part of the upcoming native narrative UI pass. The new art is not a rig or an animation atlas.

[Final Game views and metadata](../review/index.html) cover each new pose, canonical emotion reconstruction, 1920×1080, 2400×1080 with simulated insets, and 1600×1200. Pause holds the selected line/voice across resizing. The original clean `UomdMain` scene, start-scene setting and Enter Play Mode settings were restored. A focused round trip also verifies eight current preference/checkpoint keys with their real data types. All Unity interaction used CLI/public typed controls; no native pointer/device acceptance is claimed.

Checks: `npm run verify` PASS (954 workspace/tool executions, 507 API tests, 224 content files reproduced), EditMode **126/126**, headless logic **111/111**, reference compile **12 assemblies / zero errors**, 66 skill adapters. See [scoped evidence](../evidence/sol-story-expressions-2026-10-26.json) for source/capture hashes, the companion-expression regression and exact limits.

Next: three original tutorial stage paintings, native narrative/tutorial UI, normal authored consumer migration and complete manual entry/Finish/Continue/restart. Owner art acceptance, physical Android, signing/provider and public release gates remain open. Changes are committed locally; the owner pushes.
