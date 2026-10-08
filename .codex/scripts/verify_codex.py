"""Use a fresh installed Codex app-server to verify real skill discovery, without a chat/model turn."""
import argparse
import collections
import json
import os
from pathlib import Path
import queue
import shutil
import subprocess
import threading
import time

class Server:
    def __init__(self, root):
        binary = shutil.which('codex')
        if not binary:
            raise RuntimeError('Installed Codex executable unavailable')
        self.process = subprocess.Popen([binary, 'app-server', '--strict-config', '--stdio'], cwd=root,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            text=True, encoding='utf-8', creationflags=0x08000000 if os.name == 'nt' else 0)
        self.messages = queue.Queue()
        self.errors = []
        self.seq = 0
        def read_stdout():
            for line in self.process.stdout:
                try:
                    self.messages.put(json.loads(line))
                except ValueError:
                    pass
        def read_stderr():
            for line in self.process.stderr:
                self.errors.append(line)
        threading.Thread(target=read_stdout, daemon=True).start()
        threading.Thread(target=read_stderr, daemon=True).start()
        self.call('initialize', {'clientInfo': {'name': 'uomd_system_verify', 'version': '1'},
                                  'capabilities': {'experimentalApi': True}})
        self.process.stdin.write(json.dumps({'method': 'initialized'}) + '\n')
        self.process.stdin.flush()

    def call(self, method, params):
        self.seq += 1
        request_id = self.seq
        self.process.stdin.write(json.dumps({'id': request_id, 'method': method, 'params': params}) + '\n')
        self.process.stdin.flush()
        deadline = time.monotonic() + 50
        while time.monotonic() < deadline:
            try:
                response = self.messages.get(timeout=1)
            except queue.Empty:
                if self.process.poll() is not None:
                    raise RuntimeError('Fresh Codex app-server exited before responding')
                continue
            if response.get('id') == request_id:
                if 'error' in response:
                    raise RuntimeError(response['error'])
                return response['result']
        raise TimeoutError(method)

    def close(self):
        self.process.stdin.close()
        try:
            self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.process.terminate()
            self.process.wait(timeout=5)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[2]
    inventory = json.loads((root / '.agents/library/migration-inventory.json').read_text(encoding='utf-8'))
    server = Server(root)
    try:
        discovered = server.call('skills/list', {'cwds': [str(root)], 'forceReload': True})
    finally:
        server.close()
    rows = discovered.get('data', [])
    skills = [s for row in rows for s in row.get('skills', [])]
    counts = collections.Counter(s['name'] for s in skills)
    missing = [n for n in inventory['active_skills'] if counts[n] != 1]
    duplicates = {n: count for n, count in counts.items() if count > 1}
    errors = [e for row in rows for e in row.get('errors', [])]
    result = {'installed_codex': subprocess.check_output([shutil.which('codex'), '--version'], text=True).strip(),
              'expected_project_skills': len(inventory['active_skills']), 'discovered_skills': len(skills),
              'missing_or_repeated_project_skills': missing, 'duplicate_names': duplicates,
              'parser_errors': errors, 'status': 'PASS' if rows and not missing and not duplicates and not errors else 'FAIL',
              'discovery': discovered}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in result.items() if k != 'discovery'}, indent=2))
    raise SystemExit(result['status'] != 'PASS')

if __name__ == '__main__':
    main()
