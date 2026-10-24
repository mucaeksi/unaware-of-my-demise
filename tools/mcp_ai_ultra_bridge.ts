#!/usr/bin/env node
/**
 * UOMD Google AI Ultra Bridge MCP Server (stdio).
 *
 * Bridges Unaware of My Demise's canonical narrative, approved art, and Unity 6 LTS (URP 2D + UI Toolkit) presentation engine
 * with the Google AI Ultra ecosystem:
 *  - Google Flow (Veo 3.1 1080p filmmaking studio: Ingredients, Frames-to-Video, Camera Controls, Scenebuilder)
 *  - Project Genie (DeepMind Genie 3 interactive 3D/2.5D world model for parallax depth & corridor exploration)
 *  - Gemini Notebook / NotebookLM Plus (500-source zero-hallucination canon & dialogue grounding)
 *  - Google Whisk & Whisk Animate (Subject + Scene + Style lock & looping character idle animations)
 *  - Project Mariner / Chrome DevTools (agentic browser verification)
 *
 * Safe by design: generates deterministic local recipes, storyboards, and canon bundles in `.cache/ai-ultra/`
 * without automatically spending cloud credits or initiating paid jobs without user confirmation.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, '.cache', 'ai-ultra');

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function getCapabilities(): Record<string, unknown> {
  return {
    plan: 'Google AI Ultra',
    mode: 'safe_prepared_workflows (no automatic credit spend without explicit user confirmation)',
    tools_and_integrations: [
      {
        product: 'Google Flow (labs.google/fx/tools/flow — Veo 3.1 + Imagen 4)',
        ultraAdvantage: 'Watermark-free 1080p cinematic video generation, highest Veo 3.1 quota, Ingredients character lock, First/Last Frame transitions, Camera Controls, Scenebuilder.',
        uomdUseCases: [
          '120-second "Before the Road" animated Prologue video (plugged into PrologueScene via `video_id`) using our 9 approved 16:9 prologue stills as First/Last keyframes',
          '5-Star "First Oath" Gacha Summon ritual cinematic (plugged into SummonScene)',
          'Boss Phase transition cut-ins (e.g., The Hollow Bell Phase 2/3 awakening)'
        ],
        mcpTool: 'ai_ultra_export_flow_storyboard'
      },
      {
        product: 'Project Genie (labs.google — DeepMind Genie 3 World Model)',
        ultraAdvantage: 'Exclusive AI Ultra access to real-time 720p@24fps interactive playable world generation from a single image or prompt with object permanence and physics.',
        uomdUseCases: [
          'Interactive spatial exploration of UOMD environments (Whispering Ash, Saint Luthos Belfry, Endless Corridor, Sanctum Camp)',
          'Extracting multi-plane parallax layers (foreground / midground / horizon) and camera walk-through reference clips for Endless Corridor & Patrol modes'
        ],
        mcpTool: 'ai_ultra_prepare_genie_world_seed'
      },
      {
        product: 'Gemini Notebook / NotebookLM Plus (notebooklm.google)',
        ultraAdvantage: 'Up to 500+ sources per notebook, 5x Audio/Video Overviews, zero-hallucination citation grounding across the entire game bible.',
        uomdUseCases: [
          'Single-file canonical bundle of all `narrative/*.md`, `CHARACTER_BIBLE.md`, `VOICE_CASTING.md`, `BATTLE_SYSTEM.md`, and `story/*.json`',
          'Checking new Part I/II dialogue, companion barks, and LiveOps event scripts against canon rules without hallucination'
        ],
        mcpTool: 'ai_ultra_export_notebooklm_bundle'
      },
      {
        product: 'Google Whisk & Whisk Animate (labs.google/fx/tools/whisk)',
        ultraAdvantage: 'Highest Ultra limits for Subject + Scene + Style visual locking and Whisk Animate image-to-looping-video generation.',
        uomdUseCases: [
          'Locking the Dark Gothic Anime brushwork style across all 20 companions',
          'Generating subtle breathing / cloak-wind / lantern-flicker looping animations for the Sanctum Hub (HomeScene) and Character inspection screen'
        ],
        mcpTool: 'ai_ultra_prepare_whisk_recipe'
      },
      {
        product: 'Lyria (MusicFX DJ) & Chirp 3 HD Voice',
        ultraAdvantage: 'Adaptive dark gothic chamber music loops (`bgm_*`) and 20-character English voice acting (`voice/*.ogg`) governed by `VOICE_CASTING.md`.',
        uomdUseCases: [
          'Title & Sanctum theme, Whispering Ash calm/battle tracks, Hollow Bell boss choir',
          'Full spoken narration for the 9 Prologue scenes and Tutorial T-1..T-3 dialogue'
        ],
        mcpTool: 'google-anime-media skill + tools/media_generate.ts'
      }
    ]
  };
}

function exportNotebookLmBundle(): Record<string, unknown> {
  mkdirSync(OUT_DIR, { recursive: true });
  const narrativeDir = join(ROOT, 'narrative');
  const sections: string[] = [
    '# UNAWARE OF MY DEMISE — COMPLETE CANON & ENGINEERING SOURCE BUNDLE FOR GEMINI NOTEBOOK / NOTEBOOKLM PLUS\n',
    `Generated: ${new Date().toISOString()}\n`
  ];
  const includedFiles: string[] = [];

  if (existsSync(narrativeDir)) {
    const files = readdirSync(narrativeDir)
      .filter((f) => f.endsWith('.md'))
      .sort();
    for (const f of files) {
      const fullPath = join(narrativeDir, f);
      sections.push(`\n---\n\n## SOURCE FILE: narrative/${f}\n\n${readFileSync(fullPath, 'utf8')}`);
      includedFiles.push(`narrative/${f}`);
    }
  }

  const prologuePath = join(ROOT, 'content', 'base', 'entry', 'prologue.json');
  if (existsSync(prologuePath)) {
    sections.push(`\n---\n\n## SOURCE FILE: content/base/entry/prologue.json\n\n\`\`\`json\n${readFileSync(prologuePath, 'utf8')}\n\`\`\``);
    includedFiles.push('content/base/entry/prologue.json');
  }

  const outFile = join(OUT_DIR, 'notebooklm_uomd_canon_bundle.md');
  writeFileSync(outFile, sections.join('\n'), 'utf8');
  return {
    outputPath: outFile,
    docsHubPath: join(ROOT, 'docs', 'notebooklm'),
    googleDriveHubPath: resolve(ROOT, '..', 'UOMD_NotebookLM_Hub'),
    includedFileCount: includedFiles.length,
    includedFiles,
    instructions:
      'Select the 6 numbered Markdown sources in Google Drive (`UOMD_NotebookLM_Hub` or `docs/notebooklm/`) or upload `.cache/ai-ultra/notebooklm_uomd_canon_bundle.md` directly into NotebookLM Plus (notebooklm.google).'
  };
}

const PROLOGUE_CAMERA_BY_ID: Record<string, string> = {
  hours: 'Slow push-in toward the bronze belfry axle as the bell swings and dust motes drift through warm window light',
  names: 'Intimate macro push-in on the roadside register ledger as the quill hand traces an indistinct ink stroke and lifts away',
  ordinary_days: 'Gentle lateral drift across the living village street as market figures share bread in warm afternoon light',
  throne_wars: 'Wide lateral pan across abandoned harvest fields toward the distant capital silhouette as travelers depart along the road',
  crownfall: 'Fixed solemn composition on the ruined capital gates at dawn with rising smoke and drifting pale ash (never depicting regicide)',
  roads: 'Slow tracking drift alongside anonymous survivors carrying blankets and tools into the morning mist beyond the walls',
  search: 'Slow Ken Burns push-in toward younger Mahmut at the winter inn counter studying the village register by candle lantern',
  reunion: 'Gentle two-shot push-in as Fadyme (20) extends her hand and Mahmut (26) raises his gaze in the quiet hill village',
  beginning: 'Slow receding camera dolly as present-day Fadyme and Mahmut walk side by side into the Whispering Ash Forest mist'
};

function exportFlowStoryboard(sequence: string): Record<string, unknown> {
  mkdirSync(OUT_DIR, { recursive: true });
  const cleanSeq = sequence.toLowerCase().trim();
  const prologuePath = join(ROOT, 'content', 'base', 'entry', 'prologue.json');

  if (cleanSeq === 'teaser_90s' || cleanSeq === 'play_store_teaser') {
    const kitDir = join(OUT_DIR, 'teaser_90s_flow_kit');
    const framesDir = join(kitDir, 'frames');
    const shots = [
      {
        shotNumber: 1,
        act: 'Act I — The Broken Oath & The Bells (0:00–0:24)',
        timeRange: '0:00 – 0:06',
        durationSeconds: 6,
        trackMode: 'Track B: Veo 3.1 4s cinematic clip (after 1.5s StudioScene flash) | Track A: PrologueScene hours capture',
        sceneId: 'hours',
        startFrameImage: 'content/approved_art/art/still_prologue_hours.webp',
        endFrameImage: 'content/approved_art/art/still_prologue_names.webp',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_01_start_hours.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_02_start_names.png',
        voiceLineId: 'entry_past_001',
        voiceFile: 'content/base/voices/entry_past_001.ogg',
        subtitleEn: 'Before the roads filled with ash, Veyrhold measured its days in bells.',
        transcriptJa: '道という道が灰に埋もれる前、ヴェアホルドの人々は鐘の音で日々を測っていた。',
        bgmCue: 'content/base/audio/bgm_prologue_before_the_road.ogg',
        sfxCue: 'content/base/sfx/sfx_bell_sanctuary.ogg',
        flowVeoPrompt:
          'Painterly dark gothic anime 16:9 cinematic shot (4s, 1080p 24fps). Inside the ancient stone belfry of Veyrhold, a heavy weathered bronze sanctuary bell swings slowly on its timber axle; rope follows the motion as golden dust motes drift across a warm shaft of window light into deep plum-charcoal shadows. Zero text, zero watermarks.'
      },
      {
        shotNumber: 2,
        act: 'Act I — The Broken Oath & The Bells (0:00–0:24)',
        timeRange: '0:06 – 0:12',
        durationSeconds: 6,
        trackMode: 'Track A & B: PrologueScene names -> ordinary_days capture (or optional Flow First/Last transition)',
        sceneId: 'names_to_ordinary_days',
        startFrameImage: 'content/approved_art/art/still_prologue_names.webp',
        endFrameImage: 'content/approved_art/art/still_prologue_ordinary_days.webp',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_02_start_names.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_02_end_ordinary_days.png',
        voiceLineId: 'entry_past_002',
        voiceFile: 'content/base/voices/entry_past_002.ogg',
        subtitleEn: 'People carved their names on doors and trees, and wrote them in roadside registers… So someone would remember that they had been here.',
        transcriptJa: '人々は扉や樹々に自らの名を刻み、道端の台帳にその名を書き残した。確かにここに生きていたと、誰かが覚えていてくれるように。',
        bgmCue: 'content/base/audio/bgm_prologue_before_the_road.ogg',
        sfxCue: 'content/base/sfx/sfx_ui_tap.ogg',
        flowVeoPrompt:
          'Painterly dark gothic anime 16:9 cinematic shot (6s, 1080p 24fps). Close-up on an open leather-bound roadside register ledger lit by warm amber lantern light as a feathered quill traces an indistinct ink stroke (no legible letters) and lifts away, gently dissolving to a quiet peaceful gothic village street. Zero text, zero watermarks.'
      },
      {
        shotNumber: 3,
        act: 'Act I — The Broken Oath & The Bells (0:00–0:24)',
        timeRange: '0:12 – 0:18',
        durationSeconds: 6,
        trackMode: 'Track A & B: PrologueScene throne_wars capture + Card Overlay at 0:15',
        sceneId: 'throne_wars',
        startFrameImage: 'content/approved_art/art/still_prologue_throne_wars.webp',
        endFrameImage: 'content/approved_art/art/still_prologue_crownfall.webp',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_03_start_throne_wars.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_04_start_crownfall.png',
        voiceLineId: 'entry_past_004',
        voiceFile: 'content/base/voices/entry_past_004.ogg',
        subtitleEn: 'The great houses fought over a throne. Fields emptied. Families took to the roads…',
        transcriptJa: '諸侯はひとつの玉座を巡って争った。畑からは人が消え、家族は持てるものだけを抱えて街道へと出た。',
        cardOverlayEn: 'A BROKEN OATH. A KINGDOM IN ASH.',
        bgmCue: 'content/base/audio/bgm_prologue_before_the_road.ogg',
        sfxCue: 'content/base/sfx/sfx_footstep_march.ogg',
        flowVeoPrompt:
          'Painterly dark gothic anime 16:9 cinematic shot (6s, 1080p 24fps). Wide lateral camera pan across abandoned autumn harvest fields under a brooding slate-plum sky as cloaked traveler families walk away along a muddy road toward a distant gothic capital silhouette. Zero text, zero watermarks.'
      },
      {
        shotNumber: 4,
        act: 'Act I — The Broken Oath & The Bells (0:00–0:24)',
        timeRange: '0:18 – 0:24',
        durationSeconds: 6,
        trackMode: 'Track B: Veo 3.1 4s smoke/ember drift anchored to still_prologue_crownfall.webp | Track A: PrologueScene crownfall capture',
        sceneId: 'crownfall',
        startFrameImage: 'content/approved_art/art/still_prologue_crownfall.webp',
        endFrameImage: 'content/approved_art/art/still_prologue_roads.webp',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_04_start_crownfall.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_04_end_roads.png',
        voiceLineId: 'entry_past_005',
        voiceFile: 'content/base/voices/entry_past_005.ogg',
        subtitleEn: 'Then came Crownfall. By dawn, survivors were leaving behind streets they had once known by heart.',
        transcriptJa: 'そして、『王冠落ち』の日が訪れた。夜が明ける頃、生き残った者たちは、かつて知り尽くしていたはずの街路を後にした。',
        bgmCue: 'content/base/audio/bgm_prologue_before_the_road.ogg',
        sfxCue: 'content/base/sfx/sfx_bell_sanctuary.ogg',
        flowVeoPrompt:
          'Painterly dark gothic anime 16:9 cinematic shot (4s, 1080p 24fps). Tight solemn composition on the shattered outer stone gates of a fallen gothic capital at cold dawn; dark smoke plumes billow upward while pale grey ash and dying amber embers drift slowly across the foreground. Strictly environmental only—no king, no violence, zero text, zero watermarks.'
      },
      {
        shotNumber: 5,
        act: 'Act II — Mahmut, Fadyme & The Road Ahead (0:24–0:44)',
        timeRange: '0:24 – 0:31',
        durationSeconds: 7,
        trackMode: 'Track A & B: PrologueScene search capture (Ken Burns drift on Mahmut at winter inn register)',
        sceneId: 'search',
        startFrameImage: 'content/approved_art/art/still_prologue_search.webp',
        endFrameImage: 'content/approved_art/art/still_prologue_reunion.webp',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_05_start_search.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_06_start_reunion.png',
        voiceLineId: 'entry_past_007',
        voiceFile: 'content/base/voices/entry_past_007.ogg',
        subtitleEn: 'Among the travelers was a knight who searched the village registers for one name. Village after village, winter after winter…',
        transcriptJa: '旅人たちのなかに、ただひとつの名を求めて村々の台帳を辿る騎士がいた。村から村へ、冬から冬へと、彼は探し続けた。',
        bgmCue: 'content/base/audio/bgm_fadyme_theme.ogg',
        sfxCue: 'content/base/sfx/sfx_footstep_ash.ogg',
        flowVeoPrompt:
          'Painterly dark gothic anime 16:9 cinematic shot (6s, 1080p 24fps). Slow push-in toward a tall weary knight (Mahmut, dark messy hair, stubble, worn dark half-plate with hammered-off crown socket, tattered oxblood cloak) standing at a dim winter inn counter, warm candle lantern flickering over the open village register book as snow drifts outside the window. Zero text, zero watermarks.'
      },
      {
        shotNumber: 6,
        act: 'Act II — Mahmut, Fadyme & The Road Ahead (0:24–0:44)',
        timeRange: '0:31 – 0:38',
        durationSeconds: 7,
        trackMode: 'Track B: Veo 3.1 4s First/Last Frame transition (still_prologue_reunion -> still_prologue_beginning) | Track A: PrologueScene reunion + beginning capture',
        sceneId: 'reunion_to_beginning',
        startFrameImage: 'content/approved_art/art/still_prologue_reunion.webp',
        endFrameImage: 'content/approved_art/art/still_prologue_beginning.webp',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_06_start_reunion.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_06_end_beginning.png',
        voiceLineId: 'entry_past_008',
        voiceFile: 'content/base/voices/entry_past_008.ogg',
        subtitleEn: 'In a hill village, he found her. She asked him to stay. He did. Now Fadyme and Mahmut walk together.',
        transcriptJa: 'ある丘の村で、彼はついに彼女を見つけた。傍にいてほしいと彼女は願い、彼は頷いた。',
        bgmCue: 'content/base/audio/bgm_fadyme_theme.ogg',
        sfxCue: 'content/base/sfx/sfx_bell_silver.ogg',
        flowVeoPrompt:
          'Painterly dark gothic anime 16:9 cinematic shot (4s, 1080p 24fps). Fadyme (pale ash-blonde hair, violet eyes, deep plum hood, high white scarf) extends a quiet hand toward Mahmut (tall knight in worn dark half-plate and oxblood cloak) in a misty hill village; soft wind stirs their cloaks and hair strands as warm twilight rim light catches falling ash motes, transitioning to the two walking side by side down the forest road. Zero text, zero watermarks.'
      },
      {
        shotNumber: 7,
        act: 'Act II — Mahmut, Fadyme & The Road Ahead (0:24–0:44)',
        timeRange: '0:38 – 0:44',
        durationSeconds: 6,
        trackMode: 'Track A & B: Real in-game capture of StoryScene (tutorial_t1_before) with knee-up portraits & gothic dialogue box',
        sceneId: 'story_tutorial_t1_before',
        startFrameImage: 'docs/store/assets/screenshots/02_prologue_cinematic.png',
        endFrameImage: 'docs/store/assets/screenshots/04_world_map_hub.png',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_07_in_game_story.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_08_in_game_world_map.png',
        voiceLineId: 'tutorial_t1_before_006',
        voiceFile: 'content/base/voices/tutorial_t1_before_006.ogg',
        subtitleEn: 'Mahmut: "That one is loose. Give me your hand." · Fadyme: "For the stone, or for the whole road?"',
        transcriptJa: 'マフムト：「その石は浮いている。手を貸せ。」',
        bgmCue: 'content/base/audio/bgm_fadyme_theme.ogg',
        sfxCue: 'content/base/sfx/sfx_ui_tap.ogg',
        flowVeoPrompt:
          'Real 1920x1080 60fps in-game capture of StoryScene (no Veo generation needed—captures authentic knee-up portraits of Mahmut and Fadyme with breathing motion and synchronized dialogue subtitles).'
      },
      {
        shotNumber: 8,
        act: 'Act III — The Bell Road, Companions & 5v5 Tactical Combat (0:44–1:14)',
        timeRange: '0:44 – 0:51',
        durationSeconds: 7,
        trackMode: 'Track A & B: Real in-game capture of HomeScene (WorldMap mode: bg_world_map_part1.webp) -> ChaptersScene',
        sceneId: 'world_map_hub',
        startFrameImage: 'docs/store/assets/screenshots/04_world_map_hub.png',
        endFrameImage: 'docs/store/assets/screenshots/05_companion_roster.png',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_08_in_game_world_map.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_09_in_game_roster.png',
        cardOverlayEn: 'FOLLOW THE BELL ROAD ACROSS VEYRHOLD',
        bgmCue: 'content/base/audio/bgm_ch1_ash_forest_chaotic.ogg',
        sfxCue: 'content/base/sfx/sfx_ui_wax_seal.ogg',
        flowVeoPrompt:
          'Real 1920x1080 60fps in-game capture of HomeScene World Map Hub showing the painted Bell Road of Veyrhold, Chapter 1 glowing in the west, and the World-Map Banner Spotlight.'
      },
      {
        shotNumber: 9,
        act: 'Act III — The Bell Road, Companions & 5v5 Tactical Combat (0:44–1:14)',
        timeRange: '0:51 – 0:58',
        durationSeconds: 7,
        trackMode: 'Track A & B: Real in-game quick cuts (2.3s each) of RosterScene, CharacterScene (STR/INT/VIT/AGI + Signature Weapon), and TeamScene',
        sceneId: 'roster_character_team',
        startFrameImage: 'docs/store/assets/screenshots/05_companion_roster.png',
        endFrameImage: 'docs/store/assets/screenshots/06_character_sheet.png',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_09_in_game_roster.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_09b_in_game_character.png',
        cardOverlayEn: 'FORGE UNLIKELY COMPANIONS · BUILD YOUR FORMATION',
        bgmCue: 'content/base/audio/bgm_ch1_ash_forest_chaotic.ogg',
        sfxCue: 'content/base/sfx/sfx_ui_confirm.ogg',
        flowVeoPrompt:
          'Real 1920x1080 60fps in-game captures of RosterScene, CharacterScene, and TeamScene.'
      },
      {
        shotNumber: 10,
        act: 'Act III — The Bell Road, Companions & 5v5 Tactical Combat (0:44–1:14)',
        timeRange: '0:58 – 1:06',
        durationSeconds: 8,
        trackMode: 'Track A & B: Real in-game capture of 5v5 BattleScene (animated SD chibi units, turn-order ribbon, enemy intent badges, skill target selection)',
        sceneId: 'battle_tactical_turn',
        startFrameImage: 'docs/store/assets/screenshots/03_tactical_battle.png',
        endFrameImage: 'docs/store/assets/screenshots/07_boss_objectives.png',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_10_in_game_battle.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_11_in_game_boss_vfx.png',
        cardOverlayEn: 'READ ENEMY INTENTIONS · COMMAND EVERY TURN',
        bgmCue: 'content/base/audio/bgm_ch1_ash_forest_chaotic.ogg',
        sfxCue: 'content/base/sfx/sfx_blade_slash.ogg',
        flowVeoPrompt:
          'Real 1920x1080 60fps in-game capture of 5v5 tactical BattleScene with 16-frame animated chibi sprites and enemy intent telegraphs.'
      },
      {
        shotNumber: 11,
        act: 'Act III — The Bell Road, Companions & 5v5 Tactical Combat (0:44–1:14)',
        timeRange: '1:06 – 1:14',
        durationSeconds: 8,
        trackMode: 'Track A & B: Real in-game capture of Ultimate Signature VFX execution + Breakable Boss Objectives + Trials & 3-Star VICTORY banner',
        sceneId: 'battle_ultimate_and_trials',
        startFrameImage: 'docs/store/assets/screenshots/07_boss_objectives.png',
        endFrameImage: 'docs/store/assets/screenshots/08_trials_and_summon.png',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_11_in_game_boss_vfx.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_11b_in_game_trials.png',
        voiceLineId: 'entry_past_009',
        voiceFile: 'content/base/voices/entry_past_009.ogg',
        subtitleEn: 'The bells still ring. Neither has told the other everything.',
        transcriptJa: '鐘はいまも鳴り響き、ふたりはまだ互いのすべてを語ってはいない。',
        bgmCue: 'content/base/audio/bgm_ch1_ash_forest_chaotic.ogg',
        sfxCue: 'content/base/sfx/sfx_ultimate_release.ogg',
        flowVeoPrompt:
          'Real 1920x1080 60fps in-game capture of Signature VFX ultimates (eclipse_corona, bell_arch, shield_wall), breakable boss reliquaries, and Trials/Summon showcase.'
      },
      {
        shotNumber: 12,
        act: 'Act IV — Title Reveal & Call to Action (1:14–1:30)',
        timeRange: '1:14 – 1:30',
        durationSeconds: 16,
        trackMode: 'Track B: 4s Veo 3.1 key-art intro from ui_title_bg.webp dissolving into live TitleScene (Black-Sun Eclipse Corona + Swinging Bell + Logo + Wax Seal burst) | Track A: Full live TitleScene capture',
        sceneId: 'title_reveal_cta',
        startFrameImage: 'content/approved_art/art/ui_title_bg.webp',
        endFrameImage: 'docs/store/assets/screenshots/01_title_screen.png',
        kitStartPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_12_start_title_art.png',
        kitEndPng: '.cache/ai-ultra/teaser_90s_flow_kit/frames/shot_12_end_title_screen.png',
        voiceLineId: 'entry_past_009',
        voiceFile: 'content/base/voices/entry_past_009.ogg',
        subtitleEn: 'This is where their story begins.',
        transcriptJa: '……ここから、ふたりの物語が始まる。',
        cardOverlayEn: 'UNAWARE OF MY DEMISE · A Broken Oath. A Distant Bell. An Unlikely Company. · Available on Google Play',
        bgmCue: 'content/base/audio/bgm_main_theme.ogg',
        sfxCue: 'content/base/sfx/sfx_bell_sanctuary.ogg',
        flowVeoPrompt:
          'Painterly dark gothic anime 16:9 key-art cinematic shot (4s, 1080p 24fps). Under a glowing crimson-and-gold Black-Sun Eclipse corona and a fractured ancient bronze sanctuary bell in the sky, Fadyme (pale ash-blonde hair, plum hood, silver bell on chain) and Mahmut (tall knight, dark half-plate, tattered oxblood cloak, heater shield) stand together on an ash-strewn stone road; wind stirs their cloaks as golden embers rise. Zero text, zero watermarks.'
      }
    ];

    const pkg = {
      tool: 'Google Flow (Veo 3.1 1080p Scenebuilder) + Hybrid Unity 6 LTS In-Game Capture',
      sequenceId: 'google_play_teaser_90s',
      storyboardSource: 'docs/store/TEASER_STORYBOARD.md',
      totalDurationSeconds: 90,
      resolution: '1920x1080',
      fps: 60,
      kitDirectory: kitDir,
      framesDirectory: framesDir,
      ingredients: [
        '.cache/ai-ultra/teaser_90s_flow_kit/frames/ingredient_01_style_title_bg.png',
        '.cache/ai-ultra/teaser_90s_flow_kit/frames/ingredient_02_fadyme_mahmut_reunion.png',
        '.cache/ai-ultra/teaser_90s_flow_kit/frames/ingredient_03_fadyme_mahmut_road.png',
        '.cache/ai-ultra/teaser_90s_flow_kit/frames/ingredient_04_fadyme_portrait_canonical.png',
        '.cache/ai-ultra/teaser_90s_flow_kit/frames/ingredient_05_mahmut_portrait_canonical.png'
      ],
      veoPriorityShots: [1, 4, 6, 12],
      shots
    };
    const outPath = join(OUT_DIR, 'flow_teaser_90s_storyboard.json');
    writeFileSync(outPath, JSON.stringify(pkg, null, 2), 'utf8');
    return { outputPath: outPath, shotCount: shots.length, veoPriorityShots: [1, 4, 6, 12], package: pkg };
  }

  if (cleanSeq === 'prologue' && existsSync(prologuePath)) {
    const prologue = JSON.parse(readFileSync(prologuePath, 'utf8')) as {
      prologue_id: string;
      title_en: string;
      total_duration_seconds: number;
      scenes: {
        id: string;
        duration_seconds: number;
        caption_en: string;
        visual: string;
        camera?: string;
        text_en: string;
      }[];
    };
    const shots = prologue.scenes.map((sc, idx) => {
      const nextSc = prologue.scenes[idx + 1];
      const cameraMotion = sc.camera ?? PROLOGUE_CAMERA_BY_ID[sc.id] ?? 'Slow atmospheric camera drift';
      return {
        shotNumber: idx + 1,
        sceneId: sc.id,
        caption: sc.caption_en,
        durationSeconds: sc.duration_seconds,
        startFrameImage: `content/approved_art/art/still_prologue_${sc.id}.webp`,
        endFrameImage: nextSc ? `content/approved_art/art/still_prologue_${nextSc.id}.webp` : 'content/approved_art/art/ui_title_bg.webp',
        cameraControl: cameraMotion,
        narrationSubtitle: sc.text_en,
        flowVeoPrompt: `Painterly dark gothic anime 16:9 cinematic shot (${sc.duration_seconds}s). Camera motion: ${cameraMotion}. Subtle drifting ash motes, flickering warm candle/amber rim light against deep plum-charcoal shadows, zero text, zero watermarks.`
      };
    });
    const pkg = {
      tool: 'Google Flow (Veo 3.1 1080p Scenebuilder)',
      sequenceId: 'prologue_before_the_road',
      totalDurationSeconds: prologue.total_duration_seconds,
      ingredients: [
        'content/approved_art/art/ui_title_bg.webp',
        'content/approved_art/art/still_prologue_reunion.webp',
        'content/approved_art/art/still_prologue_beginning.webp'
      ],
      targetGameIntegration: 'Set `video_id` in `content/base/entry/prologue.json` once exported from Google Flow Scenebuilder as 1080p WebM/MP4.',
      shots
    };
    const outPath = join(OUT_DIR, 'flow_prologue_storyboard.json');
    writeFileSync(outPath, JSON.stringify(pkg, null, 2), 'utf8');
    return { outputPath: outPath, shotCount: shots.length, package: pkg };
  }

  const pkg = {
    tool: 'Google Flow (Veo 3.1 1080p Scenebuilder)',
    sequenceId: cleanSeq,
    ingredients: ['content/approved_art/art/ui_title_bg.webp', 'content/approved_art/art/bg_forest_whispering_ash.webp'],
    flowVeoPrompt:
      cleanSeq === 'first_oath_summon'
        ? 'Painterly dark gothic anime 16:9 5-star gacha summon ritual ("First Oath"). A weathered stone wayshrine lantern flares from warm amber to blinding antique gold and silver-lilac under a crimson eclipse ring; a silver thorn-bell tolls as ash parts to reveal the companion silhouette. 1080p 24fps, zero text.'
        : `Painterly dark gothic anime 16:9 cinematic sequence for ${cleanSeq}, 1080p 24fps, consistent character ingredients, subtle camera dolly, zero text.`
  };
  const outPath = join(OUT_DIR, `flow_${cleanSeq.replace(/[^a-z0-9_-]/g, '_')}_storyboard.json`);
  writeFileSync(outPath, JSON.stringify(pkg, null, 2), 'utf8');
  return { outputPath: outPath, package: pkg };
}

function prepareGenieWorldSeed(locationId: string): Record<string, unknown> {
  mkdirSync(OUT_DIR, { recursive: true });
  const loc = locationId.toLowerCase().trim() || 'forest_whispering_ash';
  const seed = {
    tool: 'Project Genie (DeepMind Genie 3 Interactive World Model)',
    locationId: loc,
    seedImage:
      loc === 'forest_whispering_ash'
        ? 'content/approved_art/art/bg_forest_whispering_ash.webp'
        : `content/base/art/bg_${loc}.webp`,
    worldPrompt:
      'Dark gothic anime 2.5D/3D navigable environment. Damp cobblestone road winding through ancient pale-grey ash trees, drifting low fog, warm amber stone wayshrine lantern light on the right, distant gothic bell-tower spire against a slate-plum twilight sky. Maintain strict spatial coherence and multi-plane depth.',
    layerExtractionGuide: [
      '1. Load `seedImage` and `worldPrompt` in Project Genie (labs.google).',
      '2. Perform a slow lateral camera truck (left-to-right) and forward dolly along the stone road.',
      '3. Export keyframes to slice into 3 Phaser 4 parallax TileSprite/Image planes: `fg_trees_mist`, `mid_wayshrine_road`, and `bg_spire_sky`.'
    ]
  };
  const outPath = join(OUT_DIR, `genie_seed_${loc.replace(/[^a-z0-9_-]/g, '_')}.json`);
  writeFileSync(outPath, JSON.stringify(seed, null, 2), 'utf8');
  return { outputPath: outPath, seed };
}

function prepareWhiskRecipe(characterId: string, sceneId = 'forest_whispering_ash'): Record<string, unknown> {
  mkdirSync(OUT_DIR, { recursive: true });
  const charId = characterId.toLowerCase().trim() || 'fadyme';
  const recipe = {
    tool: 'Google Whisk & Whisk Animate (labs.google/fx/tools/whisk)',
    characterId: charId,
    sceneId,
    subjectImage: `content/base/art/portrait_${charId}_neutral.webp`,
    sceneImage: `content/approved_art/art/bg_${sceneId}.webp`,
    styleReferenceImage: 'content/approved_art/art/ui_title_bg.webp',
    whiskPrompt: `Keep exact character design from Subject (${charId}) and painterly dark gothic anime brushwork from Style. Place in ${sceneId} with warm amber lantern rim light and cool twilight shadows.`,
    whiskAnimatePrompt:
      'Subtle 4-second seamless loop: gentle breathing motion, soft wind stirring the cloak hem and hair strands, drifting ash motes, warm candle flicker. Keep face and proportions strictly locked.'
  };
  const outPath = join(OUT_DIR, `whisk_recipe_${charId.replace(/[^a-z0-9_-]/g, '_')}.json`);
  writeFileSync(outPath, JSON.stringify(recipe, null, 2), 'utf8');
  return { outputPath: outPath, recipe };
}

const TOOLS = [
  {
    name: 'ai_ultra_capabilities',
    description:
      'Return the complete Google AI Ultra integration map for Unaware of My Demise (Google Flow, Project Genie, Gemini Notebook / NotebookLM Plus, Whisk Animate, Veo 3.1, Lyria, Chirp 3 HD).',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'ai_ultra_export_notebooklm_bundle',
    description:
      'Compile all canonical narrative markdown files and prologue scripts into a single citation-ready bundle in `.cache/ai-ultra/notebooklm_uomd_canon_bundle.md` for Gemini Notebook / NotebookLM Plus.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'ai_ultra_export_flow_storyboard',
    description:
      'Generate a Google Flow (Veo 3.1) production storyboard package with Ingredients, First/Last Frame image paths, and camera controls for a sequence (e.g., "prologue", "first_oath_summon", "boss_cutin").',
    inputSchema: {
      type: 'object',
      properties: {
        sequence: {
          type: 'string',
          description: 'Sequence identifier: "prologue", "first_oath_summon", or custom sequence name.'
        }
      },
      required: ['sequence']
    }
  },
  {
    name: 'ai_ultra_prepare_genie_world_seed',
    description:
      'Prepare a Project Genie (Genie 3) interactive world-model seed package (reference 16:9 keyframe + spatial prompt + parallax layer extraction guide) for a game location.',
    inputSchema: {
      type: 'object',
      properties: {
        locationId: {
          type: 'string',
          description: 'Location ID (e.g., "forest_whispering_ash", "bell_tower_interior", "endless_corridor").'
        }
      },
      required: ['locationId']
    }
  },
  {
    name: 'ai_ultra_prepare_whisk_recipe',
    description:
      'Prepare a Google Whisk / Whisk Animate 3-part recipe (Subject + Scene + Style + seamless idle loop prompt) for a character.',
    inputSchema: {
      type: 'object',
      properties: {
        characterId: { type: 'string', description: 'Character ID (e.g., "fadyme", "mahmut", "sister_aveline").' },
        sceneId: { type: 'string', description: 'Background location ID (default "forest_whispering_ash").' }
      },
      required: ['characterId']
    }
  }
];

async function handleRequest(req: JsonRpcRequest): Promise<Record<string, unknown> | null> {
  if (req.method === 'notifications/initialized' || req.id === undefined) {
    return null;
  }
  try {
    if (req.method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'uomd-ai-ultra', version: '1.0.0' }
        }
      };
    }
    if (req.method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: { tools: TOOLS }
      };
    }
    if (req.method === 'tools/call') {
      const name = String(req.params?.name ?? '');
      const args = (req.params?.arguments ?? {}) as Record<string, unknown>;
      let payload: unknown;
      if (name === 'ai_ultra_capabilities') {
        payload = getCapabilities();
      } else if (name === 'ai_ultra_export_notebooklm_bundle') {
        payload = exportNotebookLmBundle();
      } else if (name === 'ai_ultra_export_flow_storyboard') {
        payload = exportFlowStoryboard(String(args.sequence ?? 'prologue'));
      } else if (name === 'ai_ultra_prepare_genie_world_seed') {
        payload = prepareGenieWorldSeed(String(args.locationId ?? 'forest_whispering_ash'));
      } else if (name === 'ai_ultra_prepare_whisk_recipe') {
        payload = prepareWhiskRecipe(String(args.characterId ?? 'fadyme'), String(args.sceneId ?? 'forest_whispering_ash'));
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
      return {
        jsonrpc: '2.0',
        id: req.id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload, null, 2)
            }
          ]
        }
      };
    }
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32601, message: `Method not found: ${req.method}` }
    };
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id: req.id,
      error: { code: -32000, message: err instanceof Error ? err.message : String(err) }
    };
  }
}

let useContentLength = false;
function sendResponse(res: Record<string, unknown>): void {
  const body = JSON.stringify(res);
  if (useContentLength) {
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`);
  } else {
    process.stdout.write(`${body}\n`);
  }
}

let buffer = Buffer.alloc(0);
process.stdin.on('data', (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length > 0) {
    const str = buffer.toString('utf8');
    if (str.startsWith('Content-Length:')) {
      useContentLength = true;
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;
      const header = buffer.slice(0, headerEnd).toString('utf8');
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      const len = match ? parseInt(match[1]!, 10) : 0;
      const totalLen = headerEnd + 4 + len;
      if (buffer.length < totalLen) break;
      const jsonStr = buffer.slice(headerEnd + 4, totalLen).toString('utf8');
      buffer = buffer.slice(totalLen);
      void processMessage(jsonStr);
    } else {
      const nl = buffer.indexOf('\n');
      if (nl === -1) break;
      const line = buffer.slice(0, nl).toString('utf8').trim();
      buffer = buffer.slice(nl + 1);
      if (line) void processMessage(line);
    }
  }
});

async function processMessage(raw: string): Promise<void> {
  try {
    const req = JSON.parse(raw) as JsonRpcRequest;
    const res = await handleRequest(req);
    if (res) sendResponse(res);
  } catch {
    /* ignore malformed line */
  }
}
