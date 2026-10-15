#!/usr/bin/env node
/**
 * UOMD Google AI Ultra Bridge MCP Server (stdio).
 *
 * Bridges Unaware of My Demise's canonical narrative, approved art, and Phaser 4 presentation engine
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
    includedFileCount: includedFiles.length,
    includedFiles,
    instructions:
      'Upload `.cache/ai-ultra/notebooklm_uomd_canon_bundle.md` directly into Gemini Notebook (notebooklm.google) or query it via `notebooklm-mcp` for zero-hallucination canon checks, voice scripts, and Audio Overviews.'
  };
}

function exportFlowStoryboard(sequence: string): Record<string, unknown> {
  mkdirSync(OUT_DIR, { recursive: true });
  const cleanSeq = sequence.toLowerCase().trim();
  const prologuePath = join(ROOT, 'content', 'base', 'entry', 'prologue.json');

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
        camera: string;
        text_en: string;
      }[];
    };
    const shots = prologue.scenes.map((sc, idx) => {
      const nextSc = prologue.scenes[idx + 1];
      return {
        shotNumber: idx + 1,
        sceneId: sc.id,
        caption: sc.caption_en,
        durationSeconds: sc.duration_seconds,
        startFrameImage: `content/approved_art/art/still_prologue_${sc.id}.webp`,
        endFrameImage: nextSc ? `content/approved_art/art/still_prologue_${nextSc.id}.webp` : 'content/approved_art/art/ui_title_bg.webp',
        cameraControl: sc.camera,
        narrationSubtitle: sc.text_en,
        flowVeoPrompt: `Painterly dark gothic anime 16:9 cinematic shot (${sc.duration_seconds}s). Camera motion: ${sc.camera}. ${sc.visual} Subtle drifting ash motes, flickering warm candle/amber rim light against deep plum-charcoal shadows, zero text, zero watermarks.`
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
