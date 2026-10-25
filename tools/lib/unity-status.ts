/**
 * Unity migration status computed from the repository itself, so the Control Center "Development" page cannot drift
 * from the code. Every check is a file/grep fact about apps/unity; nothing here claims a test result or a device run.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export type CheckState = 'done' | 'partial' | 'todo';

export interface UnityCheck {
  id: string;
  phase: string;
  title: string;
  state: CheckState;
  detail: string;
}

export interface UnityAssembly {
  name: string;
  path: string;
  references: string[];
  csFiles: number;
  lines: number;
  /** Files compiled by the headless .NET harness (apps/unity/Logic) and therefore proven to build without Unity. */
  headlessFiles: number;
}

export interface UnityStatus {
  editorVersion: string;
  counts: { metaFiles: number; projectSettingsAssets: number; csFiles: number; csLines: number; javaBridges: number; screenControllers: number; editModeTests: number };
  assemblies: UnityAssembly[];
  combat: { csharpLines: number; typescriptLines: number };
  checks: UnityCheck[];
  /** Latest cloud capture of the real Unity player (docs/evidence/unity-*.webp, tools/publish_unity_screens.mjs). */
  capture: { commit: string; editorVersion: string; capturedAt: string; files: string[] } | null;
  /** Latest Android build recorded by tools/record_unity_build.mjs (docs/evidence/unity-android-build.json). */
  android: UnityAndroidBuild | null;
}

export interface UnityAndroidBuild {
  commit: string;
  file: string;
  bytes: number;
  sha256: string;
  format: 'aab' | 'apk';
  signing: 'debug' | 'release';
  applicationId: string;
  versionName: string;
  versionCode: number;
  minSdk: number;
  targetSdk: number;
  architectures: string[];
  scriptingBackend: string;
  editorVersion: string;
  builtAt: string;
  durationSeconds: number;
}

function walk(dir: string, keep: (path: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'StreamingAssets' || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      walk(p, keep, out);
    } else if (entry.isFile() && keep(p)) out.push(p);
  }
  return out;
}

const lineCount = (file: string): number => readFileSync(file, 'utf8').split('\n').length;
const sumLines = (files: string[]): number => files.reduce((n, f) => n + lineCount(f), 0);

/** Absolute paths of the Assets/ sources linked by the headless harness projects (explicit Compile Include items). */
export function headlessSources(unityRoot: string): Set<string> {
  const logic = join(unityRoot, 'Logic');
  const result = new Set<string>();
  const scripts = join(unityRoot, 'Assets/_UOMD/Scripts');
  const assets = join(unityRoot, 'Assets/_UOMD');
  for (const proj of walk(logic, (p) => p.endsWith('.csproj'))) {
    for (const m of readFileSync(proj, 'utf8').matchAll(/<Compile Include="([^"]+)"/g)) {
      const raw = m[1]!.replace('$(UomdScripts)', `${scripts}/`).replace('$(UomdAssets)', `${assets}/`);
      if (raw.includes('$(')) continue;
      if (raw.includes('**')) {
        const [dir = ''] = raw.split('**');
        for (const f of walk(dir, (p) => p.endsWith('.cs'))) result.add(f);
      } else if (!raw.includes('*')) {
        result.add(join(raw));
      }
    }
  }
  return result;
}

function state(ok: boolean, partial = false): CheckState {
  return ok ? 'done' : partial ? 'partial' : 'todo';
}

export function unityStatus(root: string): UnityStatus {
  const unity = join(root, 'apps/unity');
  const assetsDir = join(unity, 'Assets');
  const versionFile = join(unity, 'ProjectSettings/ProjectVersion.txt');
  const editorVersion = existsSync(versionFile) ? (/m_EditorVersion:\s*(\S+)/.exec(readFileSync(versionFile, 'utf8'))?.[1] ?? '') : '';

  const csFiles = walk(assetsDir, (p) => p.endsWith('.cs'));
  const metaFiles = walk(assetsDir, (p) => p.endsWith('.meta')).length;
  const settingsDir = join(unity, 'ProjectSettings');
  const projectSettingsAssets = existsSync(settingsDir) ? readdirSync(settingsDir).filter((f) => f.endsWith('.asset')).length : 0;
  const javaBridges = walk(join(assetsDir, 'Plugins/Android'), (p) => p.endsWith('.java')).length;
  const headless = headlessSources(unity);

  const asmdefs = walk(assetsDir, (p) => p.endsWith('.asmdef')).sort();
  const assemblies: UnityAssembly[] = asmdefs.map((file) => {
    const def = JSON.parse(readFileSync(file, 'utf8')) as { name: string; references?: string[] };
    const dir = file.slice(0, file.lastIndexOf('/'));
    // a nested asmdef owns its own folder
    const nested = asmdefs.filter((o) => o !== file && o.startsWith(`${dir}/`)).map((o) => o.slice(0, o.lastIndexOf('/') + 1));
    const own = csFiles.filter((f) => f.startsWith(`${dir}/`) && !nested.some((n) => f.startsWith(n)));
    return {
      name: def.name,
      path: relative(root, dir),
      references: (def.references ?? []).filter((r) => r.startsWith('Uomd.')),
      csFiles: own.length,
      lines: sumLines(own),
      headlessFiles: own.filter((f) => headless.has(f)).length
    };
  });

  const read = (rel: string): string => (existsSync(join(root, rel)) ? readFileSync(join(root, rel), 'utf8') : '');
  const scenesDir = join(assetsDir, '_UOMD/Scripts/Scenes');
  const screenControllers = walk(scenesDir, (p) => p.endsWith('.cs')).reduce((n, f) => n + (readFileSync(f, 'utf8').match(/class \w+(Screen|Overlay)Controller\b/g)?.length ?? 0), 0);
  const testFiles = walk(join(assetsDir, '_UOMD/Tests'), (p) => p.endsWith('.cs'));
  const testText = testFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
  const editModeTests = testText.match(/\[(Test|UnityTest|TestCase)\b/g)?.length ?? 0;

  const combatCs = csFiles.filter((f) => f.includes('/Scripts/Combat/'));
  const combatTs = walk(join(root, 'packages/combat/src'), (p) => p.endsWith('.ts') && !p.endsWith('.test.ts'));
  const combat = { csharpLines: sumLines(combatCs), typescriptLines: sumLines(combatTs) };

  const patch = read('apps/unity/Assets/_UOMD/Scripts/Core/PatchManager.cs');
  const patchClient = read('apps/unity/Assets/_UOMD/Scripts/Core/Patching/UomdPatchClient.cs');
  const vfxTimeline = read('apps/unity/Assets/_UOMD/Scripts/Core/Vfx/VfxTimeline.cs');
  const vfxTests = testFiles.filter((f) => /VfxTests\.cs$/.test(f)).reduce((n, f) => n + (readFileSync(f, 'utf8').match(/\[Test\]/g) ?? []).length, 0);
  const patchTests = testFiles.filter((f) => /Patch\w*Tests\.cs$/.test(f)).reduce((n, f) => n + (readFileSync(f, 'utf8').match(/\[Test\]/g) ?? []).length, 0);
  const evidence = join(root, 'docs/evidence');
  const captureMeta = read('docs/evidence/unity-capture.json');
  const capture = captureMeta
    ? { ...(JSON.parse(captureMeta) as { commit: string; editorVersion: string; capturedAt: string }), files: readdirSync(evidence).filter((f) => f.startsWith('unity-') && f.endsWith('.webp')).sort() }
    : null;
  const androidMeta = read('docs/evidence/unity-android-build.json');
  const android = androidMeta ? (JSON.parse(androidMeta) as UnityAndroidBuild) : null;
  const imported = metaFiles > 0;
  const checks: UnityCheck[] = [
    { id: 'export', phase: 'U-0', title: 'Content bundle + C# primitives exporter', state: state(existsSync(join(root, 'tools/export_unity_bundle.ts')) && existsSync(join(assetsDir, '_UOMD/Scripts/Core/Generated/UomdCorePrimitives.g.cs'))), detail: 'npm run export:unity' },
    { id: 'harness', phase: 'U-1', title: 'Headless .NET C# harness (no Unity licence)', state: state(existsSync(join(unity, 'Logic/Uomd.Logic.sln'))), detail: `${headless.size} Assets/ files compiled headlessly · npm run test:unity-logic` },
    { id: 'core-parity', phase: 'U-1', title: 'Core parity tests (RNG, stats, canonical JSON, ES256)', state: state(/Mulberry32MatchesTypeScript/.test(testText) && /ManagedEs256/.test(testText)), detail: `${editModeTests} EditMode tests` },
    { id: 'combat-parity', phase: 'U-1', title: 'Combat replay parity with @uomd/combat (logHash)', state: state(/ReplayParity|logHash/i.test(testText), combat.csharpLines > 0), detail: /logHash/i.test(testText) ? `golden replays in CombatParityTests (tools/export_unity_combat_vectors.ts); C# ${combat.csharpLines} / TypeScript ${combat.typescriptLines} lines` : `C# ${combat.csharpLines} lines vs TypeScript ${combat.typescriptLines} lines; no replay parity test yet` },
    { id: 'story-tests', phase: 'U-1', title: 'StoryRunner C# tests', state: state(/StoryRunner/.test(testText)), detail: 'port packages/story runner.test.ts cases' },
    { id: 'patch-remote', phase: 'U-2', title: 'Signed remote patch download + staged activation', state: state(/CheckAndApplyAsync/.test(patchClient) && /ActivateStagedAsync/.test(patchClient) && /UomdPatchClient/.test(patch), /ActivateStaged|VerifyRemoteManifestAdmission/.test(patch)), detail: /CheckAndApplyAsync/.test(patchClient) ? `UomdPatchClient (port of packages/patch manager.ts) · ${patchTests} patch tests · device-side validateContentSet pending (U-2b)` : 'manifest signature check exists; download/stage/activate pending' },
    { id: 'unity-import', phase: 'U-3', title: 'First Unity Editor import (metas, ProjectSettings, packages-lock)', state: state(imported && projectSettingsAssets > 0 && existsSync(join(unity, 'Packages/packages-lock.json')), imported), detail: `${metaFiles} .meta · ${projectSettingsAssets} ProjectSettings assets${imported ? '' : ' · needs a licensed editor (apps/unity/cloud/unity_ci.sh import)'}` },
    { id: 'battle-vfx', phase: 'U-4', title: 'Data-driven battle VFX (vfx_presets.json)', state: state(/VfxTimeline/.test(vfxTimeline) && vfxTests > 0 && existsSync(join(assetsDir, '_UOMD/Scripts/Scenes/UomdVfxPlayer.cs'))), detail: vfxTests > 0 ? `VfxTimeline + UI Toolkit player · ${vfxTests} VFX tests · ultimate cut-in and additive blending pending` : 'presets are not played yet' },
    { id: 'screens', phase: 'U-3/U-4', title: 'Screen controllers', state: state(false, screenControllers > 0), detail: `${screenControllers} controllers exist as UI shells; art and flows still to wire` },
    { id: 'cloud-capture', phase: 'U-3', title: 'Real Unity player screenshots from the cloud', state: state(capture !== null && capture.files.length > 0), detail: capture ? `${capture.files.length} screens · ${capture.commit} · ${capture.capturedAt}` : 'needs UNITY_LICENSE/UNITY_EMAIL/UNITY_PASSWORD in the cloud environment (apps/unity/cloud/unity_ci.sh capture)' },
    { id: 'android', phase: 'U-5', title: 'Android native bridges + Gradle deps', state: state(javaBridges >= 4 && existsSync(join(assetsDir, 'Plugins/Android/UomdNative.androidlib/build.gradle'))), detail: `${javaBridges} Java files in UomdNative.androidlib` },
    { id: 'aab-script', phase: 'U-5', title: 'Signed AAB build entry point', state: state(existsSync(join(assetsDir, '_UOMD/Editor/UomdBuild.cs'))), detail: 'UomdBuild (UOMD_KEYSTORE_* from environment)' },
    {
      id: 'aab-build',
      phase: 'U-5',
      title: 'Android AAB built in the cloud',
      state: state(android?.format === 'aab' && android.signing === 'release', android !== null),
      detail: android
        ? `${android.format.toUpperCase()} ${android.versionName} (${android.versionCode}) · ${(android.bytes / 1048576).toFixed(1)} MB · ${android.signing === 'release' ? 'release-signed' : 'debug-signed, not uploadable to Play until the upload key is provided (B-SIGNING)'} · ${android.commit}`
        : 'not built yet (apps/unity/cloud/unity_ci.sh build, then node tools/record_unity_build.mjs)'
    }
  ];

  return {
    editorVersion,
    counts: { metaFiles, projectSettingsAssets, csFiles: csFiles.length, csLines: sumLines(csFiles), javaBridges, screenControllers, editModeTests },
    assemblies,
    combat,
    checks,
    capture,
    android
  };
}
