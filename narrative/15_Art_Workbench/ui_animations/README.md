# Unaware of My Demise — UI Animations Workbench Index (`narrative/15_Art_Workbench/ui_animations/`)

Bu klasör; oyunun karanlık gotik anime atmosferine (`Ash Falls Upward`, Çatlak Gümüş Çan, Kızıl Tutulma, Yedi Zincir Mührü, Akrepsiz Cep Saati) uygun olarak adım adım üretilen **8-karelik UI & VFX Sprite-Sheet** dosyalarını ve her birinin dilimlenmiş ardışık **PNG karelerini (`frame_01.png` ... `frame_08.png`)** içerir.

---

## Adım 1: Ana Menü (`Title Screen`), Başlangıç Mührü & Yükleme Spinner Animasyonları (`Tamamlandı`)

Klasör: [`narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/`](file:///g:/Drive'ım/unaware-of-my-demise/narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/)

| # | Animasyon ID | 8-Kare Sprite Sheet | Dilimlenmiş PNG Kare Klasörü (`8 Kare`) | Karesel Akış (`Frames 01 → 08`) & Oyun İçi Kullanım |
|---|---|---|---|---|
| 1 | `ui_anim_step1_01_eclipse_corona_loop` | [ui_anim_step1_01_eclipse_corona_loop_v001.jpg](file:///g:/Drive'ım/unaware-of-my-demise/narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/ui_anim_step1_01_eclipse_corona_loop_v001.jpg) | [`01_eclipse_corona_frames/`](file:///g:/Drive'ım/unaware-of-my-demise/narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/01_eclipse_corona_frames/) | **Kızıl Tutulma Korona Döngüsü (`4×2`, `320×320/kare`)**: Durgun tutulma halkası (`01–02`) → korona alev patlaması (`03–04`) → eşmerkezli rünik tutulma dalgası (`05–06`) → yumuşak sönümlenme (`07–08`). Ana Menü gökyüzünde `screen/add` blend modu ile döngüsel oynatılır. |
| 2 | `ui_anim_step1_02_bell_resonance` | [ui_anim_step1_02_bell_resonance_v001.jpg](file:///g:/Drive'ım/unaware-of-my-demise/narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/ui_anim_step1_02_bell_resonance_v001.jpg) | [`02_bell_resonance_frames/`](file:///g:/Drive'ım/unaware-of-my-demise/narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/02_bell_resonance_frames/) | **Fadyme'nin Çatlak Gümüş Çanı & Ses Dalgası (`4×2`, `320×320/kare`)**: Dingin mavi-gümüş ışıltı (`01–02`) → çan dili vuruşu ve altın-gümüş şok dalgası (`03–04`) → rünik ses halkalarının yayılması (`05–06`) → akustik yankı sönümü (`07–08`). Başlangıç tıklamasında ve hikâye geçişlerinde tetiklenir. |
| 3 | `ui_anim_step1_03_title_button_seal` | [ui_anim_step1_03_title_button_seal_v001.jpg](file:///g:/Drive'ım/unaware-of-my-demise/narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/ui_anim_step1_03_title_button_seal_v001.jpg) | [`03_title_button_seal_frames/`](file:///g:/Drive'ım/unaware-of-my-demise/narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/03_title_button_seal_frames/) | **Gotik Başlangıç Butonu & Balmumu Mühür Kırılması (`2×4`, `640×192/kare`)**: Nefes alan bekleme durumu (`01–02`) → altın telkari rün devrelerinin yanması (`03–04`) → tıklama anında merkezdeki kızıl balmumu mührün çatlayıp ışık saçması (`05–06`) → çerçevenin tamamen uyanması (`07–08`). |
| 4 | `ui_anim_step1_04_loading_watch_bell` | [ui_anim_step1_04_loading_watch_bell_v001.jpg](file:///g:/Drive'ım/unaware-of-my-demise/narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/ui_anim_step1_04_loading_watch_bell_v001.jpg) | [`04_loading_watch_frames/`](file:///g:/Drive'ım/unaware-of-my-demise/narrative/15_Art_Workbench/ui_animations/step1_title_and_entry/04_loading_watch_frames/) | **Akrepsiz Cep Saati (`Handless Watch`) & 7 Mühür Yükleme Spinner'ı (`4×2`, `320×320/kare`)**: Lord Cael Veyr'in akrepsiz gümüş cep saati etrafındaki pirinç usturlap halkası dönerken 7 rünik çentik sırayla kızıl-altın alevle yanar (`01→08`). Yükleme ve sunucu senkronizasyon ekranlarında kullanılır. |

---

## Sıradaki Adımlar (5 Adımlı Plan)

- **Adım 2**: Ana Lobi (`Sanctuary Hub`) — Ocak Ateşi & Kıvılcım Döngüsü, Savaş Masası Mum/Harita Parıltısı, Sığınak Çanı Salınımı ve 6 Alt Navigasyon Sekmesinin (`Sanctuary, Journey, Companions, Summon, Records, Settings`) Aktif/Hover/Bildirim Animasyon Sprite-Sheet'leri.
- **Adım 3**: Gacha Summon (`Altar of Oaths`) — Dönen Usturlap Halkası, Kader İpliği (`Fate's Thread`) Çekim Kopuşu ve **3★ (Demir/Bronz) / 4★ (Gümüş/Ay) / 5★ (Kızıl Tutulma & Şafak Altını)** Çağrı Mühür Patlama VFX Sprite-Sheet'leri.
- **Adım 4**: Savaş HUD (`Battle UI`) — 6 Element (`Ember, Tide, Gale, Stone, Dawn, Veil`) Ultimate Dolum & Aktif Çerçeve Animasyonları, 10 Savaş Durumu Tetikleme Halkaları ve Karakter Ultimate Cut-in Şeridi.
- **Adım 5**: Zafer / Yenilgi (`Victory / Defeat`) Mühür Damgası, İlk Yemin (`First Oath`) 3 Sütun Aurası ve Yukarı Yükselen Kül (`Ash Curtain`) Sahne Geçiş Perdesi.
