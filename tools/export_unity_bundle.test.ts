import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ArtManifest } from '@uomd/content-schema';
import { buildUnityArtMetadata, exportUnityBundle, generateCSharpCorePrimitives } from './export_unity_bundle';

// Workspaces run this file from apps/unity, the root test:tools run from the repo root: never rely on cwd.
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('export_unity_bundle (D-31 Unity migration tooling)', () => {
  it('converts top-left atlas frames and foot_y into Unity bottom-left Sprite rects and pivots', () => {
    const baseState = {
      frame: 'idle_1',
      scale: 1,
      foot_y: 0.92,
      pivot_x: 0.48
    };
    const sample = ArtManifest.parse({
      schema_version: 1,
      atlases: {
        atlas_test: {
          image: 'art/atlas_test.webp',
          width: 1024,
          height: 512,
          frames: {
            idle_1: [0, 0, 256, 256],
            idle_2: [256, 128, 256, 256]
          }
        }
      },
      units: {
        hero_test: {
          atlas: 'atlas_test',
          facing: 'right',
          height_px: 220,
          states: {
            idle: {
              ...baseState,
              animation: {
                frames: ['idle_1', 'idle_2'],
                fps: 6,
                loop: true
              }
            },
            walk: baseState,
            basic: baseState,
            active: baseState,
            ultimate: baseState,
            hit: baseState,
            defeat: baseState,
            victory: baseState
          }
        }
      },
      portraits: {},
      backgrounds: {}
    });

    const meta = buildUnityArtMetadata(sample);
    expect(meta.coordinateSystem).toBe('unity_bottom_left');
    const slices = meta.atlases.atlas_test!.slices;
    expect(slices).toHaveLength(2);
    // Top-left (0, 0, 256, 256) in a 512px-tall texture -> bottom-left y = 512 - 256 = 256
    expect(slices[0]!.rect).toEqual({ x: 0, y: 256, width: 256, height: 256 });
    expect(slices[0]!.pivot).toEqual({ x: 0.48, y: 0.08 });
    // Top-left (256, 128, 256, 256) in a 512px-tall texture -> bottom-left y = 512 - (128 + 256) = 128
    expect(slices[1]!.rect).toEqual({ x: 256, y: 128, width: 256, height: 256 });
    expect(meta.units.hero_test!.clips[0]!.unityPivotY).toBe(0.08);
  });

  it('generates valid C# core primitives source with Mulberry32Rng, UomdStatMath and trusted keys', () => {
    const cs = generateCSharpCorePrimitives([
      {
        kty: 'EC',
        crv: 'P-256',
        x: 'VXuwEWj7AAFE5aHR6YTr8FsRp2RcMtXUQV7suRRSK7s',
        y: 'FPCZaCAXOXusdrq55f_pZHgf3rd-JVsAPqvD4RkUkdc',
        kid: 'uomd-staging-2026-10'
      }
    ]);
    expect(cs).toContain('public sealed class Mulberry32Rng');
    expect(cs).toContain('0x6D2B79F5u');
    expect(cs).toContain('public static class UomdStatMath');
    expect(cs).toContain('uomd-staging-2026-10');
    expect(cs).toContain('world_map_v1');
    expect(cs).toContain('hard_mode_v1');
  });

  it('exports the repository base release and generated C# primitives into a temporary bundle directory', () => {
    const tempOut = mkdtempSync(join(tmpdir(), 'uomd-unity-export-'));
    try {
      const summary = exportUnityBundle({ outDir: tempOut });
      expect(summary.baseReleaseId).toBe('rel_0001');
      expect(summary.baseFilesCopied).toBeGreaterThan(100);
      expect(summary.baseAtlases).toBeGreaterThanOrEqual(4);
      expect(existsSync(join(tempOut, 'StreamingAssets/uomd_base/release.json'))).toBe(true);
      expect(existsSync(join(tempOut, 'StreamingAssets/uomd_metadata/unity_base_art_slices.json'))).toBe(true);
      expect(existsSync(summary.csharpFile)).toBe(true);
      const csText = readFileSync(summary.csharpFile, 'utf8');
      expect(csText).toContain('namespace Uomd.Core');
    } finally {
      rmSync(tempOut, { recursive: true, force: true });
    }
  });

  it('configures IvanMurzak/Unity-MCP (com.ivanmurzak.unity.mcp) and UomdMcpEditorTools in apps/unity', () => {
    const manifestPath = join(REPO_ROOT, 'apps/unity/Packages/manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      scopedRegistries?: Array<{ url: string; scopes: string[] }>;
    };
    expect(manifest.dependencies?.['com.ivanmurzak.unity.mcp']).toBe('1.5.0');
    expect(manifest.scopedRegistries?.[0]?.url).toBe('https://package.openupm.com');
    expect(manifest.scopedRegistries?.[0]?.scopes).toContain('com.ivanmurzak');

    const editorToolsPath = join(REPO_ROOT, 'apps/unity/Assets/_UOMD/Editor/UomdMcpEditorTools.cs');
    expect(existsSync(editorToolsPath)).toBe(true);
    const editorToolsCs = readFileSync(editorToolsPath, 'utf8');
    expect(editorToolsCs).toContain('VerifyBundleAndParity');
    expect(editorToolsCs).toContain('InspectActiveSceneJson');
  });
});
