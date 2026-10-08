"""Validate canonical manifests, agent TOML, references, provenance and discovery bridge."""
from pathlib import Path
import collections
import hashlib
import json
import re
import sys
import tomllib

ROOT = Path(__file__).resolve().parents[2]

def validate():
    errors = []
    inventory = json.loads((ROOT / '.agents/library/migration-inventory.json').read_text(encoding='utf-8'))
    skills = sorted((ROOT / '.codex/skills').glob('*/SKILL.md'))
    names = []
    for p in skills:
        text = p.read_text(encoding='utf-8-sig')
        match = re.match(r'^---\nname: ([a-z0-9-]+)\ndescription: ("[^\n]*")\n---\n', text)
        if not match:
            errors.append(f'{p.relative_to(ROOT)}: invalid supported scalar YAML frontmatter')
            continue
        name = match.group(1)
        try:
            description = json.loads(match.group(2))
        except ValueError:
            errors.append(f'{name}: invalid description string')
            continue
        if name != p.parent.name or len(name) > 64 or not name.startswith('uomd-'):
            errors.append(f'{name}: naming/folder mismatch')
        if not description.strip() or len(description) > 1024:
            errors.append(f'{name}: invalid description length')
        names.append(name)
    if sorted(names) != sorted(inventory['active_skills']):
        errors.append('Active skill inventory differs from canonical folders')
    if len(names) != len(set(names)):
        errors.append('Duplicate project skill names')
    forbidden = re.compile(r'AskUserQuestion|CLAUDE_SKILL_DIR|CLAUDE_PROJECT_DIR|subagent_type\s*=|^!`|\b(?:sonnet|opus|haiku)\b|\.claude/|`/(?:uomd-|story-done|test-evidence-review|gate-check|create-stories|create-epics|architecture-decision|story-readiness|propagate-design-change)', re.M)
    active_documents = list((ROOT / '.codex/skills').rglob('*.md')) + list((ROOT / '.codex/references').rglob('*.md'))
    for p in active_documents:
        text = p.read_text(encoding='utf-8-sig')
        if forbidden.search(text):
            errors.append(f'{p.relative_to(ROOT)}: active legacy instruction/reference')
        for link in re.findall(r'\[[^\]]*\]\(([^)]+)\)', text):
            target = link.split('#', 1)[0].strip('<>')
            if not target or re.match(r'[a-z]+://', target) or '[' in target or ' ' in target:
                continue
            if not (p.parent / target).exists():
                errors.append(f'{p.relative_to(ROOT)}: missing link {target}')
    for p in active_documents + list((ROOT / '.codex/standards').glob('*.md')) + list((ROOT / '.codex/workflows').glob('*.md')):
        text = p.read_text(encoding='utf-8-sig')
        for reference in re.findall(r'`((?:\.codex/|docs/|game/)[^`]+)`', text):
            if any(character in reference for character in ('*', '<', '[', ' ')):
                continue
            if not (ROOT / reference).exists():
                errors.append(f'{p.relative_to(ROOT)}: missing repository path {reference}')
    agent_names = []
    for p in sorted((ROOT / '.codex/agents').glob('*.toml')):
        try:
            data = tomllib.loads(p.read_text(encoding='utf-8-sig'))
        except tomllib.TOMLDecodeError as exc:
            errors.append(f'{p.name}: {exc}')
            continue
        if set(data) != {'name', 'description', 'developer_instructions'} or not all(isinstance(v, str) and v for v in data.values()):
            errors.append(f'{p.name}: custom agent schema mismatch')
        if data.get('name') != p.stem:
            errors.append(f'{p.name}: agent name mismatch')
        agent_names.append(data.get('name'))
    if sorted(agent_names) != sorted(inventory['custom_agents']):
        errors.append('Custom agent inventory mismatch')
    tomllib.loads((ROOT / '.codex/config.toml').read_text(encoding='utf-8-sig'))
    bridge = ROOT / '.agents/skills'
    if not bridge.exists() or bridge.resolve() != (ROOT / '.codex/skills').resolve():
        errors.append('Discovery bridge missing or points to a different source')
    archived = ROOT / '.agents/archive/20261008/sources'
    excluded = set(inventory['private_config_excluded'])
    preserved = 0
    for source, expected in inventory['source_manifest'].items():
        if source in excluded or source in {'.gitignore', '.codex/hooks.json', '.codex/hooks.json.graphify-bak'}:
            continue
        p = archived / source
        if not p.exists() or hashlib.sha256(p.read_bytes()).hexdigest() != expected:
            errors.append(f'Preserved source mismatch: {source}')
        else:
            preserved += 1
    summary = {'skills': len(names), 'agents': len(agent_names), 'verified_archived_files': preserved,
               'errors': errors, 'status': 'PASS' if not errors else 'FAIL'}
    return summary

if __name__ == '__main__':
    result = validate()
    print(json.dumps(result, indent=2))
    sys.exit(bool(result['errors']))
