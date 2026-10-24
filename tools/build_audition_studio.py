"""Build the local interactive Prologue Soundtrack + 3-Character (Narrator, Fadyme, Mahmut)
Casting & Live Web-Audio Voice Manipulation Studio at `.cache/audition/index.html`.
"""
from __future__ import annotations

import io
import json
import subprocess
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / 'narrative/10_VO/Voice_Samples/Chirp3_HD/ja-JP/audition_v001/manifest.json'
JP_PROLOGUE_PATH = ROOT / 'narrative/10_VO/Line_Maps/jp_script_prologue.json'
MASTER_SCRIPT_PATH = ROOT / 'narrative/10_VO/Line_Maps/jp_script_vertical_slice_master.json'
OUT_DIR = ROOT / '.cache/audition'

SCENE_STILLS = {
    'hours': '/content/base/art/still_prologue_hours.webp',
    'names': '/content/base/art/still_prologue_names.webp',
    'ordinary_days': '/content/base/art/still_prologue_days.webp',
    'throne_wars': '/content/base/art/still_prologue_wars.webp',
    'crownfall': '/content/base/art/still_prologue_crownfall.webp',
    'roads': '/content/base/art/still_prologue_aftermath.webp',
    'search': '/content/base/art/still_prologue_search.webp',
    'reunion': '/content/base/art/still_prologue_reunion.webp',
    'beginning': '/content/base/art/still_prologue_beginning.webp',
}

SCENE_SCORE_NOTES = {
    'hours': 'Act I (E Minor) · Veyrhold Bronze Tower Bell tolls (0.35s & 6.1s) + warm acoustic harp, nylon guitar & alto flute.',
    'names': 'Act I (E Minor) · The Ledger Memory Motif on intimate felt piano & harp over warm pastoral strings.',
    'ordinary_days': 'Act I -> Act II Bridge · Warm chamber cello glow (26s-33s), darkening into a low cello shadow at 33s ("Until the day people began to lose them").',
    'throne_wars': 'Act II (E Minor Uneasy) · Distant low war-bell (38.2s), detuned pad, bowed double-bass & rising muffled frame-drum heartbeat pulses.',
    'crownfall': 'Act II Climax (Crownfall) · Heavy tragic funeral bell strike + sub-bass impact at 50.0s, surging into chaotic string tremolo & brass swells.',
    'roads': 'Act II Aftermath (Quiet Sorrow) · War drums drop out; weeping solo cello elegy & smoky mist pad pivot from E minor to D minor at 1:17 ("Home was not").',
    'search': 'Act III (D Minor, 73.8 BPM, 3/4) · Mahmut’s steady walking low-cello motif + Fadyme’s Theme intimate felt-piano broken-chord arpeggios.',
    'reunion': 'Act III Blossom · Fadyme’s crystalline Silver Pilgrim Bell chimes at 1:36, blossoming into the full felt-piano & solo cello duet.',
    'beginning': 'Act III Finale · Veyrhold Bronze Bell & Fadyme’s Silver Bell answer each other at 1:51.5 ("The bells still ring"), resolving into a warm D-minor cadence at 2:00.',
}

ROLE_NOTES = {
    'narrator': {
        'Algieba': (1, '🔒 KİLİTLENEN RESMİ SES · NARRATOR (ALGIEBA)', 'Kanonik olarak kilitlenen resmi Narrator sesi (93.4 Hz F0). Katalogdaki en derin bas-bariton tını; "Crownfall" yıkımı ve karanlık gotik kronik anlatımı için seçildi.'),
        'Charon': (2, 'NARRATOR ADAYI #2 · DERİN & KADİFEMSİ BARİTON', 'Sıcak ve kadifemsi koyu bariton tını (915 Hz centroid, 125.3 Hz F0, 7.49 sn sakin tempo).'),
        'Umbriel': (3, 'NARRATOR ADAYI #3 · EN AĞIRBAŞLI & DİNGİN TEMPO', 'Erkek sesler arasında sakin, acele etmeyen anlatım temposu (8.20 sn, 143.7 Hz F0).'),
        'Alnilam': (4, 'NARRATOR ADAYI #4 · NÖTR & DENGELİ BARİTON', 'Temiz, nötr, sıcak ve abartısız bariton (145.5 Hz F0, 947 Hz sıcak tını).'),
        'Fenrir': (5, 'NARRATOR ADAYI #5 · OLGUN & YAŞANMIŞLIK HİSSİ', 'Sakin ve ağırbaşlı tempo (7.75 sn, 150.0 Hz F0).'),
        'Pulcherrima': (6, 'KADIN NARRATOR #1 · DERİN KONTRALTO', 'Kadın sesler arasındaki en pes, olgun ve sıcak kontralto tını (152.9 Hz F0, 1038 Hz sıcak tını).'),
        'Gacrux': (7, 'KADIN NARRATOR #2 · SAKİN & EDEBİ ALTO', 'Düşük perdeli, ağırbaşlı ve edebi kadın alto sesi (166.7 Hz F0, 7.63 sn sakin tempo).'),
        'Vindemiatrix': (8, 'KADIN NARRATOR #3 · YUMUŞAK & HÜZÜNLÜ', 'Yumuşak, karanlık-sıcak tınılı (1077 Hz centroid, 7.47 sn) dingin kadın anlatıcı adayı.'),
    },
    'fadyme': {
        'Sulafat': (1, '🔒 KİLİTLENEN RESMİ SES · FADYME (SULAFAT)', 'Kanonik olarak kilitlenen resmi Fadyme sesi (252.6 Hz). Kibar, kontrollü, zarif gotik alto; "Ben iyiyim" maskesini, ince alaycılığı ("wry") ve gizli kırılganlığı taşır.'),
        'Vindemiatrix': (2, 'FADYME ADAYI #2 · SICAK & İÇTEN MASKE', '250.0 Hz perde ve 1077 Hz ile çok yumuşak, buğulu ve sıcak-karanlık tını.'),
        'Aoede': (3, 'FADYME ADAYI #3 · SAKİN & ARİSTOKRATİK NEZAKET', '247.4 Hz perde ve 8.20 sn ile sakin, ölçülü ve zarif kadın performansı.'),
        'Despina': (4, 'FADYME ADAYI #4 · DİNGİN & YUMUŞAK ALTO', '260.9 Hz perde, 8.00 sn ağırbaşlı tempo ve 1163 Hz kadifemsi tını.'),
        'Zephyr': (5, 'FADYME ADAYI #5 · İNCE MİZAH ("WRY") & HAFİF TON', '260.9 Hz perde, 7.55 sn tempo ve 1124 Hz sıcak-berrak denge.'),
        'Laomedeia': (6, 'FADYME ADAYI #6 · ÖLÇÜLÜ & SESSİZ GÜÇ', '263.7 Hz perde, 7.72 sn sakin tempo ve 1137 Hz yumuşak gövde.'),
        'Autonoe': (7, 'FADYME ADAYI #7 · NET & KARARLI ("RESOLVE")', '260.9 Hz perde, 7.17 sn tempo; çanını kaldırıp uyarı yaptığı "Resolve" anlarında berrak duruş.'),
        'Gacrux': (8, 'FADYME ADAYI #8 · DAHA OLGUN / PES ALTO', '166.7 Hz perde; daha pes alto ses rengi.'),
    },
    'mahmut': {
        'Iapetus': (1, '🔒 KİLİTLENEN RESMİ SES · MAHMUT (IAPETUS)', 'Kanonik olarak kilitlenen resmi Mahmut sesi (144.6 Hz perde, 7.10 sn net ve kısa cümle temposu). 28 yaşındaki yorgun ama sarsılmaz muhafız şövalye; Narrator (Algieba 93.4 Hz) ile kusursuz frekans ayrımına sahiptir.'),
        'Enceladus': (2, 'MAHMUT ADAYI #2 · TOK & AZ KONUŞAN ("SHORT, PLAIN")', '133.3 Hz tok bariton perde, 979 Hz sıcak göğüs tınısı ve 6.88 sn doğrudan konuşma temposu.'),
        'Sadachbia': (3, 'MAHMUT ADAYI #3 · SAKİN, KORUYUCU & KURU MİZAH', '151.9 Hz perde, 7.06 sn kontrollü tempo.'),
        'Sadaltager': (4, 'MAHMUT ADAYI #4 · SICAK & YORGUN YOL ARKADAŞI', '156.9 Hz perde ve 964 Hz koyu/sıcak tını.'),
        'Zubenelgenubi': (5, 'MAHMUT ADAYI #5 · SERT & KISA CÜMLELİ MUHAFIZ', '154.8 Hz perde, 902 Hz çok tok/koyu gövde ve 6.78 sn keskin, kısa cümle temposu.'),
        'Alnilam': (6, 'MAHMUT ADAYI #6 · SAKİN & SARSILMAZ BARİTON', '145.5 Hz perde, 947 Hz sıcak tını.'),
        'Orus': (7, 'MAHMUT ADAYI #7 · GENÇ / DİNAMİK ŞÖVALYE', '173.9 Hz daha genç/dinamik bariton-tenor.'),
        'Charon': (8, 'MAHMUT ADAYI #8 · DERİN BARİTON', '125.3 Hz kadifemsi derin bariton.'),
    },
}

FADYME_ARCHIVE_LINES = [
    {
        'id': 'opening_004',
        'title': 'Fadyme (Spoken · Soft Smile Maskesi)',
        'en': 'Then it is a feast. I am perfectly fine.',
        'ja': 'なら、ごちそうね。私は、まったく平気よ。',
        'git_path': 'narrative/13_Archive/fadyme_voice_sulafat_2026-10-09/narrative/10_VO/Japanese/Fadyme/fadyme/opening_004.ogg',
        'out_rel': 'fadyme_lines/opening_004.ogg',
    },
    {
        'id': 'opening_006',
        'title': 'Fadyme (Spoken · Wry / Deflecting)',
        'en': 'The cold has found my fingers. It has not found the rest of me.',
        'ja': '寒さが、指先を見つけただけ。ほかのところまでは、見つけられていないわ。',
        'git_path': 'narrative/13_Archive/fadyme_voice_sulafat_2026-10-09/narrative/10_VO/Japanese/Fadyme/fadyme/opening_006.ogg',
        'out_rel': 'fadyme_lines/opening_006.ogg',
    },
    {
        'id': 'opening_012',
        'title': 'Fadyme (Spoken · Composed)',
        'en': 'Do you know her?',
        'ja': 'あの人を、知っているの？',
        'git_path': 'narrative/13_Archive/fadyme_voice_sulafat_2026-10-09/narrative/10_VO/Japanese/Fadyme/fadyme/opening_012.ogg',
        'out_rel': 'fadyme_lines/opening_012.ogg',
    },
    {
        'id': 'opening_001',
        'title': 'Fadyme (jp_inner · İç Ses / Düşünce)',
        'en': 'If I wake before the bell tomorrow, I will call it luck. If I do not... Mahmut must never read this page.',
        'ja': '明日、鐘より先に目が覚めたなら……運が良かったと思うことにする。もし覚めなかったら……マフムトには、このページを決して読ませない。',
        'git_path': 'narrative/13_Archive/fadyme_voice_sulafat_2026-10-09/narrative/10_VO/Japanese/Fadyme/fadyme_thought/opening_001.ogg',
        'out_rel': 'fadyme_lines/opening_001.ogg',
    },
    {
        'id': 'opening_002',
        'title': 'Fadyme (jp_inner · İç Ses / Kırılgan)',
        'en': "One month, perhaps less. The old physician wrote it in Mother's prayer book. The ink does not tremble. I do.",
        'ja': '一か月。もっと短いかもしれない。老医師は、お母様の祈祷書にそう書いた。インクは震えていない。震えているのは、私。',
        'git_path': 'narrative/13_Archive/fadyme_voice_sulafat_2026-10-09/narrative/10_VO/Japanese/Fadyme/fadyme_thought/opening_002.ogg',
        'out_rel': 'fadyme_lines/opening_002.ogg',
    },
]


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    jp_prologue = json.loads(JP_PROLOGUE_PATH.read_text(encoding='utf-8'))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    fadyme_demos = []
    for item in FADYME_ARCHIVE_LINES:
        raw = subprocess.check_output(['git', 'show', f'origin/archive/pre-cleanup-2026-10-10:{item["git_path"]}'])
        dest = OUT_DIR / item['out_rel']
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        fadyme_demos.append({
            'id': item['id'],
            'title': item['title'],
            'en': item['en'],
            'ja': item['ja'],
            'file': '/content/audition/' + item['out_rel'],
        })

    voices_data = []
    for v in manifest['voices']:
        rel = 'narrative/10_VO/Voice_Samples/Chirp3_HD/ja-JP/audition_v001/' + v['file']
        raw = subprocess.check_output(['git', 'show', f'origin/archive/pre-cleanup-2026-10-10:{rel}'])
        dest = OUT_DIR / v['file']
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)
        with wave.open(io.BytesIO(raw), 'rb') as w:
            sr = w.getframerate()
            x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
        frame_len = int(0.04 * sr)
        hop = int(0.015 * sr)
        f0s = []
        centroids = []
        freqs = np.fft.rfftfreq(frame_len, 1.0 / sr)
        for i in range(0, len(x) - frame_len, hop):
            seg = x[i:i + frame_len]
            if np.sqrt(np.mean(seg ** 2)) < 0.04:
                continue
            spec = np.abs(np.fft.rfft(seg * np.hanning(frame_len)))
            centroids.append(float(np.sum(freqs * spec) / (np.sum(spec) + 1e-9)))
            corr = np.correlate(seg, seg, mode='full')[frame_len - 1:]
            min_lag, max_lag = int(sr / 340.0), int(sr / 70.0)
            lag = min_lag + int(np.argmax(corr[min_lag:max_lag]))
            if corr[lag] > 0.35 * corr[0]:
                f0s.append(sr / lag)
        med_f0 = round(float(np.median(f0s)), 1) if f0s else 0.0
        med_cent = int(round(float(np.median(centroids)), 0)) if centroids else 0
        dur = round(v['metrics']['duration_seconds'], 2)

        roles_meta = {}
        for role_key, role_map in ROLE_NOTES.items():
            if v['name'] in role_map:
                rk, badge, note_tr = role_map[v['name']]
                roles_meta[role_key] = {'rank': rk, 'badge': badge, 'note_tr': note_tr, 'recommended': True}
            else:
                roles_meta[role_key] = {
                    'rank': 50,
                    'badge': '',
                    'note_tr': f'Google Chirp 3 HD doğrulanmış {v["gender"]} Japonca ses profili ({med_f0} Hz ortalama perde, {dur} sn okuma süresi). Üstteki Ses Laboratuvarından ton/perde ve gövde rengiyle farklı karakterlere uyarlanabilir.',
                    'recommended': False,
                }

        voices_data.append({
            'name': v['name'],
            'voice_id': v['voice_id'],
            'gender': v['gender'],
            'file': '/content/audition/' + v['file'],
            'f0_hz': med_f0,
            'duration_s': dur,
            'centroid_hz': med_cent,
            'roles': roles_meta,
        })

    master_script = json.loads(MASTER_SCRIPT_PATH.read_text(encoding='utf-8'))

    scenes_data = []
    for line in jp_prologue['lines']:
        sid = line['scene_id']
        scenes_data.append({
            **line,
            'still': SCENE_STILLS[sid],
            'score_note': SCENE_SCORE_NOTES[sid],
        })

    payload = json.dumps({
        'bgm_url': '/content/base/audio/bgm_prologue_before_the_road.ogg',
        'scenes': scenes_data,
        'voices': voices_data,
        'fadyme_demos': fadyme_demos,
        'script_lines': master_script['lines'],
    }, ensure_ascii=False)

    html = f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>UOMD · Prologue 2:00 Müzik & Japonca Ses (Narrator / Fadyme / Mahmut) + Tonlama Laboratuvarı</title>
<style>
  :root {{
    --bg: #0c0812;
    --panel: rgba(24, 16, 34, 0.90);
    --border: rgba(212, 178, 108, 0.35);
    --gold: #e3c37d;
    --lilac: #c9b6e4;
    --text: #f3ece0;
    --dim: #a89bb9;
    --crimson: #d86c78;
    --emerald: #7bc9a6;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: radial-gradient(circle at 50% 0%, #1d122b 0%, #09050e 75%);
    color: var(--text);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    padding: 22px;
    max-width: 1440px;
    margin-inline: auto;
  }}
  header {{
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 22px;
  }}
  h1 {{
    margin: 0;
    font-size: 25px;
    color: var(--gold);
    letter-spacing: 0.8px;
  }}
  .sub {{
    color: var(--dim);
    font-size: 13.5px;
    margin-top: 4px;
    line-height: 1.45;
  }}
  .top-links {{
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }}
  .top-links a {{
    display: inline-block;
    padding: 10px 18px;
    border-radius: 999px;
    background: rgba(227, 195, 125, 0.14);
    border: 1px solid var(--gold);
    color: var(--gold);
    text-decoration: none;
    font-weight: 600;
    font-size: 13.5px;
  }}
  .studio-grid {{
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 20px;
    margin-bottom: 24px;
  }}
  @media (max-width: 1024px) {{
    .studio-grid {{ grid-template-columns: 1fr; }}
  }}
  .card {{
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 18px 20px;
    box-shadow: 0 14px 36px rgba(0,0,0,0.45);
    margin-bottom: 22px;
  }}
  .stage-preview {{
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 9;
    border-radius: 14px;
    overflow: hidden;
    background: #050308;
    border: 1px solid rgba(227, 195, 125, 0.3);
  }}
  .stage-preview img {{
    width: 100%;
    height: 100%;
    object-fit: cover;
  }}
  .stage-overlay {{
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 18px 22px;
    background: linear-gradient(180deg, rgba(5,3,10,0.72) 0%, rgba(5,3,10,0.05) 35%, rgba(5,3,10,0.12) 58%, rgba(5,3,10,0.92) 100%);
  }}
  .stage-caption {{
    text-align: center;
    color: var(--gold);
    font-weight: 700;
    letter-spacing: 4px;
    font-size: 15px;
    text-transform: uppercase;
  }}
  .stage-subtitles {{ text-align: center; }}
  .stage-en {{
    font-size: 16.5px;
    line-height: 1.45;
    color: #fff;
    margin-bottom: 6px;
    text-shadow: 0 2px 6px #000;
  }}
  .stage-ja {{
    font-size: 14.5px;
    line-height: 1.45;
    color: var(--lilac);
    text-shadow: 0 2px 6px #000;
  }}
  .bgm-controls {{
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}
  audio {{ width: 100%; height: 38px; }}
  .score-pill {{
    background: rgba(201, 182, 228, 0.1);
    border-left: 3px solid var(--gold);
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13px;
    color: var(--lilac);
  }}
  .scene-list {{
    display: flex;
    flex-direction: column;
    gap: 7px;
    max-height: 470px;
    overflow-y: auto;
    padding-right: 4px;
  }}
  .scene-item {{
    display: grid;
    grid-template-columns: 76px 1fr;
    gap: 10px;
    align-items: center;
    padding: 8px 12px;
    border-radius: 11px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    cursor: pointer;
  }}
  .scene-item:hover, .scene-item.active {{
    background: rgba(227, 195, 125, 0.14);
    border-color: var(--gold);
  }}
  .scene-time {{
    font-family: monospace;
    font-size: 12px;
    color: var(--gold);
    font-weight: 700;
  }}
  .scene-title {{ font-weight: 700; font-size: 13.5px; color: var(--text); }}
  .scene-ja-mini {{ font-size: 12px; color: var(--dim); margin-top: 2px; }}

  /* Voice Shaper Lab */
  .lab-box {{
    background: linear-gradient(135deg, rgba(40, 24, 58, 0.92) 0%, rgba(19, 12, 30, 0.95) 100%);
    border: 1px solid var(--gold);
    border-radius: 16px;
    padding: 16px 20px;
    margin-bottom: 20px;
  }}
  .lab-sliders {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 16px;
    margin-top: 14px;
  }}
  .slider-group {{
    background: rgba(0,0,0,0.28);
    border: 1px solid rgba(201,182,228,0.2);
    border-radius: 12px;
    padding: 10px 14px;
  }}
  .slider-head {{
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    color: var(--gold);
    margin-bottom: 6px;
  }}
  .slider-group input[type=range] {{
    width: 100%;
    accent-color: var(--gold);
    cursor: pointer;
  }}
  .slider-hint {{
    font-size: 11.5px;
    color: var(--dim);
    margin-top: 4px;
  }}
  .preset-row {{
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
    align-items: center;
  }}
  button.preset-btn {{
    background: rgba(227, 195, 125, 0.12);
    color: var(--gold);
    border: 1px solid rgba(227, 195, 125, 0.45);
    padding: 6px 13px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 12.5px;
    font-weight: 600;
  }}
  button.preset-btn:hover, button.preset-btn.active {{
    background: var(--gold);
    color: #120a18;
  }}

  /* Role Tabs */
  .role-tabs {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 12px;
    margin-bottom: 18px;
  }}
  .role-tab {{
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 14px;
    background: rgba(30, 20, 44, 0.85);
    border: 1px solid rgba(201, 182, 228, 0.25);
    cursor: pointer;
    text-align: left;
    color: var(--text);
    transition: all 0.18s ease;
  }}
  .role-tab.active {{
    background: linear-gradient(135deg, rgba(68, 46, 32, 0.72) 0%, rgba(36, 22, 52, 0.95) 100%);
    border-color: var(--gold);
    box-shadow: 0 0 0 1px var(--gold);
  }}
  .role-tab img {{
    width: 54px;
    height: 54px;
    border-radius: 50%;
    object-fit: cover;
    object-position: top center;
    border: 2px solid var(--gold);
    background: #120a18;
    flex-shrink: 0;
  }}
  .role-tab-title {{ font-size: 15.5px; font-weight: 700; color: var(--gold); }}
  .role-tab-sub {{ font-size: 12px; color: var(--dim); margin-top: 2px; }}

  .role-banner {{
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(227,195,125,0.25);
    border-radius: 12px;
    margin-bottom: 16px;
  }}

  .fadyme-demos-box {{
    margin-bottom: 18px;
    padding: 14px 16px;
    border-radius: 14px;
    background: rgba(201, 182, 228, 0.07);
    border: 1px solid rgba(201, 182, 228, 0.3);
    display: none;
  }}
  .fadyme-demos-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 10px;
    margin-top: 10px;
  }}
  .demo-card {{
    background: rgba(18, 12, 28, 0.85);
    border: 1px solid rgba(201, 182, 228, 0.25);
    border-radius: 10px;
    padding: 10px 12px;
  }}

  .voices-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 14px;
  }}
  .voice-card {{
    background: rgba(29, 20, 42, 0.9);
    border: 1px solid rgba(201, 182, 228, 0.22);
    border-radius: 14px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }}
  .voice-card.recommended {{
    border-color: var(--gold);
    background: linear-gradient(180deg, rgba(52, 36, 28, 0.52) 0%, rgba(26, 18, 38, 0.92) 100%);
  }}
  .voice-head {{
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
  }}
  .voice-name {{ font-size: 17.5px; font-weight: 700; color: var(--gold); }}
  .voice-badge {{
    font-size: 10.5px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(227, 195, 125, 0.18);
    color: var(--gold);
    border: 1px solid rgba(227, 195, 125, 0.4);
  }}
  .voice-meta {{ font-size: 12px; color: var(--lilac); font-family: monospace; }}
  .voice-note {{ font-size: 13px; color: var(--text); line-height: 1.45; flex-grow: 1; }}
  .voice-actions {{
    display: flex;
    gap: 8px;
    align-items: center;
    margin-top: 4px;
  }}
  button.play-lab-btn {{
    background: var(--gold);
    color: #120a18;
    border: none;
    border-radius: 999px;
    padding: 7px 14px;
    font-weight: 700;
    font-size: 12.5px;
    cursor: pointer;
    flex-shrink: 0;
  }}
  button.play-lab-btn.playing {{
    background: var(--crimson);
    color: #fff;
  }}
</style>
</head>
<body>
<header>
  <div>
    <h1>UNAWARE OF MY DEMISE · Lyria 3.5 Saf Stüdyo Müzikleri & Japonca Seslendirme Stüdyosu</h1>
    <div class="sub">🎸 Berrak Lyria 3.5 Main Theme ("Unaware of My Demise") + ⚔️ Dengeli & Tekrarsız 7 Parçalık Savaş/Ara Sahne Rotasyonu + 🎙️ Japonca Ses Kadrosu</div>
  </div>
  <div class="top-links">
    <a href="/?fresh_entry=1" target="_blank">▶ Tüm AAB'yi Baştan Oyna (Splash → Prologue → T-1/T-2/T-3)</a>
    <a href="/?scene=Title" target="_blank" style="margin-left:8px;">▶ Title Screen</a>
  </div>
</header>

<!-- LYRIA 3.5 MAIN THEME STUDIO -->
<div class="card" id="soundtrack-suite-card" style="border-color: rgba(227, 195, 125, 0.65); background: linear-gradient(145deg, rgba(30, 16, 38, 0.95), rgba(14, 10, 22, 0.96)); margin-bottom: 22px;">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:14px;">
    <div>
      <div style="font-size:20px;font-weight:700;color:var(--gold);">🎸 Google Lyria 3.5 (<code>lyria-3.5</code>) — Ana Tema ("Unaware of My Demise") Stüdyosu</div>
      <div class="sub">
        <b>Tasarım & Motif:</b> Doğrudan Google Gemini API üzerinden <b><code>lyria-3.5</code> (44.1 kHz / 48 kHz Stereo)</b> modeliyle üretildi. <i>Duman – Haberin Yok Ölüyorum</i> ruhunu (inen Anadolu minör yürüyüşü, yalnız ve bol reverbli ağlayan elektro gitar arpejleri, içli mikro-bend'ler, derin bas, yavaş rimshot davul, yalnız çello ve nakaratta yükselen sıcak lambalı overdrive elektro gitar solosu) oyunumuzun karanlık gotik atmosferiyle birleştirir.
      </div>
    </div>
  </div>

  <!-- ACTIVE FLAGSHIP MAIN THEME -->
  <div style="background: rgba(216, 108, 120, 0.14); border: 1.5px solid rgba(227, 195, 125, 0.82); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:8px;">
      <div>
        <span style="background:var(--gold);color:#120a18;font-weight:800;font-size:11.5px;padding:3px 9px;border-radius:99px;margin-right:8px;">🔒 KİLİTLENEN RESMİ ANA TEMA (OYUNDA TAKILI)</span>
        <b style="font-size:17px;color:var(--gold);">"Unaware of My Demise" (Aday 3 · Intimate Midnight Guitar & Symphonic Rock Ballad · 68 BPM · 2:46)</b>
      </div>
      <span style="font-size:12.5px;color:var(--lilac);">2 dk 46 sn (Loop: 0:17.5) · Gerçek <code>lyria-3.5</code> Stüdyo Kaydı</span>
    </div>
    <div style="font-size:13px;color:var(--text);line-height:1.5;margin-bottom:10px;">
      • <b>0:00–0:17 (İntro):</b> Yalnız, derin reverbli ağlayan elektro gitarın karanlık-romantik açılış motifi.<br>
      • <b>0:17–0:52 (Verse 1):</b> Samimi akustik gitar parmak yürüyüşü, temiz elektro gitar melodisi, derin bas ve yumuşak rimshot davul.<br>
      • <b>0:52–1:24 (Nakarat 1 / Duygusal Zirve):</b> Lambalı (tube-overdriven) solo elektro gitarın yaylılar eşliğinde uzun, feryat eden bend'lerle yükselişi.<br>
      • <b>1:24–2:46 (Verse 2, Çello/Akustik Köprü & Büyük Final):</b> Sakinleşen ikinci kıta (1:24), büyük gitar solosu (1:56), çello ve akustik gitarın nefes aldığı samimi köprü (2:16) ve epik final (2:28–2:46).
    </div>
    <audio controls preload="auto" style="width:100%;height:38px;" src="/content/base/audio/bgm_main_theme.ogg"></audio>
  </div>

  <!-- ALTERNATIVE LYRIA 3.5 CANDIDATES -->
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:12px;">
    <div style="background:rgba(16,10,24,0.88);border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
      <div style="font-size:11.5px;color:var(--lilac);font-weight:700;">🎸 ARŞİV ADAY 1 · VINTAGE TUBE GUITAR & SLOW ROCK BALLAD (72 BPM · 2:56)</div>
      <div style="font-weight:700;color:var(--gold);margin:3px 0;">main_theme_v3_duman_eclipse_anthem (176.0 sn · <code>lyria-3.5</code>)</div>
      <div style="font-size:12.5px;color:var(--dim);margin-bottom:8px;">Yalnız spring-reverbli elektro gitar arpejleri (0:00–0:30), 4/4 rimshot davul (0:30–1:02) ve lambalı overdrive gitar solosu (1:02+).</div>
      <audio controls preload="none" style="width:100%;height:34px;" src="/audition/music/main_theme_v3_duman_eclipse_anthem.mp3"></audio>
    </div>

    <div style="background:rgba(16,10,24,0.88);border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
      <div style="font-size:11.5px;color:var(--emerald);font-weight:700;">🎻 ARŞİV ADAY 2 · ELEKTRO GİTAR & ANADOLU ÇELLO DÜETİ (70 BPM · 2:44)</div>
      <div style="font-weight:700;color:var(--gold);margin:3px 0;">main_theme_v1_weeping_ballad (164.4 sn · <code>lyria-3.5</code> + Key Art Multimodal)</div>
      <div style="font-size:12.5px;color:var(--dim);margin-bottom:8px;">Temiz ağlayan elektro gitar arpejleriyle (0:00–0:27) başlayıp içli bir solo çello kıtasına (0:27–0:54) ve overdrive elektro gitar nakaratına (0:54+) bağlanan versiyon.</div>
      <audio controls preload="none" style="width:100%;height:34px;" src="/audition/music/main_theme_v1_weeping_ballad.mp3"></audio>
    </div>
  </div>
</div>

<div class="studio-grid">
  <div class="card" style="margin-bottom:0;">
    <div class="stage-preview">
      <img id="stage-img" src="/content/base/art/still_prologue_hours.webp" alt="Prologue plate">
      <div class="stage-overlay">
        <div class="stage-caption" id="stage-caption">BEFORE THE ROAD (0:00 – 0:12)</div>
        <div class="stage-subtitles">
          <div class="stage-en" id="stage-en"></div>
          <div class="stage-ja" id="stage-ja" lang="ja"></div>
        </div>
      </div>
    </div>
    <div class="bgm-controls">
      <audio id="bgm-player" controls preload="auto" src="/content/base/audio/bgm_prologue_before_the_road.ogg"></audio>
      <div class="score-pill" id="stage-score"></div>
    </div>
  </div>

  <div class="card" style="margin-bottom:0;">
    <h2 style="margin:0 0 10px 0;font-size:17.5px;color:var(--gold);">9 Prologue Sahnesi & Müzikal Akış (Tıklayarak O Saniyeye Atla)</h2>
    <div class="scene-list" id="scene-list"></div>
  </div>
</div>

<!-- LIVE VOICE PITCH / TIMBRE / TEMPO MANIPULATION LAB -->
<div class="lab-box">
  <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;">
    <div>
      <h2 style="margin:0;font-size:19px;color:var(--gold);">🎛️ Canlı Ses Tonu, Perde (Pitch) & Tını Değiştirme Laboratuvarı (Web Audio DSP)</h2>
      <div class="sub">Aynı baz seslendirmeni <b>farklı perde (yarım ton / semitone)</b>, <b>farklı okuma hızı</b> ve <b>farklı göğüs/tını rengi (EQ)</b> ile birden fazla karakterde (ör. biri tok/yaşlı, biri genç/ince) nasıl kullanabileceğimizi aşağıdaki sürgülerle <b>canlı dinleyerek</b> test edebilirsiniz.</div>
    </div>
    <label style="display:inline-flex;align-items:center;gap:8px;font-size:13.5px;color:var(--gold);cursor:pointer;">
      <input type="checkbox" id="mix-with-bgm" checked>
      Ses Örneği Çalarken Arka Planda Prologue Müziğini Kısık Çal (Ducking Testi)
    </label>
  </div>

  <div class="preset-row">
    <span style="font-size:12.5px;color:var(--lilac);font-weight:700;">Tek Tıkla Karakter Varyasyon Presetleri:</span>
    <button class="preset-btn active" data-pitch="0" data-rate="1.00" data-tilt="0" data-reverb="0.08">1. Orijinal Kayıt (0 st · 1.00x)</button>
    <button class="preset-btn" data-pitch="-2.0" data-rate="0.95" data-tilt="-5" data-reverb="0.14">2. Tok & Olgun Varyasyon (-2.0 st · Koyu Gövde · 0.95x)</button>
    <button class="preset-btn" data-pitch="-3.2" data-rate="0.90" data-tilt="-8" data-reverb="0.22">3. Derin Kronik / Komutan (-3.2 st · Ağırbaşlı · 0.90x)</button>
    <button class="preset-btn" data-pitch="+2.0" data-rate="1.05" data-tilt="+5" data-reverb="0.06">4. İnce & Genç Varyasyon (+2.0 st · Parlak Tını · 1.05x)</button>
    <button class="preset-btn" data-pitch="-1.2" data-rate="0.92" data-tilt="-3" data-reverb="0.28">5. Dingin Narrator (-1.2 st · 0.92x · Kronik Salon)</button>
    <button class="preset-btn" data-pitch="0" data-rate="0.96" data-tilt="+3" data-reverb="0.48">6. İç Ses / Düşünce (jp_inner · Veil Yankısı)</button>
  </div>

  <div class="lab-sliders">
    <div class="slider-group">
      <div class="slider-head"><span>Ton / Perde (Pitch Shift)</span><span id="val-pitch">0.0 st</span></div>
      <input type="range" id="sl-pitch" min="-6" max="6" step="0.2" value="0">
      <div class="slider-hint">Negatif (-): Daha kalın/pes · Pozitif (+): Daha ince/tiz (Hızı bozmaz!)</div>
    </div>
    <div class="slider-group">
      <div class="slider-head"><span>Okuma Hızı (Tempo)</span><span id="val-rate">1.00x</span></div>
      <input type="range" id="sl-rate" min="0.78" max="1.25" step="0.01" value="1.00">
      <div class="slider-hint">Perdeyi bozmadan konuşma temposunu ağırlaştırır veya hızlandırır</div>
    </div>
    <div class="slider-group">
      <div class="slider-head"><span>Ses Gövdesi / Tını (Timbre EQ)</span><span id="val-tilt">0 dB (Doğal)</span></div>
      <input type="range" id="sl-tilt" min="-10" max="10" step="1" value="0">
      <div class="slider-hint">Sol (-): Koyu/Tok göğüs rezonansı · Sağ (+): Parlak/Açık/Genç tını</div>
    </div>
    <div class="slider-group">
      <div class="slider-head"><span>Mekan / İç Ses Yankısı (Veil Reverb)</span><span id="val-reverb">8%</span></div>
      <input type="range" id="sl-reverb" min="0" max="0.75" step="0.01" value="0.08">
      <div class="slider-hint">Prologue katedral ambiyansı veya Fadyme/Mahmut iç ses (jp_inner) efekti</div>
    </div>
  </div>
</div>

<!-- CHARACTER CASTING TABS -->
<div class="card">
  <div class="role-tabs">
    <div class="role-tab active" data-role="narrator">
      <img src="/content/base/art/still_prologue_hours.webp" alt="Narrator">
      <div>
        <div class="role-tab-title">📜 1. Narrator (Anlatıcı)</div>
        <div class="role-tab-sub">neutral, low, unhurried · Prologue & Kronik (24 satır)</div>
      </div>
    </div>
    <div class="role-tab" data-role="fadyme">
      <img src="/content/base/art/portrait_fadyme_composed.webp" alt="Fadyme">
      <div>
        <div class="role-tab-title">🔔 2. Fadyme (22 · Başrol)</div>
        <div class="role-tab-sub">light controlled alto · zarif, ince alaycı, gizli hüzün (241 satır)</div>
      </div>
    </div>
    <div class="role-tab" data-role="mahmut">
      <img src="/content/base/art/portrait_mahmut_watchful.webp" alt="Mahmut">
      <div>
        <div class="role-tab-title">🛡️ 3. Mahmut (28 · Başrol)</div>
        <div class="role-tab-sub">low calm baritone · kısa cümleler, kuru mizah, koruyucu (144 satır)</div>
      </div>
    </div>
    <div class="role-tab" data-role="all">
      <img src="/content/base/art/still_prologue_beginning.webp" alt="All Voices">
      <div>
        <div class="role-tab-title">🗂️ Tüm 30 Ses Kataloğu</div>
        <div class="role-tab-sub">14 Kadın + 16 Erkek · Perdeye veya Hıza Göre Sırala</div>
      </div>
    </div>
  </div>

  <div class="role-banner" id="role-banner"></div>

  <!-- Fadyme Actual Game Lines Demo Box -->
  <div class="fadyme-demos-box" id="fadyme-demos-box">
    <div style="font-weight:700;color:var(--gold);font-size:15px;">🌸 Fadyme Gerçek Oyun İçi Japonca Replik & İç Ses (`jp_inner`) Kayıt Örnekleri (`Sulafat` Referans Sesiyle)</div>
    <div class="sub">Aşağıdaki 5 kayıt oyunun gerçek açılış sahnesi metinleridir. <b>"🎛️ Lab İle Çal"</b> tuşuna basarak bu gerçek replikler üzerinde de yukarıdaki Perde (Pitch), Hız ve İç Ses Yankısı sürgülerini canlı deneyebilirsiniz:</div>
    <div class="fadyme-demos-grid" id="fadyme-demos-grid"></div>
  </div>

  <div class="voices-grid" id="voices-grid"></div>
</div>

<!-- 116-LINE DIRECTED ACTING SCRIPT & PROMPT INSPECTOR -->
<div class="card" id="acting-script-studio" style="border-color: rgba(123, 201, 166, 0.55); background: linear-gradient(145deg, rgba(16, 28, 28, 0.92), rgba(22, 14, 32, 0.94));">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:14px;">
    <div>
      <div style="font-size:19px;font-weight:700;color:var(--emerald);">🎬 Kilitlenen Resmi Ses Kadrosu & 116-Satırlık Oyunculuk / Duygu Prompt Masası (Non-Robotic Acting Script)</div>
      <div class="sub">
        <b>🔒 Kilitli Kadro:</b> <b>Narrator → Algieba</b> (93.4 Hz Derin Bas-Bariton · 33 Satır) &nbsp;|&nbsp;
        <b>Fadyme → Sulafat</b> (252.6 Hz Kontrollü Gotik Alto · 40 Satır + 241 Part I) &nbsp;|&nbsp;
        <b>Mahmut → Iapetus</b> (144.6 Hz Yorgun Şövalye Baritonu · 43 Satır)<br>
        Her satır için <b>Ne Zaman (`when_cue`)</b>, <b>Hangi Duygu & Alt Metin (`subtext_tr`)</b>, <b>Gemini 3.8 Acting Style + Inline Nefes/Duraksama Etiketleri (`tts_text_gemini38`)</b> ve <b>Chirp 3 HD Clause-Level SSML (`ssml_chirp3`)</b> hazırlandı.
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;" id="script-speaker-filters">
      <button class="preset-btn active" data-sp="ALL">Tümü (116)</button>
      <button class="preset-btn" data-sp="narrator">📜 Narrator · Algieba (33)</button>
      <button class="preset-btn" data-sp="fadyme">🔔 Fadyme · Sulafat (40)</button>
      <button class="preset-btn" data-sp="mahmut">🛡️ Mahmut · Iapetus (43)</button>
    </div>
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;" id="script-scene-filters">
    <button class="preset-btn active" data-sc="ALL">Tüm Sahneler (116)</button>
    <button class="preset-btn" data-sc="prologue_">Prologue (9)</button>
    <button class="preset-btn" data-sc="tutorial_t1_before">T-1 Öncesi (14)</button>
    <button class="preset-btn" data-sc="tutorial_t1_after">T-1 Sonrası (14)</button>
    <button class="preset-btn" data-sc="tutorial_t2_before">T-2 Öncesi (13)</button>
    <button class="preset-btn" data-sc="tutorial_t2_after">T-2 Sonrası · Mola (18)</button>
    <button class="preset-btn" data-sc="tutorial_t3_before">T-3 Öncesi (14)</button>
    <button class="preset-btn" data-sc="tutorial_t3_after">T-3 Sonrası · Sığınak (34)</button>
  </div>
  <div id="script-lines-list" style="display:flex;flex-direction:column;gap:10px;max-height:620px;overflow-y:auto;padding-right:6px;"></div>
</div>

<script id="studio-data" type="application/json">{payload}</script>
<script>
const data = JSON.parse(document.getElementById('studio-data').textContent);
const bgm = document.getElementById('bgm-player');
const stageImg = document.getElementById('stage-img');
const stageCaption = document.getElementById('stage-caption');
const stageEn = document.getElementById('stage-en');
const stageJa = document.getElementById('stage-ja');
const stageScore = document.getElementById('stage-score');
const sceneList = document.getElementById('scene-list');
const voicesGrid = document.getElementById('voices-grid');
const roleBanner = document.getElementById('role-banner');
const fadymeDemosBox = document.getElementById('fadyme-demos-box');
const fadymeDemosGrid = document.getElementById('fadyme-demos-grid');
const mixToggle = document.getElementById('mix-with-bgm');

function fmtTime(s) {{
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}}

let activeSceneIdx = -1;
function selectScene(idx, seekBgm = false) {{
  const sc = data.scenes[idx];
  if (!sc) return;
  activeSceneIdx = idx;
  stageImg.src = sc.still;
  stageCaption.textContent = sc.caption_en.toUpperCase() + ' (' + fmtTime(sc.time_range_s[0]) + ' – ' + fmtTime(sc.time_range_s[1]) + ')';
  stageEn.textContent = sc.en;
  stageJa.textContent = sc.ja;
  stageScore.textContent = '🎵 ' + sc.score_note + ' | 🎙️ JP Yönlendirme: ' + sc.direction;
  document.querySelectorAll('.scene-item').forEach((el, i) => el.classList.toggle('active', i === idx));
  if (seekBgm) {{
    bgm.currentTime = sc.time_range_s[0];
    bgm.play().catch(() => undefined);
  }}
}}

data.scenes.forEach((sc, idx) => {{
  const row = document.createElement('div');
  row.className = 'scene-item';
  row.innerHTML = `<div class="scene-time">${{fmtTime(sc.time_range_s[0])}}–${{fmtTime(sc.time_range_s[1])}}</div>
    <div>
      <div class="scene-title">${{idx + 1}}. ${{sc.caption_en}}</div>
      <div class="scene-ja-mini" lang="ja">${{sc.ja}}</div>
    </div>`;
  row.onclick = () => selectScene(idx, true);
  sceneList.append(row);
}});

bgm.addEventListener('timeupdate', () => {{
  const t = bgm.currentTime;
  const idx = data.scenes.findIndex(s => t >= s.time_range_s[0] && t < s.time_range_s[1]);
  if (idx !== -1 && idx !== activeSceneIdx) selectScene(idx, false);
}});
selectScene(0, false);

// ============================================================================
// WEB AUDIO API REAL-TIME GRANULAR PITCH SHIFTER + TIMBRE EQ + VEIL REVERB
// ============================================================================
let audioCtx = null;
let currentStopFn = null;
let currentPlayingBtn = null;
const bufferCache = new Map();

const labState = {{
  pitchSemitones: 0.0,
  tempoRate: 1.00,
  timbreTiltDb: 0.0,
  reverbWet: 0.08,
}};

let liveNodes = null;

function ensureCtx() {{
  if (!audioCtx) {{
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }}
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}}

function createImpulseResponse(ctx, duration = 1.9, decay = 2.6) {{
  const len = Math.floor(ctx.sampleRate * duration);
  const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {{
    const d = impulse.getChannelData(ch);
    for (let i = 0; i < len; i++) {{
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }}
  }}
  return impulse;
}}

// Apply pitch shift + time stretch in-memory on AudioBuffer via dual-window overlap-add (SOLA/WSOLA-lite)
// so that pitch (semitones) and speed (tempoRate) are 100% independent and glitch-free!
function renderPitchAndTempoBuffer(ctx, srcBuf, semitones, tempoRate) {{
  const pitchFactor = Math.pow(2, semitones / 12);
  if (Math.abs(semitones) < 0.05 && Math.abs(tempoRate - 1.0) < 0.01) return srcBuf;
  const sr = srcBuf.sampleRate;
  const inCh = srcBuf.getChannelData(0);
  const inLen = inCh.length;
  // First time-stretch by (pitchFactor / tempoRate) using Hann-windowed 40ms grains with 50% overlap,
  // then resample by 1/pitchFactor so duration = inLen / tempoRate and pitch = pitchFactor!
  const stretchRatio = pitchFactor / tempoRate;
  const grainSize = Math.floor(0.042 * sr);
  const hopOut = grainSize >> 1;
  const hopIn = hopOut / stretchRatio;
  const stretchedLen = Math.max(grainSize, Math.floor(inLen * stretchRatio));
  const stretched = new Float32Array(stretchedLen + grainSize);
  const win = new Float32Array(grainSize);
  for (let i = 0; i < grainSize; i++) win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (grainSize - 1)));

  let inPos = 0;
  for (let outPos = 0; outPos < stretchedLen; outPos += hopOut) {{
    const iBase = Math.min(inLen - grainSize - 1, Math.max(0, Math.floor(inPos)));
    for (let j = 0; j < grainSize; j++) {{
      stretched[outPos + j] += (inCh[iBase + j] || 0) * win[j];
    }}
    inPos += hopIn;
  }}

  const finalLen = Math.max(1, Math.floor(stretchedLen / pitchFactor));
  const outBuf = ctx.createBuffer(1, finalLen, sr);
  const outCh = outBuf.getChannelData(0);
  for (let i = 0; i < finalLen; i++) {{
    const p = i * pitchFactor;
    const idx = Math.floor(p);
    const frac = p - idx;
    outCh[i] = (stretched[idx] || 0) * (1 - frac) + (stretched[idx + 1] || 0) * frac;
  }}
  return outBuf;
}}

async function playThroughVoiceLab(url, btn) {{
  const ctx = ensureCtx();
  if (currentStopFn) {{
    const wasSame = currentPlayingBtn === btn;
    currentStopFn();
    if (wasSame) return;
  }}

  btn.textContent = '⏳ Yükleniyor...';
  let rawBuf = bufferCache.get(url);
  if (!rawBuf) {{
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    rawBuf = await ctx.decodeAudioData(arr);
    bufferCache.set(url, rawBuf);
  }}

  const processedBuf = renderPitchAndTempoBuffer(ctx, rawBuf, labState.pitchSemitones, labState.tempoRate);
  const src = ctx.createBufferSource();
  src.buffer = processedBuf;

  // Timbre / Formant Tilt EQ (Low-shelf chest warmth + High-shelf brightness)
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = 'lowshelf';
  lowShelf.frequency.value = 210;
  lowShelf.gain.value = -labState.timbreTiltDb * 0.9; // Negative tilt = MORE chest warmth (+dB at 210Hz)

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = 'highshelf';
  highShelf.frequency.value = 2800;
  highShelf.gain.value = labState.timbreTiltDb * 0.9; // Positive tilt = MORE brightness (+dB at 2.8kHz)

  const dryGain = ctx.createGain();
  const wetGain = ctx.createGain();
  const convolver = ctx.createConvolver();
  convolver.buffer = createImpulseResponse(ctx);

  dryGain.gain.value = 1.0 - labState.reverbWet * 0.45;
  wetGain.gain.value = labState.reverbWet;

  src.connect(lowShelf);
  lowShelf.connect(highShelf);
  highShelf.connect(dryGain);
  highShelf.connect(convolver);
  convolver.connect(wetGain);
  dryGain.connect(ctx.destination);
  wetGain.connect(ctx.destination);

  liveNodes = {{ lowShelf, highShelf, dryGain, wetGain }};

  if (mixToggle.checked) {{
    bgm.volume = 0.22;
    if (bgm.paused) bgm.play().catch(() => undefined);
  }}

  btn.classList.add('playing');
  btn.textContent = '⏹ Durdur (Lab Aktif)';
  currentPlayingBtn = btn;

  const stop = () => {{
    try {{ src.stop(); }} catch {{}}
    src.disconnect();
    btn.classList.remove('playing');
    btn.textContent = '🎛️ Lab İle Çal';
    if (currentPlayingBtn === btn) {{
      currentPlayingBtn = null;
      currentStopFn = null;
      liveNodes = null;
      bgm.volume = 1.0;
    }}
  }};
  currentStopFn = stop;
  src.onended = stop;
  src.start();
}}

function updateLabUI() {{
  document.getElementById('val-pitch').textContent = (labState.pitchSemitones > 0 ? '+' : '') + labState.pitchSemitones.toFixed(1) + ' st';
  document.getElementById('val-rate').textContent = labState.tempoRate.toFixed(2) + 'x';
  const t = labState.timbreTiltDb;
  document.getElementById('val-tilt').textContent = (t === 0 ? '0 dB (Doğal)' : t < 0 ? `${{t}} dB (Daha Tok/Koyu)` : `+${{t}} dB (Daha Parlak/İnce)`);
  document.getElementById('val-reverb').textContent = Math.round(labState.reverbWet * 100) + '%';

  if (liveNodes) {{
    liveNodes.lowShelf.gain.value = -labState.timbreTiltDb * 0.9;
    liveNodes.highShelf.gain.value = labState.timbreTiltDb * 0.9;
    liveNodes.dryGain.gain.value = 1.0 - labState.reverbWet * 0.45;
    liveNodes.wetGain.gain.value = labState.reverbWet;
  }}
}}

document.getElementById('sl-pitch').oninput = (e) => {{ labState.pitchSemitones = parseFloat(e.target.value); updateLabUI(); }};
document.getElementById('sl-rate').oninput = (e) => {{ labState.tempoRate = parseFloat(e.target.value); updateLabUI(); }};
document.getElementById('sl-tilt').oninput = (e) => {{ labState.timbreTiltDb = parseFloat(e.target.value); updateLabUI(); }};
document.getElementById('sl-reverb').oninput = (e) => {{ labState.reverbWet = parseFloat(e.target.value); updateLabUI(); }};

document.querySelectorAll('.preset-btn').forEach(btn => {{
  btn.onclick = () => {{
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    labState.pitchSemitones = parseFloat(btn.dataset.pitch);
    labState.tempoRate = parseFloat(btn.dataset.rate);
    labState.timbreTiltDb = parseFloat(btn.dataset.tilt);
    labState.reverbWet = parseFloat(btn.dataset.reverb);
    document.getElementById('sl-pitch').value = labState.pitchSemitones;
    document.getElementById('sl-rate').value = labState.tempoRate;
    document.getElementById('sl-tilt').value = labState.timbreTiltDb;
    document.getElementById('sl-reverb').value = labState.reverbWet;
    updateLabUI();
  }};
}});

// Render Fadyme real game lines
data.fadyme_demos.forEach(d => {{
  const c = document.createElement('div');
  c.className = 'demo-card';
  c.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
      <strong style="color:var(--gold);font-size:13px;">${{d.title}}</strong>
      <button class="play-lab-btn" data-url="${{d.file}}">🎛️ Lab İle Çal</button>
    </div>
    <div style="font-size:12.5px;color:#fff;margin-bottom:3px;">"${{d.en}}"</div>
    <div style="font-size:12px;color:var(--lilac);" lang="ja">${{d.ja}}</div>`;
  const b = c.querySelector('.play-lab-btn');
  b.onclick = () => playThroughVoiceLab(d.file, b);
  fadymeDemosGrid.append(c);
}});

const ROLE_BANNERS = {{
  narrator: {{
    title: '📜 Narrator (`jp_narration`) Ses Adayları',
    desc: 'Kanonik Yönlendirme: "neutral, low, unhurried; separate actor from the cast" — Başrol karakterlerinden (Fadyme & Mahmut) ayrı, ağırbaşlı ve zamansız kronik anlatıcısı.',
    defaultFilter: 'REC',
  }},
  fadyme: {{
    title: '🔔 Fadyme (22 · Light Controlled Alto) Ses Adayları',
    desc: 'Kanonik Yönlendirme: "light, controlled alto; dark humour and sharp observation under the courtesy; “I am fine” is a mask" — Zarif, sakin, ince alaycı ve içten içe kırılgan başrol.',
    defaultFilter: 'FEMALE',
  }},
  mahmut: {{
    title: '🛡️ Mahmut (28 · Low Calm Baritone) Ses Adayları',
    desc: 'Kanonik Yönlendirme: "low, calm baritone; short sentences, dry humour; anger shown as silence" — Yorgun, sadık, az ve öz konuşan muhafız şövalye. (Narrator olarak seçtiğiniz sesten farklı bir bariton seçebilir veya üstteki Lab ile tonunu ayrıştırabilirsiniz.)',
    defaultFilter: 'MALE',
  }},
  all: {{
    title: '🗂️ Tüm 30 Doğrulanmış Google Chirp 3 HD (`ja-JP`) Ses Kataloğu',
    desc: '14 Kadın ve 16 Erkek sesin tamamı. Herhangi bir sesi baz alıp üstteki Ses Laboratuvarı ile perde (-6/+6 st), hız ve gövde rengini değiştirerek yan karakterler için de varyasyon üretebilirsiniz.',
    defaultFilter: 'ALL',
  }},
}};

let activeRole = 'narrator';
let sortMode = 'role'; // 'role' | 'pitch_asc' | 'dur_desc'

function renderRoleView() {{
  const rb = ROLE_BANNERS[activeRole];
  fadymeDemosBox.style.display = activeRole === 'fadyme' ? 'block' : 'none';

  roleBanner.innerHTML = `<div>
      <div style="font-size:17px;font-weight:700;color:var(--gold);">${{rb.title}}</div>
      <div class="sub">${{rb.desc}}</div>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <span style="font-size:12.5px;color:var(--lilac);">Sıralama:</span>
      <button class="preset-btn ${{sortMode === 'role' ? 'active' : ''}}" id="sort-role">Rol Uyumu (Önerilenler Üstte)</button>
      <button class="preset-btn ${{sortMode === 'pitch_asc' ? 'active' : ''}}" id="sort-pitch">En Tok / Pes → En İnce (Hz)</button>
      <button class="preset-btn ${{sortMode === 'dur_desc' ? 'active' : ''}}" id="sort-dur">En Ağırbaşlı / Yavaş → Hızlı (sn)</button>
    </div>`;

  document.getElementById('sort-role').onclick = () => {{ sortMode = 'role'; renderRoleView(); }};
  document.getElementById('sort-pitch').onclick = () => {{ sortMode = 'pitch_asc'; renderRoleView(); }};
  document.getElementById('sort-dur').onclick = () => {{ sortMode = 'dur_desc'; renderRoleView(); }};

  let list = data.voices.filter(v => {{
    if (activeRole === 'fadyme') return v.gender === 'FEMALE';
    if (activeRole === 'mahmut') return v.gender === 'MALE';
    return true;
  }});

  const roleKey = activeRole === 'all' ? 'narrator' : activeRole;
  list.sort((a, b) => {{
    if (sortMode === 'pitch_asc') return a.f0_hz - b.f0_hz;
    if (sortMode === 'dur_desc') return b.duration_s - a.duration_s;
    const ra = a.roles[roleKey]?.rank ?? 50;
    const rb2 = b.roles[roleKey]?.rank ?? 50;
    if (ra !== rb2) return ra - rb2;
    return a.f0_hz - b.f0_hz;
  }});

  voicesGrid.replaceChildren();
  for (const v of list) {{
    const rm = v.roles[roleKey] || v.roles.narrator;
    const card = document.createElement('div');
    card.className = 'voice-card' + (rm.recommended ? ' recommended' : '');
    const head = document.createElement('div');
    head.className = 'voice-head';
    head.innerHTML = `<span class="voice-name">${{v.name}} (${{v.gender === 'MALE' ? 'Erkek' : 'Kadın'}})</span>` +
      (rm.badge ? `<span class="voice-badge">${{rm.badge}}</span>` : '');
    const meta = document.createElement('div');
    meta.className = 'voice-meta';
    meta.textContent = `${{v.voice_id}} · Perde: ${{v.f0_hz}} Hz · Tempo: ${{v.duration_s}} sn · Tını: ${{v.centroid_hz}} Hz`;
    const note = document.createElement('div');
    note.className = 'voice-note';
    note.textContent = rm.note_tr;

    const actions = document.createElement('div');
    actions.className = 'voice-actions';
    const labBtn = document.createElement('button');
    labBtn.className = 'play-lab-btn';
    labBtn.textContent = '🎛️ Lab İle Çal';
    labBtn.onclick = () => playThroughVoiceLab(v.file, labBtn);

    const player = document.createElement('audio');
    player.controls = true;
    player.preload = 'none';
    player.src = v.file;
    player.addEventListener('play', () => {{
      if (currentStopFn) currentStopFn();
      if (mixToggle.checked) {{
        bgm.volume = 0.22;
        if (bgm.paused) bgm.play().catch(() => undefined);
      }}
    }});
    const restoreBgm = () => {{ bgm.volume = 1.0; }};
    player.addEventListener('pause', restoreBgm);
    player.addEventListener('ended', restoreBgm);

    actions.append(labBtn, player);
    card.append(head, meta, note, actions);
    voicesGrid.append(card);
  }}
}}

document.querySelectorAll('.role-tab').forEach(tab => {{
  tab.onclick = () => {{
    document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeRole = tab.dataset.role;
    renderRoleView();
  }};
}});

renderRoleView();

// 116-LINE DIRECTED ACTING SCRIPT INSPECTOR
let activeScriptSpeaker = 'ALL';
let activeScriptScene = 'ALL';
const scriptLinesList = document.getElementById('script-lines-list');

function renderScriptInspector() {{
  const rows = (data.script_lines || []).filter(r => {{
    if (activeScriptSpeaker !== 'ALL' && r.speaker_id !== activeScriptSpeaker) return false;
    if (activeScriptScene !== 'ALL' && !r.scene_id.startsWith(activeScriptScene)) return false;
    return true;
  }});
  scriptLinesList.replaceChildren();
  for (const r of rows) {{
    const card = document.createElement('div');
    card.style.cssText = 'background:rgba(10,6,18,0.82);border:1px solid rgba(212,178,108,0.28);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px;';
    const spColor = r.speaker_id === 'fadyme' ? '#e2d2ff' : r.speaker_id === 'mahmut' ? '#e3c37d' : '#7bc9a6';
    const top = document.createElement('div');
    top.style.cssText = 'display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;';
    top.innerHTML = `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-weight:700;color:${{spColor}};font-size:13.5px;">#${{r.order_index}} · ${{r.speaker_name.toUpperCase()}} (${{r.gemini_voice}})</span>
        <span class="voice-badge">${{r.emotion}}</span>
        <code style="font-size:11.5px;color:var(--dim);">${{r.line_id}} · ${{r.scene_id}}</code>
      </div>
      <div style="font-size:11.5px;color:var(--lilac);">
        Hız: ${{r.acoustic_profile.speaking_rate}}x · Perde: ${{r.acoustic_profile.pitch_semitones >= 0 ? '+' : ''}}${{r.acoustic_profile.pitch_semitones}}st · Süre: ~${{r.acoustic_profile.duration_seconds}}sn
      </div>`;
    const whenRow = document.createElement('div');
    whenRow.style.cssText = 'font-size:12px;color:#b8e6d1;';
    whenRow.innerHTML = `⏱️ <b>Ne Zaman:</b> ${{r.when_cue}}`;
    const subRow = document.createElement('div');
    subRow.style.cssText = 'font-size:12px;color:#e5d8f4;';
    subRow.innerHTML = `🎭 <b>Duygu & Alt Metin:</b> ${{r.subtext_tr}}`;
    const enRow = document.createElement('div');
    enRow.style.cssText = 'font-size:13px;color:#fff;';
    enRow.textContent = `"${{r.en}}"`;
    const jaRow = document.createElement('div');
    jaRow.style.cssText = 'font-size:13.5px;color:var(--gold);';
    jaRow.lang = 'ja';
    jaRow.textContent = r.ja;
    const audioUrl = `/content/base/${{r.output_ogg || ('voices/' + r.line_id + '.ogg')}}`;
    const audioRow = document.createElement('div');
    audioRow.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0;';
    const labPlayBtn = document.createElement('button');
    labPlayBtn.className = 'play-lab-btn';
    labPlayBtn.textContent = '🎛️ Lab İle Çal';
    labPlayBtn.onclick = () => playThroughVoiceLab(audioUrl, labPlayBtn);
    const lineAudio = document.createElement('audio');
    lineAudio.controls = true;
    lineAudio.preload = 'none';
    lineAudio.src = audioUrl;
    lineAudio.style.cssText = 'height:34px;flex:1;min-width:220px;';
    audioRow.append(labPlayBtn, lineAudio);
    const promptRow = document.createElement('div');
    promptRow.style.cssText = 'font-size:11.5px;color:var(--dim);background:rgba(255,255,255,0.03);padding:7px 10px;border-radius:8px;font-family:monospace;white-space:pre-wrap;';
    promptRow.textContent = `Prompt (style): ${{r.speech_metadata.style}}\nGemini-3.8 Tags: ${{r.tts_text_gemini38}}\nChirp3 SSML   : ${{r.ssml_chirp3}}`;
    card.append(top, whenRow, subRow, enRow, jaRow, audioRow, promptRow);
    scriptLinesList.append(card);
  }}
}}

document.querySelectorAll('#script-speaker-filters .preset-btn').forEach(btn => {{
  btn.onclick = () => {{
    document.querySelectorAll('#script-speaker-filters .preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeScriptSpeaker = btn.dataset.sp;
    renderScriptInspector();
  }};
}});

document.querySelectorAll('#script-scene-filters .preset-btn').forEach(btn => {{
  btn.onclick = () => {{
    document.querySelectorAll('#script-scene-filters .preset-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeScriptScene = btn.dataset.sc;
    renderScriptInspector();
  }};
}});

renderScriptInspector();
</script>
</body>
</html>
"""
    (OUT_DIR / 'index.html').write_text(html, encoding='utf-8')
    print(f'Audition studio updated at .cache/audition/index.html with {len(voices_data)} voices, {len(fadyme_demos)} Fadyme demos, and {len(master_script["lines"])} directed acting lines.')


if __name__ == '__main__':
    main()
