# Part I Narrative → Teknik Entegrasyon Notu

**Tarih:** 2026-09-27 · **Hazırlayan:** Narrative Director · **Durum:** Narrative içerik tamam; commit, pytest, JP ses ve görseller bilinçli olarak en sona bırakıldı.

Bu not, Part I narrative turunda eklenen/değişen her dosyanın **hangi kod bileşeniyle, hangi anahtar üzerinden** eşleşeceğini tanımlar. Uygulama biçimi teknik ekibin kararıdır; aşağıdakiler gereksinimdir, dikte değildir.

## 1. Özet

| Dosya | Durum | Kim okur | Mevcut kod destekliyor mu |
|---|---|---|---|
| `content/story_script_ch01.json`–`ch07.json` | Değişti (satır ekleme/çıkarma + 13 yeni sahne) | `client/story_index.py`, `core/localization.py`, `client/screens/vn_screen.py` | **Evet** (sahne şekilleri aynı) |
| `content/story_script_part1_manifest.json` | Değişti (`story_order` 38 → 51, `non_stage_scene_ids`, `starting_free`) | `client/story_index.py`, `core/story_state.py`, `client/game_controller.py` | Evet, **ama save migrasyonu gerekli** (§3) |
| `content/chapters_part1.json` | Değişti (`ending_scene.dialogue_ids` + `ending_fadyme_003`) | builder / validator | Evet |
| `content/enemies_part1.json` + `tools/build_part1_content.py` | Değişti (`ashened_estate_dead` → `ashen_estate_dead`) | loader, builder | Evet |
| `content/character_stories_part1.json` | **Yeni** | — | **Hayır**, yeni okuyucu + UI gerekli (§4) |
| `content/events_part1.json` | **Yeni** | — | **Hayır** (§5) |
| `content/lore_text_part1.json` | **Yeni** | — | **Hayır** (§6) |
| `content/character_voice_lines_part1.json` | **Yeni** | — | **Hayır** (§7) |
| `tools/validate_part1_content.py` | Değişti (izinli konuşmacılara `shrine_keeper`, `refugee_woman`) | CI | Evet |
| `tests/test_localization.py` | Değişti (beklenen satır sayısı 308 → **409**) | pytest | Çalıştırılmadı |
| `docs/PART1_FULL_SCRIPT.md` | Yeni, üretilmiş okuma kopyası | İnsanlar | Kaynak değildir; JSON'lar kaynaktır |
| `lore/` | Yeni (canon, timeline, dünya kuralları, faction'lar, 20 karakter modeli) | Yazarlar | Runtime'a girmez |

Validator: `tools/validate_part1_content.py` geçiyor, 409 benzersiz ana hikâye satırı. Builder drift kontrolü `drop_tables_part1.json`, `battle_rules_part1.json`, `stages_part1.json` için fark bildiriyor; bu üç dosyaya narrative turunda dokunulmadı, fark teknik ekibin commit edilmemiş işinden geliyor olmalı.

## 2. Ana hikâye akışı

- `story_order` artık 51 giriş: 35 stage + açılış + itiraf + Cael reveal + **13 yeni bölüm arası sahne**:
  `ch1_first_oath`, `ch1_camp`, `ch2_road`, `ch2_camp`, `ch3_road`, `ch3_camp`, `ch4_road`, `ch4_camp`, `ch5_road`, `ch5_camp`, `ch6_road`, `ch6_camp`, `ch7_road`.
- Yeni sahneler ilgili bölüm dosyasının `scenes` dizisinde, **`stage_id` alanı olmadan**, `scene_id` + `lines` ile duruyor. `client/story_index.py` bu şekli zaten "plain scene" olarak kaydediyor; `core/localization.py` `scenes[*].lines` dizisini zaten tarıyor. Ek alanlar: `placement` (bilgi amaçlı), `counts_as_stage: false`, `ration_cost: 0`.
- Yeni sahneler savaş içermez, Ration harcamaz, ödül vermez, `completed_stage_ids`'e eklenmez.
- Kaldırılan satırlar: `node_7_2_pre_004`, `node_7_4_pre_003`, `node_7_4_pre_004`. Bu ID'lere referans veren ses/test/veri varsa silinmeli.
- Ana hikâyede yeni konuşmacı ID'leri: `shrine_keeper`, `refugee_woman`, `mahmut_thought` (iç ses kutusu: `*_thought` kuralı). Portre yoksa isim plakasıyla gösterilebilir.
- `manifest.acquisition_story_beats.starting_free` artık `["mahmut", "fadyme"]` (önceden eşleşmeyen ID'ler vardı). `core/story_state` başlangıç kadrosunu `characters_part1.json` `acquisition == "free_start"` üzerinden alıyor; davranış değişmez.

## 3. Save migrasyonu (zorunlu)

`PlayerStoryState.story_cursor` şu an `story_order` içindeki **indeks**. Sıra değiştiği için eski save'ler yanlış sahneye işaret eder.

**Gereksinim:** Cursor'u indeks yerine **giriş ID'si** (`"3-2"`, `"ch2_camp"`) olarak sakla; ya da okuma sırasında aşağıdaki tabloyla eski indeksi yeni indekse çevir. Eski save bir stage girişinin üzerindeyse, o stage'den önceki yeni geçiş sahnesi atlanabilir (oyuncu zaten o noktayı geçti).

| Eski indeks | Giriş | Yeni indeks |
|---|---|---|
| 0 | `opening_sad_scene` | 0 |
| 1 | `1-1` | 1 |
| 2 | `1-2` | 2 |
| 3 | `1-3` | 4 |
| 4 | `1-4` | 5 |
| 5 | `1-5` | 6 |
| 6 | `2-1` | 9 |
| 7 | `2-2` | 10 |
| 8 | `2-3` | 11 |
| 9 | `2-4` | 12 |
| 10 | `2-5` | 13 |
| 11 | `3-1` | 16 |
| 12 | `3-2` | 17 |
| 13 | `3-3` | 18 |
| 14 | `3-4` | 19 |
| 15 | `3-5` | 20 |
| 16 | `4-1` | 23 |
| 17 | `4-2` | 24 |
| 18 | `4-3` | 25 |
| 19 | `4-4` | 26 |
| 20 | `4-5` | 27 |
| 21 | `5-1` | 30 |
| 22 | `5-2` | 31 |
| 23 | `5-3` | 32 |
| 24 | `5-4` | 33 |
| 25 | `5-5` | 34 |
| 26 | `6-1` | 37 |
| 27 | `6-2` | 38 |
| 28 | `6-3` | 39 |
| 29 | `6-4` | 40 |
| 30 | `6-5` | 41 |
| 31 | `7-1` | 44 |
| 32 | `7-2` | 45 |
| 33 | `7-3` | 46 |
| 34 | `7-4` | 47 |
| 35 | `7-5` | 48 |
| 36 | `part1_emotional_confession` | 49 |
| 37 | `part1_clockless_reveal` | 50 |

Kabul ölçütü: 38 girişlik eski sıradan kaydedilmiş her cursor, yükleme sonrası aynı girişi gösterir.

## 4. Companion story'ler — `content/character_stories_part1.json`

**Şema:** `stories[]` → `{character_id, name_en, tier, parts[]}`; her `part` → `{story_id, part, title_en, unlock, location_id, direction_en, lines[]}`. Satır şekli ana script ile aynı (`line_id, speaker_id, speaker_display, text_en, emotion, voice_track`). 20 karakter, 76 bölüm, 388 satır.

**Kilit kuralı:**
- `unlock.requires_owned_character` ∈ `PlayerStoryState.owned_character_ids` (Mahmut/Fadyme için `null` = her zaman).
- `unlock.after_stage` ∈ `completed_stage_ids`.
- Bölüm N, bölüm N−1 görülmeden açılmaz.

**Gereksinimler:**
- Yeni persist alanı, örn. `seen_character_story_ids: set[str]` (`to_persisted_dict` / `from_persisted_dict`'e eklenmeli, eski save'de boş küme).
- Oynatma: `VNScreen.load_scene()` bir parçayı doğrudan alabilir (`direction_en` + `lines`).
- UI: karakter profil/roster ekranında "Story" sekmesi; kilitli bölüm "Unlocks after X-Y" gösterir.
- Ödül: narrative tarafı ödül tanımlamadı; ekonomi kararı (ör. Memory Shard / Hymn Leaves) teknik/ekonomi ekibinde.
- Companion story'de yeni NPC konuşmacılar: `old_priest`, `estate_servant`, `old_potter`, `red_vial_agent` (event), `oakhaven_innkeeper` (event), `council_herald` (event). Validator bu dosyaları taramıyor; istenirse kapsam genişletilebilir.

## 5. Event'ler — `content/events_part1.json`

4 canon event, her biri 3 sahne: `event_harvest_inn_meal` (festival), `event_sun_eclipse_day` (mystery), `event_guild_salt_fever` (guild), `event_council_herald` (court).

- Kilit: `unlock.after_stage` tamamlanmış olmalı. Event'in hangi takvim penceresinde (3-3-1 haftası, Sun-Eclipse günü) açılacağı ekonomi/LiveOps kararı.
- Doğal eşleşmeler: `event_sun_eclipse_day` ↔ `items_part1.sun_eclipse_token` ve Sun-Eclipse günü; `event_harvest_inn_meal` ↔ 12 saatlik "Inn Meal" Ration ödülü (oyun içi gerekçesi bu event'te).
- Persist: `seen_event_scene_ids`.
- `featured_character_ids` event banner'ı/ön izleme için kullanılabilir; sahiplik zorunlu değil.

## 6. Lore metinleri — `content/lore_text_part1.json`

| Anahtar | Eşleşme | Nerede gösterilir |
|---|---|---|
| `weapons{weapon_id: text}` | `weapons_part1.json` `weapon_id` (20 imza silahı) | Silah detay ekranı |
| `enemies{enemy_id: text}` | `enemies_part1.json` `enemy_id` (27, bosslar dahil) | Düşman bilgi / intent paneli, bestiary |
| `items{item_id: text}` | `items_part1.json` `item_id` (18) | Envanter tooltip |
| `codex[]` (`codex_id, title_en, text_en, unlock`) | Yok (yeni) | Loading screen ipuçları, codex menüsü. Şimdilik hepsi `unlock: always`. |
| `banners{banner_id: {title_en, tagline_en, story_tie_en}}` | `oath_01_aveline` … `oath_05_vespera` (`weapons_part1.weapon_banners`, karakter `banner_id`), `hall_of_armaments`; **`hall_of_ancestors` ID'si ekonomi paketindeki kalıcı karakter banner ID'siyle teyit edilmeli** | Banner ekranı başlık/slogan |
| `chapter_cards[]` (`chapter, title_en, card_en`) | `chapters_part1.json` sırası (`ch01_…` → 1) | Bölüm başlangıç kartı |

Alternatif: bu metinler ileride ilgili paketlere `lore_en` alanı olarak taşınabilir; bu durumda builder kaynağına da eklenmeli (aksi halde drift çıkar). Narrative tarafı ayrı paket olarak bıraktı ki generated dosyalara dokunulmasın.

## 7. Karakter ses satırları — `content/character_voice_lines_part1.json`

Her karakter 11 satır, `line_id = vo_<character_id>_<trigger>`, `voice_track: jp`.

| `trigger` | Tetikleyici (öneri) |
|---|---|
| `first_meeting` | Gacha'dan ilk edinim veya story recruit anı |
| `team_join` | Formasyon ekranında slota yerleştirme |
| `idle` | Ana ekran / profil ekranında bekleme |
| `basic_attack` / `active_skill` / `ultimate` | Savaşta ilgili skill tipinin yürütülmesi (`BattleState` sunum olayları). x2/x3 hızda kısaltılabilir veya atlanabilir (GDD). |
| `victory` / `defeat` | `BattleResult` sonucu; takımda rastgele veya MVP karakter |
| `low_hp` | Karakter HP'si eşik altına ilk düştüğünde (öneri: %30, savaş başına 1) |
| `relationship_1` / `relationship_2` | Profil ekranı; `about` alanı hedef karakteri gösterir (`oren` oynanabilir değil, bu yüzden `about_character_id: null`) |

Ses dosyası yolu `core.localization.resolve_voice_asset` konvansiyonuyla `line_id` üzerinden çözülebilir; dosya yoksa mevcut davranış (uyarı, metin gösterimi) korunur.

## 8. Görsel ekip için lokasyon ID'leri

Yeni metinler aşağıdaki `location_id` değerlerini kullanıyor. Ana lokasyonlar mevcut arka plan planıyla aynı; alt lokasyonlar ana arka planın varyantı olarak eşlenebilir.

| Ana lokasyon (mevcut) | Yeni alt lokasyonlar |
|---|---|
| `forest_whispering_ash` | `forest_edge_road` |
| `cathedral_saint_luthos` | — |
| `village_oakhaven` | `oakhaven_inn`, `oakhaven_forge`, `oakhaven_square`, `oakhaven_refuge`, `orchard_lowlands` |
| `undercity_subterranean` | `river_city_gates`, `undercity_red_vial_ward`, `undercity_archive_room`, `undercity_antidote_archive`, `undercity_cistern`, `undercity_cistern_stairs`, `undercity_market` |
| `bridge_forsaken` | `bridge_gate`, `bridge_signal_tower`, `bridge_far_bank`, `eastern_ravine_road` |
| `estate_ashen_lord` | `ashen_estate_gallery`, `ashen_estate_conservatory`, `ashen_estate_servants_wing`, `ashen_estate_ruins`, `eastern_highland_road`, `eastern_village_square` |
| `altar_first_eclipse` | `altar_first_eclipse_outer_dais`, `altar_first_eclipse_reflection`, `altar_outer_stair`, `altar_round_archive`, `altar_east_passage`, `altar_field_infirmary`, `mountain_crater_rim`, `mountain_lower_pass` |
| (yeni, yol/yan içerik) | `lowland_refuge`, `lowland_refuge_road`, `kiln_town`, `salt_road_coast`, `highland_ridge`, `highland_village` |

## 9. Açık teknik işler (narrative tarafından istenen)

- [ ] `story_cursor` migrasyonu (§3).
- [ ] Companion story okuyucu + kilit + persist + UI (§4).
- [ ] Event okuyucu + takvim bağlantısı (§5).
- [ ] Lore metinlerinin ekranlara bağlanması (§6).
- [ ] Ses satırı tetikleyicileri (§7).
- [ ] Silinen üç satır ID'sine bağlı referans kontrolü.
- [ ] `hall_of_ancestors` banner ID teyidi.
- [ ] **GDD metin düzeltmesi (narrative W1, 2026-09-29, karar C16/C17/C20).** Kaynak: `narrative/lore/world_rules.md`, `narrative/lore/glossary.md`. Oyun verisi ve kod etkilenmez; yalnızca `Unaware_of_My_Demise_Part1_GDD.md` metni:
  - §2 "Evren: Veyrhold": `Krallık, taç varislerinin kanıyla mühürlenmiş yedi çanın sesini kullanarak` → `Krallık, Veyr çan soyunun (anneden kıza geçen kan) kefil olduğu yedi çanın sesini kullanarak`
  - §2 "Fadyme'nin gizli trajedisi": `Fadyme'nin üstündeki mühür **The Unwritten Hour** diye anılır.` → `Fadyme'nin üstündeki mühür **the Last Bell seal** (Son Çan mührü) diye anılır; **The Unwritten Hour** yalnızca Cael'in Crownfall gecesi defterden çıkarıp sakladığı saattir.`
  - §3 "Açılış tehdidi ve Part I twist'i": `Unwritten Hour mührünü ve altar düzeneğini tasarladığını açıklar` → `the Rewrite planını (Unwritten Hour) ve altar'ın Hinge düzeneğini tasarladığını açıklar`
- [ ] **Yol değişikliği (2026-09-29, sahibin talebi).** Anlatı ve görsel yön belgeleri artık yalnızca `narrative/` içinde. Kökteki `lore/` ve `docs/` altındaki anlatı kopyaları `narrative/archive/2026-09-29_consolidation/`'a arşivlendi (manifest: `narrative/archive/README.md`). `docs/ART_BIBLE.md`, `docs/ASSET_CATALOG.md`, `docs/BRAND_MARKS_AND_ICON_GUIDE.md` → `narrative/docs/`; `assets/concepts/app_icon/` → `narrative/art/brand/concepts/app_icon/`. Teknik belgelerdeki bağlantıların (CLAUDE.md, README.md, GDD, `docs/PROJECT_WORKFLOW.md`, `docs/GODOT_HANDOFF.md`, `docs/GODOT_MIGRATION_PROMPT.md`, `assets/README.md`, `game/icon.svg` ve `game/scripts/ui/safe_area_container.gd` yorumları) yeni yollara çevrilmesi gerekiyor. Anlatıya yönelik istekler bu dosyanın §9'una yazılır (eski yol `docs/NARRATIVE_TECH_HANDOFF_PART1.md` artık yok). Boş kalan `lore/` ve `assets/concepts/` klasörleri silme izni olmadığı için duruyor.
- [ ] **Veri düzeltmesi (narrative W4, 2026-09-29, C32).** `enemies_part1.json` (builder kaynağı `tools/build_part1_content.py`): `noble_retainer.faction_id` `crown_remnant` → `ashen_estate_dead`. Gerekçe: lore metni "the ghost of a household attendant", Bölüm 6 Ashen malikânesi. Faction ID'leri kanonik kalıyor; eşleme `narrative/lore/factions/_registry.md`. Denge/fixture etkisi teknik ekibin kontrolünde.
- [ ] **Senaryo ve paket senkronu (adım 3, 2026-09-30, C37).** Değişen: `story_script_ch04–07`, `character_stories_part1.json` (4 bölümün yönergesi ve `location_id`'si), `character_voice_lines_part1.json`, `lore_text_part1.json`. 8 yeni satır (`ch4_road_006`, `ch6_road_005`, `ch6_road_006`, `node_4_5_post_007`, `node_5_5_post_005`, `node_6_1_post_004`, `node_6_3_post_004`, `node_7_3_pre_008`); ana hikâye **411 → 419** (`tests/test_localization.py`).
- [ ] **Spoiler/kilit gereksinimi (C37).** `narrative/docs/SPOILER_UNLOCK_POLICY.md`: ilişki ses satırlarında yeni `unlock: {"after_stage": ...}` alanı (40 satır); codex `unlock` değeri artık `"always"` ya da `{"after_stage": ...}`; düşman lore metni intent panelinde gösterilmez, bestiary'de ilk yenilgiden sonra açılır.
- [ ] **Senaryo senkronu (adım 2, 2026-09-30, C36).** `story_script_ch01–04`, `ch06`, `ch07` ve `character_stories_part1.json` değişti: 3 diyalog satırı metni, sahne yönergeleri, iki companion kilidi (`cs_nixie_vale_2` 3-4, `cs_kera_voss_3` 4-5), Yseldra'nın konuşmacı kimliği `yseldra` → `lady_yseldra_vale` (validator izin listesinde zaten var), `story_guests` eklemeleri. Satır sayısı 411 kalıyor. **Görsel gereksinim:** 6-2 galeri arka planında elinde eldiven olan bir saray görevlisi portresi ve yanında akrepsiz yelkovansız bir saat (Mahmut 6-4'te buna atıf yapıyor).
- [ ] **Senaryo senkronu (Part I hikâye geçişi adım 1, 2026-09-29, C35).** `narrative/content/story_script_ch03.json` ve `story_script_ch07.json` → `content/` ve Godot kopyası. İki yeni satır: `node_3_1_post_004`, `node_7_3_pre_007` (ikisi de `fadyme_thought`, `voice_track: jp`). Ana hikâye satır sayısı **409 → 411**: `tests/test_localization.py` beklenen değeri; parity fixture'ları senaryoyu içeriyorsa yeniden üretim teknik ekibin kararı. Ayrıca `character_stories_part1.json` iki metin düzeltmesi hâlâ senkron bekliyor.
- [ ] **GDD ek düzeltme (C33).** §7.2 Fadyme "Geçmiş": `Mahmut onu köyde yeniden bulduğunda kaçış planı hazırdı` → `Mahmut onu köyde yeniden bulduğunda sunağa gitme planı hazırdı (borcunu köyler yerine kendisi ödemek için)`
- [ ] **İçerik senkronu (Part I son okuma, 2026-09-30, C39).** `lore_text_part1.json`, `events_part1.json`, `character_stories_part1.json` metin/yönerge değişiklikleri; `cs_brin_alder_2` ve `_3` satırlarında konuşmacı değişti (`jori_flint` → `shrine_keeper`, `marek_vane` → `nixie_vale`; JP kaydı bu 4 satır için yeniden). Satır sayısı değişmedi (419).
- [ ] **Görsel klasörü taşındı (2026-09-30).** `narrative/photos/` → `narrative/art/` (sheets, brand, production, _rejected; dizin `narrative/art/MANIFEST.md`, PNG içinde `uomd_*` metadata). Yeniden adlandırmalar: `char-brin-adler` → `char-brin-alder`, `char-lord-caer` (webp) → `pending/char-lord-cael-veyr` (png), logo/ikon/key art → `art/brand/`. Teknik belgelerdeki `narrative/photos/...` bağlantıları güncellenmeli. Onaylı ilk üretimler: `art/production/fadyme/vn_bust_fadyme_{composed,warm,honest_fear}_v001.png` (#00FF00 key).
- [ ] **Müzik ipuçları ve ses planı (2026-09-30, C42).** `story_script_ch01–07.json`: 51 sahneye `music_cue` eklendi (açılışta zaten kullanılan alan; yeni şema yok; biçim `pre: … | battle: … | post: …`). Satır sayısı değişmedi. Çalma/miks gereksinimleri: `narrative/docs/AUDIO_VO_PLAN_PART1.md` §3.
- [ ] **Narrative klasör düzeni (2026-09-30).** Anlatı/görsel/ses işlerinin hepsi `narrative/` altında: `art/` (görseller), `audio/` (müzik, ses), `prompts/sheets/` (sheet prompt'ları eski `prompts/*_sheet.md` yerinden taşındı), `art/brand/concepts/app_icon/` (eski `narrative/concepts/app_icon/`). Kökteki boş `lore/` ve `assets/concepts/` klasörleri silindi. Teknik belgelerdeki bu yolları gösteren bağlantılar güncellenmeli.
- [ ] **Onaylı müzik ve döngü noktaları (2026-09-30).** `narrative/audio/music/bgm_fadyme_theme/`, `bgm_ch1_ash_forest/` (calm/uneasy/chaotic), `bgm_battle_field/`. Oyunda kullanılacak dosya `*_loop.ogg`: parçanın kendi başından başlar (ilk seferde intro gibi çalar), sonra `loop_offset` noktasına dönüp sonsuza kadar döner; dönüş noktası dosyanın içinde önceden harmanlandı, kesinti olmaz. Gereken davranış: loop açık, loop offset = yan dosyadaki `engine_loop.loop_offset_s` (örnek sayısı da var, 44.1 kHz). Uygulama yolu teknik ekibin kararı (Godot 4'te OGG içe aktarmada Loop + Loop Offset ayarı bunu karşılıyor olmalı; doğrulayın). Orman katmanları ayrı üretildi, tempoları senkron değil: durum değişiminde üst üste bindirme değil 3–4 sn çapraz geçiş. `*_original.mp3` sahibin isteğiyle saklanan ham Lyria çekimleri (sonu sönümlenir); uneasy/chaotic/battle orijinalleri döngülerden farklı tonda, döngülerle karıştırılmasın.
- [ ] **Fadyme JP ses dosyaları (2026-09-30).** `narrative/audio/voice/fadyme/<speaker_id>/<line_id>.ogg` (`fadyme/` ve `fadyme_thought/`), `core/localization.py`'nin çözdüğü `assets/voice/{speaker_id}/{line_id}.ogg` düzeniyle birebir; kopyalamak yeterli. 24 kHz mono OGG, −20 dB seviyesine eşitlenmiş. İç ses (`jp_inner`) kuru teslim edildi; yakın mikrofon/efekt işleme oynatma tarafının kararı. Tam liste ve metin: `narrative/audio/voice/jp_script_fadyme.json` (201 satır; `audio_file` alanı). Kayıt sürüyor (2026-09-30: 25/201).
- [ ] **Veri düzeltmesi (2026-09-30).** `story_script_ch03.json` `node_3_1_post_004` ve `story_script_ch07.json` `node_7_3_pre_007`: `speaker_id: fadyme_thought` ama `voice_track: jp` idi → `jp_inner`. Satır sayısı değişmedi; runtime `content/` ve Godot kopyasına senkron.
- [ ] En sonda: pytest (beklenen 419 satır), commit, JP kayıt paketi (ana hikâye 419 + companion 388 + event + 220 ses satırı), görseller.
