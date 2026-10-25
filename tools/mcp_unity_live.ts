#!/usr/bin/env node
/**
 * UOMD Unity 6 LTS Live Inspection & Skill Knowledge MCP Server (stdio).
 *
 * Configured under Decision D-31 (2026-10-24).
 * Provides Claude Opus 5.5 (`claude-opus-5-5` / Claude Code) with deterministic tools to:
 *  - `unity_project_status`: Inspect `apps/unity/` structure, `.asmdef` assemblies, C# scripts, scenes, and `ProjectVersion.txt`.
 *  - `unity_bundle_status`: Verify `apps/unity/Assets/StreamingAssets/uomd_base/unity_export_manifest.json` and `UomdCorePrimitives.g.cs` parity against `content/base/release.json`.
 *  - `unity_inspect_unit_slices`: Query 16-cell (4x4) chibi slice coordinates, top-left vs Unity bottom-left normalized foot pivots (`unity_pivot: { x, y }`), and asset paths for any unit.
 *  - `unity_skills_search`: Search canonical Unity 6 LTS and UOMD engine skills in `.claude/skills/`.
 *  - `unity_skill_read`: Read the full `SKILL.md` and reference docs of any Unity 6 LTS or UOMD skill.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const UNITY_ROOT = join(ROOT, 'apps', 'unity');
const STREAMING_BASE = join(UNITY_ROOT, 'Assets', 'StreamingAssets', 'uomd_base');
const CONTENT_BASE = join(ROOT, 'content', 'base');
const CLAUDE_SKILLS_DIR = join(ROOT, '.claude', 'skills');

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

const UNITY_SKILL_NAMES = [
  'uomd-unity-engine',
  'unity-6-core',
  'unity-urp-2d',
  'unity-ui-toolkit',
  'unity-2d-animation',
  'unity-deterministic-combat',
  'unity-android-il2cpp',
  'unity-mcp-workflow',
  'unity-mcp-orchestrator',
  'uomd-battle',
  'uomd-anime-ui',
  'uomd-chibi-animation',
  'uomd-narrative-cinematics',
  'uomd-mobile-qa',
  'google-anime-media'
];

function walkFiles(dir: string, extFilter?: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, extFilter));
    } else if (entry.isFile()) {
      if (!extFilter || entry.name.endsWith(extFilter)) {
        results.push(full);
      }
    }
  }
  return results.sort();
}

function getUnityProjectStatus(): Record<string, unknown> {
  const versionPath = join(UNITY_ROOT, 'ProjectSettings', 'ProjectVersion.txt');
  const editorVersion = existsSync(versionPath)
    ? readFileSync(versionPath, 'utf8').trim()
    : 'not_initialized_yet (scaffold ready in apps/unity/)';

  const asmdefFiles = walkFiles(join(UNITY_ROOT, 'Assets'), '.asmdef').map((f) => relative(ROOT, f).replace(/\\/g, '/'));
  const csFiles = walkFiles(join(UNITY_ROOT, 'Assets'), '.cs').map((f) => relative(ROOT, f).replace(/\\/g, '/'));
  const javaFiles = walkFiles(join(UNITY_ROOT, 'Assets'), '.java').map((f) => relative(ROOT, f).replace(/\\/g, '/'));
  const shaderFiles = walkFiles(join(UNITY_ROOT, 'Assets'), '.shader').map((f) => relative(ROOT, f).replace(/\\/g, '/'));
  const sceneFiles = walkFiles(join(UNITY_ROOT, 'Assets'), '.unity').map((f) => relative(ROOT, f).replace(/\\/g, '/'));
  const uxmlFiles = walkFiles(join(UNITY_ROOT, 'Assets'), '.uxml').map((f) => relative(ROOT, f).replace(/\\/g, '/'));
  const ussFiles = walkFiles(join(UNITY_ROOT, 'Assets'), '.uss').map((f) => relative(ROOT, f).replace(/\\/g, '/'));

  const primitivesPath = join(UNITY_ROOT, 'Assets', '_UOMD', 'Scripts', 'Core', 'Generated', 'UomdCorePrimitives.g.cs');
  const manifestPath = join(UNITY_ROOT, 'Packages', 'manifest.json');
  const packageManifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        scopedRegistries?: Array<Record<string, unknown>>;
      })
    : null;
  const dependencies = packageManifest?.dependencies ?? {};

  return {
    unityRoot: 'apps/unity',
    editorVersion,
    generatedPrimitivesPresent: existsSync(primitivesPath),
    unityMcpPackage: dependencies['com.coplaydev.unity-mcp'] ?? null,
    counts: {
      asmdef: asmdefFiles.length,
      csharpScripts: csFiles.length,
      javaPlugins: javaFiles.length,
      shaders: shaderFiles.length,
      scenes: sceneFiles.length,
      uxml: uxmlFiles.length,
      uss: ussFiles.length,
      upmDependencies: Object.keys(dependencies).length
    },
    upmDependencies: dependencies,
    scopedRegistries: packageManifest?.scopedRegistries ?? [],
    asmdefFiles,
    csharpScripts: csFiles,
    javaPlugins: javaFiles,
    shaders: shaderFiles,
    scenes: sceneFiles
  };
}

function getUnityBundleStatus(): Record<string, unknown> {
  const exportManifestPath = join(STREAMING_BASE, 'unity_export_manifest.json');
  const baseReleasePath = join(CONTENT_BASE, 'release.json');
  const primitivesPath = join(UNITY_ROOT, 'Assets', '_UOMD', 'Scripts', 'Core', 'Generated', 'UomdCorePrimitives.g.cs');

  if (!existsSync(exportManifestPath)) {
    return {
      synced: false,
      reason: 'unity_export_manifest.json not found in apps/unity/Assets/StreamingAssets/uomd_base/. Run `npm run export:unity`.'
    };
  }

  const exportManifest = JSON.parse(readFileSync(exportManifestPath, 'utf8')) as Record<string, unknown>;
  const baseRelease = existsSync(baseReleasePath)
    ? (JSON.parse(readFileSync(baseReleasePath, 'utf8')) as Record<string, unknown>)
    : null;

  const exportReleaseId = String(exportManifest.release_id ?? '');
  const baseReleaseObj = baseRelease?.release as Record<string, unknown> | undefined;
  const baseReleaseId = String(baseReleaseObj?.id ?? baseRelease?.release_id ?? '');
  const unitSlices = (exportManifest.unit_slices ?? {}) as Record<string, unknown>;
  const files = Array.isArray(exportManifest.files) ? exportManifest.files : [];

  return {
    synced: exportReleaseId === baseReleaseId && existsSync(primitivesPath),
    exportReleaseId,
    baseReleaseId,
    targetEngine: exportManifest.target_engine,
    copiedFileCount: exportManifest.copied_file_count,
    verifiedAssetCount: files.length,
    unitSliceCount: Object.keys(unitSlices).length,
    generatedPrimitivesPath: relative(ROOT, primitivesPath).replace(/\\/g, '/'),
    generatedPrimitivesBytes: existsSync(primitivesPath) ? statSync(primitivesPath).size : 0
  };
}

function inspectUnitSlices(unitId?: string): Record<string, unknown> {
  const exportManifestPath = join(STREAMING_BASE, 'unity_export_manifest.json');
  if (!existsSync(exportManifestPath)) {
    throw new Error('unity_export_manifest.json missing; run `npm run export:unity` first.');
  }
  const exportManifest = JSON.parse(readFileSync(exportManifestPath, 'utf8')) as {
    unit_slices?: Record<string, Record<string, unknown>>;
    art_assets?: Array<{ id: string; kind: string; path: string; width: number; height: number }>;
  };
  const slices = exportManifest.unit_slices ?? {};
  const artAssets = exportManifest.art_assets ?? [];

  if (unitId && unitId.trim().length > 0) {
    const key = unitId.trim();
    const spec = slices[key];
    if (!spec) {
      return {
        found: false,
        requestedUnitId: key,
        availableUnits: Object.keys(slices).sort()
      };
    }
    const relatedAssets = artAssets.filter((a) => a.id.includes(`_${key}_`) || a.id.endsWith(`_${key}`));
    return {
      found: true,
      unitId: key,
      sliceSpec: spec,
      unityCoordinateNotes: {
        pixelsPerUnit: 100,
        meshType: 'SpriteMeshType.FullRect',
        normalizedBottomLeftPivot: spec.unity_pivot,
        cellRectFormula: 'y_unity = texture.height - ((rowFromTop + 1) * cellHeight)'
      },
      relatedAssets
    };
  }

  return {
    unitCount: Object.keys(slices).length,
    units: slices
  };
}

function searchUnitySkills(query: string): Record<string, unknown> {
  const q = query.trim().toLowerCase();
  const matches: Array<Record<string, unknown>> = [];

  for (const name of UNITY_SKILL_NAMES) {
    const skillPath = join(CLAUDE_SKILLS_DIR, name, 'SKILL.md');
    if (!existsSync(skillPath)) continue;
    const content = readFileSync(skillPath, 'utf8');
    if (!q || name.includes(q) || content.toLowerCase().includes(q)) {
      const refsDir = join(CLAUDE_SKILLS_DIR, name, 'references');
      const references = existsSync(refsDir)
        ? readdirSync(refsDir)
            .filter((f) => f.endsWith('.md'))
            .sort()
        : [];
      matches.push({
        skill: name,
        path: `.claude/skills/${name}/SKILL.md`,
        references,
        preview: content.split('\n').slice(0, 12).join('\n')
      });
    }
  }

  return {
    query,
    matchCount: matches.length,
    matches
  };
}

function readUnitySkill(skillName: string, referenceFile?: string): Record<string, unknown> {
  const cleanName = skillName.trim().replace(/[^a-z0-9-]/gi, '');
  const baseDir = join(CLAUDE_SKILLS_DIR, cleanName);
  const targetPath = referenceFile
    ? join(baseDir, 'references', referenceFile.replace(/[^a-z0-9._-]/gi, ''))
    : join(baseDir, 'SKILL.md');

  if (!existsSync(targetPath)) {
    throw new Error(`Skill document not found: ${relative(ROOT, targetPath)}`);
  }

  return {
    skill: cleanName,
    path: relative(ROOT, targetPath).replace(/\\/g, '/'),
    content: readFileSync(targetPath, 'utf8')
  };
}

function getUnityEditorMcpBridgeInfo(): Record<string, unknown> {
  const manifestPath = join(UNITY_ROOT, 'Packages', 'manifest.json');
  const editorToolsPath = join(UNITY_ROOT, 'Assets', '_UOMD', 'Editor', 'UomdMcpEditorTools.cs');
  const manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        dependencies?: Record<string, string>;
        scopedRegistries?: Array<Record<string, unknown>>;
      })
    : null;
  const packageSource = manifest?.dependencies?.['com.coplaydev.unity-mcp'] ?? null;
  const mcpConfigPath = join(ROOT, '.mcp.json');
  const mcpConfig = existsSync(mcpConfigPath)
    ? (JSON.parse(readFileSync(mcpConfigPath, 'utf8')) as { mcpServers?: Record<string, { args?: string[] }> })
    : null;

  return {
    packageId: 'com.coplaydev.unity-mcp',
    repository: 'https://github.com/CoplayDev/unity-mcp',
    configuredPackage: packageSource,
    serverEntry: mcpConfig?.mcpServers?.unityMCP ?? null,
    connection:
      'Open apps/unity in the Editor (the package starts its bridge), keep Window → MCP for Unity on the stdio transport, then use the unityMCP tools. Do not also register UnityMCP through "Configure All Detected Clients" for Claude Code: .mcp.json already provides it.',
    editorToolsScriptPresent: existsSync(editorToolsPath),
    editorToolsScriptPath: relative(ROOT, editorToolsPath).replace(/\\/g, '/'),
    uomdEditorMenuAndReflectionTools: [
      {
        method: 'Uomd.EditorTools.UomdMcpEditorTools.VerifyBundleAndParity',
        menuItem: 'UOMD/MCP/Verify StreamingAssets Bundle & Deterministic Math',
        purpose: 'Verifies StreamingAssets/uomd_base/release.json and runs Mulberry32Rng + UomdStatMath sanity check inside the Unity Editor.'
      },
      {
        method: 'Uomd.EditorTools.UomdMcpEditorTools.InspectActiveSceneJson',
        menuItem: 'UOMD/MCP/Inspect Active Scene & URP 2D Status',
        purpose: 'Returns canonical JSON of active scene roots, UIDocument count, SpriteRenderer count, and active URP 2D pipeline asset.'
      },
      {
        method: 'Uomd.EditorTools.UomdMcpEditorTools.CaptureGameViewScreenshot',
        menuItem: 'UOMD/MCP/Capture GameView Screenshot',
        purpose: 'Saves active GameView screenshot to .cache/screenshots/unity_gameview.png for visual regression checks.'
      },
      {
        method: 'Uomd.EditorTools.UomdProjectSetup.Apply',
        menuItem: 'UOMD/Apply Project Setup',
        purpose: 'Applies idempotent URP 2D Renderer2DData, Android IL2CPP ARM64 landscape settings, and EditorBuildSettings scenes.'
      }
    ],
    unityMcpToolsForUomd: [
      'read_console',
      'run_tests',
      'execute_menu_item',
      'manage_editor',
      'manage_scene',
      'find_gameobjects',
      'manage_ui',
      'manage_camera',
      'refresh_unity',
      'manage_profiler',
      'manage_build'
    ],
    skill: '.claude/skills/unity-mcp-orchestrator (read UOMD-NOTE.md first)'
  };
}

const TOOLS = [
  {
    name: 'unity_project_status',
    description:
      'Inspect the UOMD Unity 6 LTS project (`apps/unity/`) — `.asmdef` assemblies, C# scripts, scenes, UXML/USS files, UPM packages (`com.coplaydev.unity-mcp`), and generated `UomdCorePrimitives.g.cs`.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'unity_editor_mcp_bridge',
    description:
      'Inspect the MCP for Unity (`com.coplaydev.unity-mcp`, server `unityMCP` in `.mcp.json`) integration, the UOMD Editor menu entry points (`UomdMcpEditorTools.cs`) and the Editor tools to use with this project.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'unity_bundle_status',
    description:
      'Verify parity between `content/base/release.json` and `apps/unity/Assets/StreamingAssets/uomd_base/unity_export_manifest.json` + `UomdCorePrimitives.g.cs`.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'unity_inspect_unit_slices',
    description:
      'Inspect 16-cell (4x4) SD Chibi slice specs and precomputed Unity bottom-left normalized foot pivots (`unity_pivot: { x, y }`) for a specific unit or every unit of the exported art.',
    inputSchema: {
      type: 'object',
      properties: {
        unitId: {
          type: 'string',
          description: 'Optional unit ID (e.g. `fadyme`, `mahmut`, `hollow_pilgrim`). Omit to list all units.'
        }
      }
    }
  },
  {
    name: 'unity_skills_search',
    description:
      'Search the canonical Unity 6 LTS and UOMD engine skills in `.claude/skills/` (`uomd-unity-engine`, `unity-6-core`, `unity-urp-2d`, `unity-ui-toolkit`, `unity-2d-animation`, `unity-deterministic-combat`, `unity-android-il2cpp`, `unity-mcp-workflow`).',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keyword to search across Unity 6 LTS skills (e.g. `Awaitable`, `Sprite.Create`, `UIDocument`, `Mulberry32`, `IL2CPP`).'
        }
      }
    }
  },
  {
    name: 'unity_skill_read',
    description: 'Read the full `SKILL.md` or reference guide of a Unity 6 LTS or UOMD skill in `.claude/skills/`.',
    inputSchema: {
      type: 'object',
      properties: {
        skill: {
          type: 'string',
          description: 'Skill directory name (e.g. `uomd-unity-engine`, `unity-6-core`, `unity-urp-2d`, `unity-ui-toolkit`).'
        },
        reference: {
          type: 'string',
          description: 'Optional markdown filename inside the skill `references/` directory.'
        }
      },
      required: ['skill']
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
          serverInfo: { name: 'uomd-unity-live', version: '1.0.0' }
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
      if (name === 'unity_project_status') {
        payload = getUnityProjectStatus();
      } else if (name === 'unity_editor_mcp_bridge') {
        payload = getUnityEditorMcpBridgeInfo();
      } else if (name === 'unity_bundle_status') {
        payload = getUnityBundleStatus();
      } else if (name === 'unity_inspect_unit_slices') {
        payload = inspectUnitSlices(typeof args.unitId === 'string' ? args.unitId : undefined);
      } else if (name === 'unity_skills_search') {
        payload = searchUnitySkills(String(args.query ?? ''));
      } else if (name === 'unity_skill_read') {
        payload = readUnitySkill(
          String(args.skill ?? 'uomd-unity-engine'),
          typeof args.reference === 'string' ? args.reference : undefined
        );
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
