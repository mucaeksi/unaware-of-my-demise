"""Build the local interactive Prologue Soundtrack & Japanese Narrator Audition Studio
at `apps/game/public/content/audition/index.html` (served at http://127.0.0.1:5173/content/audition/index.html).
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
OUT_DIR = ROOT / 'apps/game/public/content/audition'

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

NARRATOR_NOTES = {
    'Charon': {
        'rank': 1,
        'badge': 'TOP PICK · DERİN & SAKİN BARİTON',
        'note_tr': 'En sıcak ve kadifemsi koyu bariton tını (915 Hz centroid, 125 Hz F0, 7.49 sn sakin tempo). Karanlık gotik anime kronik anlatıcısı (Frieren / Lodoss / Dark Souls tarzı) için 1 numaralı aday.',
    },
    'Umbriel': {
        'rank': 2,
        'badge': 'TOP PICK · EN AĞIRBAŞLI & ÖLÇÜLÜ TEMPO',
        'note_tr': 'Tüm erkek sesler arasında en sakin, acele etmeyen, dingin anlatım temposu (8.20 sn, 144 Hz F0). Hikâyeyi sindirerek okuyan bilge anlatıcı hissi verir.',
    },
    'Algieba': {
        'rank': 3,
        'badge': 'TOP PICK · EN DERİN BAS-BARİTON',
        'note_tr': 'Katalogdaki en pes/derin erkek sesi (93.4 Hz F0). Tarihsel yıkım ("Crownfall") ve eski krallık kayıtları için çok güçlü bir ağırlığa sahip.',
    },
    'Alnilam': {
        'rank': 4,
        'badge': 'ÖNERİLEN · DENGELİ & NÖTR BARİTON',
        'note_tr': 'Çok temiz, nötr, sıcak ve abartısız bariton (145.5 Hz F0, 947 Hz sıcak tını). Karakterlerin önüne geçmeden atmosfer kuran klasik Visual Novel anlatıcısı.',
    },
    'Fenrir': {
        'rank': 5,
        'badge': 'ÖNERİLEN · OLGU & YORGUN ANLATICI',
        'note_tr': 'Sakin ve ağırbaşlı tempo (7.75 sn, 150 Hz F0). Yıllar süren kış yolculuğunu anlatan olgun, yaşanmışlık hissi veren erkek sesi.',
    },
    'Pulcherrima': {
        'rank': 6,
        'badge': 'KADIN ANLATICI #1 · DERİN KONTRALTO',
        'note_tr': 'Kadın sesler arasındaki en pes, olgun ve sıcak kontralto tını (152.9 Hz F0, 1038 Hz sıcak tını). Kadın Narrator tercih edilirse Fadyme’den (Sulafat) tamamen ayrışan en güçlü aday.',
    },
    'Gacrux': {
        'rank': 7,
        'badge': 'KADIN ANLATICI #2 · SAKİN & EDEBİ ALTO',
        'note_tr': 'Düşük perdeli, ağırbaşlı ve edebi kadın alto sesi (166.7 Hz F0, 7.63 sn sakin tempo). Masalsı ve melankolik bir kronik anlatımı sunar.',
    },
    'Vindemiatrix': {
        'rank': 8,
        'badge': 'KADIN ANLATICI #3 · YUMUŞAK & HÜZÜNLÜ',
        'note_tr': 'Çok yumuşak, karanlık-sıcak tınılı (1077 Hz centroid, 7.47 sn) dingin kadın anlatıcı adayı.',
    },
    'Sulafat': {
        'rank': 99,
        'badge': 'FADYME REFERANS SESİ (KARAKTERE AYRILDI)',
        'note_tr': 'AUDIO_VO_PLAN_PART1.md kapsamında Fadyme için referans seçilen ses. Narrator ayrı bir aktör olacağı için karşılaştırma amacıyla listede yer alır.',
    },
}


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
    jp_prologue = json.loads(JP_PROLOGUE_PATH.read_text(encoding='utf-8'))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

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
        info = NARRATOR_NOTES.get(v['name'], {})
        voices_data.append({
            'name': v['name'],
            'voice_id': v['voice_id'],
            'gender': v['gender'],
            'file': '/content/audition/' + v['file'],
            'f0_hz': med_f0,
            'duration_s': dur,
            'centroid_hz': med_cent,
            'recommended': v['name'] in NARRATOR_NOTES and NARRATOR_NOTES[v['name']]['rank'] <= 8,
            'rank': info.get('rank', 50),
            'badge': info.get('badge', ''),
            'note_tr': info.get('note_tr', f'Google Chirp 3 HD doğrulanmış {v["gender"]} Japonca ses profili ({med_f0} Hz ortalama perde, {dur} sn okuma süresi).'),
        })

    voices_data.sort(key=lambda item: (item['rank'], item['gender'], item['f0_hz']))

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
    }, ensure_ascii=False)

    html = f"""<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>UOMD · Prologue 2:00 Müzik & Japonca Narrator Ses Seçim Stüdyosu</title>
<style>
  :root {{
    --bg: #0c0812;
    --panel: rgba(24, 16, 34, 0.88);
    --border: rgba(212, 178, 108, 0.35);
    --gold: #e3c37d;
    --lilac: #c9b6e4;
    --text: #f3ece0;
    --dim: #a89bb9;
    --crimson: #d86c78;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    background: radial-gradient(circle at 50% 0%, #1d122b 0%, #09050e 75%);
    color: var(--text);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    padding: 24px;
    max-width: 1400px;
    margin-inline: auto;
  }}
  header {{
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 18px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 24px;
  }}
  h1 {{
    margin: 0;
    font-size: 26px;
    color: var(--gold);
    letter-spacing: 1px;
  }}
  .sub {{
    color: var(--dim);
    font-size: 14px;
    margin-top: 4px;
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
    font-size: 14px;
  }}
  .studio-grid {{
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 22px;
    margin-bottom: 28px;
  }}
  @media (max-width: 1024px) {{
    .studio-grid {{ grid-template-columns: 1fr; }}
  }}
  .card {{
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 18px;
    padding: 20px;
    box-shadow: 0 14px 36px rgba(0,0,0,0.45);
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
    transition: opacity 0.35s ease;
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
  .stage-subtitles {{
    text-align: center;
  }}
  .stage-en {{
    font-size: 17px;
    line-height: 1.45;
    color: #fff;
    margin-bottom: 6px;
    text-shadow: 0 2px 6px #000;
  }}
  .stage-ja {{
    font-size: 15px;
    line-height: 1.45;
    color: var(--lilac);
    text-shadow: 0 2px 6px #000;
  }}
  .bgm-controls {{
    margin-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }}
  .bgm-ControlsRow {{
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }}
  audio {{
    width: 100%;
    height: 40px;
  }}
  .score-pill {{
    background: rgba(201, 182, 228, 0.1);
    border-left: 3px solid var(--gold);
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 13.5px;
    color: var(--lilac);
  }}
  .scene-list {{
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 490px;
    overflow-y: auto;
    padding-right: 4px;
  }}
  .scene-item {{
    display: grid;
    grid-template-columns: 76px 1fr;
    gap: 12px;
    align-items: center;
    padding: 9px 12px;
    border-radius: 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07);
    cursor: pointer;
    transition: all 0.18s ease;
  }}
  .scene-item:hover, .scene-item.active {{
    background: rgba(227, 195, 125, 0.14);
    border-color: var(--gold);
  }}
  .scene-time {{
    font-family: monospace;
    font-size: 12.5px;
    color: var(--gold);
    font-weight: 700;
  }}
  .scene-title {{
    font-weight: 700;
    font-size: 14px;
    color: var(--text);
  }}
  .scene-ja-mini {{
    font-size: 12.5px;
    color: var(--dim);
    margin-top: 2px;
  }}
  .filter-bar {{
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }}
  .btn-group {{
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }}
  button.pill {{
    background: rgba(32, 22, 46, 0.9);
    color: var(--text);
    border: 1px solid var(--border);
    padding: 8px 16px;
    border-radius: 999px;
    cursor: pointer;
    font-size: 13.5px;
    font-weight: 600;
  }}
  button.pill.active {{
    background: var(--gold);
    color: #120a18;
    border-color: var(--gold);
  }}
  .voices-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
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
  }}
  .voice-name {{
    font-size: 18px;
    font-weight: 700;
    color: var(--gold);
  }}
  .voice-badge {{
    font-size: 11px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(227, 195, 125, 0.18);
    color: var(--gold);
    border: 1px solid rgba(227, 195, 125, 0.4);
  }}
  .voice-meta {{
    font-size: 12px;
    color: var(--lilac);
    font-family: monospace;
  }}
  .voice-note {{
    font-size: 13px;
    color: var(--text);
    line-height: 1.45;
  }}
  label.duck-toggle {{
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13.5px;
    color: var(--gold);
    cursor: pointer;
    user-select: none;
  }}
</style>
</head>
<body>
<header>
  <div>
    <h1>BEFORE THE ROAD · 2:00 Prologue Müzik & Japonca Narrator Seçim Stüdyosu</h1>
    <div class="sub">9 Sahneli Prologue Orkestral Müzik Tasarımı (E Minor → D Minor, 120.0 sn) & 30 Doğrulanmış Google Chirp 3 HD (ja-JP) Ses Adayı</div>
  </div>
  <div class="top-links">
    <a href="/?scene=Prologue" target="_blank">▶ Oyunda Canlı Prologue'u Aç (?scene=Prologue)</a>
  </div>
</header>

<div class="studio-grid">
  <div class="card">
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

  <div class="card">
    <h2 style="margin:0 0 12px 0;font-size:18px;color:var(--gold);">9 Prologue Sahnesi & Müzikal Akış (Tıklayarak O Saniyeye Atla)</h2>
    <div class="scene-list" id="scene-list"></div>
  </div>
</div>

<div class="card">
  <div class="filter-bar">
    <div>
      <h2 style="margin:0;font-size:20px;color:var(--gold);">Japonca Narrator (`jp_narration`) Ses Seçimi · Google Chirp 3 HD (`ja-JP`)</h2>
      <div class="sub">Kanonik Yönlendirme: "neutral, low, unhurried; separate actor from the cast" — Ses örneğini başlattığınızda arka plandaki Prologue müziği otomatik kısılır (ducking).</div>
    </div>
    <label class="duck-toggle">
      <input type="checkbox" id="mix-with-bgm" checked>
      Ses Örneğini Çalarken Arka Planda Prologue Müziğini Kısık Çal (In-Game Mix Testi)
    </label>
  </div>
  <div class="btn-group" style="margin-bottom:16px;">
    <button class="pill active" data-filter="REC">★ Narrator İçin Önerilenler (İlk 8)</button>
    <button class="pill" data-filter="MALE">Erkek Sesler (16)</button>
    <button class="pill" data-filter="FEMALE">Kadın Sesler (14)</button>
    <button class="pill" data-filter="ALL">Tüm 30 Ses</button>
  </div>
  <div class="voices-grid" id="voices-grid"></div>
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

let activeVoiceAudio = null;
function renderVoices(filter) {{
  voicesGrid.replaceChildren();
  const list = data.voices.filter(v => {{
    if (filter === 'REC') return v.recommended;
    if (filter === 'MALE') return v.gender === 'MALE';
    if (filter === 'FEMALE') return v.gender === 'FEMALE';
    return true;
  }});
  for (const v of list) {{
    const card = document.createElement('div');
    card.className = 'voice-card' + (v.recommended ? ' recommended' : '');
    const head = document.createElement('div');
    head.className = 'voice-head';
    head.innerHTML = `<span class="voice-name">${{v.name}} (${{v.gender === 'MALE' ? 'Erkek' : 'Kadın'}})</span>` +
      (v.badge ? `<span class="voice-badge">${{v.badge}}</span>` : '');
    const meta = document.createElement('div');
    meta.className = 'voice-meta';
    meta.textContent = `${{v.voice_id}} · Perde: ${{v.f0_hz}} Hz · Süre: ${{v.duration_s}} sn`;
    const note = document.createElement('div');
    note.className = 'voice-note';
    note.textContent = v.note_tr;
    const player = document.createElement('audio');
    player.controls = true;
    player.preload = 'none';
    player.src = v.file;
    player.addEventListener('play', () => {{
      if (activeVoiceAudio && activeVoiceAudio !== player) activeVoiceAudio.pause();
      activeVoiceAudio = player;
      if (mixToggle.checked) {{
        bgm.volume = 0.24;
        if (bgm.paused) bgm.play().catch(() => undefined);
      }}
    }});
    const restoreBgm = () => {{
      if (activeVoiceAudio === player) bgm.volume = 1.0;
    }};
    player.addEventListener('pause', restoreBgm);
    player.addEventListener('ended', restoreBgm);
    card.append(head, meta, note, player);
    voicesGrid.append(card);
  }}
}}

document.querySelectorAll('button.pill').forEach(btn => {{
  btn.onclick = () => {{
    document.querySelectorAll('button.pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderVoices(btn.dataset.filter);
  }};
}});
renderVoices('REC');
</script>
</body>
</html>
"""
    (OUT_DIR / 'index.html').write_text(html, encoding='utf-8')
    print(f'Audition studio built at apps/game/public/content/audition/index.html with {len(voices_data)} voices and {len(scenes_data)} scenes.')


if __name__ == '__main__':
    main()
