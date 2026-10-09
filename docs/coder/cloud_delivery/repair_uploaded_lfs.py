"""Finish an interrupted, already-uploaded Git LFS transfer in GitHub Actions.

Uses normal batch/verify/download operations; does not upload pointers, disable
hooks, rewrite refs, or move credential/action URLs into logs or reports.
"""
import base64
import hashlib
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


class RepairError(Exception):
    pass


def request(url, headers, body=None):
    if urllib.parse.urlsplit(url).scheme != 'https':
        raise RepairError('NON_HTTPS_ACTION_REJECTED')
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=payload, headers=headers,
                                 method='POST' if body is not None else 'GET')
    try:
        return urllib.request.urlopen(req, timeout=90)
    except urllib.error.HTTPError as error:
        raise RepairError('LFS_HTTP_' + str(error.code)) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise RepairError('LFS_TRANSPORT_FAILED') from None


def batch(operation, objects, headers):
    endpoint = 'https://github.com/mucaeksi/unaware-of-my-demise.git/info/lfs/objects/batch'
    with request(endpoint, headers, {'operation': operation, 'transfers': ['basic'], 'objects': objects}) as r:
        return json.load(r)['objects']


def main():
    here = Path(__file__).resolve().parent
    pending = json.loads((here / 'lfs_pending_objects.json').read_text())
    objects = [{'oid': o['oid'], 'size': o['size']} for o in pending['objects']]
    assert len(objects) == 2 and all(re.fullmatch('[0-9a-f]{64}', o['oid']) and o['size'] > 0 for o in objects)
    previous_path = here / 'lfs_remote_repair.json'
    if previous_path.is_file():
        previous = json.loads(previous_path.read_text())
        expected = {(o['oid'], o['size']) for o in objects}
        verified = {(o['oid'], o['size']) for o in previous.get('objects', [])
                    if o.get('status') == 'REMOTE_BYTES_DOWNLOADED_SHA256_VERIFIED'
                    and o.get('download_sha256') == o['oid'] and o.get('download_bytes') == o['size']}
        if previous.get('status') == 'ALL_PENDING_REMOTE_LFS_BYTES_SHA256_VERIFIED' and verified == expected:
            print('Previous remote SHA256 verification retained for the identical two objects; no repeat download.')
            return 0
    token = os.environ.get('GITHUB_TOKEN')
    report = {'at_utc': datetime.now(timezone.utc).isoformat(), 'objects': [],
              'operation': 'NORMAL_LFS_VERIFY_EXISTING_UPLOAD_AND_DOWNLOAD_HASH',
              'hooks_disabled': False, 'pointers_pushed_without_bytes': False}
    try:
        if not token:
            raise RepairError('REPOSITORY_TOKEN_UNAVAILABLE')
        auth = base64.b64encode(('x-access-token:' + token).encode()).decode()
        headers = {'Authorization': 'Basic ' + auth, 'Accept': 'application/vnd.git-lfs+json',
                   'Content-Type': 'application/vnd.git-lfs+json'}
        offered = batch('upload', objects, headers)
        expected = {o['oid']: o['size'] for o in objects}
        if {o['oid'] for o in offered} != set(expected):
            raise RepairError('LFS_BATCH_OBJECT_SET_MISMATCH')
        for obj in offered:
            row = {'oid': obj['oid'], 'size': expected[obj['oid']], 'status': 'CHECKING_EXISTING_UPLOAD'}
            report['objects'].append(row)
            if obj.get('error'):
                raise RepairError('LFS_BATCH_OBJECT_ERROR')
            action = obj.get('actions', {}).get('verify')
            if action:
                if urllib.parse.urlsplit(action['href']).hostname not in {'lfs.github.com', 'github.com'}:
                    raise RepairError('UNEXPECTED_VERIFY_HOST')
                # The server decides whether the actual uploaded bytes exist.
                # A missing upload fails verification; never pretend it passed.
                with request(action['href'], {**action.get('header', {}),
                             'Content-Type': 'application/vnd.git-lfs+json'},
                             {'oid': obj['oid'], 'size': expected[obj['oid']]}) as response:
                    response.read()
                row['verify_http_succeeded'] = True
        downloads = batch('download', objects, headers)
        if {o['oid'] for o in downloads} != set(expected):
            raise RepairError('LFS_DOWNLOAD_SET_MISMATCH')
        for obj in downloads:
            if obj.get('error') or not obj.get('actions', {}).get('download'):
                raise RepairError('REMOTE_LFS_BYTES_UNAVAILABLE')
            action = obj['actions']['download']
            host = urllib.parse.urlsplit(action['href']).hostname or ''
            if not (host in {'github.com', 'lfs.github.com', 'github-cloud.githubusercontent.com'}
                    or host.endswith('.githubusercontent.com') or host.endswith('.amazonaws.com')):
                raise RepairError('UNEXPECTED_DOWNLOAD_HOST')
            sha = hashlib.sha256()
            count = 0
            with request(action['href'], action.get('header', {})) as response:
                for chunk in iter(lambda: response.read(4 * 1024 * 1024), b''):
                    sha.update(chunk)
                    count += len(chunk)
            if count != expected[obj['oid']] or sha.hexdigest() != obj['oid']:
                raise RepairError('REMOTE_LFS_CONTENT_HASH_OR_SIZE_MISMATCH')
            row = next(r for r in report['objects'] if r['oid'] == obj['oid'])
            row.update({'status': 'REMOTE_BYTES_DOWNLOADED_SHA256_VERIFIED',
                        'download_bytes': count, 'download_sha256': sha.hexdigest()})
        report['status'] = 'ALL_PENDING_REMOTE_LFS_BYTES_SHA256_VERIFIED'
    except RepairError as error:
        report['status'] = 'LFS_REPAIR_PENDING'
        report['safe_error_category'] = str(error)
    except (KeyError, ValueError, TypeError, AssertionError):
        report['status'] = 'LFS_REPAIR_PENDING'
        report['safe_error_category'] = 'LFS_RESPONSE_OR_INPUT_INVALID'
    finally:
        (here / 'lfs_remote_repair.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'status': report['status'], 'safe_error_category': report.get('safe_error_category')}))
    return 0 if report['status'] == 'ALL_PENDING_REMOTE_LFS_BYTES_SHA256_VERIFIED' else 2


if __name__ == '__main__':
    raise SystemExit(main())
