# TitleScreen — ui.title

Status: **EXISTING RUNTIME REUSED; startup readiness integrated locally; final visual redesign pending**.

Script: `res://scripts/ui/title/title_screen.gd`. StoryDirector constructs this Control directly; there is no new title `.tscn` in this step. Signals: `start_requested`, `support_requested`. Access: public.

StartupSequence fades its ink overlay away to reveal this existing title. The title becomes ready after both presentation and content loading finish. `Tap to start`, `Preparing…`, build text and Support keep their existing English behavior. New players still enter `A Letter the Rain Could Not Keep`; returning players use HubScreen; open battles use recovery.

The `ui/title_key_art` resolver slot is still unfilled and the current title visibly uses its existing placeholder. The new v02 art is reviewed in the separate ArtDirectionReviewV01 scene; this step does not promote it as final art or declare all UI completed. The next design step applies the shared art system to this title and then the entry screens.

Music is started by the entry presentation, not restarted by this view. It continues through title and existing entry operations; routing to a new player's story fades it out, while the hub/recovery routes use their existing hub cue behavior.

Sources: [current logo/native startup](../../design/STUDIO_SPLASH_V02.md), [historical startup/audio v01](../../design/STARTUP_AUDIO_V01.md), [first-launch design](../../../docs/design/FIRST_LAUNCH_FLOW.md), [art review](../../design/ART_SYSTEM_V01.md).
