import { useEffect, useState, type ReactNode } from 'react';
import { downloadJson, type Me } from '../api';

export type ApprovalStatus = 'pending' | 'approved' | 'revision' | 'pulled_to_game';

export interface AnimationEntry {
  id: string;
  title: string;
  category: 'UI_STEP1' | 'UI_KIT_V001' | 'CHARACTER_KERA_VOSS';
  categoryLabel: string;
  gifUrl: string;
  targetScreen: string;
  targetEnginePath: string;
  framesInfo: string;
  description: string;
  defaultBg: 'cathedral' | 'checker' | 'stage';
}

export interface ApprovalRecord {
  status: ApprovalStatus;
  note: string;
  updatedAt: string;
}

const STORAGE_KEY = 'uomd_admin_animation_approvals_v001';

export const ANIMATION_CATALOG: AnimationEntry[] = [
  {
    id: '01_ui_eclipse_corona_loop',
    title: '1. Tutulma Koronası & Kül Akışı (Eclipse Corona Loop)',
    category: 'UI_STEP1',
    categoryLabel: 'Adım 1 · Ana Menü & Yükleme',
    gifUrl: '/dev/animations/01_ui_eclipse_corona_loop.gif',
    targetScreen: 'TitleScene (Ana Menü Gökyüzü Katmanı)',
    targetEnginePath: 'apps/game/src/scenes/TitleScene.ts → coronaSprite',
    framesInfo: '16 Kare Döngüsel GIF · 12.5 FPS + Canlı CSS/Pixi Katmanı',
    description: 'Ana Menüdeki kara güneş tutulması halkasının saat yönünde ağır dönüşü, altın korona parlaması ve yükselen kor/kül parçacıkları.',
    defaultBg: 'cathedral'
  },
  {
    id: '02_ui_bell_resonance_pulse',
    title: '2. Çatlak Çan Rezonansı & Ses Dalgaları (Bell Resonance)',
    category: 'UI_STEP1',
    categoryLabel: 'Adım 1 · Ana Menü & Yükleme',
    gifUrl: '/dev/animations/02_ui_bell_resonance_pulse.gif',
    targetScreen: 'TitleScene & SummonScene (Merkez Çan Amblemi)',
    targetEnginePath: 'apps/game/src/scenes/TitleScene.ts → bellEmblem',
    framesInfo: '16 Kare Döngüsel GIF · 12.5 FPS + Sarkaç Salınımı',
    description: 'Kırık bronz çan ambleminin ağır sarkaç salınımı, çatlaklarından sızan kehribar ateş ve dışa yayılan altın akustik şok halkaları.',
    defaultBg: 'cathedral'
  },
  {
    id: '03_ui_title_cta_wax_seal',
    title: '3. Mühürlü Başlat Butonu Ateşlemesi (Wax-Seal CTA Ignition)',
    category: 'UI_STEP1',
    categoryLabel: 'Adım 1 · Ana Menü & Yükleme',
    gifUrl: '/dev/animations/03_ui_title_cta_wax_seal.gif',
    targetScreen: 'TitleScene ("Dokun ve Başla" / Tap to Start CTA)',
    targetEnginePath: 'apps/game/src/scenes/TitleScene.ts → startButton',
    framesInfo: '16 Kare Döngüsel GIF · Normal → Hover → Seal Crack → Burst',
    description: 'Gotik demir/altın ana menü butonunun üzerinde gezen ışık süpürmesi ve tıklandığında kızıl balmumu mührün çatlayarak kor saçması.',
    defaultBg: 'cathedral'
  },
  {
    id: '04_ui_loading_watch_bell',
    title: '4. Kırık Cep Saati & Sarkaç Yükleme Çarkı (Loading Spinner)',
    category: 'UI_STEP1',
    categoryLabel: 'Adım 1 · Ana Menü & Yükleme',
    gifUrl: '/dev/animations/04_ui_loading_watch_bell.gif',
    targetScreen: 'PatchWaitScene & Sahne Geçiş Yükleme Ekranı',
    targetEnginePath: 'apps/game/src/scenes/BootScene.ts → loadingSpinner',
    framesInfo: '16 Kare Döngüsel GIF · 12.5 FPS Kesintisiz Döngü',
    description: 'Aldric’in çatlak cep saati akrep/yelkovan dönüşü, altındaki minyatür sığınak çanının salınımı ve rün halkası nabzı.',
    defaultBg: 'cathedral'
  },
  {
    id: '05_ui_kit_button_4state_cycle',
    title: '5. Katmanlı RGBA Gotik Buton — 4 Durum Döngüsü (Normal/Hover/Pressed/Disabled)',
    category: 'UI_KIT_V001',
    categoryLabel: 'Öncelik #1A · Katmanlı RGBA UI Kit',
    gifUrl: '/dev/animations/05_ui_kit_button_4state_cycle.gif',
    targetScreen: 'Tüm Oyun & Lobi Menü Butonları (Yazısız Şeffaf RGBA)',
    targetEnginePath: 'narrative/15_Art_Workbench/ui_screens/production_v001/ui_kit/button_primary_*',
    framesInfo: '16 Kare GIF · 4 Durum (Normal, Hover, Pressed, Disabled)',
    description: '#00FF00 yeşil zeminden kesilmiş şeffaf RGBA buton çerçevelerinin üzerinde metin olmadan 4 etkileşim durumu geçişi.',
    defaultBg: 'checker'
  },
  {
    id: '06_ui_kit_hp_focus_bars_live',
    title: '6. Can (HP) & Tutulma Odağı (Focus) Barları Canlı Dolum & Ultimate Nabzı',
    category: 'UI_KIT_V001',
    categoryLabel: 'Öncelik #1A · Katmanlı RGBA UI Kit',
    gifUrl: '/dev/animations/06_ui_kit_hp_focus_bars_live.gif',
    targetScreen: 'BattleScene HUD & Karakter Durum Çubukları',
    targetEnginePath: 'narrative/15_Art_Workbench/ui_screens/production_v001/ui_kit/bar_*',
    framesInfo: '18 Kare GIF · Hasar, İyileşme ve %100 Focus Ultimate Hazır Efekti',
    description: 'Boş metal bar çerçevesi (bar_frame_empty) içinde akan kızıl HP sıvısı ve %100 olduğunda parlayan altın-mor Focus göstergesi.',
    defaultBg: 'cathedral'
  },
  {
    id: '07_kera_voss_chibi_all_8_states',
    title: '7. Kera Voss — 8 Savaş Durumu Tam Döngü (Idle, Walk, Basic, Active, Ult, Hit, Defeat, Victory)',
    category: 'CHARACTER_KERA_VOSS',
    categoryLabel: 'Öncelik #2 · Pilot Karakter: Kera Voss',
    gifUrl: '/dev/animations/07_kera_voss_chibi_all_8_states.gif',
    targetScreen: 'BattleScene — UnitView (5v5 Taktiksel Savaş Sahnesi)',
    targetEnginePath: 'narrative/15_Art_Workbench/characters/kera_voss/production_v001/animation/states/*',
    framesInfo: '24 Kare GIF · 8 Durum × 3 Prosedürel Tween Karesi · 512×512 RGBA Pivot (0.5, 0.875)',
    description: 'Kera Voss 2-Head SD Chibi birim spritelarının 8 zorunlu savaş durumunun tamamı, ayak hizası sabitlenmiş ve nefes/hamle tweenleriyle hareketlendirilmiş döngüsü.',
    defaultBg: 'stage'
  },
  {
    id: '08_kera_voss_chibi_combat_combo',
    title: '8. Kera Voss — Savaş İçi Aksiyon Kombo Akışı (Idle → Walk → Basic → Active → Ultimate → Victory)',
    category: 'CHARACTER_KERA_VOSS',
    categoryLabel: 'Öncelik #2 · Pilot Karakter: Kera Voss',
    gifUrl: '/dev/animations/08_kera_voss_chibi_combat_combo.gif',
    targetScreen: 'BattleScene — Canlı Tur Sırası Kombo Gösterimi',
    targetEnginePath: 'apps/game/src/scenes/BattleScene.ts → UnitView.playState()',
    framesInfo: '13 Kare Hızlı Savaş Kombo GIF · 10.5 FPS',
    description: 'Kera Voss’un gerçek bir savaş turunda ileri adım atıp havan darbesi (Basic), simya şişesi (Active) ve Tutulma Ateşi (Ultimate) kullandıktan sonra zafer pozuna geçişi.',
    defaultBg: 'stage'
  },
  {
    id: '09_kera_voss_vn_expressions_live',
    title: '9. Kera Voss — Görsel Roman (VN) 4 İfade & Diyalog Sahnesi Geçişi',
    category: 'CHARACTER_KERA_VOSS',
    categoryLabel: 'Öncelik #2 · Pilot Karakter: Kera Voss',
    gifUrl: '/dev/animations/09_kera_voss_vn_expressions_live.gif',
    targetScreen: 'StoryScene / NarrativeStage (2:3 Şeffaf RGBA Portre + Diyalog Kutusu)',
    targetEnginePath: 'narrative/15_Art_Workbench/characters/kera_voss/production_v001/vn/*',
    framesInfo: '16 Kare GIF · 4 İfade (Composed, Focused, Proud Smile, Defiant) · 768×1152 RGBA',
    description: 'Beden, şapka ve kadraj %100 sabit tutularak üretilen 4 farklı yüz ifadesinin VN diyalog kutusu ve hafif nefes hareketiyle yerinde görünümü.',
    defaultBg: 'stage'
  }
];

const CHIBI_STATES = [
  { id: '01_idle', label: '1. Idle (Bekleme)', file: 'kera_voss_chibi_01_idle_v001.png', anim: 'anim-chibi-idle' },
  { id: '02_walk', label: '2. Walk (Yürüme)', file: 'kera_voss_chibi_02_walk_v001.png', anim: 'anim-chibi-walk' },
  { id: '03_basic', label: '3. Basic (Havan Darbesi)', file: 'kera_voss_chibi_03_basic_v001.png', anim: 'anim-chibi-attack' },
  { id: '04_active', label: '4. Active (Simya Şişesi)', file: 'kera_voss_chibi_04_active_v001.png', anim: 'anim-chibi-skill' },
  { id: '05_ultimate', label: '5. Ultimate (Tutulma Ateşi)', file: 'kera_voss_chibi_05_ultimate_v001.png', anim: 'anim-chibi-ult' },
  { id: '06_hit', label: '6. Hit (Hasar Alma)', file: 'kera_voss_chibi_06_hit_v001.png', anim: 'anim-chibi-hit' },
  { id: '07_defeat', label: '7. Defeat (Düşüş)', file: 'kera_voss_chibi_07_defeat_v001.png', anim: 'anim-chibi-defeat' },
  { id: '08_victory', label: '8. Victory (Zafer)', file: 'kera_voss_chibi_08_victory_v001.png', anim: 'anim-chibi-victory' }
] as const;

const VN_EXPRESSIONS = [
  {
    id: 'composed',
    label: '1. Composed (Varsayılan Ciddi)',
    file: 'kera_voss_vn_composed_v001.png',
    dialogue: '"Ateş çukurundan bir adım geri dur Aldric. Rüzgâr ters eserse bu karışım kaldırım taşlarını bile eritir."'
  },
  {
    id: 'focused',
    label: '2. Focused (Analitik Odak)',
    file: 'kera_voss_vn_focused_v001.png',
    dialogue: '"İki tutam kül tuzu, üç damla çan suyu... Güzel, reaksiyon tam hesapladığım sıcaklıkta sabitlendi."'
  },
  {
    id: 'proud_smile',
    label: '3. Proud Smile (Özgüvenli Gülümseme)',
    file: 'kera_voss_vn_proud_smile_v001.png',
    dialogue: '"Sana benim pirinç havanımın Sanctum çeliğinden sağlam olduğunu söylemiştim! Bu şişeyi boşa harcama."'
  },
  {
    id: 'defiant',
    label: '4. Defiant (Meydan Okuyan / Savaş Emri)',
    file: 'kera_voss_vn_defiant_v001.png',
    dialogue: '"Eğer Veil yaratıkları Oakhaven meydanını istiyorsa, önce benim kükürt ateşimde boğulacaklar!"'
  }
] as const;

export function Animations({ me, say }: { me: Me | null; say: (m: string) => void }): ReactNode {
  const [activeTab, setActiveTab] = useState<'in_context' | 'gif_gallery'>('in_context');
  const [stageScene, setStageScene] = useState<'title' | 'battle' | 'vn' | 'uikit'>('battle');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [bgMode, setBgMode] = useState<'cathedral' | 'checker' | 'green'>('cathedral');

  // Interactive Battle Stage state
  const [chibiStateIdx, setChibiStateIdx] = useState<number>(0);
  const [autoCycleChibi, setAutoCycleChibi] = useState<boolean>(true);
  const [battleHp, setBattleHp] = useState<number>(88);
  const [battleFocus, setBattleFocus] = useState<number>(100);

  // Interactive VN Stage state
  const [vnExprIdx, setVnExprIdx] = useState<number>(0);
  const [autoCycleVn, setAutoCycleVn] = useState<boolean>(true);

  // Interactive Title Stage button state
  const [titleBtnState, setTitleBtnState] = useState<'normal' | 'hover' | 'pressed' | 'disabled'>('normal');

  // Approval state persisted in localStorage
  const [approvals, setApprovals] = useState<Record<string, ApprovalRecord>>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, ApprovalRecord>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(approvals));
    } catch {
      /* ignore quota errors */
    }
  }, [approvals]);

  // Auto-cycle Chibi states when enabled on Battle stage
  useEffect(() => {
    if (!autoCycleChibi || activeTab !== 'in_context' || stageScene !== 'battle') return;
    const timer = window.setInterval(() => {
      setChibiStateIdx((prev) => (prev + 1) % CHIBI_STATES.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [autoCycleChibi, activeTab, stageScene]);

  // Auto-cycle VN expressions when enabled on VN stage
  useEffect(() => {
    if (!autoCycleVn || activeTab !== 'in_context' || stageScene !== 'vn') return;
    const timer = window.setInterval(() => {
      setVnExprIdx((prev) => (prev + 1) % VN_EXPRESSIONS.length);
    }, 2400);
    return () => window.clearInterval(timer);
  }, [autoCycleVn, activeTab, stageScene]);

  const setStatus = (id: string, status: ApprovalStatus, noteText?: string): void => {
    setApprovals((prev) => {
      const existing = prev[id];
      const next: Record<string, ApprovalRecord> = {
        ...prev,
        [id]: {
          status,
          note: noteText !== undefined ? noteText : (existing?.note ?? ''),
          updatedAt: new Date().toISOString()
        }
      };
      return next;
    });
    const label =
      status === 'approved'
        ? 'Onaylandı (Approved)'
        : status === 'pulled_to_game'
          ? 'Oyuna Çekildi / Entegre Edilecek (Pull Ready)'
          : status === 'revision'
            ? 'Revize İstendi'
            : 'Beklemeye Alındı';
    say(`${id}: ${label}`);
  };

  const approveAllVisible = (entries: AnimationEntry[]): void => {
    const now = new Date().toISOString();
    setApprovals((prev) => {
      const next = { ...prev };
      for (const e of entries) {
        next[e.id] = { status: 'approved', note: next[e.id]?.note ?? '', updatedAt: now };
      }
      return next;
    });
    say(`${entries.length} animasyon onaylandı!`);
  };

  const filteredCatalog = ANIMATION_CATALOG.filter(
    (item) => categoryFilter === 'ALL' || item.category === categoryFilter
  );

  const approvedCount = ANIMATION_CATALOG.filter(
    (x) => approvals[x.id]?.status === 'approved' || approvals[x.id]?.status === 'pulled_to_game'
  ).length;
  const pulledCount = ANIMATION_CATALOG.filter((x) => approvals[x.id]?.status === 'pulled_to_game').length;

  const activeChibi = CHIBI_STATES[chibiStateIdx] ?? CHIBI_STATES[0];
  const activeVn = VN_EXPRESSIONS[vnExprIdx] ?? VN_EXPRESSIONS[0];

  return (
    <div>
      <style>{`
        @keyframes uomdSpinSlow {
          from { transform: rotate(0deg) scale(1); }
          50% { transform: rotate(180deg) scale(1.06); }
          to { transform: rotate(360deg) scale(1); }
        }
        @keyframes uomdBellPendulum {
          0%, 100% { transform: rotate(-7deg); }
          50% { transform: rotate(7deg); }
        }
        @keyframes uomdFloatEmbers {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.78; }
          50% { transform: translateY(-12px) scale(1.08); opacity: 1; }
        }
        @keyframes uomdChibiIdle {
          0%, 100% { transform: translateY(0px) scaleY(1); }
          50% { transform: translateY(-6px) scaleY(1.03); }
        }
        @keyframes uomdChibiWalk {
          0%, 100% { transform: translateX(0px) translateY(0px) rotate(0deg); }
          25% { transform: translateX(12px) translateY(-10px) rotate(3deg); }
          50% { transform: translateX(22px) translateY(0px) rotate(0deg); }
          75% { transform: translateX(10px) translateY(-8px) rotate(-3deg); }
        }
        @keyframes uomdChibiAttack {
          0%, 100% { transform: translateX(0px) scale(1); }
          35% { transform: translateX(-14px) scale(0.96); }
          65% { transform: translateX(46px) translateY(-6px) scale(1.08); filter: drop-shadow(0 0 16px #ff9233); }
        }
        @keyframes uomdChibiSkill {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-16px) scale(1.1); filter: drop-shadow(0 0 22px #ffae33); }
        }
        @keyframes uomdChibiUlt {
          0%, 100% { transform: translateY(0px) scale(1); filter: drop-shadow(0 0 12px #ff5e1a); }
          50% { transform: translateY(-24px) scale(1.18); filter: drop-shadow(0 0 34px #ffae00) brightness(1.15); }
        }
        @keyframes uomdChibiHit {
          0%, 100% { transform: translateX(0px); }
          20% { transform: translateX(-22px) rotate(-6deg); filter: drop-shadow(0 0 18px #ff2a2a) brightness(1.3); }
          40% { transform: translateX(-10px) rotate(4deg); }
          60% { transform: translateX(-18px) rotate(-3deg); }
        }
        @keyframes uomdChibiDefeat {
          0%, 100% { transform: translateY(14px) rotate(-8deg) scale(0.95); opacity: 0.88; }
          50% { transform: translateY(17px) rotate(-10deg) scale(0.94); opacity: 0.75; }
        }
        @keyframes uomdChibiVictory {
          0%, 100% { transform: translateY(0px) scale(1); }
          40% { transform: translateY(-20px) scale(1.08); filter: drop-shadow(0 0 20px #ffd166); }
          70% { transform: translateY(-6px) scale(1.03); }
        }
        .anim-chibi-idle { animation: uomdChibiIdle 1.6s ease-in-out infinite; }
        .anim-chibi-walk { animation: uomdChibiWalk 0.9s ease-in-out infinite; }
        .anim-chibi-attack { animation: uomdChibiAttack 0.95s ease-in-out infinite; }
        .anim-chibi-skill { animation: uomdChibiSkill 1.1s ease-in-out infinite; }
        .anim-chibi-ult { animation: uomdChibiUlt 1.2s ease-in-out infinite; }
        .anim-chibi-hit { animation: uomdChibiHit 0.8s ease-in-out infinite; }
        .anim-chibi-defeat { animation: uomdChibiDefeat 2s ease-in-out infinite; }
        .anim-chibi-victory { animation: uomdChibiVictory 1.1s ease-in-out infinite; }
        .bg-checker {
          background-color: #181420;
          background-image:
            linear-gradient(45deg, #252030 25%, transparent 25%),
            linear-gradient(-45deg, #252030 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #252030 75%),
            linear-gradient(-45deg, transparent 75%, #252030 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
        .bg-cathedral {
          background: radial-gradient(circle at 50% 42%, #281a3d 0%, #120c1c 68%, #08050d 100%);
        }
        .bg-green {
          background: #00ff00;
        }
      `}</style>

      <header className="page" style={{ flexWrap: 'wrap', gap: 10 }}>
        <h2 style={{ margin: 0 }}>Animasyon Stüdyosu &amp; Onay Merkezi (GIF + Yerinde Sahne)</h2>
        <span className="badge ok">{approvedCount} / {ANIMATION_CATALOG.length} Onaylı</span>
        <span className="badge info">{pulledCount} Oyuna Çekildi</span>
        <div className="row" style={{ marginLeft: 'auto', margin: 0, gap: 8 }}>
          <button
            type="button"
            className={`btn${activeTab === 'in_context' ? ' primary' : ''}`}
            onClick={() => setActiveTab('in_context')}
          >
            🎬 1. Yerinde Canlı Sahne Simülatörü (In-Context)
          </button>
          <button
            type="button"
            className={`btn${activeTab === 'gif_gallery' ? ' primary' : ''}`}
            onClick={() => setActiveTab('gif_gallery')}
          >
            🎞️ 2. Tüm Hareketli GIF Galerisi &amp; Onay Kutusu ({ANIMATION_CATALOG.length} GIF)
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadJson('uomd_animation_approvals_v001.json', {
                exportedAt: new Date().toISOString(),
                exportedBy: me?.identity ?? 'local-owner',
                approvals
              })
            }
          >
            Onay JSON İndir
          </button>
        </div>
      </header>

      <p style={{ color: 'var(--dim)', marginTop: 4 }}>
        Burada statik PNG yerine tüm UI ve karakter animasyonlarını <strong>gerçek döngüsel GIF</strong> olarak veya{' '}
        <strong>oyun sahnelerinin içinde yerinde (Ana Menü, 5v5 Savaş, Görsel Roman Diyaloğu ve UI Kit)</strong> canlı görebilirsiniz.
        Beğendiklerinizi <strong>Onayla</strong> veya <strong>Oyuna Çek</strong> olarak işaretleyin.
      </p>

      {/* ==================== TAB 1: IN-CONTEXT LIVE STAGE SIMULATOR ==================== */}
      {activeTab === 'in_context' ? (
        <section className="card" style={{ marginBottom: 18, padding: 16 }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 0 }}>
            <div className="row" style={{ margin: 0, gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn${stageScene === 'battle' ? ' primary' : ''}`}
                onClick={() => setStageScene('battle')}
              >
                ⚔️ Sahne A: 5v5 Savaş Sahnesi (Kera Voss Chibi + HP/Focus Barları)
              </button>
              <button
                type="button"
                className={`btn${stageScene === 'vn' ? ' primary' : ''}`}
                onClick={() => setStageScene('vn')}
              >
                📖 Sahne B: Görsel Roman (VN) Diyalog Sahnesi (Kera Voss 4 İfade + 9-Slice Çerçeve)
              </button>
              <button
                type="button"
                className={`btn${stageScene === 'title' ? ' primary' : ''}`}
                onClick={() => setStageScene('title')}
              >
                🌘 Sahne C: Ana Menü (Tutulma Koronası + Çan + 4 Durumlu Buton)
              </button>
              <button
                type="button"
                className={`btn${stageScene === 'uikit' ? ' primary' : ''}`}
                onClick={() => setStageScene('uikit')}
              >
                🛡️ Sahne D: Katmanlı RGBA UI Kit &amp; Core 16 İkon Test Masası
              </button>
            </div>
          </div>

          {/* --- SCENE A: 5V5 BATTLE STAGE IN-CONTEXT --- */}
          {stageScene === 'battle' ? (
            <div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <strong style={{ marginRight: 6 }}>Savaş Durumu Seç:</strong>
                {CHIBI_STATES.map((st, idx) => (
                  <button
                    key={st.id}
                    type="button"
                    className={`btn${chibiStateIdx === idx ? ' primary' : ''}`}
                    onClick={() => {
                      setAutoCycleChibi(false);
                      setChibiStateIdx(idx);
                    }}
                  >
                    {st.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`btn${autoCycleChibi ? ' primary' : ''}`}
                  onClick={() => setAutoCycleChibi((v) => !v)}
                >
                  {autoCycleChibi ? '⏸ Otomatik Döngü: AÇIK' : '▶ Otomatik Döngü: KAPALI'}
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(480px, 1.45fr) minmax(320px, 1fr)',
                  gap: 16,
                  alignItems: 'stretch'
                }}
              >
                {/* Live Interactive Battle Stage Viewport */}
                <div
                  style={{
                    position: 'relative',
                    minHeight: 420,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '2px solid #8a6421',
                    backgroundImage: 'url(/dev/animations/assets/ui_hub_sanctuary_v001.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.65)'
                  }}
                >
                  {/* Dark atmospheric battle vignette */}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background:
                        'linear-gradient(180deg, rgba(10,7,18,0.65) 0%, rgba(15,10,24,0.35) 50%, rgba(8,5,14,0.88) 100%)'
                    }}
                  />

                  {/* Top HUD — Ornate HP & Focus Bars from production_v001 */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 18px',
                      background: 'rgba(11, 8, 18, 0.82)',
                      borderBottom: '1px solid rgba(212, 155, 53, 0.35)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img
                        src="/dev/animations/assets/icon_el_ember.png"
                        alt="Ember"
                        style={{ width: 38, height: 38 }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, color: '#f5e6c8', fontSize: 14 }}>
                          KERA VOSS · 4★ EMBER CONTROLLER
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: '#c8b496' }}>
                          Durum: {activeChibi.label} · Ayak Pivotu: (256, 448)
                        </div>
                      </div>
                    </div>

                    {/* Live Bars using production_v001 bar_frame_empty + fills */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: 250 }}>
                      <div style={{ position: 'relative', height: 24 }}>
                        <img
                          src="/dev/animations/assets/bar_frame_empty_v001.png"
                          alt=""
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
                        />
                        <img
                          src="/dev/animations/assets/bar_fill_hp_crimson_v001.png"
                          alt=""
                          style={{
                            position: 'absolute',
                            left: '6%',
                            top: '25%',
                            width: `${Math.max(4, battleHp * 0.88)}%`,
                            height: '50%',
                            objectFit: 'fill',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                      <div style={{ position: 'relative', height: 24 }}>
                        <img
                          src="/dev/animations/assets/bar_frame_empty_v001.png"
                          alt=""
                          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' }}
                        />
                        <img
                          src="/dev/animations/assets/bar_fill_focus_gold_violet_v001.png"
                          alt=""
                          style={{
                            position: 'absolute',
                            left: '6%',
                            top: '25%',
                            width: `${Math.max(4, battleFocus * 0.88)}%`,
                            height: '50%',
                            objectFit: 'fill',
                            transition: 'width 0.3s ease'
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Center Battle Arena with Kera Voss Animated Chibi + VFX */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      height: 275,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {/* Rotating Eclipse Ring on Ultimate */}
                    {activeChibi.id === '05_ultimate' ? (
                      <img
                        src="/dev/animations/assets/vfx_eclipse_corona_ring_v001.png"
                        alt=""
                        style={{
                          position: 'absolute',
                          width: 250,
                          height: 250,
                          opacity: 0.72,
                          animation: 'uomdSpinSlow 6s linear infinite',
                          pointerEvents: 'none'
                        }}
                      />
                    ) : null}

                    {/* Floating Ember Particles */}
                    <img
                      src="/dev/animations/assets/vfx_ember_ash_particles_v001.png"
                      alt=""
                      style={{
                        position: 'absolute',
                        width: 240,
                        height: 240,
                        opacity: 0.65,
                        animation: 'uomdFloatEmbers 2.4s ease-in-out infinite',
                        pointerEvents: 'none'
                      }}
                    />

                    {/* Ground tactical shadow */}
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 24,
                        width: 148,
                        height: 32,
                        borderRadius: '50%',
                        background: 'radial-gradient(ellipse, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 75%)',
                        border: '1px solid rgba(229, 169, 60, 0.45)'
                      }}
                    />

                    {/* Kera Voss Normalized 512x512 RGBA Chibi Sprite */}
                    <img
                      key={activeChibi.id}
                      src={`/dev/animations/assets/${activeChibi.file}`}
                      alt={activeChibi.label}
                      className={activeChibi.anim}
                      style={{
                        position: 'relative',
                        width: 230,
                        height: 230,
                        objectFit: 'contain'
                      }}
                    />
                  </div>

                  {/* Bottom Skill Bar with Core 16 RGBA Skill Icons */}
                  <div
                    style={{
                      position: 'relative',
                      zIndex: 2,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 18px',
                      background: 'rgba(10, 7, 16, 0.88)',
                      borderTop: '1px solid rgba(212, 155, 53, 0.35)'
                    }}
                  >
                    <div className="row" style={{ margin: 0, gap: 8 }}>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setBattleHp((h) => Math.max(15, h - 25));
                          setAutoCycleChibi(false);
                          setChibiStateIdx(5);
                        }}
                      >
                        💥 Hasar Testi (Hit)
                      </button>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => {
                          setBattleHp(100);
                          setBattleFocus(100);
                          setAutoCycleChibi(false);
                          setChibiStateIdx(4);
                        }}
                      >
                        🔥 Ultimate Testi
                      </button>
                    </div>
                    <div className="row" style={{ margin: 0, gap: 10 }}>
                      <img
                        src="/dev/animations/assets/icon_skill_basic.png"
                        alt="Basic"
                        title="Basic Skill"
                        style={{ width: 42, height: 42, cursor: 'pointer' }}
                        onClick={() => {
                          setAutoCycleChibi(false);
                          setChibiStateIdx(2);
                        }}
                      />
                      <img
                        src="/dev/animations/assets/icon_skill_active.png"
                        alt="Active"
                        title="Active Skill"
                        style={{ width: 42, height: 42, cursor: 'pointer' }}
                        onClick={() => {
                          setAutoCycleChibi(false);
                          setChibiStateIdx(3);
                        }}
                      />
                      <img
                        src="/dev/animations/assets/icon_skill_ultimate.png"
                        alt="Ultimate"
                        title="Ultimate Skill"
                        style={{ width: 46, height: 46, cursor: 'pointer', filter: 'drop-shadow(0 0 8px #f5b841)' }}
                        onClick={() => {
                          setAutoCycleChibi(false);
                          setChibiStateIdx(4);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Side-by-Side Animated GIFs for Kera Voss */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: 'space-between', margin: '0 0 6px' }}>
                      <strong>Kera Voss 8 Durum GIF Döngüsü</strong>
                      <span className="badge ok">GIF</span>
                    </div>
                    <img
                      src="/dev/animations/07_kera_voss_chibi_all_8_states.gif"
                      alt="Kera Voss 8 States GIF"
                      style={{ width: '100%', borderRadius: 8, border: '1px solid #3c2c52' }}
                    />
                  </div>
                  <div className="card" style={{ padding: 12 }}>
                    <div className="row" style={{ justifyContent: 'space-between', margin: '0 0 6px' }}>
                      <strong>Savaş Kombo Akışı GIF</strong>
                      <span className="badge info">COMBO GIF</span>
                    </div>
                    <img
                      src="/dev/animations/08_kera_voss_chibi_combat_combo.gif"
                      alt="Kera Voss Combat Combo GIF"
                      style={{ width: '100%', borderRadius: 8, border: '1px solid #3c2c52' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* --- SCENE B: VISUAL NOVEL (VN) DIALOGUE STAGE IN-CONTEXT --- */}
          {stageScene === 'vn' ? (
            <div>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <strong>VN İfadesi Seç (Kadraj &amp; Kıyafet %100 Sabit):</strong>
                {VN_EXPRESSIONS.map((exp, idx) => (
                  <button
                    key={exp.id}
                    type="button"
                    className={`btn${vnExprIdx === idx ? ' primary' : ''}`}
                    onClick={() => {
                      setAutoCycleVn(false);
                      setVnExprIdx(idx);
                    }}
                  >
                    {exp.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`btn${autoCycleVn ? ' primary' : ''}`}
                  onClick={() => setAutoCycleVn((v) => !v)}
                >
                  {autoCycleVn ? '⏸ Otomatik İfade Geçişi: AÇIK' : '▶ Otomatik İfade Geçişi: KAPALI'}
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(480px, 1.4fr) minmax(320px, 1fr)',
                  gap: 16,
                  alignItems: 'stretch'
                }}
              >
                {/* Live VN Stage */}
                <div
                  style={{
                    position: 'relative',
                    minHeight: 440,
                    borderRadius: 12,
                    overflow: 'hidden',
                    border: '2px solid #9c732b',
                    backgroundImage: 'url(/dev/animations/assets/ui_hub_sanctuary_v001.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(12,8,20,0.45) 0%, rgba(10,7,18,0.88) 100%)'
                    }}
                  />

                  {/* Kera Voss 768x1152 (2:3) Keyed RGBA VN Sprite */}
                  <img
                    src={`/dev/animations/assets/${activeVn.file}`}
                    alt={activeVn.label}
                    className="anim-chibi-idle"
                    style={{
                      position: 'absolute',
                      left: 42,
                      bottom: 92,
                      height: 340,
                      objectFit: 'contain',
                      filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.75))'
                    }}
                  />

                  {/* VN Dialogue Box using production_v001 divider & Gothic styling */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 20,
                      right: 20,
                      bottom: 16,
                      minHeight: 118,
                      padding: '16px 22px',
                      borderRadius: 10,
                      background: 'rgba(12, 9, 20, 0.94)',
                      border: '2px solid #b88736',
                      boxShadow: '0 8px 28px rgba(0,0,0,0.8)'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8
                      }}
                    >
                      <span
                        style={{
                          background: '#2a1c3b',
                          border: '1px solid #d49b35',
                          color: '#ffe3a8',
                          padding: '3px 12px',
                          borderRadius: 4,
                          fontWeight: 700,
                          fontSize: 13
                        }}
                      >
                        KERA VOSS — {activeVn.label}
                      </span>
                      <img
                        src="/dev/animations/assets/divider_bell_ornate_v001.png"
                        alt=""
                        style={{ height: 22, objectFit: 'contain' }}
                      />
                    </div>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#f2e8d5' }}>
                      {activeVn.dialogue}
                    </p>
                  </div>
                </div>

                {/* VN Animated GIF Preview */}
                <div className="card" style={{ padding: 12 }}>
                  <div className="row" style={{ justifyContent: 'space-between', margin: '0 0 8px' }}>
                    <strong>Kera Voss 4 İfade VN Sahne GIF</strong>
                    <span className="badge ok">VN GIF</span>
                  </div>
                  <img
                    src="/dev/animations/09_kera_voss_vn_expressions_live.gif"
                    alt="Kera Voss VN GIF"
                    style={{ width: '100%', borderRadius: 8, border: '1px solid #3c2c52' }}
                  />
                  <p className="mono" style={{ fontSize: 11.5, marginTop: 8, color: 'var(--dim)' }}>
                    4 ifade portresi (`composed`, `focused`, `proud_smile`, `defiant`) aynı temel portre kilidi üzerinden üretildiği için geçişlerde şapka, omuz veya kıyafet kayması yaşanmaz.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* --- SCENE C: TITLE SCREEN IN-CONTEXT --- */}
          {stageScene === 'title' ? (
            <div
              style={{
                position: 'relative',
                minHeight: 450,
                borderRadius: 12,
                overflow: 'hidden',
                border: '2px solid #9c732b',
                backgroundImage: 'url(/dev/animations/assets/ui_title_main_menu_v001.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 24
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'radial-gradient(circle at 50% 35%, rgba(20,12,32,0.25) 0%, rgba(8,5,14,0.82) 100%)'
                }}
              />

              {/* Top Animated Eclipse Corona + Swinging Bell Emblem */}
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  width: 240,
                  height: 240,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src="/dev/animations/assets/vfx_eclipse_corona_ring_v001.png"
                  alt="Eclipse Corona"
                  style={{
                    position: 'absolute',
                    width: 240,
                    height: 240,
                    animation: 'uomdSpinSlow 14s linear infinite'
                  }}
                />
                <img
                  src="/dev/animations/assets/vfx_ember_ash_particles_v001.png"
                  alt="Ember Particles"
                  style={{
                    position: 'absolute',
                    width: 220,
                    height: 220,
                    animation: 'uomdFloatEmbers 3s ease-in-out infinite'
                  }}
                />
                <img
                  src="/dev/animations/assets/icon_ui_bell.png"
                  alt="Fractured Bell"
                  style={{
                    position: 'relative',
                    width: 96,
                    height: 96,
                    transformOrigin: 'top center',
                    animation: 'uomdBellPendulum 2.8s ease-in-out infinite',
                    filter: 'drop-shadow(0 0 16px rgba(242,184,75,0.65))'
                  }}
                />
              </div>

              {/* Interactive 4-State Gothic Button in Title Context */}
              <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
                <div className="row" style={{ justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                  {(['normal', 'hover', 'pressed', 'disabled'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`btn${titleBtnState === st ? ' primary' : ''}`}
                      onClick={() => setTitleBtnState(st)}
                    >
                      Buton: {st.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div
                  onMouseEnter={() => {
                    if (titleBtnState !== 'disabled') setTitleBtnState('hover');
                  }}
                  onMouseLeave={() => {
                    if (titleBtnState !== 'disabled') setTitleBtnState('normal');
                  }}
                  onMouseDown={() => {
                    if (titleBtnState !== 'disabled') setTitleBtnState('pressed');
                  }}
                  onMouseUp={() => {
                    if (titleBtnState !== 'disabled') setTitleBtnState('hover');
                  }}
                  style={{
                    position: 'relative',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 340,
                    height: 96,
                    cursor: titleBtnState === 'disabled' ? 'not-allowed' : 'pointer',
                    transform: titleBtnState === 'pressed' ? 'translateY(3px)' : 'none',
                    transition: 'transform 0.1s ease'
                  }}
                >
                  <img
                    src={`/dev/animations/assets/button_primary_${titleBtnState}_v001.png`}
                    alt={titleBtnState}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                  <span
                    style={{
                      position: 'relative',
                      zIndex: 1,
                      fontFamily: 'Cinzel, Georgia, serif',
                      fontWeight: 700,
                      fontSize: 18,
                      letterSpacing: 2,
                      color: titleBtnState === 'disabled' ? '#7a7880' : '#fff0d4',
                      textShadow: '0 2px 6px rgba(0,0,0,0.9)'
                    }}
                  >
                    ENTER THE SANCTUARY
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          {/* --- SCENE D: LAYERED RGBA UI KIT & CORE 16 ICONS TESTBENCH --- */}
          {stageScene === 'uikit' ? (
            <div>
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                <strong>Arka Plan Modu:</strong>
                <button
                  type="button"
                  className={`btn${bgMode === 'cathedral' ? ' primary' : ''}`}
                  onClick={() => setBgMode('cathedral')}
                >
                  Koyu Katedral
                </button>
                <button
                  type="button"
                  className={`btn${bgMode === 'checker' ? ' primary' : ''}`}
                  onClick={() => setBgMode('checker')}
                >
                  Şeffaf Dama (Alpha Checkerboard)
                </button>
              </div>

              <div className={`card bg-${bgMode}`} style={{ padding: 18 }}>
                <h4 style={{ marginTop: 0 }}>Core 16 (#00FF00 Chroma-Keyed → 256×256 Şeffaf RGBA PNG İkonlar)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 10 }}>
                  {[
                    'icon_el_veil.png',
                    'icon_el_stone.png',
                    'icon_el_ember.png',
                    'icon_el_tide.png',
                    'icon_el_gale.png',
                    'icon_el_dawn.png',
                    'icon_skill_basic.png',
                    'icon_skill_active.png',
                    'icon_skill_ultimate.png',
                    'icon_st_dread.png',
                    'icon_st_stoneguard.png',
                    'icon_st_taunt.png',
                    'icon_ui_focus.png',
                    'icon_curr_eclipse_token.png',
                    'icon_ui_bell.png',
                    'icon_ui_wax_seal.png'
                  ].map((ic) => (
                    <div
                      key={ic}
                      style={{
                        textAlign: 'center',
                        padding: 8,
                        borderRadius: 8,
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'rgba(0,0,0,0.28)'
                      }}
                    >
                      <img src={`/dev/animations/assets/${ic}`} alt={ic} style={{ width: 64, height: 64 }} />
                      <div className="mono" style={{ fontSize: 10, marginTop: 4 }}>
                        {ic.replace(/^icon_|\.png$/g, '')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ==================== TAB 2: ANIMATED GIF GALLERY & APPROVAL QUEUE ==================== */}
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div className="row" style={{ margin: 0, gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn${categoryFilter === 'ALL' ? ' primary' : ''}`}
            onClick={() => setCategoryFilter('ALL')}
          >
            Tümü ({ANIMATION_CATALOG.length})
          </button>
          <button
            type="button"
            className={`btn${categoryFilter === 'UI_STEP1' ? ' primary' : ''}`}
            onClick={() => setCategoryFilter('UI_STEP1')}
          >
            Adım 1: Ana Menü &amp; Yükleme (4 GIF)
          </button>
          <button
            type="button"
            className={`btn${categoryFilter === 'UI_KIT_V001' ? ' primary' : ''}`}
            onClick={() => setCategoryFilter('UI_KIT_V001')}
          >
            Öncelik #1A: Katmanlı UI Kit (2 GIF)
          </button>
          <button
            type="button"
            className={`btn${categoryFilter === 'CHARACTER_KERA_VOSS' ? ' primary' : ''}`}
            onClick={() => setCategoryFilter('CHARACTER_KERA_VOSS')}
          >
            Öncelik #2: Kera Voss Savaş &amp; VN (3 GIF)
          </button>
        </div>

        <div className="row" style={{ margin: 0, gap: 6 }}>
          <button type="button" className="btn primary" onClick={() => approveAllVisible(filteredCatalog)}>
            ✅ Listelenenlerin Tümünü Onayla ({filteredCatalog.length})
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(390px, 1fr))',
          gap: 16,
          marginTop: 12
        }}
      >
        {filteredCatalog.map((item) => {
          const rec = approvals[item.id] ?? { status: 'pending', note: '', updatedAt: '' };
          const badgeClass =
            rec.status === 'approved' || rec.status === 'pulled_to_game'
              ? 'ok'
              : rec.status === 'revision'
                ? 'bad'
                : 'warn';
          const statusLabel =
            rec.status === 'approved'
              ? 'ONAYLANDI'
              : rec.status === 'pulled_to_game'
                ? 'OYUNA ÇEKİLDİ'
                : rec.status === 'revision'
                  ? 'REVİZE İSTENDİ'
                  : 'ONAY BEKLİYOR';

          return (
            <article
              key={item.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                border:
                  rec.status === 'approved' || rec.status === 'pulled_to_game'
                    ? '1.5px solid #3fa36c'
                    : rec.status === 'revision'
                      ? '1.5px solid #d14949'
                      : undefined
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', margin: 0 }}>
                <span className="badge info">{item.categoryLabel}</span>
                <span className={`badge ${badgeClass}`}>{statusLabel}</span>
              </div>

              <h3 style={{ margin: 0, fontSize: 16 }}>{item.title}</h3>

              <div
                className={item.defaultBg === 'checker' ? 'bg-checker' : 'bg-cathedral'}
                style={{
                  borderRadius: 8,
                  overflow: 'hidden',
                  border: '1px solid #382a4a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 220
                }}
              >
                <a href={item.gifUrl} target="_blank" rel="noreferrer" style={{ width: '100%' }}>
                  <img
                    src={item.gifUrl}
                    alt={item.title}
                    style={{ width: '100%', display: 'block', objectFit: 'contain', maxHeight: 320 }}
                  />
                </a>
              </div>

              <div className="mono" style={{ fontSize: 11.5, color: 'var(--dim)' }}>
                <div><strong>Sahne:</strong> {item.targetScreen}</div>
                <div><strong>Hedef:</strong> {item.targetEnginePath}</div>
                <div><strong>Format:</strong> {item.framesInfo}</div>
              </div>

              <p style={{ margin: 0, fontSize: 13.5 }}>{item.description}</p>

              <input
                type="text"
                placeholder="Not ekle (ör. hızı %15 artır, efekt parlaklığını kıs...)"
                value={rec.note}
                onChange={(e) => setStatus(item.id, rec.status, e.target.value)}
                style={{ width: '100%' }}
              />

              <div className="row" style={{ marginTop: 'auto', marginBottom: 0, gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn${rec.status === 'approved' ? ' primary' : ''}`}
                  onClick={() => setStatus(item.id, 'approved')}
                >
                  ✅ Onayla
                </button>
                <button
                  type="button"
                  className={`btn${rec.status === 'pulled_to_game' ? ' primary' : ''}`}
                  onClick={() => setStatus(item.id, 'pulled_to_game')}
                >
                  🚀 Oyuna Çek
                </button>
                <button
                  type="button"
                  className={`btn${rec.status === 'revision' ? ' primary' : ''}`}
                  onClick={() => setStatus(item.id, 'revision')}
                >
                  🛠️ Revize
                </button>
                <a className="btn" href={item.gifUrl} download={`${item.id}.gif`}>
                  GIF İndir
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
