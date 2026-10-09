"""Connect both skill loaders to canonical files; preserve user folders."""
from pathlib import Path
import os
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]


def bootstrap(root=ROOT):
    root = Path(root).resolve()
    canonical = root / '.codex/skills'
    skills = sorted(p.parent for p in canonical.glob('*/SKILL.md'))
    if not skills:
        raise RuntimeError('Canonical skills are missing; no changes made.')
    specs = [(root / '.agents/skills', canonical, '../.codex/skills')]
    specs += [(root / '.claude/skills' / p.name, p, '../../.codex/skills/' + p.name)
              for p in skills]
    pending = []
    for bridge, target, relative in specs:
        if not bridge.parent.resolve().is_relative_to(root):
            raise RuntimeError(f'Bridge parent escapes checkout: {bridge}')
        ancestor = bridge.parent
        while ancestor != root:
            if os.path.lexists(ancestor) and not ancestor.is_dir():
                raise RuntimeError(f'Discovery parent is a user file: {ancestor}; no changes made.')
            ancestor = ancestor.parent
        if os.path.lexists(bridge):
            if bridge.is_symlink() or (hasattr(os.path, 'isjunction') and os.path.isjunction(bridge)):
                if bridge.resolve() == target.resolve() and bridge.exists():
                    continue
                raise RuntimeError(f'Conflicting discovery link: {bridge}; no changes made.')
            if not (os.name == 'nt' and bridge.is_file()
                    and bridge.read_bytes() == relative.encode('utf-8')):
                raise RuntimeError(f'Existing user file/folder: {bridge}; no changes made.')
        pending.append((bridge, target, relative))
    for bridge, target, relative in pending:
        bridge.parent.mkdir(parents=True, exist_ok=True)
        if bridge.is_file():
            bridge.unlink()  # Only an exact Windows Git placeholder passed preflight.
        try:
            bridge.symlink_to(relative, target_is_directory=True)
        except OSError as exc:
            if os.name != 'nt' or exc.winerror != 1314:
                raise
            subprocess.run(['cmd', '/c', 'mklink', '/J', str(bridge), str(target)],
                           check=True, capture_output=True)
        if bridge.resolve() != target.resolve() or not bridge.is_dir():
            raise RuntimeError(f'Bridge verification failed: {bridge}')
    return {'canonical_skills': len(skills), 'created_links': len(pending),
            'verified_links': len(specs)}


if __name__ == '__main__':
    import json
    try:
        print(json.dumps(bootstrap(), indent=2))
    except (RuntimeError, OSError, subprocess.CalledProcessError) as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
