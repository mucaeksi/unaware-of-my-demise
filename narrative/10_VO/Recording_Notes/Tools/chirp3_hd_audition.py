"""Google Cloud Chirp 3 HD authoring only; never imported by the game.

Run with --generate after the owner's sample request. Authentication comes from
GOOGLE_CLOUD_API_KEY, GOOGLE_API_KEY or GEMINI_API (including proxy bindings),
an existing service account, or usable Google ADC. Credentials are used only
for the authorized audio batch; this tool never generates images. No keys,
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
import urllib.parse
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
    if os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON'):
        try:
            import google.oauth2.service_account
            import google.auth.transport.requests
            info = json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT_JSON'])
            if info.get('type') != 'service_account' or info.get('token_uri') not in {
                    'https://oauth2.googleapis.com/token', 'https://accounts.google.com/o/oauth2/token'}:
                raise ValueError('Unexpected service account credential format')
            credentials = google.oauth2.service_account.Credentials.from_service_account_info(
                info, scopes=['https://www.googleapis.com/auth/cloud-platform'])
            credentials.refresh(google.auth.transport.requests.Request())
            return {'Authorization': 'Bearer ' + credentials.token}, 'EXISTING_GITHUB_SERVICE_ACCOUNT_OAUTH'
        except Exception:
            raise AuthoringError('GOOGLE_SERVICE_ACCOUNT_OAUTH_UNAVAILABLE') from None
    for name in ('GOOGLE_CLOUD_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_API'):
        if os.environ.get(name):
            key = os.environ[name].strip()
            if not key or any(ord(c) <= 32 or ord(c) >= 127 for c in key):
                raise AuthoringError('GOOGLE_API_KEY_BINDING_INVALID_FORMAT')
            return {'x-goog-api-key': key}, 'API_KEY_BINDING'
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
    headers = dict(headers)
    url = API + endpoint
    if 'x-goog-api-key' in headers:
        # Standard Google REST key parameter. Never persist or log this URL.
        key = headers.pop('x-goog-api-key')
        url += ('&' if '?' in url else '?') + urllib.parse.urlencode({'key': key})
    req = urllib.request.Request(url, data=data, headers={
        **headers, 'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'uomd-chirp3-hd-authoring/1',
    }, method='POST' if body is not None else 'GET')
    try:
        # Preserve inherited proxy and certificate trust. Never bypass the sidecar.
        with urllib.request.urlopen(req, timeout=90) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        category = 'GOOGLE_HTTP_' + str(error.code)
        # ErrorInfo enums explain API enablement/restriction failures without
        # logging error messages, request headers or any credential value.
        safe_reasons = {'API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED', 'API_KEY_HTTP_REFERRER_BLOCKED',
                        'API_KEY_IP_ADDRESS_BLOCKED', 'API_KEY_ANDROID_APP_BLOCKED',
                        'API_KEY_IOS_APP_BLOCKED', 'SERVICE_DISABLED', 'BILLING_DISABLED',
                        'CONSUMER_INVALID', 'CREDENTIALS_MISSING', 'ACCESS_TOKEN_EXPIRED',
                        'IAM_PERMISSION_DENIED', 'RATE_LIMIT_EXCEEDED', 'RESOURCE_EXHAUSTED'}
        try:
            details = json.load(error).get('error', {}).get('details', [])
            reason = next((d.get('reason') for d in details if isinstance(d, dict)
                           and d.get('reason') in safe_reasons), None)
            if reason:
                category += '_' + reason
        except (ValueError, OSError, AttributeError):
            pass
        raise AuthoringError(category) from None
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
    view = {'text': plan.get('spoken_text_ja', plan['request_template']['input'].get('text', '')), 'status': manifest['status'],
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


def sync_shared_catalog(out, manifest):
    if manifest['status'] != 'ALL_LIVE_JAPANESE_CHIRP_WAVS_GENERATED_LISTENING_PENDING':
        raise AuthoringError('CATALOG_SYNC_REQUIRES_COMPLETE_LIVE_SAMPLE_SET')
    path = ROOT / 'narrative/10_VO/Line_Maps/chirp3_hd_voice_catalog.json'
    previous = json.loads(path.read_text(encoding='utf-8'))
    package = out.relative_to(ROOT).as_posix()
    voices = manifest['voices']
    counts = {'total': len(voices), 'female': sum(v['gender'] == 'FEMALE' for v in voices),
              'male': sum(v['gender'] == 'MALE' for v in voices)}
    previous.update({'verification_status': 'LIVE_JAPANESE_VOICES_LIST_VERIFIED',
                     'current_completeness_verified': True, 'completeness_scope': 'ja-JP-Chirp3-HD-*',
                     'verification_note': 'Verified using the official Google Cloud voices.list API, languageCode=ja-JP. Sample WAVs are original API output; listening review is pending.',
                     'counts': counts, 'live_api_response': package + '/voices_live_snapshot.json',
                     'live_verified_at': manifest['live_catalog_verified_at_utc'],
                     'api_calls': manifest['voices_list_calls_attempted'] + manifest['synthesis_calls_attempted'],
                     'auditions_generated': manifest['generated_samples'],
                     'audition_status': 'ALL_LIVE_JAPANESE_SAMPLES_GENERATED_LISTENING_PENDING',
                     'audition_package': package,
                     'voices': [{'name': v['name'], 'ssml_gender_reference': v['gender'],
                                 'ja_JP_voice_id_candidate': v['voice_id'],
                                 'ja_JP_availability': 'VERIFIED_LIVE_VOICES_LIST',
                                 'audition_status': 'GENERATED_LISTENING_PENDING',
                                 'sample_file': package + '/' + v['file'],
                                 'sample_sha256': v['sha256'], 'selected_for_characters': []} for v in voices]})
    save_json(path, previous)
    lines = ['# Google Chirp 3 HD · ortak Japonca ses kataloğu', '',
             f'Canlı Google Cloud API ile doğrulandı: **{counts["total"]} ses; {counts["female"]} kadın, {counts["male"]} erkek**.', '',
             f'Canlı liste zamanı (UTC): `{manifest["live_catalog_verified_at_utc"]}`.', '',
             '[Ortak örnek paketi](../../' + package + '/README.md) · '
             '[Dinleme galerisi](../../' + package + '/index.html) · '
             '[Gerçek üretim manifesti](../../' + package + '/manifest.json)', '',
             'Her ses aynı Japonca metin ve 24 kHz mono LINEAR16 ayarlarıyla üretildi. '
             'WAV masterları orijinal API çıktısıdır. Teknik doğrulama tamamlandı; '
             'duygu, duraksama, Japonca performans ve karakter seçimi dinleme aşamasındadır. '
             'Eski Fadyme kayıtları arşivde kalır; oyuna bağlantı yapılmadı.', '']
    for gender, title in [('FEMALE', 'Kadın'), ('MALE', 'Erkek')]:
        lines += ['## ' + title, '', '| İsim | Doğrulanmış Japonca voice ID |', '|---|---|']
        lines += [f'| {v["name"]} | `{v["voice_id"]}` |' for v in voices if v['gender'] == gender]
        lines.append('')
    lines += ['[Makine kataloğu](../../narrative/10_VO/Line_Maps/chirp3_hd_voice_catalog.json). '
              'Kapsam, bu API yanıtındaki Japonca Chirp 3 HD sesleridir; başka locale veya '
              'Gemini TTS listelerinden kullanılabilirlik çıkarılmadı.', '']
    (ROOT / 'docs/art/CHIRP3_HD_VOICE_CATALOG.md').write_text('\n'.join(lines), encoding='utf-8')


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
    if set(template) != {'input', 'voice', 'audioConfig'} or set(template['input']) not in ({'text'}, {'ssml'}):
        raise AuthoringError('REQUEST_TEMPLATE_CHANGED_REQUIRES_REVIEW')
    if 'ssml' in template['input'] and plan.get('ssml_verification_status') != 'OFFICIAL_SYNCHRONOUS_PREVIEW_SUPPORTED':
        raise AuthoringError('SSML_PROVIDER_CAPABILITY_NOT_VERIFIED')
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
    parser.add_argument('--sync-shared-catalog', action='store_true', help='After complete generation, update the shared catalog using the verified live list.')
    args = parser.parse_args()
    # Never run two paid batches concurrently in the same output folder.
    lock = args.out / '.authoring.lock'
    try:
        with lock.open('x'):
            try:
                result = run(args.out, args.generate, retry_uncertain=args.retry_uncertain)
                if args.sync_shared_catalog:
                    sync_shared_catalog(args.out, result)
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
