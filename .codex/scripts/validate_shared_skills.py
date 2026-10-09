"""Read-only integrity and dual-discovery validation; not native client acceptance."""
from pathlib import Path
import hashlib
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[2]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate(root=ROOT):
    root = Path(root).resolve()
    errors = []
    canonical = root / '.codex/skills'
    comparisons = []
    for skill in sorted(canonical.glob('*/SKILL.md')):
        name = skill.parent.name
        for prefix in ['.agents/skills', '.claude/skills']:
            view = root / prefix / name
            if not view.is_dir() or view.resolve() != skill.parent.resolve():
                errors.append(f'{prefix}/{name}: incorrect/missing discovery link')
                continue
            files = sorted(p for p in skill.parent.rglob('*') if p.is_file())
            for path in files:
                relative = path.relative_to(skill.parent)
                if not (view / relative).is_file() or sha(path) != sha(view / relative):
                    errors.append(f'{prefix}/{name}/{relative}: hash mismatch')
            comparisons.append({'loader': prefix, 'skill': name,
                                'files': len(files), 'skill_sha256': sha(skill)})
        # Also check adapted reference links, including fragment-bearing local links.
        for path in skill.parent.rglob('*.md'):
            for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
                target = link.split('#', 1)[0].strip('<>')
                if target and not re.match(r'[a-z]+://', target) and not (path.parent / target).exists():
                    errors.append(f'{path.relative_to(root)}: missing link {target}')
    manifest = json.loads((root / '.agents/library/shared-skills-install.json').read_text())
    for source in manifest['source_snapshots']:
        folder = root / source['stored_path']
        for relative, expected in source['files'].items():
            path = folder / relative
            if not path.is_file() or sha(path) != expected:
                errors.append(f'{source["id"]}/{relative}: upstream snapshot changed')
        repo_root = root / '.agents/library/upstream/20261009' / ('gamedev' if source['license'] == 'Apache-2.0' else 'prompter')
        if not (repo_root / 'LICENSE').is_file():
            errors.append(f'{source["id"]}: license missing')
        if source['license'] == 'Apache-2.0' and not (repo_root / 'NOTICE').is_file():
            errors.append(f'{source["id"]}: original NOTICE missing')
    for source in json.loads((root / 'references/shared_godot/SOURCES.json').read_text())['sources']:
        for relative, record in source['files'].items():
            path = root / 'references/shared_godot' / relative
            if not path.is_file() or sha(path) != record['sha256']:
                errors.append(f'{source["id"]}/{relative}: upstream study changed')
    for relative, expected in manifest.get('notice_hashes', {}).items():
        path = root / relative
        if not path.is_file() or sha(path) != expected:
            errors.append(f'{relative}: source notice changed')
    return {'status': 'PASS' if not errors else 'FAIL',
            'canonical_skills': len(list(canonical.glob('*/SKILL.md'))),
            'loader_comparisons': comparisons, 'errors': errors,
            'native_client_discovery': 'NOT_ESTABLISHED_BY_FILESYSTEM_VALIDATION'}


if __name__ == '__main__':
    result = validate()
    print(json.dumps(result, indent=2))
    sys.exit(bool(result['errors']))
