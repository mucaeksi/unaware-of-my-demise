import { useEffect, useState, type ReactNode } from 'react';
import { downloadJson, type Me } from '../api';

export type ApprovalStatus = 'pending' | 'approved' | 'revision' | 'pulled_to_game';

export interface AnimationEntry {
  id: string;
  title: string;
  category: 'FIRST_AAB_FLOW' | 'UI_STEP1' | 'UI_KIT_V001' | 'CHARACTER_KERA_VOSS';
  categoryLabel: string;
  gifUrl: string;
  targetScreen: string;
  targetEnginePath: string;
  framesInfo: string;
  description: string;
  defaultBg: 'cathedral' | 'checker' | 'stage';
  previewSceneId?: string;
}

export interface ApprovalRecord {
  status: ApprovalStatus;
  note: string;
  updatedAt: string;
}

const STORAGE_KEY = 'uomd_admin_animation_approvals_v002';

export interface AabSceneStep {
  index: number;
  id: string;
  shortLabel: string;
  title: string;
  gifId: string;
  animations: string[];
}

export const AAB_15_SCENES: AabSceneStep[] = [
  {
    index: 1,
    id: 'fresh_flow',
    shortLabel: '1. Tam Akış (Splash → Hub)',
    title: 'Sahne 1: Splash Engine Credit & Tam İlk AAB Akışı',
    gifId: '10_aab_splash_studio_intro',
    animations: [
      'PixiJS v8.0 Wordmark & 4 Renk Prizma Işını',
      '#1 Dönen Kara Güneş Tutulma Koronası & Astronomik Rün Halkası',
      'Genişleyen Gümüş Cetvel & Cyan Glint Süpürmesi'
    ]
  },
  {
    index: 2,
    id: 'studio',
    shortLabel: '2. SovTaym Studios',
    title: 'Sahne 2: SovTaym Studios Presents (Kronometre & Çan)',
    gifId: '10_aab_splash_studio_intro',
    animations: [
      'Çift Yönlü Dönen Altın/Gümüş Kronometre Halkaları (studio_mark)',
      '#1 Tutulma Koronası Arka Plan Hale Nabzı',
      '#2 Sallanan Çatlak Çan & Dışa Yayılan Akustik Şok Halkası (330Hz Çan Sesi)'
    ]
  },
  {
    index: 3,
    id: 'title_fresh',
    shortLabel: '3. Ana Menü (Title)',
    title: 'Sahne 3: Ana Menü (TitleScene — Korona + Çan + Mühürlü Başlat)',
    gifId: '11_aab_title_screen_full',
    animations: [
      '#1 Logo Arkasında Dönen Kara Güneş Tutulma Koronası & Yükselen Kül/Kor Akışı',
      '#2 Logo Tacında Sallanan Çatlak Sığınak Çanı & Akustik Rezonans Halkaları',
      '#3 "TAP TO START" Kızıl/Altın Balmumu Mühür Kırılması & Kor Patlaması',
      '#5 Katmanlı Gotik Buton Üzerinde Metalik Işık Süpürmesi (Sheen Sweep)'
    ]
  },
  {
    index: 4,
    id: 'prologue',
    shortLabel: '4. 120sn 9-Sahne Prolog',
    title: 'Sahne 4: "Before the Road" 120sn 9 Sahneli Prolog',
    gifId: '12_aab_prologue_9scenes_flow',
    animations: [
      '9 Prolog İllüstrasyonunda (Crownfall → Search) Ken Burns Kamera Pan/Zoom',
      '#2 Üst Başlık Cetvelinde Sallanan Minyatür Çan & Her Sahne Geçişinde Akustik Şok Halkası',
      'Gotik Altyazı Plakası Üzerinde Altın Işık Süpürmesi & Canlı Ses Dalga Boyu Çubuğu'
    ]
  },
  {
    index: 5,
    id: 'story_t1',
    shortLabel: '5. LN T-1 Öncesi',
    title: 'Sahne 5: Tutorial T-1 Öncesi Görsel Roman (Whispering Ash)',
    gifId: '13_aab_tutorial_vn_mahmut_fadyme',
    animations: [
      'Mahmut & Fadyme Boydan Portre Nefes Alma & Mikro-Duruş Koreografisi',
      '4 Duygu İfadesi Yumuşak Crossfade & Fiziksel Tepki İvmesi',
      '#2 Diyalog Kutusu Üst Cetvelinde Sallanan Sığınak Çanı & Ses Senkron Çubuğu'
    ]
  },
  {
    index: 6,
    id: 'battle_t1',
    shortLabel: '6. Savaş T-1 (Whispering Ash)',
    title: 'Sahne 6: Savaş T-1 — Whispering Ash (Mahmut & Fadyme vs Bellbound Dead)',
    gifId: '14_aab_tutorial_battles_t1_t2_t3',
    animations: [
      '8 Savaş Durumu (Idle Nefes/Aura, Walk Adım Sekmesi, Basic Hamle, Active Çan Mührü, Ultimate, Hit, Defeat, Victory)',
      '#6 Gecikmeli Hasar İzi (Ghost Bar) + Sıvı Parıltılı HP Barı & %100 Focus Ultimate Nabzı',
      'Tur Sırası Portre Madalyonları & Gotik Yetenek Kartları'
    ]
  },
  {
    index: 7,
    id: 'story_t1_after',
    shortLabel: '7. LN T-1 Sonrası',
    title: 'Sahne 7: Tutorial T-1 Sonrası Görsel Roman',
    gifId: '13_aab_tutorial_vn_mahmut_fadyme',
    animations: [
      'Savaş Sonrası Mahmut & Fadyme Yakınlaşma Koreografisi (Omuzdan Kül Yaprağı Silkeleme)',
      'Duygu Geçişleri (Dry Humor ↔ Soft Smile / Warm) & Yükselen Kül Parçacıkları'
    ]
  },
  {
    index: 8,
    id: 'story_t2_before',
    shortLabel: '8. LN T-2 Öncesi',
    title: 'Sahne 8: Tutorial T-2 Öncesi Görsel Roman (Forgotten Stone Crossing)',
    gifId: '13_aab_tutorial_vn_mahmut_fadyme',
    animations: [
      'Hollow Pilgrim Karşılaşması — Kalkan Arkası Savunma Duruşu Koreografisi',
      'Gotik Diyalog Çerçevesi & Sallanan Çan Ayıracı'
    ]
  },
  {
    index: 9,
    id: 'battle_t2',
    shortLabel: '9. Savaş T-2 (Stone Crossing)',
    title: 'Sahne 9: Savaş T-2 — Forgotten Stone Crossing (Koruma & Taunt Savaşı)',
    gifId: '14_aab_tutorial_battles_t1_t2_t3',
    animations: [
      'Hollow Pilgrim & Bellbound Dead Karşısında Kalkan/Taunt & Odak (Focus) Mekanikleri',
      '#6 Canlı HP Ghost-Drain & Focus Dolum Animasyonları'
    ]
  },
  {
    index: 10,
    id: 'story_t2_after',
    shortLabel: '10. LN T-2 Sonrası + CG',
    title: 'Sahne 10: Tutorial T-2 Sonrası + Özel Event CG (Roadside Rest)',
    gifId: '13_aab_tutorial_vn_mahmut_fadyme',
    animations: [
      'Özel Tam Ekran Event CG Açılışı (still_roadside_rest — Zırh Kayışı Sıkma Sahnesi)',
      'CG Üzerinde Yumuşak Kamera Nefes Hareketi & Yükselen Kor/Kül Parçacıkları'
    ]
  },
  {
    index: 11,
    id: 'story_t3_before',
    shortLabel: '11. LN T-3 Öncesi',
    title: 'Sahne 11: Tutorial T-3 Öncesi Görsel Roman (Shelter Courtyard Dusk)',
    gifId: '13_aab_tutorial_vn_mahmut_fadyme',
    animations: [
      'Sığınak Avlusu Alacakaranlık Atmosferi & Son Savunma Hazırlığı Koreografisi',
      'Müzik & Konuşmacı Odak Geçişleri'
    ]
  },
  {
    index: 12,
    id: 'battle_t3',
    shortLabel: '12. Savaş T-3 (Shelter Courtyard)',
    title: 'Sahne 12: Savaş T-3 — Shelter Courtyard Dusk (Ultimate & Final Dalgası)',
    gifId: '14_aab_tutorial_battles_t1_t2_t3',
    animations: [
      '%100 Focus Tamamlandığında Parlayan Altın-Mor Ultimate Çerçevesi & Portre Cut-In',
      'Zafer (Victory) Zıplama Döngüsü & Element İzi (Afterimage Ghost)'
    ]
  },
  {
    index: 13,
    id: 'story_t3_after',
    shortLabel: '13. LN T-3 Final + CG',
    title: 'Sahne 13: Tutorial T-3 Finali + Özel Event CG (Shelter Evening)',
    gifId: '13_aab_tutorial_vn_mahmut_fadyme',
    animations: [
      'Özel Tam Ekran Event CG Açılışı (still_shelter_evening — Kamp Ateşi Başında Gece Nöbeti)',
      'Duygusal Final Diyalog Akışı & Yavaş Kararma Geçişi'
    ]
  },
  {
    index: 14,
    id: 'finish_wait',
    shortLabel: '14. Patch Wait (Cep Saati & Çan)',
    title: 'Sahne 14: Patch Wait ("While the Road Opens" — Kırık Cep Saati & Çan Çarkı)',
    gifId: '15_aab_patch_wait_and_hub',
    animations: [
      '#4 Dönen Kırık Cep Saati Akrep/Yelkovanı, Çatlak Cam Parıltısı & Sallanan Minyatür Çan Sarkacı',
      '#1 Arka Planda Dönen Tutulma Koronası & Sıvı Altın Yama İlerleme Çubuğu',
      'Dönüşümlü Kanon Alıntı Kartları & Hesap Kayıt Doğrulama Rozeti'
    ]
  },
  {
    index: 15,
    id: 'hub',
    shortLabel: '15. Company Hub (Lobi)',
    title: 'Sahne 15: The Company Hub (9 Animasyonlu Gotik Menü Karosu)',
    gifId: '15_aab_patch_wait_and_hub',
    animations: [
      '#1 & #2 "THE COMPANY" Başlığında Dönen Tutulma Koronası ve Çift Sallanan Sığınak Çanı',
      '#5 9 Lobi Karosunda (SUMMON, ROSTER, TEAM vb.) Hover Büyüme, Işık Süpürmesi & Tıklamada Mühür Patlaması'
    ]
  }
];

function liveGameUrl(sceneId: string, fastIntro: boolean): string {
  const h = typeof window !== 'undefined' ? window.location.hostname : 'uomd-admin-staging.muratcaneksiii.workers.dev';
  const base =
    h === '127.0.0.1' || h === 'localhost'
      ? 'https://uomd-game-staging.muratcaneksiii.workers.dev/'
      : `${window.location.protocol}//${h.replace(/^uomd-admin/, 'uomd-game')}/`;
  const params = new URLSearchParams();
  if (sceneId) params.set('preview_scene', sceneId);
  if (fastIntro) params.set('fastintro', '1');
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export const ANIMATION_CATALOG: AnimationEntry[] = [
  {
    id: '10_aab_splash_studio_intro',
    title: 'İlk AAB (Sahneler 1–2): Splash Engine & SovTaym Studios Giriş Sekansı',
    category: 'FIRST_AAB_FLOW',
    categoryLabel: 'İlk AAB Tam Akış · Sahneler 1–2',
    gifUrl: '/dev/animations/10_aab_splash_studio_intro.gif',
    targetScreen: 'SplashScene → StudioScene (İlk AAB Açılış)',
    targetEnginePath: 'apps/game/src/scenes/SplashScene.ts & StudioScene.ts',
    framesInfo: '16 Kare GIF · Prizma Işını + Çift Kronometre Halkası + Çan Akustik Dalgası',
    description: 'İlk AAB açılışındaki PixiJS v8 prizma/korona sekansı ve SovTaym Studios amblemi etrafında dönen altın/gümüş kronometre halkaları ile çan akustik şok dalgası.',
    defaultBg: 'cathedral',
    previewSceneId: 'studio'
  },
  {
    id: '11_aab_title_screen_full',
    title: 'İlk AAB (Sahne 3): Ana Menü (TitleScene) Tam Entegre Görünüm',
    category: 'FIRST_AAB_FLOW',
    categoryLabel: 'İlk AAB Tam Akış · Sahne 3',
    gifUrl: '/dev/animations/11_aab_title_screen_full.gif',
    targetScreen: 'TitleScene (Ana Menü — Korona + Çan + Mühürlü Başlat)',
    targetEnginePath: 'apps/game/src/scenes/TitleScene.ts',
    framesInfo: '16 Kare GIF · Dönen Korona + Sallanan Çan + Balmumu Mühür Patlaması',
    description: 'Gerçek İlk AAB Ana Menüsü üzerinde dönen Kara Güneş Tutulma Koronası, logo üstünde sallanan çatlak çan, metalik parıltılı başlat butonu ve tıklandığında patlayan kızıl balmumu mühür.',
    defaultBg: 'cathedral',
    previewSceneId: 'title_fresh'
  },
  {
    id: '12_aab_prologue_9scenes_flow',
    title: 'İlk AAB (Sahne 4): 120sn 9 Sahneli Prolog ("Before the Road") Akışı',
    category: 'FIRST_AAB_FLOW',
    categoryLabel: 'İlk AAB Tam Akış · Sahne 4',
    gifUrl: '/dev/animations/12_aab_prologue_9scenes_flow.gif',
    targetScreen: 'PrologueScene (9 Sahneli Sinematik Açılış)',
    targetEnginePath: 'apps/game/src/scenes/PrologueScene.ts',
    framesInfo: '15 Kare GIF · 9 Prolog İllüstrasyonu + Çan Akustik Halkası + Ses Dalga Boyu',
    description: 'İlk AAB içindeki 9 prolog sahnesinin (Crownfall, Ash Roads, Throne Wars, Reunion, Search) Ken Burns kamera hareketi, üst çan ayıracından yayılan akustik halkalar ve altyazı ses senkronu.',
    defaultBg: 'cathedral',
    previewSceneId: 'prologue'
  },
  {
    id: '13_aab_tutorial_vn_mahmut_fadyme',
    title: 'İlk AAB (Sahneler 5, 7, 8, 10, 11, 13): Mahmut & Fadyme VN Diyalogları + 2 Özel Event CG',
    category: 'FIRST_AAB_FLOW',
    categoryLabel: 'İlk AAB Tam Akış · Sahneler 5–13 (VN & CG)',
    gifUrl: '/dev/animations/13_aab_tutorial_vn_mahmut_fadyme.gif',
    targetScreen: 'StoryScene (T-1, T-2, T-3 Hikâye Sahneleri + Roadside Rest & Shelter Evening CG)',
    targetEnginePath: 'apps/game/src/scenes/StoryScene.ts',
    framesInfo: '15 Kare GIF · 4 Duygu Geçişi + Mikro-Duruş Koreografisi + 2 Tam Ekran CG',
    description: 'İlk AAB öğretici hikâye bölümlerinde Mahmut ve Fadyme portrelerinin nefes, eğilme, duygu geçişleri, sallanan çan ayıraçlı diyalog kutusu ve 2 özel Event CG (Roadside Rest & Shelter Evening) sahnesi.',
    defaultBg: 'stage',
    previewSceneId: 'story_t2_after'
  },
  {
    id: '14_aab_tutorial_battles_t1_t2_t3',
    title: 'İlk AAB (Sahneler 6, 9, 12): T-1, T-2 & T-3 Taktiksel Savaş Animasyonları',
    category: 'FIRST_AAB_FLOW',
    categoryLabel: 'İlk AAB Tam Akış · Sahneler 6, 9, 12 (Savaş)',
    gifUrl: '/dev/animations/14_aab_tutorial_battles_t1_t2_t3.gif',
    targetScreen: 'BattleScene & UnitView (Whispering Ash, Stone Crossing, Shelter Courtyard)',
    targetEnginePath: 'apps/game/src/scenes/BattleScene.ts & battle/UnitView.ts',
    framesInfo: '15 Kare GIF · 3 Savaş Meydanı × (Idle/Walk → Basic → Active → Ultimate → Victory)',
    description: 'İlk AAB savaşlarında Mahmut ve Fadyme’nin Bellbound Dead ve Hollow Pilgrim karşısında 8 durumlu aksiyonları, gecikmeli hasar izli (ghost trail) HP barları ve %100 Focus Ultimate patlaması.',
    defaultBg: 'stage',
    previewSceneId: 'battle_t1'
  },
  {
    id: '15_aab_patch_wait_and_hub',
    title: 'İlk AAB (Sahneler 14–15): Patch Wait (Kırık Cep Saati & Çan) → Company Hub (9 Menü Karosu)',
    category: 'FIRST_AAB_FLOW',
    categoryLabel: 'İlk AAB Tam Akış · Sahneler 14–15',
    gifUrl: '/dev/animations/15_aab_patch_wait_and_hub.gif',
    targetScreen: 'FinishScene (Patch Wait) & HomeScene (The Company Hub)',
    targetEnginePath: 'apps/game/src/scenes/FinishScene.ts & HomeScene.ts',
    framesInfo: '16 Kare GIF · Kırık Cep Saati Çarkı + Sıvı Altın Bar + 9 Lobi Karosu',
    description: 'T-3 sonrası açılan Patch Wait ekranında dönen Kırık Cep Saati ve sallanan çan sarkacı, ardından girilen Company Hub ekranındaki korona/çan başlığı ve 9 Gotik menü karosu.',
    defaultBg: 'cathedral',
    previewSceneId: 'finish_wait'
  },
  {
    id: '01_ui_eclipse_corona_loop',
    title: '1. Tutulma Koronası & Kül Akışı (Eclipse Corona Loop)',
    category: 'UI_STEP1',
    categoryLabel: 'Adım 1 · Ana Menü & Yükleme',
    gifUrl: '/dev/animations/01_ui_eclipse_corona_loop.gif',
    targetScreen: 'TitleScene (Ana Menü Gökyüzü Katmanı)',
    targetEnginePath: 'apps/game/src/scenes/TitleScene.ts → createEclipseCorona()',
    framesInfo: '16 Kare Döngüsel GIF · 12.5 FPS + Canlı PixiJS Katmanı',
    description: 'Ana Menüdeki kara güneş tutulması halkasının saat yönünde ağır dönüşü, altın korona parlaması ve yükselen kor/kül parçacıkları.',
    defaultBg: 'cathedral',
    previewSceneId: 'title_fresh'
  },
  {
    id: '02_ui_bell_resonance_pulse',
    title: '2. Çatlak Çan Rezonansı & Ses Dalgaları (Bell Resonance)',
    category: 'UI_STEP1',
    categoryLabel: 'Adım 1 · Ana Menü & Yükleme',
    gifUrl: '/dev/animations/02_ui_bell_resonance_pulse.gif',
    targetScreen: 'TitleScene, PrologueScene & StoryScene (Merkez Çan Amblemi)',
    targetEnginePath: 'apps/game/src/vfx/gothicUiVfx.ts → createSwingingBellEmblem()',
    framesInfo: '16 Kare Döngüsel GIF · 12.5 FPS + Sarkaç Salınımı',
    description: 'Kırık bronz çan ambleminin ağır sarkaç salınımı, çatlaklarından sızan kehribar ateş ve dışa yayılan altın akustik şok halkaları.',
    defaultBg: 'cathedral',
    previewSceneId: 'title_fresh'
  },
  {
    id: '03_ui_title_cta_wax_seal',
    title: '3. Mühürlü Başlat Butonu Ateşlemesi (Wax-Seal CTA Ignition)',
    category: 'UI_STEP1',
    categoryLabel: 'Adım 1 · Ana Menü & Yükleme',
    gifUrl: '/dev/animations/03_ui_title_cta_wax_seal.gif',
    targetScreen: 'TitleScene ("Dokun ve Başla" / Tap to Start CTA)',
    targetEnginePath: 'apps/game/src/vfx/gothicUiVfx.ts → triggerWaxSealBurst()',
    framesInfo: '16 Kare Döngüsel GIF · Normal → Hover → Seal Crack → Burst',
    description: 'Gotik demir/altın ana menü butonunun üzerinde gezen ışık süpürmesi ve tıklandığında kızıl balmumu mührün çatlayarak kor saçması.',
    defaultBg: 'cathedral',
    previewSceneId: 'title_fresh'
  },
  {
    id: '04_ui_loading_watch_bell',
    title: '4. Kırık Cep Saati & Sarkaç Yükleme Çarkı (Loading Spinner)',
    category: 'UI_STEP1',
    categoryLabel: 'Adım 1 · Ana Menü & Yükleme',
    gifUrl: '/dev/animations/04_ui_loading_watch_bell.gif',
    targetScreen: 'FinishScene (Patch Wait) & Sahne Geçiş Yükleme Ekranı',
    targetEnginePath: 'apps/game/src/vfx/gothicUiVfx.ts → createCrackedWatchSpinner()',
    framesInfo: '16 Kare Döngüsel GIF · 12.5 FPS Kesintisiz Döngü',
    description: 'Aldric’in çatlak cep saati akrep/yelkovan dönüşü, altındaki minyatür sığınak çanının salınımı ve rün halkası nabzı.',
    defaultBg: 'cathedral',
    previewSceneId: 'finish_wait'
  },
  {
    id: '05_ui_kit_button_4state_cycle',
    title: '5. Katmanlı RGBA Gotik Buton — 4 Durum Döngüsü (Normal/Hover/Pressed/Disabled)',
    category: 'UI_KIT_V001',
    categoryLabel: 'Öncelik #1A · Katmanlı RGBA UI Kit',
    gifUrl: '/dev/animations/05_ui_kit_button_4state_cycle.gif',
    targetScreen: 'Tüm Oyun & Lobi Menü Butonları (pixiKit.ts & domKit.ts)',
    targetEnginePath: 'apps/game/src/ui/pixiKit.ts & domKit.ts',
    framesInfo: '16 Kare GIF · 4 Durum (Normal, Hover, Pressed, Disabled)',
    description: '#00FF00 yeşil zeminden kesilmiş şeffaf RGBA buton çerçevelerinin üzerinde metin olmadan 4 etkileşim durumu geçişi.',
    defaultBg: 'checker',
    previewSceneId: 'hub'
  },
  {
    id: '06_ui_kit_hp_focus_bars_live',
    title: '6. Can (HP) & Tutulma Odağı (Focus) Barları Canlı Dolum & Ultimate Nabzı',
    category: 'UI_KIT_V001',
    categoryLabel: 'Öncelik #1A · Katmanlı RGBA UI Kit',
    gifUrl: '/dev/animations/06_ui_kit_hp_focus_bars_live.gif',
    targetScreen: 'BattleScene HUD & Karakter Durum Çubukları (Bar)',
    targetEnginePath: 'apps/game/src/ui/pixiKit.ts → Bar',
    framesInfo: '18 Kare GIF · Hasar Ghost-Trail, İyileşme ve %100 Focus Ultimate Hazır Efekti',
    description: 'Boş metal bar çerçevesi içinde gecikmeli hasar izi (ghost bar), akan kızıl HP sıvısı ve %100 olduğunda parlayan altın-mor Focus göstergesi.',
    defaultBg: 'cathedral',
    previewSceneId: 'battle_t1'
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
    defaultBg: 'stage',
    previewSceneId: 'battle_t3'
  },
  {
    id: '08_kera_voss_chibi_combat_combo',
    title: '8. Kera Voss — Savaş İçi Aksiyon Kombo Akışı (Idle → Walk → Basic → Active → Ultimate → Victory)',
    category: 'CHARACTER_KERA_VOSS',
    categoryLabel: 'Öncelik #2 · Pilot Karakter: Kera Voss',
    gifUrl: '/dev/animations/08_kera_voss_chibi_combat_combo.gif',
    targetScreen: 'BattleScene — Canlı Tur Sırası Kombo Gösterimi',
    targetEnginePath: 'apps/game/src/battle/UnitView.ts → applyState()',
    framesInfo: '13 Kare Hızlı Savaş Kombo GIF · 10.5 FPS',
    description: 'Kera Voss’un gerçek bir savaş turunda ileri adım atıp havan darbesi (Basic), simya şişesi (Active) ve Tutulma Ateşi (Ultimate) kullandıktan sonra zafer pozuna geçişi.',
    defaultBg: 'stage',
    previewSceneId: 'battle_t3'
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
    defaultBg: 'stage',
    previewSceneId: 'story_t1'
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

const DEFAULT_APPROVED_IDS = [
  '01_ui_eclipse_corona_loop',
  '02_ui_bell_resonance_pulse',
  '03_ui_title_cta_wax_seal',
  '04_ui_loading_watch_bell',
  '05_ui_kit_button_4state_cycle',
  '06_ui_kit_hp_focus_bars_live',
  '07_kera_voss_chibi_all_8_states',
  '08_kera_voss_chibi_combat_combo',
  '09_kera_voss_vn_expressions_live'
];

interface ManifestAtlas {
  image: string;
  width: number;
  height: number;
  frames: Record<string, [number, number, number, number]>;
}
interface ManifestUnitState {
  frame: string;
  scale: number;
  foot_y: number;
  pivot_x?: number;
  animation?: { frames: string[]; fps: number; loop: boolean };
}
interface ManifestUnit {
  atlas: string;
  facing: 'left' | 'right';
  height_px: number;
  states: Record<string, ManifestUnitState>;
}
interface ManifestPortrait {
  emotions: Record<string, string>;
  images: Record<string, string>;
}
interface CampaignArtManifest {
  atlases: Record<string, ManifestAtlas>;
  units: Record<string, ManifestUnit>;
  portraits: Record<string, ManifestPortrait>;
}

export function Animations({ me, say }: { me: Me | null; say: (m: string) => void }): ReactNode {
  const [activeTab, setActiveTab] = useState<'first_aab' | 'in_context' | 'atlas_inspector' | 'gif_gallery'>('first_aab');
  const [aabStepIdx, setAabStepIdx] = useState<number>(2); // Default to Scene 3 (Title Screen) or Scene 1
  const [fastIntro, setFastIntro] = useState<boolean>(false);
  const [iframeNonce, setIframeNonce] = useState<number>(0);
  const [stageScene, setStageScene] = useState<'title' | 'battle' | 'vn' | 'uikit'>('battle');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [bgMode, setBgMode] = useState<'cathedral' | 'checker' | 'green'>('cathedral');

  // ART-1 Live Ingested Atlas & Portrait Inspector state
  const [artManifest, setArtManifest] = useState<CampaignArtManifest | null>(null);
  const [inspectUnitId, setInspectUnitId] = useState<string>('kera_voss');
  const [inspectState, setInspectState] = useState<string>('idle');
  const [inspectFrameIdx, setInspectFrameIdx] = useState<number>(0);
  const [inspectPortraitKey, setInspectPortraitKey] = useState<string>('composed');

  useEffect(() => {
    fetch('/dev/media/art/campaign_art_manifest.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : fetch('/dev/media/art/art_manifest.json').then((r2) => r2.json())))
      .then((data: CampaignArtManifest) => setArtManifest(data))
      .catch(() => {
        /* ignore if dev media not built */
      });
  }, []);

  useEffect(() => {
    const unit = artManifest?.units[inspectUnitId];
    const st = unit?.states[inspectState];
    const anim = st?.animation;
    setInspectFrameIdx(0);
    if (!anim || anim.frames.length <= 1) return;
    const intervalMs = Math.max(40, Math.round(1000 / Math.max(1, anim.fps)));
    const timer = window.setInterval(() => {
      setInspectFrameIdx((prev) => (prev + 1) % anim.frames.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [artManifest, inspectUnitId, inspectState]);

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

  // Approval state persisted in localStorage (with 01..09 pre-marked as pulled_to_game)
  const [approvals, setApprovals] = useState<Record<string, ApprovalRecord>>(() => {
    const initial: Record<string, ApprovalRecord> = {};
    const now = new Date().toISOString();
    for (const id of DEFAULT_APPROVED_IDS) {
      initial[id] = { status: 'pulled_to_game', note: 'Onaylandı ve İlk AAB sahnelerine entegre edildi.', updatedAt: now };
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, ApprovalRecord>;
        return { ...initial, ...parsed };
      }
    } catch {
      /* ignore */
    }
    return initial;
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
        <h2 style={{ margin: 0 }}>Animasyon Stüdyosu &amp; İlk AAB Tam Akış İnceleme Merkezi</h2>
        <span className="badge ok">{approvedCount} / {ANIMATION_CATALOG.length} Onaylı</span>
        <span className="badge info">{pulledCount} Oyuna Entegre</span>
        <div className="row" style={{ marginLeft: 'auto', margin: 0, gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn${activeTab === 'first_aab' ? ' primary' : ''}`}
            onClick={() => setActiveTab('first_aab')}
          >
            🚀 1. İlk AAB (Base AAB) Tam Akış İnceleme (15 Sahne Canlı + 6 Akış GIF)
          </button>
          <button
            type="button"
            className={`btn${activeTab === 'in_context' ? ' primary' : ''}`}
            onClick={() => setActiveTab('in_context')}
          >
            🎬 2. Bireysel Sahne Labı (In-Context)
          </button>
          <button
            type="button"
            className={`btn${activeTab === 'atlas_inspector' ? ' primary' : ''}`}
            onClick={() => setActiveTab('atlas_inspector')}
          >
            🎨 3. Canlı Atlas &amp; Portre Denetçisi (ART-1)
          </button>
          <button
            type="button"
            className={`btn${activeTab === 'gif_gallery' ? ' primary' : ''}`}
            onClick={() => setActiveTab('gif_gallery')}
          >
            🎞️ 4. Tüm Hareketli GIF Galerisi ({ANIMATION_CATALOG.length} GIF)
          </button>
          <button
            type="button"
            className="btn"
            onClick={() =>
              downloadJson('uomd_animation_approvals_v002.json', {
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
        Onayladığınız 9 temel UI/Karakter animasyonu <strong>İlk AAB (Base AAB) sürümünün tamamındaki 15 sahneye</strong>{' '}
        (Splash → SovTaym Studios → Ana Menü → 9 Sahneli Prolog → Tutorial T-1/T-2/T-3 Görsel Roman, Event CG ve 5v5 Savaşlar → Patch Wait → Company Hub)
        doğrudan entegre edildi. Aşağıdan hem <strong>canlı oyun sahneleri arasında tek tıkla geçiş yaparak</strong> hem de{' '}
        <strong>6 uçtan uca İlk AAB sahne GIF&apos;i</strong> üzerinden tüm akışı inceleyebilirsiniz.
      </p>

      {/* ==================== TAB 0: FIRST AAB FULL 15-SCENE FLOW INSPECTOR ==================== */}
      {activeTab === 'first_aab' ? (
        <section className="card" style={{ marginBottom: 18, padding: 16 }}>
          {(() => {
            const currentStep = AAB_15_SCENES[aabStepIdx] ?? AAB_15_SCENES[0]!;
            const currentUrl = `${liveGameUrl(currentStep.id, fastIntro)}${liveGameUrl(currentStep.id, fastIntro).includes('?') ? '&' : '?'}r=${iframeNonce}`;
            const aabFlowGifs = ANIMATION_CATALOG.filter((item) => item.category === 'FIRST_AAB_FLOW');
            return (
              <div>
                <div
                  className="row"
                  style={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginTop: 0,
                    marginBottom: 12
                  }}
                >
                  <div>
                    <span className="badge ok" style={{ marginRight: 8 }}>
                      CANLI İLK AAB SAHNE {currentStep.index} / 15
                    </span>
                    <strong style={{ fontSize: 16, color: '#fff3d6' }}>{currentStep.title}</strong>
                  </div>
                  <div className="row" style={{ margin: 0, gap: 6, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn"
                      disabled={aabStepIdx <= 0}
                      onClick={() => setAabStepIdx((i) => Math.max(0, i - 1))}
                    >
                      ◀ Önceki Sahne
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      disabled={aabStepIdx >= AAB_15_SCENES.length - 1}
                      onClick={() => setAabStepIdx((i) => Math.min(AAB_15_SCENES.length - 1, i + 1))}
                    >
                      Sonraki Sahne ▶
                    </button>
                    <button
                      type="button"
                      className={`btn${fastIntro ? ' primary' : ''}`}
                      onClick={() => setFastIntro((v) => !v)}
                    >
                      {fastIntro ? '⚡ Hızlı Geçiş Açık (fastintro=1)' : '⏱️ Normal Sinematik Süre'}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setIframeNonce((n) => n + 1)}
                    >
                      🔄 Sahneyi Yeniden Başlat
                    </button>
                    <a
                      href={liveGameUrl(currentStep.id, fastIntro)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn"
                      style={{ textDecoration: 'none' }}
                    >
                      ↗ Tam Ekranda Aç
                    </a>
                  </div>
                </div>

                {/* 15-Scene Stepper Bar */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                    gap: 6,
                    marginBottom: 14,
                    padding: 10,
                    borderRadius: 10,
                    background: 'rgba(10, 7, 16, 0.72)',
                    border: '1px solid rgba(242, 184, 75, 0.22)'
                  }}
                >
                  {AAB_15_SCENES.map((step, idx) => {
                    const active = idx === aabStepIdx;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        className={`btn${active ? ' primary' : ''}`}
                        onClick={() => setAabStepIdx(idx)}
                        style={{
                          textAlign: 'left',
                          fontSize: 12,
                          padding: '7px 10px',
                          borderColor: active ? '#f2b84b' : 'rgba(255,255,255,0.12)',
                          boxShadow: active ? '0 0 12px rgba(242, 184, 75, 0.35)' : 'none'
                        }}
                      >
                        {step.shortLabel}
                      </button>
                    );
                  })}
                </div>

                {/* Live Game Staging Iframe + Active Scene Animation Checklist */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 2.15fr) minmax(300px, 1fr)',
                    gap: 14,
                    alignItems: 'stretch',
                    marginBottom: 18
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '16 / 9',
                      borderRadius: 12,
                      overflow: 'hidden',
                      border: '2px solid #d8a93c',
                      boxShadow: '0 14px 38px rgba(0,0,0,0.72)',
                      background: '#08050d'
                    }}
                  >
                    <iframe
                      key={`${currentStep.id}-${fastIntro}-${iframeNonce}`}
                      src={currentUrl}
                      title={currentStep.title}
                      style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
                      allow="autoplay; fullscreen"
                    />
                  </div>

                  <div
                    className="card"
                    style={{
                      margin: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      background: 'rgba(14, 10, 22, 0.92)',
                      border: '1px solid rgba(216, 169, 60, 0.35)'
                    }}
                  >
                    <div>
                      <div className="row" style={{ marginTop: 0, gap: 6, flexWrap: 'wrap' }}>
                        <span className="badge info">Sahne Kodu: ?preview_scene={currentStep.id}</span>
                        <span className="badge ok">PixiJS v8 Canlı Motor</span>
                      </div>
                      <h4 style={{ margin: '10px 0 8px', color: '#ffdf9a' }}>
                        Bu Sahnede Devrede Olan Onaylı Animasyonlar:
                      </h4>
                      <ul style={{ margin: 0, paddingLeft: 18, color: '#e6d8f2', fontSize: 13, lineHeight: 1.6 }}>
                        {currentStep.animations.map((anim, i) => (
                          <li key={i} style={{ marginBottom: 6 }}>
                            {anim}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 6 }}>
                        İlgili Sahne Akış GIF Önizlemesi ({currentStep.gifId}.gif):
                      </div>
                      <img
                        src={`/dev/animations/${currentStep.gifId}.gif`}
                        alt={currentStep.title}
                        style={{
                          width: '100%',
                          borderRadius: 8,
                          border: '1px solid rgba(242, 184, 75, 0.3)'
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 6 End-to-End First AAB Animated GIF Showcase Cards */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 14 }}>
                  <div className="row" style={{ justifyContent: 'space-between', marginTop: 0, marginBottom: 10 }}>
                    <h3 style={{ margin: 0, color: '#ffdf9a' }}>
                      🎞️ İlk AAB Tam Akış Hareketli GIF Özeti (6 Sahne Grubu — Sahneler 1..15)
                    </h3>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => approveAllVisible(aabFlowGifs)}
                    >
                      ✅ İlk AAB Akışının Tümünü Onayla ({aabFlowGifs.length} Sahne Grubu)
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                      gap: 14
                    }}
                  >
                    {aabFlowGifs.map((item) => {
                      const rec = approvals[item.id] ?? { status: 'pending', note: '', updatedAt: '' };
                      const badgeClass =
                        rec.status === 'approved' || rec.status === 'pulled_to_game'
                          ? 'ok'
                          : rec.status === 'revision'
                            ? 'bad'
                            : 'warn';
                      const badgeText =
                        rec.status === 'pulled_to_game'
                          ? 'OYUNA ENTEGRE EDİLDİ'
                          : rec.status === 'approved'
                            ? 'ONAYLANDI'
                            : rec.status === 'revision'
                              ? 'REVİZE'
                              : 'İNCELEMEDE';
                      return (
                        <div key={item.id} className="card" style={{ margin: 0 }}>
                          <div className="row" style={{ justifyContent: 'space-between', marginTop: 0 }}>
                            <span className="badge info">{item.categoryLabel}</span>
                            <span className={`badge ${badgeClass}`}>{badgeText}</span>
                          </div>
                          <h4 style={{ margin: '8px 0 6px' }}>{item.title}</h4>
                          <div
                            style={{
                              borderRadius: 10,
                              overflow: 'hidden',
                              border: '1px solid rgba(242, 184, 75, 0.28)',
                              background: '#09060f',
                              marginBottom: 8
                            }}
                          >
                            <img
                              src={item.gifUrl}
                              alt={item.title}
                              style={{ width: '100%', display: 'block' }}
                              loading="lazy"
                            />
                          </div>
                          <p style={{ fontSize: 12.5, color: 'var(--dim)', margin: '0 0 10px' }}>{item.description}</p>
                          <div className="row" style={{ margin: 0, gap: 6, flexWrap: 'wrap' }}>
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
                              🚀 Oyunda Kalıcı Tut
                            </button>
                            <button
                              type="button"
                              className="btn"
                              onClick={() => setStatus(item.id, 'revision')}
                            >
                              ✏️ Revize
                            </button>
                            {item.previewSceneId ? (
                              <button
                                type="button"
                                className="btn"
                                onClick={() => {
                                  const foundIdx = AAB_15_SCENES.findIndex((s) => s.id === item.previewSceneId);
                                  if (foundIdx >= 0) setAabStepIdx(foundIdx);
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                              >
                                🎮 Yukarıda Canlı Sahnede Aç
                              </button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </section>
      ) : null}

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

      {/* ==================== TAB 3: ART-1 LIVE INGESTED ATLAS & PORTRAIT INSPECTOR ==================== */}
      {activeTab === 'atlas_inspector' && artManifest ? (
        <section className="card" style={{ marginBottom: 18, padding: 16 }}>
          {(() => {
            const bespokeUnits = Object.entries(artManifest.units).filter(
              ([id, u]) =>
                id === u.atlas.replace(/^atlas_/, '') &&
                !['hero_arcanist', 'enemy_knight', 'placeholder', 'objective'].includes(id)
            );
            const activeUnit = artManifest.units[inspectUnitId] ?? bespokeUnits[0]?.[1];
            const activeAtlas = activeUnit ? artManifest.atlases[activeUnit.atlas] : undefined;
            const stObj = activeUnit?.states[inspectState] ?? activeUnit?.states.idle;
            const animFrames = stObj?.animation?.frames ?? (stObj ? [stObj.frame] : ['idle']);
            const currentFrameName = animFrames[inspectFrameIdx % animFrames.length] ?? stObj?.frame ?? 'idle';
            const frameRect = activeAtlas?.frames[currentFrameName] ?? [0, 0, 256, 256];
            const [fx, fy, fw, fh] = frameRect;
            const portraitDef = artManifest.portraits[inspectUnitId];
            const portraitKeys = portraitDef ? Object.keys(portraitDef.images) : [];
            const activePKey =
              portraitKeys.includes(inspectPortraitKey) ? inspectPortraitKey : (portraitKeys[0] ?? 'composed');

            return (
              <div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 0, marginBottom: 12 }}>
                  <strong>Ingest Edilmiş Birimler ({bespokeUnits.length}):</strong>
                  {bespokeUnits.map(([id, u]) => (
                    <button
                      key={id}
                      type="button"
                      className={`btn${inspectUnitId === id ? ' primary' : ''}`}
                      onClick={() => {
                        setInspectUnitId(id);
                        setInspectState('idle');
                      }}
                    >
                      {id} ({u.facing === 'right' ? '→ Hero' : '← Enemy'})
                    </button>
                  ))}
                </div>

                {activeUnit && activeAtlas && stObj ? (
                  <div>
                    <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      <strong>Durum (State):</strong>
                      {Object.keys(activeUnit.states).map((stKey) => {
                        const s = activeUnit.states[stKey]!;
                        const fCount = s.animation?.frames.length ?? 1;
                        return (
                          <button
                            key={stKey}
                            type="button"
                            className={`btn${inspectState === stKey ? ' primary' : ''}`}
                            onClick={() => setInspectState(stKey)}
                          >
                            {stKey} ({fCount}f{s.animation ? ` @${s.animation.fps}fps` : ''})
                          </button>
                        );
                      })}
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(320px, 1fr) minmax(360px, 1.3fr)',
                        gap: 16,
                        alignItems: 'start'
                      }}
                    >
                      {/* Left: Live Frame-Stepped Sprite Preview with Foot & Pivot Guides */}
                      <div className="card bg-checker" style={{ margin: 0, padding: 16, textAlign: 'center' }}>
                        <div className="mono" style={{ fontSize: 12, marginBottom: 8 }}>
                          <strong>{inspectUnitId}</strong> · state=<code>{inspectState}</code> · frame=
                          <code>{currentFrameName}</code> [{fx},{fy},{fw}×{fh}] · foot_y={stObj.foot_y} · pivot_x=
                          {stObj.pivot_x ?? 0.5}
                        </div>
                        <div
                          style={{
                            position: 'relative',
                            width: Math.min(340, fw),
                            height: Math.min(340, fh),
                            margin: '0 auto',
                            overflow: 'hidden',
                            border: '1px dashed rgba(242,184,75,0.45)'
                          }}
                        >
                          <div
                            style={{
                              width: fw,
                              height: fh,
                              backgroundImage: `url(/dev/media/${activeAtlas.image})`,
                              backgroundPosition: `-${fx}px -${fy}px`,
                              backgroundRepeat: 'no-repeat',
                              transform: fw > 340 || fh > 340 ? `scale(${Math.min(340 / fw, 340 / fh)})` : 'none',
                              transformOrigin: 'top left'
                            }}
                          />
                          {/* Ground shadow & pivot crosshair */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: `${stObj.foot_y * 100}%`,
                              borderTop: '2px solid #3fa36c',
                              pointerEvents: 'none'
                            }}
                          />
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              bottom: 0,
                              left: `${(stObj.pivot_x ?? 0.5) * 100}%`,
                              borderLeft: '1px dashed #f2b84b',
                              pointerEvents: 'none'
                            }}
                          />
                        </div>
                      </div>

                      {/* Right: Packed WebP Atlas & VN Portraits (if Hero) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="card bg-checker" style={{ margin: 0, padding: 12 }}>
                          <div className="mono" style={{ fontSize: 12, marginBottom: 6 }}>
                            Atlas: <code>{activeAtlas.image}</code> ({activeAtlas.width}×{activeAtlas.height}px ·{' '}
                            {Object.keys(activeAtlas.frames).length} frames)
                          </div>
                          <img
                            src={`/dev/media/${activeAtlas.image}`}
                            alt={activeUnit.atlas}
                            style={{ width: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' }}
                          />
                        </div>

                        {portraitDef ? (
                          <div className="card bg-cathedral" style={{ margin: 0, padding: 12 }}>
                            <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 0, marginBottom: 8 }}>
                              <strong>VN Portreleri ({portraitKeys.length} görsel · {Object.keys(portraitDef.emotions).length} duygu etiketi):</strong>
                              {portraitKeys.map((pk) => (
                                <button
                                  key={pk}
                                  type="button"
                                  className={`btn${activePKey === pk ? ' primary' : ''}`}
                                  onClick={() => setInspectPortraitKey(pk)}
                                >
                                  {pk}
                                </button>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              <img
                                src={`/dev/media/${portraitDef.images[activePKey]}`}
                                alt={activePKey}
                                style={{ height: 210, objectFit: 'contain', borderRadius: 8 }}
                              />
                              <div className="mono" style={{ fontSize: 11.5, color: '#e6d8f2' }}>
                                <div>
                                  <strong>Dosya:</strong> <code>{portraitDef.images[activePKey]}</code>
                                </div>
                                <div style={{ marginTop: 6 }}>
                                  <strong>Eşleşen Duygu Etiketleri:</strong>{' '}
                                  {Object.entries(portraitDef.emotions)
                                    .filter(([, target]) => target === activePKey)
                                    .map(([emo]) => emo)
                                    .join(', ')}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })()}
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
            className={`btn${categoryFilter === 'FIRST_AAB_FLOW' ? ' primary' : ''}`}
            onClick={() => setCategoryFilter('FIRST_AAB_FLOW')}
          >
            İlk AAB Tam Akış (6 GIF)
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
