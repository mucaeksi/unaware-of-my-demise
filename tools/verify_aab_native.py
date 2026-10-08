"""Fail if an Android export silently omits the native bridge or its libraries."""
import argparse
import json
import zipfile
from pathlib import Path

CLASSES = (
    'Lio/github/mucaeksi/uomd/UomdNative;',
    'Lio/github/mucaeksi/uomd/GoogleSignIn;',
    'Lio/github/mucaeksi/uomd/PlayBilling;',
    'Lio/github/mucaeksi/uomd/RewardedAds;',
    'Landroidx/credentials/CredentialManager;',
    'Lcom/google/android/libraries/identity/googleid/GetGoogleIdOption;',
    'Lcom/android/billingclient/api/BillingClient;',
    'Lcom/google/android/gms/ads/MobileAds;',
    'Lcom/google/android/ump/UserMessagingPlatform;',
)
METADATA = ('org.godotengine.plugin.v2.UomdNative', 'io.github.mucaeksi.uomd.UomdNative', 'com.google.android.gms.ads.APPLICATION_ID')

def verify(path: Path) -> dict:
    with zipfile.ZipFile(path) as archive:
        dex = [archive.read(name) for name in archive.namelist() if name.startswith('base/dex/') and name.endswith('.dex')]
        if not dex or any(not data.startswith(b'dex\n') for data in dex):
            raise ValueError('DEX files missing or invalid')
        manifest = archive.read('base/manifest/AndroidManifest.xml')
    absent = [name for name in CLASSES if not any(name.encode() in data for data in dex)]
    absent += [name for name in METADATA if name.encode() not in manifest]
    if absent:
        raise ValueError('Required native classes/manifest registration missing: ' + ', '.join(absent))
    return {'status':'passed', 'dex_files':len(dex), 'class_descriptors':list(CLASSES), 'manifest_metadata':list(METADATA), 'scope':'Packaging evidence; Android device invocation still pending'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('bundle', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    report = verify(args.bundle)
    if args.report:
        args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report))
