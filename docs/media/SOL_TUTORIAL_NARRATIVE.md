# Sol tutorial narrative — 2026-10-26

Three original built-in OpenAI paintings and native editable Story UI now serve the six tutorial before/after scenes in normal play. Canonical text, line IDs, emotion aliases, story commands and entry/progression contracts are unchanged. Other campaign stories, battle art and hub art remain migration work.

| Location | Source and submitted prompt | Runtime key |
| --- | --- | --- |
| Whispering Ash Forest | [Source](../../content/generated/openai/sol_bg_forest_whispering_ash/source.png), [prompt](../../content/generated/openai/sol_bg_forest_whispering_ash/prompt.txt) | `sol_forest_whispering_ash` |
| Forgotten Stone Crossing | [Source](../../content/generated/openai/sol_bg_forgotten_stone_crossing/source.png), [prompt](../../content/generated/openai/sol_bg_forgotten_stone_crossing/prompt.txt) | `sol_forgotten_stone_crossing` |
| Shelter Courtyard at Dusk | [Source](../../content/generated/openai/sol_bg_shelter_courtyard_dusk/source.png), [prompt](../../content/generated/openai/sol_bg_shelter_courtyard_dusk/prompt.txt) | `sol_shelter_courtyard_dusk` |

Each opaque native source is **1672×941**. Ingest makes a **1664×936** exact-16:9 export within the source dimensions, without upscaling; each WebP is below 320 KiB. The original generated artifact, exact prompt, reference roles/hashes, actual dimensions and provider are preserved in each folder's `run.provenance.json`. The title illustration supplies finish/palette; later stages reference the new forest painting for continuity. There are no baked actors, UI, readable inscriptions or tutorial eclipses. Three built-in calls produced the three sources; no Gemini/provider API generation was run. The tool does not disclose a model or dollar price.

All three automated ingest checks pass, with **human QC pending**. The workbench now has **22 candidates / 456 records**; final accepted replacements remain zero. These are integration candidates with native-2K, owner art and device gates open. Explicit `sol_` background keys preserve legacy battle/hub consumers for their later migration.

The native view is `apps/unity/Assets/_UOMD/Resources/Rebuild/Story.uxml` / `Story.uss`, bound by the partial `StoryScreenController` in `RebuildStoryPresentation.cs`. It uses real text/buttons, matte panels and responsive portrait slots; it does not attach the old animated bitmap decorations. Rebuilt Story occupies the available panel height, including 4:3; leaving Story restores the other controllers' existing layout. Portrait stature and facing come from the canonical table.

Next reveals the current line, then advances. Space/Return on the focused stage performs the same action. Auto advances at normal speed; Voice replays the current Japanese clip. Toolbar events do not bubble into another advance. First-view tutorial Skip is absent. Subtitle reveal follows the actual audio position, including mute and pause; a bounded unavailable-voice fallback uses the text clock. Reduced motion reveals text immediately. Image preflight holds the story until its illustrations load. Failure offers Try Again or explicit reading without images; unavailable story text offers retry only. Navigation invalidates pending image completions and stops the voice.

Open **Window → UOMD → Production Review**, select a new stage, then **Real scene / directing**. Choose `story/tutorial_t1_before` / `_after`, T2 or T3, a canonical line, and open/restart the isolated preview. Unpause to read through. The preview holds at its local ending, without saving progress or entering battle/Finish. Existing fixed-pose and `/authored` portrait reviews remain available. Captures retain actual paths, related ingest identities, presentation state, UI bounds and source scope.

[Executed checks and exact hashes](../evidence/sol-tutorial-narrative-2026-10-26.json) cover all **107 canonical tutorial lines** through UI submit events, six scene captures, 1920×1080 / 2400×1080 with simulated insets / 1600×1200, actual voice-clock reveal, pause, two-stage Next, toolbar bubbling, missing-image recovery and Editor/preference restoration. [Gallery](../review/index.html). Unity interaction is CLI only. These are Editor/typed-event checks; physical touch, Android performance, signed builds, owner approval and the complete manual battle/Finish/durable Continue/restart flow remain open.

Next: rebuilt manual tutorial/battle UI and new animation atlases, then complete the first-entry/Finish/Continue acceptance flow. Changes are committed locally on `main`; the owner pushes.
