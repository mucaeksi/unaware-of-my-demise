import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ROOT } from './fsutil';
import { unityStatus } from './unity-status';

const temps: string[] = [];
afterEach(() => { for (const t of temps.splice(0)) rmSync(t, { recursive: true, force: true }); });

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'uomd-unity-status-'));
  temps.push(root);
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
  return root;
}

describe('unityStatus', () => {
  it('counts headless files per asmdef and keeps nested asmdefs separate', () => {
    const root = fixture({
      'apps/unity/ProjectSettings/ProjectVersion.txt': 'm_EditorVersion: 6000.0.58f2\n',
      'apps/unity/Assets/_UOMD/Scripts/Core/Uomd.Core.asmdef': JSON.stringify({ name: 'Uomd.Core', references: ['Uomd.Contracts', 'Unity.Mathematics'] }),
      'apps/unity/Assets/_UOMD/Scripts/Core/Pure.cs': 'class Pure {}\n',
      'apps/unity/Assets/_UOMD/Scripts/Core/Engine.cs': 'using UnityEngine;\nclass Engine {}\n',
      'apps/unity/Assets/_UOMD/Scripts/Core/Inner/Uomd.Inner.asmdef': JSON.stringify({ name: 'Uomd.Inner' }),
      'apps/unity/Assets/_UOMD/Scripts/Core/Inner/Inner.cs': 'class Inner {}\n',
      'apps/unity/Logic/Uomd.Core/Uomd.Core.csproj': '<Compile Include="$(UomdScripts)Core/Pure.cs" />',
      'apps/unity/Logic/Uomd.Logic.sln': ''
    });
    const s = unityStatus(root);
    const core = s.assemblies.find((a) => a.name === 'Uomd.Core')!;
    expect(s.editorVersion).toBe('6000.0.58f2');
    expect(core).toMatchObject({ csFiles: 2, headlessFiles: 1, references: ['Uomd.Contracts'] });
    expect(s.assemblies.find((a) => a.name === 'Uomd.Inner')).toMatchObject({ csFiles: 1, headlessFiles: 0 });
    expect(s.checks.find((c) => c.id === 'harness')?.state).toBe('done');
    expect(s.checks.find((c) => c.id === 'unity-import')?.state).toBe('todo');
  });

  it('reports the real project honestly: never imported by Unity, combat parity open', () => {
    const s = unityStatus(ROOT);
    expect(s.assemblies.length).toBeGreaterThanOrEqual(10);
    expect(s.counts.metaFiles === 0).toBe(s.checks.find((c) => c.id === 'unity-import')?.state === 'todo');
    expect(s.assemblies.find((a) => a.name === 'Uomd.Combat')?.headlessFiles).toBeGreaterThan(0);
    expect(s.checks.find((c) => c.id === 'core-parity')?.state).toBe('done');
  });
});
