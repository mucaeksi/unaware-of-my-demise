"""Google Cloud Chirp 3 HD authoring only; never imported by the game.

Run with --generate after the owner's sample request. Authentication comes from
GOOGLE_CLOUD_API_KEY (including proxy bindings) or usable Google ADC. No keys,
tokens, provider error bodies or URLs containing credentials are logged.
"""
from __future__ import annotations

import argparse
import array
import base64
import hashlib
import io
import json
import math
import os
import re
import sys
import urllib.error
import urllib.request
import wave
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
DEFAULT_OUT = ROOT / 'narrative/10_VO/Voice_Samples/Chirp3_HD/ja-JP/audition_v001'
API = 'https://texttospeech.googleapis.com/v1/'
VOICE_RE = re.compile(r'^ja-JP-Chirp3-HD-([A-Za-z]+)$')


class AuthoringError(Exception):
    """Contains only a safe error category, never raw provider/auth exceptions."""


def timestamp():
    return datetime.now(timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def canonical(data):
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def save_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def authorization():
    for name in ('GOOGLE_CLOUD_API_KEY', 'GOOGLE_API_KEY'):
        if os.environ.get(name):
            return {'x-goog-api-key': os.environ[name]}, 'API_KEY_BINDING'
    try:
        import google.auth
        import google.auth.transport.requests
        creds, _ = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
        creds.refresh(google.auth.transport.requests.Request())
        headers = {'Authorization': 'Bearer ' + creds.token}
        if creds.quota_project_id:
            headers['x-goog-user-project'] = creds.quota_project_id
        return headers, 'ADC'
    except Exception:
        raise AuthoringError('GOOGLE_AUTH_UNAVAILABLE_CONFIGURE_SECURE_ENVIRONMENT_KEY') from None


def request_json(endpoint, headers, body=None):
    data = canonical(body) if body is not None else None
    req = urllib.request.Request(API + endpoint, data=data, headers={
        **headers, 'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'uomd-chirp3-hd-authoring/1',
    }, method='POST' if body is not None else 'GET')
    try:
        # Preserve inherited proxy and certificate trust. Never bypass the sidecar.
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        raise AuthoringError('GOOGLE_HTTP_' + str(error.code)) from None
    except (urllib.error.URLError, TimeoutError, OSError):
        raise AuthoringError('GOOGLE_TRANSPORT_BLOCKED_OR_TIMED_OUT_NO_AUTOMATIC_RETRY') from None
    except (ValueError, UnicodeError):
        raise AuthoringError('GOOGLE_RESPONSE_NOT_VALID_JSON') from None


def japanese_voices(response):
    result = []
    for voice in response.get('voices', []):
        name = voice.get('name', '')
        if not VOICE_RE.fullmatch(name) or 'ja-JP' not in voice.get('languageCodes', []):
            continue
        gender = voice.get('ssmlGender')
        if gender not in ('FEMALE', 'MALE'):
            raise AuthoringError('CHIRP_GENDER_REQUIRES_REVIEW')
        result.append({'voice_id': name, 'name': VOICE_RE.fullmatch(name).group(1), 'gender': gender})
    result.sort(key=lambda v: (v['gender'], v['name']))
    if not result or len({v['voice_id'] for v in result}) != len(result):
        raise AuthoringError('LIVE_JAPANESE_CHIRP_CATALOG_EMPTY_OR_DUPLICATED')
    return result


def wav_metrics(data):
    try:
        with wave.open(io.BytesIO(data), 'rb') as w:
            if (w.getnchannels(), w.getsampwidth(), w.getframerate()) != (1, 2, 24000):
                raise AuthoringError('WAV_FORMAT_DIFFERS_FROM_REQUEST')
            frame_count = w.getnframes()
            pcm = w.readframes(frame_count)
    except (wave.Error, EOFError):
        raise AuthoringError('INVALID_PROVIDER_WAV') from None
    if len(pcm) != frame_count * 2 or not frame_count:
        raise AuthoringError('EMPTY_OR_TRUNCATED_PROVIDER_WAV')
    samples = array.array('h', pcm)
    if sys.byteorder != 'little':
        samples.byteswap()
    peak = max(abs(n) for n in samples)
    if peak == 0:
        raise AuthoringError('SILENT_PROVIDER_WAV')
    return {'sample_rate_hz': 24000, 'channels': 1, 'bits_per_sample': 16,
            'frames': frame_count, 'duration_seconds': frame_count / 24000,
            'peak_linear': peak / 32768,
            'rms_linear': math.sqrt(sum(n * n for n in samples) / frame_count) / 32768,
            'clipped_sample_fraction': sum(abs(n) >= 32767 for n in samples) / frame_count}


def gallery(out, manifest, plan):
    # Embed data so the gallery opens directly as a local file without fetch/CDNs.
    view = {'text': plan['request_template']['input']['text'], 'status': manifest['status'],
            'voices': manifest.get('voices') or plan['planned_reference_voices']}
    payload = json.dumps(view, ensure_ascii=False).replace('<', '\\u003c')
    html = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chirp 3 HD Japanese voice auditions</title><style>
body{background:#17151d;color:#eee;font:16px system-ui;margin:2rem auto;max-width:1100px;padding:0 1rem}
section{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}
article{background:#292431;border:1px solid #4d415e;border-radius:12px;padding:1rem}audio{width:100%}
button{padding:.6rem;margin:0 .5rem 1rem 0}small{display:block;overflow-wrap:anywhere;color:#c3b5d1}
</style><h1>Chirp 3 HD · ja-JP</h1><p id="text" lang="ja"></p><p id="status"></p>
<p>Same text and settings for every voice. Performance and pause quality await listening review.</p>
<nav><button data-gender="">All</button><button data-gender="FEMALE">Female</button><button data-gender="MALE">Male</button></nav>
<section id="voices"></section><script id="data" type="application/json">PAYLOAD</script><script>
const data=JSON.parse(document.getElementById('data').textContent);
document.getElementById('text').textContent=data.text;document.getElementById('status').textContent=data.status;
const host=document.getElementById('voices');
function render(gender){host.replaceChildren();for(const v of data.voices){if(gender&&v.gender!==gender)continue;
const card=document.createElement('article'),title=document.createElement('h2'),label=document.createElement('small');
title.textContent=v.name+' · '+v.gender;label.textContent=v.voice_id;card.append(title,label);
if(v.status==='GENERATED_WAV_VALIDATED'){const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.src=v.file;card.append(audio);}
else{const pending=document.createElement('p');pending.textContent=v.status||'Pending generation';card.append(pending);}host.append(card);}}
document.querySelectorAll('button').forEach(b=>b.onclick=()=>render(b.dataset.gender));render('');
</script></html>'''.replace('PAYLOAD', payload)
    (out / 'index.html').write_text(html, encoding='utf-8')


def run(out, generate=False, transport=request_json, auth=authorization, retry_uncertain=False):
    plan = json.loads((out / 'audition_plan.json').read_text(encoding='utf-8'))
    manifest_path = out / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {
        'schema_version': 1, 'status': 'PLANNED_NOT_GENERATED', 'synthesis_calls_attempted': 0,
        'voices_list_calls_attempted': 0, 'voices': [], 'errors': [], 'owner_authorized': True,
        'performance_review': 'NOT_LISTENED', 'runtime_integration': False}
    if not generate:
        gallery(out, manifest, plan)
        save_json(manifest_path, manifest)
        return manifest
    template = plan['request_template']
    if set(template) != {'input', 'voice', 'audioConfig'} or set(template['input']) != {'text'}:
        raise AuthoringError('REQUEST_TEMPLATE_CHANGED_REQUIRES_REVIEW')
    common_hash = digest(canonical(template))
    previous = {v['voice_id']: v for v in manifest['voices']}
    try:
        if not retry_uncertain and any(v.get('status') == 'REQUEST_IN_PROGRESS' for v in previous.values()):
            raise AuthoringError('PREVIOUS_CALL_OUTCOME_UNCERTAIN_INSPECT_BEFORE_EXPLICIT_RETRY')
        headers, auth_kind = auth()
        manifest['auth_method'] = auth_kind
        manifest['voices_list_calls_attempted'] += 1
        response = transport('voices?languageCode=ja-JP', headers)
        voices = japanese_voices(response)
        save_json(out / 'voices_live_snapshot.json', {'retrieved_at_utc': timestamp(),
                  'endpoint': API + 'voices', 'language_filter': 'ja-JP', 'response': response})
        rows = []
        for v in voices:
            old = previous.get(v['voice_id'])
            row = {**v, 'status': 'PENDING_GENERATION', 'common_request_sha256': common_hash}
            expected_file = Path(v['gender'].lower()) / (v['voice_id'] + '.wav')
            if old and old.get('status') == 'GENERATED_WAV_VALIDATED' and old.get('common_request_sha256') == common_hash and old.get('file') == expected_file.as_posix():
                file = out / expected_file
                if file.is_file() and digest(file.read_bytes()) == old['sha256']:
                    row = old
            rows.append(row)
        manifest.update({'voices': rows, 'live_catalog_verified_at_utc': timestamp(),
                         'common_request_sha256': common_hash, 'status': 'GENERATING'})
        save_json(manifest_path, manifest)
        for row in rows:
            if row['status'] == 'GENERATED_WAV_VALIDATED':
                continue
            request = {**template, 'voice': {**template['voice'], 'name': row['voice_id']}}
            row['request'] = request
            row['request_sha256'] = digest(canonical(request))
            row['status'] = 'REQUEST_IN_PROGRESS'
            manifest['synthesis_calls_attempted'] += 1
            # Persist before sending: uncertain/failed calls are never automatically retried in this run.
            save_json(manifest_path, manifest)
            response = transport('text:synthesize', headers, request)
            try:
                audio = base64.b64decode(response['audioContent'], validate=True)
            except (KeyError, ValueError, TypeError):
                raise AuthoringError('MISSING_OR_INVALID_AUDIO_CONTENT') from None
            metrics = wav_metrics(audio)
            file = Path(row['gender'].lower()) / (row['voice_id'] + '.wav')
            (out / file).parent.mkdir(parents=True, exist_ok=True)
            temp = (out / file).with_suffix('.wav.tmp')
            temp.write_bytes(audio)
            temp.replace(out / file)
            row.update({'status': 'GENERATED_WAV_VALIDATED', 'file': file.as_posix(),
                        'sha256': digest(audio), 'bytes': len(audio), 'metrics': metrics,
                        'generated_at_utc': timestamp(), 'performance_review': 'PENDING_LISTENING'})
            save_json(manifest_path, manifest)
        manifest['status'] = 'ALL_LIVE_JAPANESE_CHIRP_WAVS_GENERATED_LISTENING_PENDING'
    except AuthoringError as error:
        manifest['status'] = 'BLOCKED_OR_INTERRUPTED'
        manifest['errors'].append({'at_utc': timestamp(), 'category': str(error)})
        raise
    finally:
        manifest['updated_at_utc'] = timestamp()
        manifest['generated_samples'] = sum(v.get('status') == 'GENERATED_WAV_VALIDATED' for v in manifest['voices'])
        save_json(manifest_path, manifest)
        gallery(out, manifest, plan)
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--generate', action='store_true', help='Make the owner-authorized live API sample calls.')
    parser.add_argument('--retry-uncertain', action='store_true', help='Explicitly repeat a previous call with unknown outcome; may incur another charge.')
    args = parser.parse_args()
    # Never run two paid batches concurrently in the same output folder.
    lock = args.out / '.authoring.lock'
    try:
        with lock.open('x'):
            try:
                result = run(args.out, args.generate, retry_uncertain=args.retry_uncertain)
                print(json.dumps({'status': result['status'], 'generated_samples': result.get('generated_samples', 0)}))
            finally:
                lock.unlink(missing_ok=True)
    except FileExistsError:
        print('Another authoring run or stale lock exists; inspect the run before retrying.', file=sys.stderr)
        return 2
    except AuthoringError as error:
        print(str(error), file=sys.stderr)
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
