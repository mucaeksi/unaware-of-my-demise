#!/usr/bin/env python3
"""Fast local file lookup. Git-visible authored files plus the current release index.

Examples: project_catalog.py build; project_catalog.py find fadyme --scope aab
The generated catalogue is local evidence, not another editable source tree.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX = '.local/project-index.json'
FEATURES = {
    'entry': ['game/scripts/ui/entry/', 'game/scripts/ui/story_director.gd', 'game/data/entry/'],
    'patch': ['game/scripts/app/installed_content.gd', 'game/scripts/app/content', 'game/scripts/app/entry_restart.gd', 'tools/content_release.py', 'patch/'],
    'prologue': ['game/scripts/ui/entry/prologue', 'game/scripts/ui/entry/entry_prologue', 'game/assets/ui/narrative/prologue', 'game/data/entry/prologue'],
    'tutorial': ['game/scripts/ui/entry/tutorial', 'game/scripts/ui/entry/entry_onboarding', 'game/data/entry/tutorial'],
    'cutscene': ['game/scripts/ui/vn/', 'game/assets/ui/narrative/tutorial', 'game/data/presentation/battle_art', 'game/scripts/ui/battle/battle_art'],
    'battle': ['game/scripts/ui/battle/', 'game/scripts/core/battle/'],
    'preview': ['game/scripts/art_review/', 'game/scenes/art_review/', 'tools/Start-'],
    'aab': ['tools/Build-', 'tools/Update-', 'tools/materialize_aab.py', 'tools/verify_opening', 'game/export_presets.cfg', 'game/android/plugins/uomd_native/', 'game/addons/uomd_native/'],
    'theme': ['game/scripts/ui/common/', 'game/theme/', 'game/assets/ui/production/'],
    'canon': ['narrative/00_Canon/', 'narrative/06_Characters/', 'narrative/09_Approved/', 'narrative/FADYME_MEDIA_ALL/'],
    'test': ['game/tests/', 'tools/tests/', 'tools/test_'],
}


def digest(path: Path) -> str:
    checksum = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            checksum.update(chunk)
    return checksum.hexdigest()


def classify(path: str) -> str:
    if path.startswith(('.agents/archive/', '.claude/', '.archive/')) or path in ['CLAUDE.md', 'project.yaml']:
        return 'history'
    if path.startswith('.codex/'):
        return 'active_tooling'
    if path.startswith('.agents/library/'):
        return 'capability_index'
    if path.startswith(('game/assets/third_party/reference/', 'game/assets/vfx/gdquest_reference/', 'references/')):
        return 'reference_library'
    if path.startswith(('game/tests/', 'game/e2e/', 'parity/', 'tools/tests/', 'tools/test_')):
        return 'test'
    if path.startswith(('game/scripts/art_review/', 'game/scenes/art_review/', 'game/assets/art_review/')):
        return 'local_preview'
    if path.startswith('game/data/content/story_script_ch'):
        return 'patch_content'
    if path.startswith(('game/android/plugins/', 'game/addons/uomd_native/', 'game/tools/', 'tools/', 'scripts/', '.github/')):
        return 'build_support'
    if path.startswith(('game/addons/godot_ai/', 'game/addons/gut/')):
        return 'development_addon'
    if path.startswith('game/'):
        return 'client_source'
    if path.startswith('narrative/'):
        return 'creative_source'
    if path.startswith('production/'):
        return 'read_only_production'
    if path.startswith(('server/', 'admin/', 'database/')):
        return 'online_services'
    if path.startswith('patch/'):
        return 'patch_support'
    if path.startswith('docs/'):
        return 'documentation'
    return 'project_root'


def authored_files(root: Path) -> list[str]:
    result = subprocess.run(['git', '-C', str(root), 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], check=True, capture_output=True)
    generated = {'.godot', '.gradle', '.wrangler', '.next', 'node_modules', '__pycache__'}
    return sorted({p for p in result.stdout.decode('utf-8').split('\0')
                   if p and (root / p).is_file() and not (root / p).is_symlink()
                   and not p.startswith(('build/', '.local/', 'local-backups/', 'graphify-out/', 'admin/out/', 'server/dist/'))
                   and not generated.intersection(Path(p).parts)
                   and not Path(p).name.startswith('.env')
                   and Path(p).name not in {'next-env.d.ts', 'tsconfig.tsbuildinfo', 'export_credentials.cfg', 'local.properties'}})


def release_sources(root: Path) -> set[str]:
    manifest = root / 'release/current/release.json'
    if not manifest.exists():
        return set()
    result: set[str] = set()
    # The snapshot index is intentionally portable; tolerate its record grouping.
    index = root / 'release/current/FILE_INDEX.json'
    if index.exists():
        def visit(value):
            if isinstance(value, dict):
                for key, child in value.items():
                    if key in ('source', 'source_path', 'origin', 'upstream') and isinstance(child, str) and (root / child).is_file():
                        result.add(child)
                    visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)
        visit(json.loads(index.read_text(encoding='utf-8')))
    return result


def build(root: Path, output: Path) -> dict:
    base = release_sources(root)
    records = []
    for relative in authored_files(root):
        path = root / relative
        if any(part in ('.godot', 'node_modules', '__pycache__') for part in path.parts):
            continue
        stat = path.stat()
        sensitive = path.suffix.lower() in ('.pem', '.jks', '.keystore', '.p12') or path.name.startswith('.env')
        record = {'path': relative, 'category': classify(relative), 'extension': path.suffix.lower(), 'bytes': stat.st_size,
                  'mtime_ns': stat.st_mtime_ns, 'aab_current': relative in base,
                  'features': [label for label, prefixes in FEATURES.items() if any(relative.startswith(prefix) for prefix in prefixes)]}
        record['sha256'] = None if sensitive else digest(path)
        records.append(record)
    report = {'schema_version': 1, 'scope': 'git-visible authored files; ignored caches/build outputs/private files excluded; Production catalogued read-only',
              'files': records, 'summary': {'files': len(records), 'bytes': sum(r['bytes'] for r in records),
              'categories': dict(Counter(r['category'] for r in records)), 'aab_current_files': sum(r['aab_current'] for r in records)},
              'release': 'release/current/release.json' if base else None}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return report


def matches(record: dict, query: str) -> bool:
    text = ' '.join([record['path'], record['category'], *record['features']]).casefold()
    return all(word in text for word in query.casefold().split())


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['build', 'find', 'check'])
    parser.add_argument('query', nargs='?', default='')
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--index', default=DEFAULT_INDEX)
    parser.add_argument('--scope', choices=['all', 'active', 'aab', 'history'], default='active')
    parser.add_argument('--category')
    parser.add_argument('--limit', type=int, default=30)
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args(argv)
    root = args.root.resolve(strict=True)
    output = root / args.index
    if args.command == 'build':
        report = build(root, output)
        print(json.dumps(report['summary'], ensure_ascii=False))
        return 0
    if not output.exists():
        print('Catalogue missing. Run project_catalog.py build first.', file=sys.stderr)
        return 2
    report = json.loads(output.read_text(encoding='utf-8'))
    if args.command == 'check':
        known = {row['path']: row for row in report['files']}
        present = set(authored_files(root))
        changed = [p for p in present & known.keys() if (root / p).stat().st_size != known[p]['bytes'] or (root / p).stat().st_mtime_ns != known[p]['mtime_ns']]
        result = {'added': sorted(present - known.keys()), 'removed': sorted(known.keys() - present), 'changed': sorted(changed)}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1 if any(result.values()) else 0
    rows = [r for r in report['files'] if matches(r, args.query)
            and (args.scope != 'active' or r['category'] != 'history')
            and (args.scope != 'history' or r['category'] == 'history')
            and (args.scope != 'aab' or r['aab_current'])
            and (not args.category or r['category'] == args.category)]
    rows.sort(key=lambda r: (r['category'] in ('history', 'reference_library'), not r['aab_current'], len(r['path']), r['path']))
    if args.json:
        print(json.dumps({'matches': len(rows), 'files': rows[:max(0, args.limit)]}, ensure_ascii=False, indent=2))
    else:
        for row in rows[:max(0, args.limit)]:
            print(f"{'AAB' if row['aab_current'] else 'DEV':3}  {row['category']:22}  {row['path']}")
        print(f'{len(rows)} matches; showing {min(len(rows), max(0, args.limit))}.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
