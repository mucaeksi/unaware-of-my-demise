#!/usr/bin/env node
/**
 * UOMD Phaser 4 Live Inspector & Documentation MCP Server (stdio).
 *
 * Exposes tools for:
 *  1. Searching and reading the 28 pinned official Phaser 4 skills in `.claude/skills/`.
 *  2. Listing compiled and approved game assets (`content/base/art/art_manifest.json`).
 *  3. Inspecting the live Phaser 4 game in headless Chromium via Playwright (`window.__UOMD__.game`),
 *     jumping to any scene, tapping coordinates, reading the live display list (`scene.children.list`),
 *     checking console/WebGL errors, and capturing a 1920x1080 screenshot so the agent can visually
 *     verify every UI/scene/animation change it makes.
 */

import { existsSync, readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, '.claude', 'skills');
const SHOTS_DIR = join(ROOT, '.cache', 'mcp-phaser-shots');

const PHASER_SKILL_NAMES = [
  'phaser4-engine',
  'phaser4-battle',
  'phaser4-anime-ui',
  'phaser4-chibi-animation',
  'phaser4-mobile-qa',
  'phaser4-narrative-cinematics',
  'game-setup-and-config',
  'scenes',
  'events-system',
  'data-manager',
  'time-and-timers',
  'loading-assets',
  'sprites-and-images',
  'game-object-components',
  'groups-and-containers',
  'graphics-and-shapes',
  'text-and-bitmaptext',
  'geometry-and-math',
  'curves-and-paths',
  'animations',
  'tweens',
  'particles',
  'cameras',
  'filters-and-postfx',
  'render-textures',
  'scale-and-responsive',
  'input-keyboard-mouse-touch',
  'audio-and-sound',
  'physics-arcade',
  'physics-matter',
  'tilemaps',
  'actions-and-utilities',
  'v3-to-v4-migration',
  'v4-new-features'
] as const;

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function searchPhaserDocs(query: string, limit = 8): { skill: string; path: string; excerpt: string }[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const scored: { skill: string; path: string; score: number; excerpt: string }[] = [];

  for (const skill of PHASER_SKILL_NAMES) {
    const skillFile = join(SKILLS_DIR, skill, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const content = readFileSync(skillFile, 'utf8');
    const lower = content.toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (skill.toLowerCase().includes(t)) score += 5;
      let idx = lower.indexOf(t);
      while (idx !== -1) {
        score += 1;
        idx = lower.indexOf(t, idx + t.length);
      }
    }
    if (score > 0) {
      const firstTerm = terms[0] ?? '';
      const pos = firstTerm ? Math.max(0, lower.indexOf(firstTerm) - 120) : 0;
      const excerpt = content.slice(pos, pos + 600).replace(/\r?\n/g, ' ').trim();
      scored.push({ skill, path: skillFile, score, excerpt });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(({ skill, path, excerpt }) => ({ skill, path, excerpt }));
}

function getPhaserDoc(skill: string): string {
  const clean = skill.replace(/[^a-z0-9-_]/gi, '');
  const skillFile = join(SKILLS_DIR, clean, 'SKILL.md');
  if (!existsSync(skillFile)) {
    return `Skill '${clean}' not found. Available Phaser skills: ${PHASER_SKILL_NAMES.join(', ')}`;
  }
  return readFileSync(skillFile, 'utf8');
}

function listGameAssets(): Record<string, unknown> {
  const manifestPath = join(ROOT, 'content', 'base', 'art', 'art_manifest.json');
  const approvedDir = join(ROOT, 'content', 'approved_art', 'entries');
  const manifest = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>) : {};
  const approvedEntries = existsSync(approvedDir)
    ? readdirSync(approvedDir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace(/\.json$/, ''))
    : [];
  return {
    manifestPath,
    approvedCount: approvedEntries.length,
    approvedAssetIds: approvedEntries,
    manifest
  };
}

async function isPortOpen(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(1500) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function ensureLocalViteServer(port = 4179): Promise<{ url: string; child: ChildProcess | null }> {
  const url = `http://127.0.0.1:${port}`;
  if (await isPortOpen(url)) {
    return { url, child: null };
  }
  const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
  const gameDir = join(ROOT, 'apps', 'game');
  const child = spawn(process.execPath, [viteBin, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: gameDir,
    stdio: 'ignore'
  });
  for (let i = 0; i < 30; i++) {
    if (await isPortOpen(url)) return { url, child };
    await new Promise((r) => setTimeout(r, 300));
  }
  child.kill();
  throw new Error(`Timed out waiting for local @uomd/game Vite server on ${url}`);
}

interface InspectOptions {
  scene?: string;
  freshInstall?: boolean;
  fastIntro?: boolean;
  prologueSceneIndex?: number;
  tapX?: number;
  tapY?: number;
  waitMs?: number;
  screenshotName?: string;
}

async function inspectLiveScene(opts: InspectOptions): Promise<Record<string, unknown>> {
  mkdirSync(SHOTS_DIR, { recursive: true });
  try {
    const syncScript = join(ROOT, 'apps', 'game', 'scripts', 'sync-content.mjs');
    if (existsSync(syncScript)) {
      const childSync = spawn(process.execPath, [syncScript], { cwd: join(ROOT, 'apps', 'game'), stdio: 'ignore' });
      await new Promise((r) => childSync.on('close', r));
    }
  } catch {
    /* ignore */
  }
  const { url, child } = await ensureLocalViteServer(4179);
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

    if (!opts.freshInstall) {
      const completed = JSON.stringify({
        phase: 'completed',
        prologue: true,
        tutorials: 3,
        updatedAt: '2026-10-11T00:00:00.000Z'
      });
      await page.addInitScript((v) => {
        try {
          localStorage.setItem('uomd.entry.v1', v);
        } catch {
          /* ignore */
        }
      }, completed);
    }

    if (typeof opts.prologueSceneIndex === 'number' && opts.prologueSceneIndex > 0) {
      await page.addInitScript((idx) => {
        try {
          localStorage.setItem('uomd.resume.prologue.v1:guest', JSON.stringify({ index: idx, updatedAt: new Date().toISOString() }));
        } catch {
          /* ignore */
        }
      }, opts.prologueSceneIndex);
    }

    const query = opts.fastIntro === true ? '?fastintro=1' : '';
    await page.goto(`${url}/${query}`, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(
      () => {
        const u = (window as unknown as {
          __UOMD__?: {
            services?: { content?: unknown; art?: unknown };
            game?: { scene?: { getScenes(active: boolean): { sys: { settings: { key: string } } }[] } };
          };
        }).__UOMD__;
        return Boolean(u?.services?.content && u?.services?.art && (u?.game?.scene?.getScenes(true).length ?? 0) > 0);
      },
      null,
      { timeout: 15000 }
    );

    const targetScene = opts.scene ?? 'Title';
    await page.evaluate((target) => {
      const g = (window as unknown as {
        __UOMD__?: {
          game?: {
            scene: {
              getScenes(active: boolean): { sys: { settings: { key: string } }; scene: { start(k: string): void } }[];
            };
          };
        };
      }).__UOMD__?.game;
      const active = g?.scene.getScenes(true).find((s) => s.sys.settings.key !== 'Boot');
      if (active && active.sys.settings.key !== target) {
        active.scene.start(target);
      }
    }, targetScene);

    await page.waitForFunction(
      (target) => {
        const g = (window as unknown as {
          __UOMD__?: {
            game?: {
              scene?: {
                getScenes(active: boolean): { sys: { settings: { key: string } }; index?: number }[];
              };
            };
          };
        }).__UOMD__?.game;
        const sc = g?.scene?.getScenes(true).find((s) => s.sys.settings.key === target);
        if (!sc) return false;
        if (target === 'Prologue') return typeof sc.index === 'number' && sc.index >= 0;
        return true;
      },
      targetScene,
      { timeout: 15000 }
    );

    if (typeof opts.prologueSceneIndex === 'number' && targetScene === 'Prologue') {
      await page.evaluate((targetIdx) => {
        const g = (window as unknown as {
          __UOMD__?: {
            game?: {
              scene?: {
                getScene(k: string): { index: number; next(): void } | undefined;
              };
            };
          };
        }).__UOMD__?.game;
        const p = g?.scene?.getScene('Prologue');
        if (p && p.index !== targetIdx) {
          p.index = targetIdx - 1;
          p.next();
        }
      }, opts.prologueSceneIndex);
    }

    await page.waitForTimeout(opts.waitMs ?? 1600);

    if (typeof opts.tapX === 'number' && typeof opts.tapY === 'number') {
      await page.mouse.click(opts.tapX, opts.tapY);
      await page.waitForTimeout(700);
    }

    const state = await page.evaluate(() => {
      const g = (window as unknown as {
        __UOMD__?: {
          game?: {
            scene: {
              getScenes(active: boolean): {
                sys: { settings: { key: string } };
                children: {
                  list: {
                    type: string;
                    x?: number;
                    y?: number;
                    width?: number;
                    height?: number;
                    alpha?: number;
                    visible?: boolean;
                    depth?: number;
                    text?: string;
                    texture?: { key?: string };
                    list?: { type: string; text?: string; x?: number; y?: number }[];
                  }[];
                };
              }[];
            };
          };
        };
      }).__UOMD__?.game;
      if (!g) return { activeScenes: [], objects: [] };
      const scenes = g.scene.getScenes(true);
      const activeScenes = scenes.map((s) => s.sys.settings.key);
      const main = scenes.find((s) => s.sys.settings.key !== 'Boot') ?? scenes[0];
      const objects = (main?.children?.list ?? []).slice(0, 80).map((c) => ({
        type: c.type,
        x: typeof c.x === 'number' ? Math.round(c.x) : undefined,
        y: typeof c.y === 'number' ? Math.round(c.y) : undefined,
        w: typeof c.width === 'number' ? Math.round(c.width) : undefined,
        h: typeof c.height === 'number' ? Math.round(c.height) : undefined,
        alpha: typeof c.alpha === 'number' ? Number(c.alpha.toFixed(2)) : undefined,
        depth: c.depth,
        visible: c.visible,
        text: c.text,
        texture: c.texture?.key,
        childrenTexts: Array.isArray(c.list) ? c.list.map((ch) => ch.text).filter(Boolean) : undefined
      }));
      return { activeScenes, objects };
    });

    const shotFile = join(SHOTS_DIR, `${(opts.screenshotName ?? opts.scene ?? 'live').replace(/[^a-z0-9-_]/gi, '_')}.png`);
    await page.screenshot({ path: shotFile });

    return {
      screenshotPath: shotFile,
      activeScenes: state.activeScenes,
      objectCount: state.objects.length,
      objects: state.objects,
      errors: errors.filter((e) => !e.includes('favicon'))
    };
  } finally {
    await browser.close();
    if (child) child.kill();
  }
}

const TOOLS = [
  {
    name: 'phaser_search_docs',
    description:
      'Search across the 34 pinned Phaser 4 skills and UOMD Phaser architecture docs (scenes, sprites, tweens, animations, particles, cameras, filters, battle, UI, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search terms (e.g., "particles blendMode", "tween yoyo", "camera vignette").' },
        limit: { type: 'number', description: 'Max results to return (default 8).' }
      },
      required: ['query']
    }
  },
  {
    name: 'phaser_get_skill_doc',
    description: 'Read the complete SKILL.md for a specific Phaser 4 skill.',
    inputSchema: {
      type: 'object',
      properties: {
        skill: {
          type: 'string',
          description: `Skill name, one of: ${PHASER_SKILL_NAMES.join(', ')}`
        }
      },
      required: ['skill']
    }
  },
  {
    name: 'phaser_list_game_assets',
    description: 'List all compiled and approved art/audio assets in content/base/art/art_manifest.json and content/approved_art.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'phaser_inspect_scene',
    description:
      'Launch the live UOMD Phaser 4 game in headless Chromium (1920x1080), optionally start a specific scene or tap coordinates, inspect the live Phaser display list (children, text, textures, bounds), check for console/WebGL errors, and save a PNG screenshot.',
    inputSchema: {
      type: 'object',
      properties: {
        scene: {
          type: 'string',
          description: 'Optional Phaser scene key to jump to (e.g., "Studio", "Title", "Prologue", "Home", "Summon", "Roster").'
        },
        freshInstall: {
          type: 'boolean',
          description: 'If true, boot as a brand-new install (first-run flow). Default false (completed entry).'
        },
        fastIntro: {
          type: 'boolean',
          description: 'If true (default), pass ?fastintro=1 to skip splash wait.'
        },
        tapX: { type: 'number', description: 'Optional X coordinate (0..1920) to click/tap before capturing.' },
        tapY: { type: 'number', description: 'Optional Y coordinate (0..1080) to click/tap before capturing.' },
        waitMs: { type: 'number', description: 'Milliseconds to wait before capturing (default 1200).' },
        screenshotName: { type: 'string', description: 'Filename stem for the saved PNG screenshot in .cache/mcp-phaser-shots/.' }
      }
    }
  }
];

async function handleRequest(req: JsonRpcRequest): Promise< Record<string, unknown> | null> {
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
          serverInfo: { name: 'uomd-phaser-live', version: '1.0.0' }
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
      if (name === 'phaser_search_docs') {
        payload = searchPhaserDocs(String(args.query ?? ''), typeof args.limit === 'number' ? args.limit : 8);
      } else if (name === 'phaser_get_skill_doc') {
        payload = getPhaserDoc(String(args.skill ?? ''));
      } else if (name === 'phaser_list_game_assets') {
        payload = listGameAssets();
      } else if (name === 'phaser_inspect_scene') {
        payload = await inspectLiveScene({
          scene: typeof args.scene === 'string' ? args.scene : undefined,
          freshInstall: Boolean(args.freshInstall),
          fastIntro: Boolean(args.fastIntro),
          prologueSceneIndex: typeof args.prologueSceneIndex === 'number' ? args.prologueSceneIndex : undefined,
          tapX: typeof args.tapX === 'number' ? args.tapX : undefined,
          tapY: typeof args.tapY === 'number' ? args.tapY : undefined,
          waitMs: typeof args.waitMs === 'number' ? args.waitMs : undefined,
          screenshotName: typeof args.screenshotName === 'string' ? args.screenshotName : undefined
        });
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
              text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
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
