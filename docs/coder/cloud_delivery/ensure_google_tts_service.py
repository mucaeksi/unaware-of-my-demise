"""Enable only the Cloud TTS service needed for the authorized voice samples.

Uses the existing GitHub Google service account in memory. Never logs private
credentials, tokens, provider messages or raw error bodies; does not configure
billing, enable other APIs or change IAM.
"""
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


class EnableError(Exception):
    pass


def call(url, token, body=None):
    headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}
    project = os.environ.get('GOOGLE_CLOUD_QUOTA_PROJECT', '')
    if project:
        if not re.fullmatch(r'[a-z][a-z0-9-]{4,61}[a-z0-9]|[0-9]+', project):
            raise EnableError('GOOGLE_QUOTA_PROJECT_INVALID')
        headers['x-goog-user-project'] = project
    request = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                                    headers=headers,
                                    method='POST' if body is not None else 'GET')
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        try:
            data = json.load(error)
        except (ValueError, OSError):
            data = {}
        return {'_http_error': error.code, '_error_data': data}
    except (urllib.error.URLError, TimeoutError, OSError):
        raise EnableError('GOOGLE_SERVICE_TRANSPORT_FAILED') from None


def main():
    path = Path(__file__).resolve().parent / 'google_tts_service_status.json'
    report = {'at_utc': datetime.now(timezone.utc).isoformat(), 'service': 'texttospeech.googleapis.com',
              'credential_source': 'EXISTING_GOOGLE_PLAY_SERVICE_ACCOUNT',
              'billing_configuration_changed': False, 'iam_configuration_changed': False,
              'other_apis_enabled': False}
    report['requested_quota_project'] = os.environ.get('GOOGLE_CLOUD_QUOTA_PROJECT')
    try:
        if not os.environ.get('GOOGLE_SERVICE_ACCOUNT_JSON'):
            raise EnableError('EXISTING_SERVICE_ACCOUNT_SECRET_UNAVAILABLE')
        import google.oauth2.service_account
        import google.auth.transport.requests
        info = json.loads(os.environ['GOOGLE_SERVICE_ACCOUNT_JSON'])
        report['credential_project_id'] = info.get('project_id')
        # Public IAM principal only; never persist the private key or credential
        # JSON. The owner needs this exact identity to grant project usage.
        email = info.get('client_email', '')
        if isinstance(email, str) and re.fullmatch(r'[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com', email):
            report['credential_service_account_email'] = email
        if info.get('type') != 'service_account' or info.get('token_uri') not in {
                'https://oauth2.googleapis.com/token', 'https://accounts.google.com/o/oauth2/token'}:
            raise EnableError('SERVICE_ACCOUNT_FORMAT_INVALID')
        creds = google.oauth2.service_account.Credentials.from_service_account_info(
            info, scopes=['https://www.googleapis.com/auth/cloud-platform'])
        creds.refresh(google.auth.transport.requests.Request())
        probe = call('https://texttospeech.googleapis.com/v1/voices?languageCode=ja-JP', creds.token)
        if '_http_error' not in probe:
            report['status'] = 'TTS_ALREADY_ENABLED_VOICES_ACCESS_VERIFIED'
        else:
            details = probe.get('_error_data', {}).get('error', {}).get('details', [])
            disabled = next((d for d in details if isinstance(d, dict) and d.get('reason') == 'SERVICE_DISABLED'
                             and d.get('metadata', {}).get('service') == 'texttospeech.googleapis.com'), None)
            if not disabled:
                raise EnableError('TTS_PROBE_HTTP_' + str(probe['_http_error']))
            consumer = disabled['metadata'].get('consumer', '')
            if not re.fullmatch(r'projects/[0-9]+', consumer):
                raise EnableError('TTS_CONSUMER_PROJECT_NOT_VERIFIABLE')
            report['consumer_project'] = consumer
            report['activation_url'] = ('https://console.cloud.google.com/apis/library/'
                                        'texttospeech.googleapis.com?project=' + consumer.split('/')[1])
            operation = call('https://serviceusage.googleapis.com/v1/' + consumer
                             + '/services/texttospeech.googleapis.com:enable', creds.token, {})
            if '_http_error' in operation:
                raise EnableError('TTS_ENABLE_HTTP_' + str(operation['_http_error']))
            name = operation.get('name', '')
            if not re.fullmatch(r'operations/[A-Za-z0-9._/-]+', name):
                raise EnableError('TTS_ENABLE_OPERATION_UNEXPECTED')
            deadline = time.monotonic() + 180
            while not operation.get('done'):
                if time.monotonic() > deadline:
                    raise EnableError('TTS_ENABLE_OPERATION_PENDING')
                time.sleep(3)
                operation = call('https://serviceusage.googleapis.com/v1/' + name, creds.token)
                if '_http_error' in operation:
                    raise EnableError('TTS_ENABLE_POLL_HTTP_' + str(operation['_http_error']))
            if operation.get('error'):
                raise EnableError('TTS_ENABLE_OPERATION_FAILED')
            report['status'] = 'TTS_SERVICE_ENABLE_OPERATION_COMPLETED'
    except EnableError as error:
        report['status'] = 'TTS_SETUP_PENDING'
        report['safe_error_category'] = str(error)
    except Exception as error:
        report['status'] = 'TTS_SETUP_PENDING'
        report['safe_error_category'] = 'OAUTH_OR_RESPONSE_INVALID_' + type(error).__name__
    finally:
        path.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: report.get(k) for k in ['status', 'safe_error_category', 'activation_url']}))
    return 0 if report['status'] != 'TTS_SETUP_PENDING' else 2


if __name__ == '__main__':
    raise SystemExit(main())
