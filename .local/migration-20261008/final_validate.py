import collections
import datetime
import hashlib
import json
import pathlib
import re
import subprocess
import xml.etree.ElementTree as ET

ROOT = pathlib.Path('F:/unaware-of-my-demise')
OUT = ROOT / '.local/migration-20261008'
baseline = json.loads((OUT / 'copied-files.json').read_text(encoding='utf-8'))
SOURCE = pathlib.Path(baseline['source'])
allowed = {'.codex/standards/authority.md', '.gitattributes', '.gitignore', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'docs/PROJECT_MAP.md', 'GODOT_AI_READY.md'}
def digest(path):
    with path.open('rb') as handle:
        return hashlib.file_digest(handle, 'sha256').hexdigest()

changed, source_changed, missing = [], [], []
for entry in baseline['files']:
    src, dst = SOURCE / entry['source'], ROOT / entry['destination']
    if not src.is_file() or digest(src) != entry['sha256']:
        source_changed.append(entry['source'])
    if not dst.is_file():
        missing.append(entry['destination'])
    elif digest(dst) != entry['sha256']:
        changed.append(entry['destination'])

extras = []
for rel in ['build/current-aab-20261008-221217-9ccfb2c4/base-privacy-acceptance.json', 'build/current-aab-20261008-221217-9ccfb2c4/source-rebuild-acceptance.json', 'game/android/plugins/uomd_native/src/main/res/values/uomd_admob.xml']:
    extras.append({'path': rel, 'bytes': (ROOT / rel).stat().st_size, 'sha256': digest(ROOT / rel), 'source_matches': digest(ROOT / rel) == digest(SOURCE / rel)})

raw = subprocess.check_output(['git', 'ls-files', '--stage', '-z'], cwd=ROOT).decode('utf-8')
index = {}
for record in raw.rstrip('\0').split('\0'):
    meta, path = record.split('\t', 1)
    mode, oid, stage = meta.split()
    index[path] = (mode, oid)
forbidden = [p for p in index if p.startswith(('.local/', '.git/', 'release/', 'build/', 'graphify-out/', '.agents/skills/', 'game/.godot/', 'game/android/build/', 'game/addons/uomd_native/bin/')) or p.endswith(('.aab', '.apk', '.apks', '.keystore', '.jks', '.p12', '.key')) or (pathlib.PurePosixPath(p).name.startswith('.env') and pathlib.PurePosixPath(p).name != '.env.example')]
patterns = [re.compile(rb'AIza[0-9A-Za-z_-]{30,}'), re.compile(rb'gh[pousr]_[0-9A-Za-z]{25,}'), re.compile(rb'github_pat_[0-9A-Za-z_]{35,}'), re.compile(rb'sk-proj-[0-9A-Za-z_-]{30,}'), re.compile(rb'xox[baprs]-[0-9A-Za-z-]{20,}'), re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')]
suspects, archived_mismatches = [], []
largest = []
pipe = subprocess.Popen(['git', 'cat-file', '--batch'], cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
for path, (mode, oid) in index.items():
    pipe.stdin.write((oid + '\n').encode('ascii'))
    pipe.stdin.flush()
    header = pipe.stdout.readline().decode('ascii').split()
    size = int(header[2])
    blob = pipe.stdout.read(size)
    assert pipe.stdout.read(1) == b'\n'
    largest.append((size, path))
    scan_blob = blob
    if path == 'tools/tests/test_materialize_aab.py':
        # Existing negative test passes an invalid one-character private-key literal.
        scan_blob = scan_blob.replace(b'-----BEGIN PRIVATE KEY-----\\na\\n-----END PRIVATE KEY-----', b'synthetic-invalid-key-negative-test')
    if size < 16_000_000 and b'\0' not in blob[:8192] and any(pattern.search(scan_blob) for pattern in patterns):
        suspects.append(path)
    if path.startswith('.agents/archive/') and hashlib.sha256(blob).hexdigest() != digest(ROOT / path):
        archived_mismatches.append(path)
pipe.stdin.close()
assert pipe.wait() == 0
mode_failures = [p for p in baseline['executable_paths'] if index.get(p, (None,))[0] != '100755']

junit = ET.parse(OUT / 'gut-junit.xml').getroot()
suites = {suite.attrib['name'] for suite in junit.findall('testsuite')}
missing_tests = [p.relative_to(ROOT / 'game').as_posix() for p in (ROOT / 'game/tests').rglob('test_*.gd') if p.relative_to(ROOT / 'game').as_posix() not in suites]
test_log = (OUT / 'gut.log').read_text(encoding='utf-8', errors='replace')
result = {
    'timestamp_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'copied_files': baseline['count'], 'copied_bytes': baseline['bytes'], 'extra_exact_copies': extras,
    'missing_copies': missing, 'original_source_changes': source_changed,
    'intentional_document_policy_updates': changed, 'unexpected_changed_copies': sorted(set(changed) - allowed),
    'staged_files': len(index), 'largest_staged_files': sorted(largest, reverse=True)[:5],
    'forbidden_staged_paths': forbidden, 'credential_like_content_paths': suspects,
    'reviewed_invalid_key_test_literal': 'tools/tests/test_materialize_aab.py:61',
    'archived_git_blob_byte_mismatches': archived_mismatches,
    'preserved_executable_modes': len(baseline['executable_paths']), 'executable_mode_failures': mode_failures,
    'gut_tests': int(junit.attrib['tests']), 'gut_failures': int(junit.attrib['failures']),
    'gut_missing_test_scripts': missing_tests, 'gut_script_error': 'SCRIPT ERROR' in test_log,
    'private_config_copied': (ROOT / '.local/audio-authoring.cfg').exists(),
    'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT).decode().strip(),
    'working_tree_changes_after_staging': subprocess.check_output(['git', 'diff', '--name-only'], cwd=ROOT).decode().splitlines(),
    'commit_created': False, 'push_performed': False,
}
bad = missing or source_changed or result['unexpected_changed_copies'] or forbidden or suspects or archived_mismatches or mode_failures or missing_tests or result['gut_failures'] or result['gut_script_error'] or result['private_config_copied'] or not all(e['source_matches'] for e in extras)
result['status'] = 'FAIL' if bad else 'PASS'
(OUT / 'final-validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False, indent=2))
raise SystemExit(bool(bad))
