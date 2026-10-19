# 5 Yeni Oynanabilir Erkek Karakter — Unit Pack, Katalog & Şartname Entegrasyonu

**Tarih:** 2026-10-19  
**Durum:** `unit_pack.json`, `characters_part1.json`, `weapons_part1.json`, `apps/api/seed/*.sql` ve `content/specs/character_locks/` içerisine tam şema doğrulamasıyla (`tools/combat_coverage.ts`: `25/25 units, 100/100 skills`) eklendi.

---

## 1. Eklenen 5 Erkek Karakterin Savaş & Katalog Özeti

| Karakter ID | İsim | Nadirlik | Element | Rol (`combat_role`) | Pozisyon | Silah Ailesi (`weapon_type`) | İmza Silahı (`signature_weapon_id`) | Lv1 İstatistikler (`HP/ATK/DEF/SPD`) |
| :--- | :--- | :---: | :---: | :--- | :---: | :--- | :--- | :---: |
| `garrick_cinder` | **Garrick Cinder** | 5★ | Ember | `siege_breaker_dps` | `front` | `glaive_shield` | `weapon_garrick_cinder_signature` (*The Sixty-First Minute*) | `13 / 3 / 2 / 4` |
| `corbin_locke` | **Corbin Locke** | 5★ | Tide | `harpoon_vanguard` | `front` | `spear` | `weapon_corbin_locke_signature` (*Seventh Sluice Anchor*) | `14 / 2 / 2 / 4` |
| `cassian_thorne` | **Cassian Thorne** | 4★ | Dawn | `reliquary_templar` | `front` | `arming_sword` | `weapon_cassian_thorne_signature` (*Clapperless Verdict*) | `13 / 2 / 2 / 4` |
| `dorian_kesk` | **Dorian Kesk** | 4★ | Veil | `cipher_debuffer_dps` | `rear` | `twin_daggers` | `weapon_dorian_kesk_signature` (*Seven-Notch Seal-Iron*) | `11 / 3 / 1 / 5` |
| `rowan_reed` | **Rowan Reed** | 3★ | Dawn | `shrine_support` | `rear` | `ritual_lantern` | `weapon_rowan_reed_signature` (*Wayshrine's Last Wick*) | `11 / 2 / 1 / 4` |

---

## 2. Yetenek Setleri (`@uomd/content-schema` Kapalı Efekt Grameri Uyumlu)

### `garrick_cinder` (5★ Ember · `siege_breaker_dps`)
- **Basic — `garrick_cinder_basic_cinder_thrust` (*Cinder Thrust*):** Tek düşmana `%105 ATK` Ember hasarı verir ve 1 tur `burn` uygular.
- **Active — `garrick_cinder_active_furnace_breach` (*Furnace Breach*, CD 2):** Tek düşmana `%165 ATK` Ember hasarı verir, 2 tur `burn` uygular ve kendisine 1 tur `stoneguard` kazandırır.
- **Passive — `garrick_cinder_passive_the_sixty_first_minute` (*The Sixty-First Minute*):** `burn` etkisindeki hedeflere `%15` daha fazla hasar verir (`before_damage_dealt` continuous modifier).
- **Ultimate — `garrick_cinder_ultimate_pyre_at_the_outer_gate` (*Pyre at the Outer Gate*, 100 Focus):** Ön sıradaki tüm düşmanlara `%230 ATK` Ember hasarı verir, 2 tur `burn` uygular ve 2 tur saldırı güçlerini (`atk`) `%15` düşürür.

### `corbin_locke` (5★ Tide · `harpoon_vanguard`)
- **Basic — `corbin_locke_basic_gaff_hook` (*Gaff Hook*):** Tek düşmana `%100 ATK` Tide hasarı verir ve 1 tur `soaked` uygular.
- **Active — `corbin_locke_active_undertow_drag` (*Undertow Drag*, CD 2):** Tek düşmana `%155 ATK` Tide hasarı verir, 2 tur `soaked` uygular ve kendisine 2 tur `%120 DEF` kalkanı verir.
- **Passive — `corbin_locke_passive_sluice_warden_s_anchor` (*Sluice-Warden's Anchor*):** Ön sırada (`front`) bulunduğu sürece tüm müttefiklere `+%10 RES` kazandırır (`stat_snapshot`).
- **Ultimate — `corbin_locke_ultimate_open_the_floodgates` (*Open the Floodgates*, 100 Focus):** Tüm düşmanlara `%200 ATK` Tide hasarı verir, 2 tur `soaked` uygular ve tüm düşmanların sıradaki eylem göstergesini (`delay_next_action`) `%10` geciktirir.

### `cassian_thorne` (4★ Dawn · `reliquary_templar`)
- **Basic — `cassian_thorne_basic_vigil_cleave` (*Vigil Cleave*):** Tek düşmana `%100 ATK` Dawn hasarı verir.
- **Active — `cassian_thorne_active_sanctuary_of_the_door` (*Sanctuary of the Door*, CD 2):** En düşük HP'li müttefikten 1 zayıflatmayı temizler (`remove_status`: `debuff`, `oldest_applied`) ve 2 tur `%130 DEF` kalkanı verir.
- **Passive — `cassian_thorne_passive_belfry_oath` (*Belfry Oath*):** Ön sırada (`front`) bulunduğu sürece ön sıradaki müttefiklere `+%8 DEF` kazandırır.
- **Ultimate — `cassian_thorne_ultimate_bell_without_a_clapper` (*Bell Without a Clapper*, 100 Focus):** Ön sıradaki düşmanlara `%190 ATK` Dawn hasarı verir ve tüm müttefiklerin `RES` değerini 2 tur `%15` artırır.

### `dorian_kesk` (4★ Veil · `cipher_debuffer_dps`)
- **Basic — `dorian_kesk_basic_hot_wax_cut` (*Hot Wax Cut*):** Tek düşmana `%100 ATK` Veil hasarı verir.
- **Active — `dorian_kesk_active_forged_warrant` (*Forged Warrant*, CD 2):** Tek düşmana `%150 ATK` Veil hasarı verir ve 2 tur `dread` uygular.
- **Passive — `dorian_kesk_passive_seven_notch_cipher` (*Seven-Notch Cipher*):** `dread` etkisindeki düşmanlara `%15` daha fazla hasar verir.
- **Ultimate — `dorian_kesk_ultimate_broken_seal_of_the_chancery` (*Broken Seal of the Chancery*, 100 Focus):** Tüm düşmanlara `%185 ATK` Veil hasarı verir, 2 tur `dread` uygular ve 2 tur `DEF` değerlerini `%15` düşürür.

### `rowan_reed` (3★ Dawn · `shrine_support`)
- **Basic — `rowan_reed_basic_warming_spark` (*Warming Spark*):** Tek düşmana `%95 ATK` Dawn hasarı verir.
- **Active — `rowan_reed_active_recut_the_name` (*Recut the Name*, CD 2):** En düşük HP'li müttefikten 1 zayıflatmayı temizler (`remove_status`: `debuff`, `oldest_applied`) ve `%130 ATK` iyileştirir.
- **Passive — `rowan_reed_passive_candle_in_the_rain` (*Candle in the Rain*):** Arka sırada (`rear`) bulunduğu sürece tüm müttefiklere `+%8 RES` kazandırır.
- **Ultimate — `rowan_reed_ultimate_lanterns_along_the_wayshrine` (*Lanterns Along the Wayshrine*, 100 Focus):** Tüm müttefiklere 2 tur `%120 ATK` kalkanı verir ve `RES` değerlerini 2 tur `%15` artırır.

---

## 3. Seslendirme / Audio Mimari Notu (Owner Kararı — 2026-10-19)

- **Chirp 3 HD İptali:** Oyun sahibi kararıyla **Google Chirp 3 HD** karakter seslendirmelerinde (VO) **artık kullanılmayacaktır**; doğal insan tonlaması vermemesi ve oyunculuk/duygu yönlendirmesi (acting prompt) kabul etmemesi nedeniyle devre dışı bırakılmıştır.
- **Yeni Seslendirme Standardı:** Ses aşamasına (en son faz) geçildiğinde yalnızca doğal insan duygusu, sahne bağlamı ve oyunculuk promptu kabul eden yeni nesil yönlendirilebilir ses modelleri (Promptable Gemini Audio / Gemini Live / onaylı yönetmenli TTS hattı) kullanılacaktır.
