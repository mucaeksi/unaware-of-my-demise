import { usePolling } from '../usePolling';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { api, ApiError, type Me } from '../api';
import { ErrorNotice } from '../App';

interface Item { title: string; detail: string }
interface ApprovedEntrySummary {
  asset_id: string;
  class: string;
  revision: number;
  path: string;
  sha256: string;
  bytes: number;
  dims: string;
  note: string;
}
interface BaseReleaseSummary {
  id: string;
  generation: number;
  minClient: string;
  notes: string;
  fileCount: number;
  totalBytes: number;
  approvedArtCount: number;
  approvedEntries: ApprovedEntrySummary[];
}
interface Progress {
  generatedAt: string;
  summary: { total: number; done: number; partial: number; missing: number };
  baseRelease?: BaseReleaseSummary;
  roadmap: { n: number; area: string; status: string; detail: string }[];
  decisions: { id: string; when: string; what: string; note: string }[];
  commits: { sha: string; at: string; subject: string }[];
  screens: { file: string; caption: string }[];
  storeAssets?: { file: string; label: string; kind: 'brand' | 'screenshot' }[];
  now: Item[];
  next: Item[];
  blockedOnOwner: Item[];
  ideas: { from: string; date: string; text: string; status: string }[];
  // docs/DEV_TRACKER.json (spread into progress.json by tools/build_progress.ts)
  reviewedAt?: string;
  sourceCommit?: string;
  currentAssignment?: { id: string; status: string; nextProposed: string; workflow: string };
  flow?: string;
  phases?: { n: number; title: string; status: string; done: string[]; remaining: string[] }[];
  capabilities?: { id: string; title: string; taskStatus: string; implementationStatus: string; implemented: string; evidenceIds: string[]; blockerIds: string[] }[];
  evidence?: { id: string; level: string; result: string; verifiedAt: string | null }[];
  blockers?: { id: string; level: string; title: string; detail: string }[];
  media?: { kind: string; drawn: string; inGame: string; missing: string }[];
  checks?: { date: string; commit: string; items: { name: string; result: string; detail: string }[] };
}

/** package code status -> badge class; acceptance stays separate (open blockers) */
const codeBadge = (s: string): string => (s === 'COMPLETE' ? 'ok' : s === 'PARTIAL' ? 'warn' : 'bad');
const checkBadge = (r: string): string => (r === 'pass' ? 'ok' : r === 'partial' ? 'warn' : r === 'fail' ? 'bad' : 'info');
interface Note { id: number; area: string; kind: string; body: string; status: string; resolution: string; created_by: string; created_at: string; updated_by: string | null }

const TABS = ['D-30 Onay Merkezi (§4.1–§4.7)', 'Overview', 'Live preview', 'Store & Brand Kit', 'Screens', 'Feedback'] as const;
type Tab = (typeof TABS)[number];
const AREAS = ['General', 'Splash & Studio', 'Title', 'Prologue (120s)', 'Story', 'Battle', 'Patch Wait & Restart', 'Company hub', 'Summon', 'Roster', 'Mail', 'Shop', 'Account', 'Chapters', 'Control Center', 'Economy', 'Art direction'];

interface D30ReviewItem {
  id: string;
  step: 'STEPS' | 'BANNERS' | 'AUDIO_SFX' | 'ATLAS_VFX';
  stepBadge: string;
  title: string;
  subtitle: string;
  description: string;
  imageUrl?: string;
  audioUrl?: string;
  sceneJump?: string;
  targetPath: string;
}

const D30_REVIEW_ITEMS: D30ReviewItem[] = [
  // 7 Core D-30 Steps (§4.1 – §4.7)
  {
    id: 'step_4_1_art_audit_objectives',
    step: 'STEPS',
    stepBadge: '§4.1 · cebb36d4',
    title: '§4.1 Sanat Yönetimi Denetimi, Alt-Kare Pivot Düzeltmesi & 9×3 Boss Objective Atlası',
    subtitle: '258 Onaylı Eser Denetimi · 1728×576 (27 Hücre) Kırılabilir Boss Hedefleri · Phone-Landscape FPS/RAM',
    description: 'UnitView, CharacterScene ve Animations.tsx içindeki alt-kare (idle_2, basic_2, vb.) pivot kayması düzeltildi. atlas_objective.webp 4×4 yerine 9×3 (1728×576, 27 hücre: intact/pulse/broken) olarak yeniden üretildi ve 13 boss hedefinin 8 animasyon durumuna bağlandı.',
    imageUrl: '/dev/media/art/atlas_objective.webp',
    sceneJump: 'battle_t3',
    targetPath: 'content/approved_art/art/atlas_objective.webp · apps/game/src/battle/UnitView.ts'
  },
  {
    id: 'step_4_2_signature_vfx',
    step: 'STEPS',
    stepBadge: '§4.2 · e7b7fab2',
    title: '§4.2 Signature VFX — 52 Birim İçin 115 Özel Preset & 133 Yetenek Bağlantısı',
    subtitle: '25 Kahraman + 7 Boss + 20 Düşman · 5 Yeni Amblem Dokusu · 4 Vektör Şekil · Hit-Stop & Shake',
    description: 'VfxStage ve @uomd/content-schema içine bell, chain, seal, droplet, feather dokuları ile bell_arch, shield_wall, eclipse_corona, crosshair şekilleri eklendi. 133 aktif/temel/ultimate/imza yeteneğin tamamı karaktere özel VFX presetlerine bağlandı.',
    imageUrl: '/dev/store/screenshots/03_tactical_battle_5v5.png',
    sceneJump: 'battle_t3',
    targetPath: 'content/base/vfx/vfx_presets.json · apps/game/src/vfx/VfxStage.ts'
  },
  {
    id: 'step_4_3_identity_locks',
    step: 'STEPS',
    stepBadge: '§4.3 · b7cbe3e7',
    title: '§4.3 Art Bible §4.11–§4.29 Kanonik Kimlik Çapaları & SHA-256 Kilit Tablosu',
    subtitle: '32 Konuşan Karakter Portre Kilidi (128 WebP) + 52 Savaş Birimi Chibi Atlas Kilidi · 53 Varlık Kuyruğu',
    description: 'ART_BIBLE.md içine 17 kahraman, 7 Part I boss + Lord Cael Veyr ve 18 düşman için birebir kanon çapaları eklendi; CHARACTER_LOCKS.md içine tüm SHA-256 kilitleri işlendi; QUEUE_DATA.json 53 varlığa genişletildi ($0.00 harcama).',
    imageUrl: '/dev/store/screenshots/06_companion_roster.png',
    sceneJump: 'roster',
    targetPath: 'docs/media/ART_BIBLE.md · content/specs/character_locks/CHARACTER_LOCKS.md'
  },
  {
    id: 'step_4_4_banners_in_game',
    step: 'STEPS',
    stepBadge: '§4.4 · 4cece6fe',
    title: '§4.4 16 Kanonik Gacha Banner Görseli (1376×768) — Summon & Dünya Haritası Vitrini',
    subtitle: '2 Kalıcı + 7 Oath Karakter + 7 İmza Silah Bannerı · SummonScene (940×440) & HomeScene (340×150)',
    description: 'Eksik 5 banner master görseli üretildi, 16 bannerın tamamı approved_art kataloğuna alındı, BannerConfig.artKey eklendi, SummonScene vitrin kartına ve Dünya Haritası (HomeScene) LIMITED OATH SPOTLIGHT kartına bağlandı.',
    imageUrl: '/dev/media/art/ui_banner_oath_01_sister_aveline.webp',
    sceneJump: 'summon',
    targetPath: 'apps/game/src/scenes/SummonScene.ts · apps/game/src/scenes/HomeScene.ts'
  },
  {
    id: 'step_4_5_motion_polish',
    step: 'STEPS',
    stepBadge: '§4.5 · 50c8be33',
    title: '§4.5 Chibi, VN Portre, Summon Kart Açılışı & Hub Modal Hareket Cilası',
    subtitle: '2 Fazlı Anticipation/Impact Chibi İvmesi · Taban Sabitli VN Nefes & Konuşma Nabzı · 4★/5★ Hale Açılışı',
    description: 'UnitView aksiyonlarında 2 fazlı geri çekilme + ileri vuruş ve 1.35× impact-hold; StoryScene içinde sahne anim.timeScale uyumlu altyazı sayacı, (0.5, 1) taban sabitli nefes, konuşma nabzı ve çift-opaklık yapmayan duygu geçişi; SummonScene kademeli kart açılışı.',
    imageUrl: '/dev/animations/08_kera_voss_chibi_combat_combo.gif',
    sceneJump: 'story_t1',
    targetPath: 'apps/game/src/battle/UnitView.ts · apps/game/src/scenes/StoryScene.ts · apps/game/src/scenes/SummonScene.ts'
  },
  {
    id: 'step_4_6_audio_sfx_music',
    step: 'STEPS',
    stepBadge: '§4.6 · 493338eb',
    title: '§4.6 16 Kanonik Ogg Vorbis SFX Seti (presentation.sounds) & Bölüm 1–7 / Boss Müzik Motifleri',
    subtitle: 'UI, Adım, Kılıç, Kalkan, Çan, Statü ve Ultimate SFX · 7 Lyria 3.5 Müzik Motifi Eşlemesi',
    description: 'tools/build_sfx_pack.mjs ile 16 adet Ogg Vorbis SFX üretildi, presentation.json sounds tablosuna ve SFX_PROVENANCE.json lisans kaydına eklendi. StoryScene ve BattleScene içinde Bölüm 1–7 ve 7 Boss karşılaşması Lyria 3.5 motiflerine bağlandı.',
    audioUrl: '/dev/media/sfx/sfx_ultimate_release.ogg',
    sceneJump: 'battle_t1',
    targetPath: 'content/base/presentation/presentation.json · apps/game/src/audio/Sfx.ts'
  },
  {
    id: 'step_4_7_narrative_upkeep',
    step: 'STEPS',
    stepBadge: '§4.7 · 7138437f',
    title: '§4.7 Narrative Upkeep & Kanonik Kuyruk / Dokümantasyon Senkronizasyonu',
    subtitle: '258 Onaylı Sanat Eseri · 415 R2/D1 Seed Varlığı · 204 Base İçerik Dosyası · $0.00 / $20.00 Bütçe',
    description: 'narrative/11_Audio_Cues/README_SOURCE.md, docs/media/QUEUE_DATA.json, docs/media/QUEUE.md, docs/DEV_TRACKER.json ve docs/NEXT_STEPS.md canlı oyun durumu ile birebir senkronize edildi.',
    imageUrl: '/dev/store/feature_graphic_1024x500.png',
    sceneJump: 'chapters',
    targetPath: 'docs/media/QUEUE_DATA.json · docs/DEV_TRACKER.json · docs/NEXT_STEPS.md'
  },

  // 16 Canonical Gacha Banners (§4.4)
  {
    id: 'banner_hall_of_ancestors',
    step: 'BANNERS',
    stepBadge: 'Banner #1 · Kalıcı',
    title: 'Hall of Ancestors — Kalıcı Kahraman Çağırma Bannerı',
    subtitle: '1376×768 WebP · Standart Kahraman Havuzu',
    description: 'SummonScene ve Dünya Haritası varsayılan vitrin görseli.',
    imageUrl: '/dev/media/art/ui_banner_hall_of_ancestors.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_hall_of_ancestors.webp'
  },
  {
    id: 'banner_hall_of_armaments',
    step: 'BANNERS',
    stepBadge: 'Banner #2 · Kalıcı Silah',
    title: 'Hall of Armaments — Kalıcı İmza Silah Bannerı',
    subtitle: '1376×768 WebP · Seçilebilir Hedefli Silah Havuzu',
    description: '25 kahramanın imza silahları için kalıcı çağrı vitrini.',
    imageUrl: '/dev/media/art/ui_banner_hall_of_armaments.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_hall_of_armaments.webp'
  },
  {
    id: 'banner_oath_01_sister_aveline',
    step: 'BANNERS',
    stepBadge: 'Banner #3 · Oath #1 Hero',
    title: 'Ashen Vigil — Sister Aveline (5★ Oath Banner)',
    subtitle: '1376×768 WebP · 1–14 Kasım Rotasyonu',
    description: 'Sister Aveline sınırlı süreli karakter banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_01_sister_aveline.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_01_sister_aveline.webp'
  },
  {
    id: 'banner_oath_01_weapon',
    step: 'BANNERS',
    stepBadge: 'Banner #4 · Oath #1 Silah',
    title: 'Ashen Vigil Arms — Censer of Saint Luthos (5★ Weapon Banner)',
    subtitle: '1376×768 WebP · Sister Aveline İmza Silahı',
    description: 'Censer of Saint Luthos sınırlı süreli silah banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_01_weapon.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_01_weapon.webp'
  },
  {
    id: 'banner_oath_02_sable_wren',
    step: 'BANNERS',
    stepBadge: 'Banner #5 · Oath #2 Hero',
    title: 'Shadow Under Glass — Sable Wren (5★ Oath Banner)',
    subtitle: '1376×768 WebP · 15–28 Kasım Rotasyonu',
    description: 'Sable Wren sınırlı süreli karakter banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_02_sable_wren.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_02_sable_wren.webp'
  },
  {
    id: 'banner_oath_02_weapon',
    step: 'BANNERS',
    stepBadge: 'Banner #6 · Oath #2 Silah',
    title: 'Shadow Under Glass Arms — Misericorde of the Bellless (5★ Weapon)',
    subtitle: '1376×768 WebP · Sable Wren İmza Silahı',
    description: 'Misericorde of the Bellless sınırlı süreli silah banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_02_weapon.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_02_weapon.webp'
  },
  {
    id: 'banner_oath_03_nara_vell',
    step: 'BANNERS',
    stepBadge: 'Banner #7 · Oath #3 Hero',
    title: 'Iron on the Bridge — Nara Vell (5★ Oath Banner)',
    subtitle: '1376×768 WebP · 29 Kasım – 12 Aralık Rotasyonu',
    description: 'Nara Vell sınırlı süreli karakter banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_03_nara_vell.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_03_nara_vell.webp'
  },
  {
    id: 'banner_oath_03_weapon',
    step: 'BANNERS',
    stepBadge: 'Banner #8 · Oath #3 Silah',
    title: 'Iron on the Bridge Arms — Sanctified Greatmace (5★ Weapon)',
    subtitle: '1376×768 WebP · Nara Vell İmza Silahı',
    description: 'Sanctified Greatmace sınırlı süreli silah banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_03_weapon.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_03_weapon.webp'
  },
  {
    id: 'banner_oath_04_mirel_quill',
    step: 'BANNERS',
    stepBadge: 'Banner #9 · Oath #4 Hero',
    title: 'Ink of the Ledger — Mirel Quill (5★ Oath Banner)',
    subtitle: '1376×768 WebP · 13–26 Aralık Rotasyonu',
    description: 'Mirel Quill sınırlı süreli karakter banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_04_mirel_quill.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_04_mirel_quill.webp'
  },
  {
    id: 'banner_oath_04_weapon',
    step: 'BANNERS',
    stepBadge: 'Banner #10 · Oath #4 Silah',
    title: 'Ink of the Ledger Arms — Ledger of Unpaid Names (5★ Weapon)',
    subtitle: '1376×768 WebP · Mirel Quill İmza Silahı',
    description: 'Ledger of Unpaid Names sınırlı süreli silah banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_04_weapon.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_04_weapon.webp'
  },
  {
    id: 'banner_oath_05_vespera_wisp',
    step: 'BANNERS',
    stepBadge: 'Banner #11 · Oath #5 Hero',
    title: 'Lantern in the Mist — Vespera Wisp (5★ Oath Banner)',
    subtitle: '1376×768 WebP · 27 Aralık – 9 Ocak Rotasyonu',
    description: 'Vespera Wisp sınırlı süreli karakter banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_05_vespera_wisp.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_05_vespera_wisp.webp'
  },
  {
    id: 'banner_oath_05_weapon',
    step: 'BANNERS',
    stepBadge: 'Banner #12 · Oath #5 Silah',
    title: 'Lantern in the Mist Arms — Pale Choir Bell-Staff (5★ Weapon)',
    subtitle: '1376×768 WebP · Vespera Wisp İmza Silahı',
    description: 'Pale Choir Bell-Staff sınırlı süreli silah banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_05_weapon.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_05_weapon.webp'
  },
  {
    id: 'banner_oath_06_iona_mist',
    step: 'BANNERS',
    stepBadge: 'Banner #13 · Oath #6 Hero',
    title: 'Veil of the Crossing — Iona Mist (5★ Oath Banner)',
    subtitle: '1376×768 WebP · 10–23 Ocak Rotasyonu',
    description: 'Iona Mist sınırlı süreli karakter banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_06_iona_mist.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_06_iona_mist.webp'
  },
  {
    id: 'banner_oath_06_weapon',
    step: 'BANNERS',
    stepBadge: 'Banner #14 · Oath #6 Silah',
    title: 'Veil of the Crossing Arms — Mistweaver Reliquary (5★ Weapon)',
    subtitle: '1376×768 WebP · Iona Mist İmza Silahı',
    description: 'Mistweaver Reliquary sınırlı süreli silah banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_06_weapon.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_06_weapon.webp'
  },
  {
    id: 'banner_oath_07_kera_voss',
    step: 'BANNERS',
    stepBadge: 'Banner #15 · Oath #7 Hero',
    title: 'Mortar of Ash — Kera Voss (5★ Oath Banner)',
    subtitle: '1376×768 WebP · 24 Ocak – 6 Şubat Rotasyonu',
    description: 'Kera Voss sınırlı süreli karakter banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_07_kera_voss.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_07_kera_voss.webp'
  },
  {
    id: 'banner_oath_07_weapon',
    step: 'BANNERS',
    stepBadge: 'Banner #16 · Oath #7 Silah',
    title: 'Mortar of Ash Arms — Brass Mortar of Oakhaven (5★ Weapon)',
    subtitle: '1376×768 WebP · Kera Voss İmza Silahı',
    description: 'Brass Mortar of Oakhaven sınırlı süreli silah banner görseli.',
    imageUrl: '/dev/media/art/ui_banner_oath_07_weapon.webp',
    sceneJump: 'summon',
    targetPath: 'content/approved_art/art/ui_banner_oath_07_weapon.webp'
  },

  // 16 SFX + 7 BGM Audio Cues (§4.6)
  {
    id: 'sfx_ui_tap',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · UI',
    title: 'sfx_ui_tap.ogg — Gotik Parşömen & Pirinç Dokunuş Sesi',
    subtitle: '0.14s · 48 kHz Ogg Vorbis · Volume 0.65',
    description: 'Buton ve sekme tıklamalarında kullanılan hızlı UI dokunuş efekti.',
    audioUrl: '/dev/media/sfx/sfx_ui_tap.ogg',
    targetPath: 'content/base/sfx/sfx_ui_tap.ogg'
  },
  {
    id: 'sfx_ui_confirm',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · UI',
    title: 'sfx_ui_confirm.ogg — Çift Tonlu Sanctum Onay Çanı',
    subtitle: '0.28s · 48 kHz Ogg Vorbis · Volume 0.72',
    description: 'Yetenek seçimi ve onay pencerelerinde çalan 520→780 Hz beşli aralık.',
    audioUrl: '/dev/media/sfx/sfx_ui_confirm.ogg',
    targetPath: 'content/base/sfx/sfx_ui_confirm.ogg'
  },
  {
    id: 'sfx_ui_wax_seal',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · UI',
    title: 'sfx_ui_wax_seal.ogg — Kızıl Mühür Darbesi & Bronz Rezonans',
    subtitle: '0.42s · 48 kHz Ogg Vorbis · Volume 0.78',
    description: 'TitleScene TAP TO START ve bölüm mühür açılışlarında kullanılan mühür sesi.',
    audioUrl: '/dev/media/sfx/sfx_ui_wax_seal.ogg',
    targetPath: 'content/base/sfx/sfx_ui_wax_seal.ogg'
  },
  {
    id: 'sfx_footstep_ash',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Footsteps',
    title: 'sfx_footstep_ash.ogg — Kül ve Taş Zemin Adım Sesi',
    subtitle: '0.24s · 48 kHz Ogg Vorbis · Volume 0.58',
    description: 'Chibi birimler walk durumuna geçtiğinde çalan kül/çakıl adım sesi.',
    audioUrl: '/dev/media/sfx/sfx_footstep_ash.ogg',
    targetPath: 'content/base/sfx/sfx_footstep_ash.ogg'
  },
  {
    id: 'sfx_footstep_march',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Footsteps',
    title: 'sfx_footstep_march.ogg — Zırhlı Öncü (Mahmut / Şövalye) Adım Sesi',
    subtitle: '0.36s · 48 kHz Ogg Vorbis · Volume 0.64',
    description: 'Mahmut ve zırhlı şövalyelerin yürüyüşünde çalan metal zırh tınılı adım.',
    audioUrl: '/dev/media/sfx/sfx_footstep_march.ogg',
    targetPath: 'content/base/sfx/sfx_footstep_march.ogg'
  },
  {
    id: 'sfx_blade_slash',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Blades',
    title: 'sfx_blade_slash.ogg — Hızlı Çelik Kılıç Kesisi',
    subtitle: '0.26s · 48 kHz Ogg Vorbis · Volume 0.76',
    description: 'Temel (basic) yakın dövüş saldırılarında çalan keskin kılıç darbesi.',
    audioUrl: '/dev/media/sfx/sfx_blade_slash.ogg',
    targetPath: 'content/base/sfx/sfx_blade_slash.ogg'
  },
  {
    id: 'sfx_blade_heavy',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Blades',
    title: 'sfx_blade_heavy.ogg — Ağır Silah / Kritik Darbe Yarıcısı',
    subtitle: '0.38s · 48 kHz Ogg Vorbis · Volume 0.84',
    description: 'Kritik vuruşlar, ağır silahlar ve boss darbelerinde çalan derin darbe.',
    audioUrl: '/dev/media/sfx/sfx_blade_heavy.ogg',
    targetPath: 'content/base/sfx/sfx_blade_heavy.ogg'
  },
  {
    id: 'sfx_shield_bash',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Shields',
    title: 'sfx_shield_bash.ogg — Mahmut Demir Kalkan & Siper Çarpması',
    subtitle: '0.48s · 48 kHz Ogg Vorbis · Volume 0.80',
    description: 'Mahmut’un aktif siper/kalkan yeteneğinde çalan D-minör demir-pirinç rezonansı.',
    audioUrl: '/dev/media/sfx/sfx_shield_bash.ogg',
    targetPath: 'content/base/sfx/sfx_shield_bash.ogg'
  },
  {
    id: 'sfx_shield_guard',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Shields',
    title: 'sfx_shield_guard.ogg — Kalkan Blok & Ward Yansıtma Tınısı',
    subtitle: '0.30s · 48 kHz Ogg Vorbis · Volume 0.72',
    description: 'Kalkan (Shield) kazanımı ve hasar sönümlemede çalan yüksek çelik çınlama.',
    audioUrl: '/dev/media/sfx/sfx_shield_guard.ogg',
    targetPath: 'content/base/sfx/sfx_shield_guard.ogg'
  },
  {
    id: 'sfx_bell_sanctuary',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Bells',
    title: 'sfx_bell_sanctuary.ogg — Veyrhold Bronz Tapınak Çanı (440 Hz)',
    subtitle: '1.85s · 48 kHz Ogg Vorbis · Volume 0.82',
    description: 'Oyunun ana işitsel motifi olan inharmonik bronz çan vuruşu (5★ Summon, Prolog, Ultimate).',
    audioUrl: '/dev/media/sfx/sfx_bell_sanctuary.ogg',
    targetPath: 'content/base/sfx/sfx_bell_sanctuary.ogg'
  },
  {
    id: 'sfx_bell_silver',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Bells',
    title: 'sfx_bell_silver.ogg — Fadyme Gümüş Koruma Çanı (587.33 Hz D5)',
    subtitle: '1.65s · 48 kHz Ogg Vorbis · Volume 0.78',
    description: 'Fadyme’nin gümüş çan yeteneklerinde ve 4★ Summon açılışında çalan kristal tını.',
    audioUrl: '/dev/media/sfx/sfx_bell_silver.ogg',
    targetPath: 'content/base/sfx/sfx_bell_silver.ogg'
  },
  {
    id: 'sfx_status_buff',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Statuses',
    title: 'sfx_status_buff.ogg — Kutsama / İyileştirme & Buff Akoru',
    subtitle: '0.62s · 48 kHz Ogg Vorbis · Volume 0.74',
    description: 'Can yenileme (Heal) ve pozitif statü (Buff) uygulandığında çalan yükselen akor.',
    audioUrl: '/dev/media/sfx/sfx_status_buff.ogg',
    targetPath: 'content/base/sfx/sfx_status_buff.ogg'
  },
  {
    id: 'sfx_status_debuff',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Statuses',
    title: 'sfx_status_debuff.ogg — Veil Laneti / Zayıflatma & Kontrol Sesi',
    subtitle: '0.56s · 48 kHz Ogg Vorbis · Volume 0.74',
    description: 'Debuff ve kontrol etkileri (Silence, Bleed, Shatter) uygulandığında çalan alçalan disonans.',
    audioUrl: '/dev/media/sfx/sfx_status_debuff.ogg',
    targetPath: 'content/base/sfx/sfx_status_debuff.ogg'
  },
  {
    id: 'sfx_ultimate_cast',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Ultimates (Beat 1)',
    title: 'sfx_ultimate_cast.ogg — Ultimate Beat 1: Ritüel Gong & Yükselen Şarj',
    subtitle: '1.15s · 48 kHz Ogg Vorbis · Volume 0.84',
    description: '3 vuruşlu Japonca Ultimate sekansının 1. adımı (Ritüel hazırlık).',
    audioUrl: '/dev/media/sfx/sfx_ultimate_cast.ogg',
    targetPath: 'content/base/sfx/sfx_ultimate_cast.ogg'
  },
  {
    id: 'sfx_ultimate_cutin',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Ultimates (Beat 2)',
    title: 'sfx_ultimate_cutin.ogg — Ultimate Beat 2: Diyagonal Cut-In Portre Flaş',
    subtitle: '0.68s · 48 kHz Ogg Vorbis · Volume 0.84',
    description: '3 vuruşlu Ultimate sekansının 2. adımı (Portre kesiti ve kristal üçlü akor).',
    audioUrl: '/dev/media/sfx/sfx_ultimate_cutin.ogg',
    targetPath: 'content/base/sfx/sfx_ultimate_cutin.ogg'
  },
  {
    id: 'sfx_ultimate_release',
    step: 'AUDIO_SFX',
    stepBadge: 'SFX · Ultimates (Beat 3)',
    title: 'sfx_ultimate_release.ogg — Ultimate Beat 3: Yıkıcı Patlama & Çifte Çan',
    subtitle: '1.95s · 48 kHz Ogg Vorbis · Volume 0.88',
    description: '3 vuruşlu Ultimate sekansının 3. adımı (Tam ekran darbe ve bronz+gümüş çan patlaması).',
    audioUrl: '/dev/media/sfx/sfx_ultimate_release.ogg',
    targetPath: 'content/base/sfx/sfx_ultimate_release.ogg'
  },
  {
    id: 'bgm_main_theme',
    step: 'AUDIO_SFX',
    stepBadge: 'BGM · Ana Tema',
    title: 'bgm_main_theme.ogg — Ana Tema (68 BPM Anadolu Gotik Melankolik Rock)',
    subtitle: 'Lyria 3.5 · Studio & TitleScene',
    description: 'ŞovTaym Studios ve TitleScene ekranlarında çalan kilitli ana tema.',
    audioUrl: '/dev/media/audio/bgm_main_theme.ogg',
    targetPath: 'content/base/audio/bgm_main_theme.ogg'
  },
  {
    id: 'bgm_ch1_ash_forest_chaotic',
    step: 'AUDIO_SFX',
    stepBadge: 'BGM · Boss & Kriz Motifi',
    title: 'bgm_ch1_ash_forest_chaotic.ogg — Bölüm 1–7 Boss Savaşları & Faz Geçişleri',
    subtitle: 'Lyria 3.5 · 7 Boss Savaşı & Kriz Sahneleri',
    description: 'BattleScene içinde tüm Boss karşılaşmaları ve StoryScene faz geçişlerinde kullanılan yüksek tempolu motif.',
    audioUrl: '/dev/media/audio/bgm_ch1_ash_forest_chaotic.ogg',
    targetPath: 'content/base/audio/bgm_ch1_ash_forest_chaotic.ogg'
  },
  {
    id: 'bgm_battle_field',
    step: 'AUDIO_SFX',
    stepBadge: 'BGM · Taktiksel Saha Savaşı',
    title: 'bgm_battle_field.ogg — 5v5 Normal & Hard Saha Savaşları',
    subtitle: 'Lyria 3.5 · Standart Savaş Sahnesi',
    description: 'Bölüm 1–7 saha karşılaşmalarında çalan taktiksel savaş müziği.',
    audioUrl: '/dev/media/audio/bgm_battle_field.ogg',
    targetPath: 'content/base/audio/bgm_battle_field.ogg'
  }
];

/** Where the browser build of the game lives: the sibling Worker of this admin, or the local dev server. */
function gameUrl(scene = '', target: 'worker' | 'vite' = 'worker'): string {
  const h = window.location.hostname;
  const port = target === 'vite' ? '5173' : '8787';
  const base = h === '127.0.0.1' || h === 'localhost' ? `http://127.0.0.1:${port}/` : `${window.location.protocol}//${h.replace(/^uomd-admin/, 'uomd-game')}/`;
  return scene ? `${base}?preview_scene=${encodeURIComponent(scene)}` : base;
}

export function Development({ me, say }: { me: Me; say: (m: string) => void }): ReactNode {
  const [tab, setTab] = useState<Tab>('D-30 Onay Merkezi (§4.1–§4.7)');
  const readProgress = useCallback(async (signal: AbortSignal): Promise<Progress> => {
    const r = await fetch('/dev/progress.json', { cache: 'no-cache', signal });
    if (!r.ok) throw new Error('progress.json missing');
    return r.json() as Promise<Progress>;
  }, []);
  const { data: p, error: err } = usePolling(readProgress);
  const [area, setArea] = useState('Art direction');
  const [jumpScene, setJumpScene] = useState('fresh_flow');
  if (err) return <ErrorNotice error={err} />;
  if (!p) return <p>Loading development data…</p>;
  return (
    <>
      <header className="page">
        <h2>Development &amp; D-30 Onay Merkezi</h2>
        <span className="badge ok">D-30 §4.1–§4.7 Tamamlandı · 258 Onaylı Eser · 415 Varlık</span>
        <span className="badge">{packageSummary(p)}</span>
      </header>
      <div className="row" role="tablist" style={{ flexWrap: 'wrap', gap: 6 }}>
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={t === tab} className={`btn${t === tab ? ' primary' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'D-30 Onay Merkezi (§4.1–§4.7)' ? (
        <D30ReviewCenter
          me={me}
          say={say}
          onJumpPreview={(sc) => {
            setJumpScene(sc);
            setTab('Live preview');
          }}
        />
      ) : null}
      {tab === 'Overview' ? <Overview p={p} onOpenReview={() => setTab('D-30 Onay Merkezi (§4.1–§4.7)')} /> : null}
      {tab === 'Live preview' ? <Preview initialScene={jumpScene} /> : null}
      {tab === 'Store & Brand Kit' ? <StoreKit p={p} /> : null}
      {tab === 'Screens' ? <Screens p={p} onNote={(a) => { setArea(a); setTab('Feedback'); }} /> : null}
      {tab === 'Feedback' ? <Feedback me={me} say={say} area={area} setArea={setArea} /> : null}
    </>
  );
}

interface D30DecisionState {
  status: 'approved' | 'rejected' | 'pending';
  comment: string;
  noteId?: number;
  updatedAt?: string;
}

function parseD30Notes(notes: Note[]): Record<string, D30DecisionState> {
  const out: Record<string, D30DecisionState> = {};
  // Notes are returned newest-first or oldest-first; sort by id ascending so latest wins
  const sorted = [...notes].sort((a, b) => a.id - b.id);
  for (const n of sorted) {
    const m = /^\[D30:([a-z0-9_]+)\]\s*(?:ONAYLANDI|REDDEDİLDİ|REVİZE)?\s*[:—-]?\s*(.*)$/i.exec(n.body);
    if (!m) continue;
    const itemId = m[1]!;
    const comment = m[2]?.trim() ?? '';
    const isRejected = n.kind === 'change_request' || n.body.includes('REDDEDİLDİ') || (n.status === 'open' && n.kind !== 'approved');
    out[itemId] = {
      status: isRejected ? 'rejected' : 'approved',
      comment,
      noteId: n.id,
      updatedAt: n.created_at
    };
  }
  return out;
}

function D30ReviewCenter({
  me,
  say,
  onJumpPreview
}: {
  me: Me;
  say: (m: string) => void;
  onJumpPreview: (scene: string) => void;
}): ReactNode {
  const [filter, setFilter] = useState<'ALL' | 'STEPS' | 'BANNERS' | 'AUDIO_SFX' | 'REJECTED'>('ALL');
  const [decisions, setDecisions] = useState<Record<string, D30DecisionState>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDecisions = useCallback((): void => {
    api<{ notes: Note[] }>('/dev/notes')
      .then((r) => {
        const parsed = parseD30Notes(r.notes);
        setDecisions(parsed);
        setDraftComments((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(parsed)) {
            if (next[k] === undefined && v.comment) next[k] = v.comment;
          }
          return next;
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  const recordDecision = async (item: D30ReviewItem, newStatus: 'approved' | 'rejected'): Promise<void> => {
    setSavingId(item.id);
    const comment = (draftComments[item.id] ?? decisions[item.id]?.comment ?? '').trim();
    const label = newStatus === 'approved' ? 'ONAYLANDI' : 'REDDEDİLDİ';
    const body = `[D30:${item.id}] ${label} — ${item.title}${comment ? ` | Not: ${comment}` : ''}`;
    const kind = newStatus === 'approved' ? 'approved' : 'change_request';
    try {
      const existing = decisions[item.id];
      if (existing?.noteId) {
        await api(`/dev/notes/${existing.noteId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: newStatus === 'approved' ? 'done' : 'open',
            resolution: `${label}${comment ? `: ${comment}` : ''}`
          })
        }).catch(() => undefined);
      }
      await api('/dev/notes', {
        method: 'POST',
        body: JSON.stringify({
          area: 'Art direction',
          kind,
          body
        })
      });
      say(
        newStatus === 'approved'
          ? `✅ "${item.title}" onaylandı ve sunucuya (D1) kaydedildi.`
          : `❌ "${item.title}" için red/revize talebi sunucuya (D1) kaydedildi.`
      );
      loadDecisions();
    } catch (e) {
      say(e instanceof ApiError ? `${e.code}: ${e.message}` : String((e as Error).message));
    } finally {
      setSavingId(null);
    }
  };

  const approveAllVisible = async (items: D30ReviewItem[]): Promise<void> => {
    setSavingId('BULK');
    try {
      for (const item of items) {
        if (decisions[item.id]?.status === 'approved') continue;
        const comment = (draftComments[item.id] ?? '').trim();
        await api('/dev/notes', {
          method: 'POST',
          body: JSON.stringify({
            area: 'Art direction',
            kind: 'approved',
            body: `[D30:${item.id}] ONAYLANDI — ${item.title}${comment ? ` | Not: ${comment}` : ''}`
          })
        });
      }
      say(`✅ Listelenen ${items.length} teslimat kalemi onaylandı ve D1 veritabanına kaydedildi.`);
      loadDecisions();
    } catch (e) {
      say(e instanceof ApiError ? `${e.code}: ${e.message}` : String((e as Error).message));
    } finally {
      setSavingId(null);
    }
  };

  const filtered = D30_REVIEW_ITEMS.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'REJECTED') return decisions[item.id]?.status === 'rejected';
    return item.step === filter;
  });

  const approvedCount = D30_REVIEW_ITEMS.filter((i) => decisions[i.id]?.status === 'approved').length;
  const rejectedCount = D30_REVIEW_ITEMS.filter((i) => decisions[i.id]?.status === 'rejected').length;
  const pendingCount = D30_REVIEW_ITEMS.length - approvedCount - rejectedCount;

  return (
    <div>
      <section className="card" style={{ marginBottom: 16, border: '1.5px solid #d4a857' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, color: '#f3d287' }}>🎨 D-30 Art Director Teslimat &amp; Canlı Onay / Red Merkezi (§4.1 – §4.7)</h3>
            <p style={{ margin: '6px 0 0', color: 'var(--dim)' }}>
              Yapılan tüm adımlar (<strong>§4.1 – §4.7</strong>), <strong>16 Gacha Banner görseli</strong>, <strong>9×3 Boss Objective Atlası</strong>, <strong>115 Signature VFX</strong> ve <strong>16 Ogg Vorbis SFX + Müzik</strong> aşağıda listelenmiştir. Verdiğiniz her <strong>Onay (✅)</strong> veya <strong>Red / Revize (❌)</strong> kararı doğrudan Cloudflare D1 veritabanına kaydedilir ve bir sonraki adımda revize taleplerinize göre ilerlenir.
            </p>
          </div>
          <div className="row" style={{ gap: 8, margin: 0 }}>
            <span className="badge ok">✅ Onaylanan: {approvedCount}</span>
            <span className="badge bad">❌ Red / Revize: {rejectedCount}</span>
            <span className="badge warn">⏳ Bekleyen: {pendingCount}</span>
          </div>
        </div>

        <div className="row" style={{ marginTop: 12, marginBottom: 0, justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="row" style={{ margin: 0, gap: 6, flexWrap: 'wrap' }}>
            <button type="button" className={`btn${filter === 'ALL' ? ' primary' : ''}`} onClick={() => setFilter('ALL')}>
              Tümü ({D30_REVIEW_ITEMS.length})
            </button>
            <button type="button" className={`btn${filter === 'STEPS' ? ' primary' : ''}`} onClick={() => setFilter('STEPS')}>
              7 Ana Adım (§4.1–§4.7)
            </button>
            <button type="button" className={`btn${filter === 'BANNERS' ? ' primary' : ''}`} onClick={() => setFilter('BANNERS')}>
              16 Gacha Banner (1376×768)
            </button>
            <button type="button" className={`btn${filter === 'AUDIO_SFX' ? ' primary' : ''}`} onClick={() => setFilter('AUDIO_SFX')}>
              16 SFX &amp; 3 Ana Müzik Motifi
            </button>
            <button type="button" className={`btn${filter === 'REJECTED' ? ' primary' : ''}`} onClick={() => setFilter('REJECTED')}>
              ❌ Red / Revize İstenenler ({rejectedCount})
            </button>
          </div>

          {me.role !== 'viewer' ? (
            <button
              type="button"
              className="btn primary"
              disabled={savingId !== null}
              onClick={() => void approveAllVisible(filtered)}
            >
              {savingId === 'BULK' ? 'Kaydediliyor…' : `✅ Görünenlerin Tümünü Onayla (${filtered.length})`}
            </button>
          ) : null}
        </div>
      </section>

      {loading ? <p>Onay durumları D1 veritabanından yükleniyor…</p> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(410px, 1fr))',
          gap: 16
        }}
      >
        {filtered.map((item) => {
          const dec = decisions[item.id] ?? { status: 'pending', comment: '' };
          const border =
            dec.status === 'approved'
              ? '1.5px solid #3fa36c'
              : dec.status === 'rejected'
                ? '1.5px solid #d14949'
                : '1px solid #382a4a';
          const statusBadge =
            dec.status === 'approved' ? (
              <span className="badge ok">ONAYLANDI ✅</span>
            ) : dec.status === 'rejected' ? (
              <span className="badge bad">REDDEDİLDİ / REVİZE ❌</span>
            ) : (
              <span className="badge warn">ONAY BEKLİYOR ⏳</span>
            );

          return (
            <article
              key={item.id}
              className="card"
              style={{
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                border
              }}
            >
              <div className="row" style={{ justifyContent: 'space-between', margin: 0 }}>
                <span className="badge info">{item.stepBadge}</span>
                {statusBadge}
              </div>

              <h3 style={{ margin: 0, fontSize: 16 }}>{item.title}</h3>
              <div className="mono" style={{ fontSize: 12, color: '#f3d287' }}>{item.subtitle}</div>

              {item.imageUrl ? (
                <a
                  href={item.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'block',
                    borderRadius: 8,
                    overflow: 'hidden',
                    border: '1px solid #382a4a',
                    background: '#09060e'
                  }}
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    loading="lazy"
                    style={{ width: '100%', maxHeight: 220, objectFit: 'contain', display: 'block' }}
                  />
                </a>
              ) : null}

              {item.audioUrl ? (
                <div style={{ padding: '8px 10px', borderRadius: 8, background: '#0b0712', border: '1px solid #382a4a' }}>
                  <audio controls preload="none" src={item.audioUrl} style={{ width: '100%', height: 36 }} />
                </div>
              ) : null}

              <p style={{ margin: 0, fontSize: 13.5 }}>{item.description}</p>
              <div className="mono" style={{ fontSize: 11, color: 'var(--dim)' }}>
                <strong>Dosya/Hedef:</strong> {item.targetPath}
              </div>

              {dec.comment ? (
                <div style={{ padding: '6px 10px', borderRadius: 6, background: 'rgba(212,168,87,0.1)', fontSize: 12.5 }}>
                  <strong>Kayıtlı Notunuz:</strong> {dec.comment}
                </div>
              ) : null}

              <input
                type="text"
                placeholder="Onay veya red/revize notunuz (ör. parlaklığı artır, sesini kıs...)"
                value={draftComments[item.id] ?? ''}
                onChange={(e) => setDraftComments((prev) => ({ ...prev, [item.id]: e.target.value }))}
                style={{ width: '100%', marginTop: 'auto' }}
              />

              <div className="row" style={{ margin: 0, gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn${dec.status === 'approved' ? ' primary' : ''}`}
                  disabled={savingId === item.id}
                  onClick={() => void recordDecision(item, 'approved')}
                >
                  ✅ Onayla
                </button>
                <button
                  type="button"
                  className={`btn${dec.status === 'rejected' ? ' primary' : ''}`}
                  disabled={savingId === item.id}
                  onClick={() => void recordDecision(item, 'rejected')}
                >
                  ❌ Reddet / Revize İste
                </button>
                {item.sceneJump ? (
                  <button type="button" className="btn" onClick={() => onJumpPreview(item.sceneJump!)}>
                    🎮 Canlı Oyunda Gör
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function packageSummary(p: Progress): string {
  const caps = p.capabilities ?? [];
  if (!caps.length) return `${p.summary.done} done · ${p.summary.partial} partial · ${p.summary.missing} missing`;
  const n = (s: string): number => caps.filter((c) => c.implementationStatus === s).length;
  const accepted = caps.filter((c) => c.implementationStatus === 'COMPLETE' && c.blockerIds.length === 0).length;
  return `R00–R18 · code ${n('COMPLETE')} complete, ${n('PARTIAL')} partial · ${accepted} with no open acceptance gate`;
}

const List = ({ title, items }: { title: string; items: Item[] }): ReactNode => (
  <section className="card"><h3>{title}</h3><ul>{items.map((i) => <li key={i.title}><strong>{i.title}</strong>{i.detail ? ` — ${i.detail}` : ''}</li>)}</ul></section>
);

function Overview({ p, onOpenReview }: { p: Progress; onOpenReview: () => void }): ReactNode {
  return (
    <>
      <p className="mono">Generated {p.generatedAt} from the repository (docs/DEV_TRACKER.json reviewed {p.reviewedAt ?? '—'} at {p.sourceCommit ?? '—'}, roadmap, decisions, git history, base release manifest).</p>
      {p.currentAssignment ? (
        <section className="card" style={{ marginBottom: 14, border: '1px solid #d4af37' }}>
          <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <h3 style={{ margin: 0 }}>Current assignment {p.currentAssignment.id}</h3>
              <span className="badge ok">{p.currentAssignment.status}</span>
            </div>
            <button type="button" className="btn primary" onClick={onOpenReview}>
              📋 D-30 Onay Merkezine Git (42 Maddeyi Onayla / Reddet)
            </button>
          </div>
          <p style={{ margin: '8px 0 0' }}>{p.currentAssignment.workflow}</p>
          <p style={{ margin: '6px 0 0', color: 'var(--dim)' }}><strong>Proposed next:</strong> {p.currentAssignment.nextProposed}</p>
        </section>
      ) : null}
      {p.baseRelease ? (
        <section className="card" style={{ marginBottom: 14 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>Base release (initial AAB content)</h3>
            <span className="badge ok">{p.baseRelease.id} · gen {p.baseRelease.generation}</span>
            <span className="badge ok">client ≥ {p.baseRelease.minClient}</span>
            <span className="badge ok">{p.baseRelease.fileCount} base files ({(p.baseRelease.totalBytes / (1024 * 1024)).toFixed(2)} MB)</span>
            <span className="badge ok">{p.baseRelease.approvedArtCount} approved art entries</span>
          </div>
          {p.flow ? <p style={{ margin: '8px 0 0', color: 'var(--dim)' }}><strong>Flow:</strong> {p.flow}</p> : null}
        </section>
      ) : null}
      {p.checks ? (
        <>
          <h3>Latest checks ({p.checks.date}, {p.checks.commit})</h3>
          <table>
            <tbody>{p.checks.items.map((c) => <tr key={c.name}><td>{c.name}</td><td><span className={`badge ${checkBadge(c.result)}`}>{c.result}</span></td><td>{c.detail}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      <div className="grid">
        <List title="Working on now" items={p.now} />
        <List title="Next" items={p.next} />
        <List title="Waiting for you" items={p.blockedOnOwner} />
      </div>
      {p.phases?.length ? (
        <>
          <h3>Phases (README section 0)</h3>
          <div className="grid">
            {p.phases.map((ph) => (
              <section key={ph.n} className="card">
                <div className="row"><h3 style={{ margin: 0 }}>Phase {ph.n} — {ph.title}</h3><span className={`badge ${ph.status === 'active' ? 'ok' : 'warn'}`}>{ph.status}</span></div>
                <p style={{ margin: '8px 0 2px' }}><strong>Done</strong></p>
                <ul>{ph.done.map((x) => <li key={x}>{x}</li>)}</ul>
                <p style={{ margin: '8px 0 2px' }}><strong>Remaining</strong></p>
                <ul>{ph.remaining.map((x) => <li key={x}>{x}</li>)}</ul>
              </section>
            ))}
          </div>
        </>
      ) : null}
      {p.capabilities?.length ? (
        <>
          <h3>Work packages R00–R18</h3>
          <p style={{ color: 'var(--dim)' }}>Code is the local source state. Acceptance stays open while a gate is listed (device, live accounts, art, owner decisions). The latest evidence shows who verified what and when.</p>
          <table>
            <thead><tr><th>ID</th><th>Package</th><th>Code</th><th>Open acceptance gates</th><th>Latest evidence</th></tr></thead>
            <tbody>{p.capabilities.map((c) => {
              const ev = (p.evidence ?? []).filter((e) => c.evidenceIds.includes(e.id) && e.verifiedAt).sort((x, y) => String(y.verifiedAt).localeCompare(String(x.verifiedAt)))[0];
              return (
                <tr key={c.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{c.id}</td>
                  <td style={{ minWidth: 280 }}>{c.title}<div className="mono" style={{ whiteSpace: 'normal' }}>{c.implemented}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}><span className={`badge ${codeBadge(c.implementationStatus)}`}>{c.implementationStatus}</span></td>
                  <td style={{ minWidth: 180 }}><div className="row" style={{ gap: 4, margin: 0 }}>{c.blockerIds.length ? c.blockerIds.map((b) => <span key={b} className="badge warn" style={{ whiteSpace: 'nowrap' }} title={(p.blockers ?? []).find((x) => x.id === b)?.title}>{b}</span>) : <span className="badge ok">none</span>}</div></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{ev ? <><div>{ev.level}</div><div className="mono">{String(ev.verifiedAt).slice(0, 10)} · <span title={ev.id}>{ev.id.length > 22 ? `${ev.id.slice(0, 21)}…` : ev.id}</span></div></> : '—'}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </>
      ) : null}
      {p.media?.length ? (
        <>
          <h3>Art integration (Argon workbench to game)</h3>
          <table>
            <thead><tr><th>Kind</th><th>Drawn</th><th>In the game</th><th>Missing</th></tr></thead>
            <tbody>{p.media.map((m) => <tr key={m.kind}><td>{m.kind}</td><td>{m.drawn}</td><td>{m.inGame}</td><td>{m.missing}</td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      {p.blockers?.length ? (
        <>
          <h3>Acceptance gates</h3>
          <table>
            <thead><tr><th>ID</th><th>State</th><th>Gate</th></tr></thead>
            <tbody>{p.blockers.map((b) => <tr key={b.id}><td>{b.id}</td><td><span className={`badge ${b.level === 'OWNER_BLOCKED' ? 'bad' : 'warn'}`}>{b.level}</span></td><td><strong>{b.title}</strong><div className="mono">{b.detail}</div></td></tr>)}</tbody>
          </table>
        </>
      ) : null}
      <h3>Infrastructure matrix (docs/INFRA_ROADMAP.md)</h3>
      <table>
        <thead><tr><th>#</th><th>Area</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody>{p.roadmap.map((r) => <tr key={r.n}><td>{r.n}</td><td>{r.area}</td><td>{r.status}</td><td>{r.detail}</td></tr>)}</tbody>
      </table>
      <h3>Your ideas and how they were handled</h3>
      <table>
        <thead><tr><th>Date</th><th>Idea</th><th>State</th></tr></thead>
        <tbody>{p.ideas.map((i) => <tr key={i.text}><td>{i.date}</td><td>{i.text}</td><td>{i.status}</td></tr>)}</tbody>
      </table>
      <h3>Decisions</h3>
      <table>
        <thead><tr><th>ID</th><th>When / who</th><th>Decision</th></tr></thead>
        <tbody>{p.decisions.slice().reverse().map((d) => <tr key={d.id}><td>{d.id}</td><td>{d.when}</td><td>{d.what}</td></tr>)}</tbody>
      </table>
      <h3>Recent commits (GitHub main → Cloudflare Workers Builds, D-28)</h3>
      <table>
        <tbody>{p.commits.map((c) => <tr key={c.sha}><td><code>{c.sha}</code></td><td>{c.at.slice(0, 16).replace('T', ' ')}</td><td>{c.subject}</td></tr>)}</tbody>
      </table>
    </>
  );
}

const FRAMES: { label: string; w: number; h: number }[] = [
  { label: 'Desktop 16:9', w: 1280, h: 720 },
  { label: 'Phone 20:9', w: 1200, h: 540 }
];

const SCENE_PRESETS: { id: string; label: string }[] = [
  { id: 'fresh_flow', label: '1. Full Flow (Splash → Prologue → Tutorials)' },
  { id: 'studio', label: '2. SovTaym Studios' },
  { id: 'title_fresh', label: '3. Title (Tap to Start → Prologue)' },
  { id: 'prologue', label: '4. 120s Prologue' },
  { id: 'story_t1', label: '5. LN T-1 Before' },
  { id: 'battle_t1', label: '6. Battle T-1 (Whispering Ash)' },
  { id: 'story_t1_after', label: '7. LN T-1 After' },
  { id: 'story_t2_before', label: '8. LN T-2 Before' },
  { id: 'battle_t2', label: '9. Battle T-2 (Stone Crossing)' },
  { id: 'story_t2_after', label: '10. LN T-2 After' },
  { id: 'story_t3_before', label: '11. LN T-3 Before' },
  { id: 'battle_t3', label: '12. Battle T-3 (Shelter Courtyard)' },
  { id: 'story_t3_after', label: '13. LN T-3 Finale' },
  { id: 'finish_wait', label: '14. Patch Wait (Quotes)' },
  { id: 'hub', label: '15. Company Hub' },
  { id: 'chapters', label: '16. World Map (Chapters)' },
  { id: 'roster', label: '17. Companion Roster (25 Heroes)' },
  { id: 'character', label: '18. Character Sheet (Fadyme)' },
  { id: 'summon', label: '19. Hall of Ancestors (Summon)' },
  { id: 'trials', label: '20. Trials (Arena & Endless)' }
];

function Preview({ initialScene = 'fresh_flow' }: { initialScene?: string }): ReactNode {
  const [f, setF] = useState(0);
  const [scene, setScene] = useState(initialScene);
  useEffect(() => {
    setScene(initialScene);
  }, [initialScene]);
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');
  const [target, setTarget] = useState<'worker' | 'vite'>(isLocal ? 'vite' : 'worker');
  const [nonce, setNonce] = useState(0);
  const frame = FRAMES[f] as (typeof FRAMES)[number];
  const url = gameUrl(scene, target);
  return (
    <>
      <p>The game as deployed on Cloudflare (or the dev server when local). Jump to any scene of the initial AAB flow below, or play the full entry sequence from the splash.</p>
      <div className="row" style={{ marginBottom: 8 }}>
        {FRAMES.map((x, i) => <button key={x.label} className={`btn${i === f ? ' primary' : ''}`} onClick={() => setF(i)}>{x.label}</button>)}
        {isLocal ? (
          <>
            <button className={`btn${target === 'vite' ? ' primary' : ''}`} onClick={() => setTarget('vite')}>Vite Dev (:5173)</button>
            <button className={`btn${target === 'worker' ? ' primary' : ''}`} onClick={() => setTarget('worker')}>Game Worker (:8787)</button>
          </>
        ) : (
          <span className="badge ok">Cloudflare Live Worker</span>
        )}
        <button className="btn" onClick={() => setNonce(nonce + 1)}>Reload</button>
        <a className="btn" href={url} target="_blank" rel="noreferrer">Open in a new tab</a>
      </div>
      <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
        {SCENE_PRESETS.map((s) => (
          <button key={s.id || 'full'} className={`btn${scene === s.id ? ' primary' : ''}`} onClick={() => { setScene(s.id); setNonce(nonce + 1); }}>
            {s.label}
          </button>
        ))}
      </div>
      <div style={{ maxWidth: '100%', overflow: 'auto', marginTop: 12 }}>
        <iframe key={`${f}-${scene}-${target}-${nonce}`} title="Game preview" src={url} width={frame.w} height={frame.h} style={{ border: '1px solid var(--edge, #444)', borderRadius: 8, background: '#0a0610', maxWidth: '100%' }} allow="autoplay; fullscreen" />
      </div>
    </>
  );
}

function StoreKit({ p }: { p: Progress }): ReactNode {
  const list = p.storeAssets ?? [];
  const brand = list.filter((x) => x.kind === 'brand');
  const shots = list.filter((x) => x.kind === 'screenshot');
  return (
    <>
      <p>Canonical Google Play Store &amp; Brand Identity Kit built from 100% approved runtime assets (silver-haired veil-hooded Fadyme, dark-brown-haired armored Mahmut, 32 clean alpha-keyed character portraits, and 54 animated chibi sheets).</p>
      <h3>Brand Logos, App Icon &amp; Feature Graphic</h3>
      <div className="grid">
        {brand.map((b) => (
          <figure key={b.file} className="card" style={{ margin: 0 }}>
            <a href={`/dev/store/${b.file}`} target="_blank" rel="noreferrer">
              <img src={`/dev/store/${b.file}`} alt={b.label} loading="lazy" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6, background: '#0c0814' }} />
            </a>
            <figcaption className="mono">{b.label} (<code>docs/store/assets/{b.file}</code>)</figcaption>
          </figure>
        ))}
      </div>
      <h3>8× 1920×1080 Google Play Landscape Store Showcase Screenshots</h3>
      <div className="grid">
        {shots.map((s) => (
          <figure key={s.file} className="card" style={{ margin: 0 }}>
            <a href={`/dev/store/${s.file}`} target="_blank" rel="noreferrer">
              <img src={`/dev/store/${s.file}`} alt={s.label} loading="lazy" style={{ width: '100%', borderRadius: 6 }} />
            </a>
            <figcaption className="mono">{s.label} (<code>docs/store/assets/{s.file}</code>)</figcaption>
          </figure>
        ))}
      </div>
    </>
  );
}

function Screens({ p, onNote }: { p: Progress; onNote: (area: string) => void }): ReactNode {
  return (
    <>
      <p>Curated screenshots from the automated browser tests (updated whenever a screen changes). Pick a screen and leave a note.</p>
      <div className="grid">
        {p.screens.map((s) => (
          <figure key={s.file} className="card" style={{ margin: 0 }}>
            <a href={`/dev/evidence/${s.file}`} target="_blank" rel="noreferrer"><img src={`/dev/evidence/${s.file}`} alt={s.caption} loading="lazy" style={{ width: '100%', borderRadius: 6 }} /></a>
            <figcaption className="mono">{s.caption}</figcaption>
            <button className="btn" onClick={() => onNote(AREAS.find((a) => s.caption.toLowerCase().includes(a.toLowerCase().split(' ')[0] ?? '')) ?? 'General')}>Leave a note</button>
          </figure>
        ))}
        {p.screens.length === 0 ? <p>No screenshots yet.</p> : null}
      </div>
    </>
  );
}

function Feedback({ me, say, area, setArea }: { me: Me; say: (m: string) => void; area: string; setArea: (a: string) => void }): ReactNode {
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const load = (): void => { api<{ notes: Note[] }>('/dev/notes').then((r) => setNotes(r.notes)).catch(setErr); };
  useEffect(load, []);
  const submit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await api('/dev/notes', { method: 'POST', body: JSON.stringify({ area, kind: String(f.get('kind')), body: String(f.get('body')) }) });
      form.reset(); say('Note saved. I read open notes at the start of every working session.'); load();
    } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); }
  };
  const move = async (n: Note, status: string): Promise<void> => {
    const resolution = status === 'done' || status === 'wontfix' ? (window.prompt('Resolution (what was done / why not):', n.resolution) ?? '') : n.resolution;
    try { await api(`/dev/notes/${n.id}`, { method: 'PATCH', body: JSON.stringify({ status, resolution }) }); load(); } catch (x) { say(x instanceof ApiError ? `${x.code}: ${x.message}` : String((x as Error).message)); }
  };
  if (err) return <ErrorNotice error={err} />;
  return (
    <>
      <form className="row" onSubmit={submit} aria-label="New note">
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area">{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
        <select name="kind" aria-label="Kind"><option value="feedback">feedback</option><option value="change_request">change request</option><option value="approved">approved</option><option value="question">question</option><option value="idea">idea</option></select>
        <input name="body" placeholder="What should change, or what do you like?" required maxLength={4000} style={{ flex: 1, minWidth: 320 }} />
        <button className="btn primary" type="submit">Save note</button>
      </form>
      <table>
        <thead><tr><th>#</th><th>Area</th><th>Kind</th><th>Note</th><th>State</th><th>Resolution</th><th /></tr></thead>
        <tbody>{(notes ?? []).map((n) => (
          <tr key={n.id}>
            <td>{n.id}</td><td>{n.area}</td><td>{n.kind}</td><td>{n.body}<div className="mono">{n.created_by} · {n.created_at.slice(0, 16).replace('T', ' ')}</div></td>
            <td><span className={`badge ${n.status === 'done' ? 'ok' : 'warn'}`}>{n.status}</span></td><td>{n.resolution}</td>
            <td>{me.role !== 'viewer' ? <select aria-label={`State of note ${n.id}`} value={n.status} onChange={(e) => void move(n, e.target.value)}><option>open</option><option>in_progress</option><option>done</option><option>wontfix</option></select> : null}</td>
          </tr>
        ))}</tbody>
      </table>
      {notes && notes.length === 0 ? <p>No notes yet.</p> : null}
    </>
  );
}
