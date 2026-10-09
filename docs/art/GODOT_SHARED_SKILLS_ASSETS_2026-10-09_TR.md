# Godot: Codex ve Claude için ortak skill, asset ve araç kataloğu

Araştırma tarihi: **9 Ekim 2026**. Proje: **Unaware of My Demise**.

Bu belge araştırma ve önerilen kurulum planıdır. Bu araştırmada hiçbir asset paketi indirilmedi, skill etkinleştirilmedi, eklenti kurulmadı veya oyun dosyası değiştirilmedi. GitHub README, LICENSE, skill içerikleri, depo metadatası ve mevcut proje kayıtları incelendi. Belgenin depoya eklenmesi paketlerin kurulması anlamına gelmez.

## 1. Somut seçim

İlk ortak paketimiz:

1. **Mevcut 32 aktif UOMD skill'ini Codex ve Claude'a aynı dosyalardan sunmak.** Yeni bir genel router veya ikinci skill kopyası oluşturmak yerine mevcut düzeni tamamlamak.
2. **Mevcut Godot AI 4.3.0'ı iki istemciye ayrı ayrı bağlamak.** İkinci MCP eklentisi kurmadan sahne, kaynak, animasyon ve görsel inceleme yeteneklerini kullanmak.
3. **Mevcut ücretsiz 2D kütüphanesini yeniden indirmeden kullanmak.** Kenney, resmî sprite shaderları ve seçilmiş VFX shaderlarından üretim türevleri hazırlamak.
4. **Yeni shader, ses ve mobil skill'lerini seçerek uyarlamak.** Kaynaklar: Awesome GameDev Agent Skills ve GodotPrompter; tamamını topluca kurmak yerine aşağıdaki içerikleri almak.
5. **İlk yeni asset/eklenti denemeleri:** resmî Skeleton2D demosu, Phantom Camera ve Universal Transition Shader.
6. **UI ve ses kaynakları:** mevcut Kenney UI referansları; Cinzel ve Inter ancak mevcut fontlarla karşılaştırıldıktan sonra; Kenney sesleri audio aşamasında.
7. **Mevcut GUT, native preview ve asset manifestlerini korumak.** Android ölçümüne gerektiğinde Perfetto eklemek.

Buradaki seçimler benim proje uygunluğu değerlendirmemdir. Kaynağın lisansı ve destek beyanı ile oyunda doğrulanmış çalışma durumu birbirinden ayrılmıştır. Ücretsiz kaynaklar ücretli API çağrısı gerektirmeyen çalışma için seçildi; Codex/Claude abonelik veya model kullanım ücretlerini kapsamaz.

## 2. Projede gerçekten bulunanlar

Yerel checkout incelemesi:

| Konu | Gözlenen durum | Sonuç |
| --- | --- | --- |
| Skill ana kaynağı | `.codex/skills/` altında **32 SKILL.md** | Yeniden kurulum yerine eksik kapsamı tamamla. Önceki sohbet sayımı 33 idi; dosya bazlı sayım 32. |
| Codex keşfi | `.agents/skills` mevcut ve symlink | Mevcut köprüyü koru. |
| Claude keşfi | Bu checkout'ta `.claude/skills` yok | Ortak kaynağa işaret eden keşif bağlantıları öneriliyor; henüz oluşturulmadı. |
| Ortak roller | `AGENTS.md`, `CLAUDE.md`, art-to-code handoff mevcut | Codex üretim/tasarım/inceleme; Claude runtime entegrasyonu ve build. Ortak kaynak kullanımı bu ayrımı kaldırmaz. |
| Godot AI | `game/addons/godot_ai/plugin.cfg`: **4.3.0** | Depoda mevcut; bu araştırmada canlı bağlantı doğrulanmadı. |
| GUT | Proje kaydı **9.7.1** | Mevcut harness'i koru; gdUnit4'e geçiş önerilmiyor. |
| 2D referans kütüphanesi | Kayıt: **1.422 dosya**, ayrı parçacık demosu; export dışında | Bu sayı varyantları içerir, 1.422 farklı bağımsız tasarım değildir. |
| Runtime'a alınmış Kenney dokuları | `spark_01.png`, `light_01.png` | Kütüphanenin geri kalanı otomatik olarak üretimde sayılmaz. |
| Shader doğrulaması | Proje kaydı 33 canvas shader için Compatibility derleme smoke kontrolü bildiriyor | Görsel kalite, tüm sampler ayarları ve Android performansı bu kontrolden çıkarılamaz. |
| Proje hedefi | Godot **4.7.2**, GDScript, Android portrait 1080×1920, `gl_compatibility` | Bütün yeni kaynaklar bu hedefe uyarlanmalı. |
| Bu terminalde varsayılan Godot | `godot --version`: **4.6.3.stable** | Bu PATH ikilisinin 4.7.2 uyumluluk testi yaptığı iddia edilemez. Doğru ikili ayrıca seçilmeli. |
| Graphify | Kayıtlar ve skill var; `graphify query` komutu PATH'te bulunamadı | Graph sorgusu çalıştırılamadı; bu araştırma doğrudan dosya/manifest incelemesine dayandı. |
| Diğer araçlar | FFmpeg mevcut; Claude CLI ve adb PATH'te bulunamadı | Claude keşfi ve Android cihaz testi bu oturumda doğrulanmadı. |

Proje kanıtları: [AGENTS.md](https://github.com/mucaeksi/unaware-of-my-demise/blob/main/AGENTS.md), [CLAUDE.md](https://github.com/mucaeksi/unaware-of-my-demise/blob/main/CLAUDE.md), [handoff](https://github.com/mucaeksi/unaware-of-my-demise/blob/main/docs/ART_AND_CODE_HANDOFF.md), [2D kütüphane](https://github.com/mucaeksi/unaware-of-my-demise/blob/main/game/assets/third_party/reference/README.md), [kaynak manifesti](https://github.com/mucaeksi/unaware-of-my-demise/blob/main/game/assets/third_party/reference/COLLECTION.json), [Godot ayarları](https://github.com/mucaeksi/unaware-of-my-demise/blob/main/game/project.godot).

## 3. Asset ve eklentiler: 31 somut kaynak

Kararlar: **KULLAN** = mevcut kaynaklardan seç; **İLK DENE** = ilk yeni değerlendirme grubuna al; **KOŞULLU** = somut ihtiyaç varsa dene; **BEKLET** = mevcut sistemle çakışma veya olgunluk nedeniyle şimdilik kurma. Yeni hiçbir aday oyun içinde bu araştırmayla test edilmiş sayılmaz.

### 3.1 VFX, shader ve atmosfer

| ID / kaynak | Lisans | Oyundaki iş | Codex ve Claude nasıl kullanır? | Karar / uyum |
| --- | --- | --- | --- | --- |
| A01 [Kenney Particle Pack](https://kenney.nl/assets/particle-pack), [GitHub aynası](https://github.com/Calinou/kenney-particle-pack) | CC0 | Kıvılcım, büyü ışığı, aura ve darbe | Codex efekt tasarımı ve doku seçimi; Claude parçacık materyali ve olay bağlantıları | **KULLAN.** Mevcut. Dokular renderer'dan bağımsız girdiler; efekt maliyeti ayrıca ölçülür. |
| A02 [Kenney Smoke Particles](https://kenney.nl/assets/smoke-particles) | CC0 | Sis, duman, yok oluş ve toz | Alpha dokularından katmanlı sprite/particle efektleri | **KULLAN.** Mevcut. Büyük saydam katmanların overdraw maliyetini sınırla. |
| A03 [Kenney Light Masks](https://kenney.nl/assets/light-masks) | CC0 | Büyü ışığı, dramatik spot ve ışık maskesi | Maskeleri shader veya 2D ışık kaynağına bağla | **KULLAN.** Mevcut. Her maske için yeni ışık eklemek yerine kompozisyon ihtiyacına göre seç. |
| A04 [Resmî Sprite Shaders](https://github.com/godotengine/godot-demo-projects/tree/master/2d/sprite_shaders) | MIT | Outline, aura, gölge, dissolve ve hit flash | `.gdshader` ve `ShaderMaterial` varyantları; ortak uniform sözleşmesi | **KULLAN.** Mevcut 9 shader; farklı engine dallarını karıştırma. |
| A05 [Godot VFX Library](https://github.com/haowg/GODOT-VFX-LIBRARY) | MIT | Portal, yıldırım, shield break, donma, zehir ve ortam efektleri | Belgeli API, `.tscn`, `.gdshader`; renk/süre/katman düzenlenebilir | **KULLAN, seçerek.** Kaynak 4.5+ hedefli. Mevcut 24 shader referansı var; manager/autoload ve bütün paketin GL uyumu doğrulanmış değil. |
| A06 [GDQuest Godot 4 VFX](https://github.com/gdquest-demos/godot-4-VFX-assets) | **Kod MIT; görsel/model CC BY-NC-SA 4.0** | Swirl ve büyü shader örnekleri | MIT kodundan üretim türevi, özgün/CC0 dokular | **KULLAN, yalnız kod.** Orijinal sanat ticari üretim seçimi değil. Demo Forward+ hedefli; her shader ayrı uyarlanmalı. Mevcut 35 shader referansı var. |
| A07 [Resmî 2D Particles Demo](https://github.com/godotengine/godot-demo-projects/tree/master/2d/particles) | MIT | Parçacık materyali ve efekt davranışı örnekleri | Örnek sahneden sınırlı, temizlenen üretim sahneleri oluştur | **KULLAN.** Mevcut ayrı referans proje. Demo sanatını ve kodunu Fadyme tasarımına uyarlamak gerekir. |
| A08 [BurstParticles2D](https://github.com/uzkbwza/BurstParticles2D) | MIT | Az sayıda önemli vuruş ve ödül patlaması | Curve/Gradient, GDScript ve `BurstParticleGroup2D` | **KOŞULLU.** 4.x; geliştirici yerleşik parçacıklardan daha yavaş olduğunu bildiriyor. Mobilde yüksek sayım için ilk seçim değil. |

### 3.2 Gerçek chibi animasyonu, kamera ve geçişler

| ID / kaynak | Lisans | Oyundaki iş | Ortak kullanım | Karar / uyum |
| --- | --- | --- | --- | --- |
| A09 [Resmî Skeleton2D Demo](https://github.com/godotengine/godot-demo-projects/tree/master/2d/skeleton) | MIT; karakter ve başlangıç rig'i için de MIT bildirilmiş | Fadyme için gerçek kemik/cutout animasyonunun teknik temeli | `Skeleton2D`, `Bone2D`, `Polygon2D`, `AnimationPlayer`; Codex rig/klip taslağı, Claude runtime bağlama | **İLK DENE.** README açıkça **Compatibility** diyor. Hazır GBot karakteri yalnız teknik örnek; Fadyme yerine kullanılmayacak. |
| A10 [Phantom Camera](https://github.com/ramokz/phantom-camera) | MIT | Ultimate odaklama, grup framing, sinematik kamera geçişi | GDScript API ve sahne düğümleri; ortak kamera presetleri | **İLK DENE.** Güncel README 4.4+ bildiriyor. Gerçek Camera2D kullanan sahnelerde yararlı; yalnız Control tabanlı ekranı kendi başına sinematikleştirmez. |
| A11 [Universal Transition Shader](https://github.com/cashew-olddew/Universal-Transition-Shader) | CC0 | Portre reveal, maskeli/bölüm geçişi, iris ve wipe | `progress`, maske ve şekil uniform'larını mevcut AnimationPlayer/Tween ile sür | **İLK DENE.** CanvasItem shader; GL ve dikey ekran oranı testi gerekli. Yeni navigation manager zorunlu değil. |
| A12 [Godot Tween Suite](https://github.com/KoBeWi/Godot-Tween-Suite) | MIT | Tekrar kullanılan panel, buton ve kart animasyonları | Kod veya `TweenAnimation` resource'ları; iki asistan aynı `.tres` presetlerini düzenler | **KOŞULLU.** Güncel [Asset Store](https://store.godotengine.org/asset/kobewi/tween-suite/) minimum 4.7 bildiriyor. Önce yerleşik Tween/AnimationPlayer ile farkını göster. |
| A13 [Skeleton2D Helper](https://github.com/folt-a/godot-skeleton2d-helper) | MIT | Kemik ve mesh noktalarını hazırlamada editor yardımı | Native Godot rig kaynaklarını oluşturur; AI kaynak kodunu inceleyebilir | **KOŞULLU.** 4.3–4.4 odaklı, belgesi sınırlı ve animasyon yardımı geliştirme aşamasında. API otomasyonu güçlü değil; önce native rig. |
| A14 [Sprite Sheet Builder Importer](https://github.com/xyh2005-qq/sprite-sheet-builder-godot-importer) | MIT | PNG + JSON veya Sparrow XML → SpriteFrames | Düzenlenebilir `.tres` çıktı; metadata AI tarafından hazırlanabilir | **KOŞULLU.** 4.4+; runtime üçüncü taraf bağımlılığı yok. Trim/rotated JSON frame'lerini reddediyor. Web sitesi ayrı ürün; ücretsiz öneri yalnız importer. AI `.tres` doğrudan üretebiliyorsa gerekli değil. |
| A15 [Saltmire Juice](https://github.com/saltmire/saltmire-juice) | MIT | Shake, hit flash, punch ve floating damage text | Basit çağrılar; pooling örneği | **BEKLET.** 4.6+. Hit-stop `Engine.time_scale` değiştiriyor; shake kamera offset/rotation'a yazıyor. Online saat ve kamera sahibiyle uyarlama gerekli. |
| A16 [Saltmire Transitions](https://github.com/saltmire/saltmire-transitions) | MIT | Fade, iris, wipe, pixelate | `cover()` / `reveal()` gibi küçük API | **BEKLET.** 4.6+; yeni autoload ve scene changer mevcut navigation ile çakışabilir. A11'i mevcut yöneticilerle kullanmak öncelikli. |
| A17 [Anima Godot 4](https://github.com/ceceppa/anima-godot-4) | MIT | Sıralı/paralel UI hareketi | Koddan animasyon tanımlama | **BEKLET.** README Godot 4'te bütün özelliklerin düzgün çalışmadığını belirtiyor. Yerleşik Tween veya A12 öncelikli. |

Gerçek chibi animasyonu için paket tek başına yeterli değil: ayrılmış gövde parçaları veya gerçek ardışık çizim kareleri gerekir. Tek portreyi hareket ettirmek, attack/cast/hasar animasyonlarının yerini tutmaz. Teslim paketi rig/atlas, klipler, ayak anchor'ı, facing, olay zamanları ve kesinti davranışlarını birlikte içermeli. [Native 2D skeleton yöntemi](https://docs.godotengine.org/en/4.7/tutorials/animation/2d_skeletons.html) bunun teknik temelidir; doküman sayfası güncellik uyarısı taşıdığı için gerçek 4.7.2 API'siyle doğrulanmalı.

### 3.3 UI, ikon ve font

| ID / kaynak | Lisans | İş | Ortak kullanım | Karar |
| --- | --- | --- | --- | --- |
| A18 [Kenney Fantasy UI Borders](https://kenney.nl/assets/fantasy-ui-borders) | CC0 | Panel/portre/dialogue çerçevesi | Codex stil türevi; Claude theme/StyleBoxTexture | **KULLAN.** Referans mevcut. Hazır çerçeve mevcut premium stilin yerine otomatik geçirilmez. |
| A19 [Kenney UI Adventure](https://kenney.nl/assets/ui-pack-adventure) | CC0 | Buton, panel ve slider | Ortak theme ve durum varyantları | **KULLAN.** Referans mevcut; dokunma alanı, stretch ve okunabilirlik ayrıca ayarlanır. |
| A20 [Game-icons.net](https://game-icons.net/about.html), [GitHub](https://github.com/game-icons/icons) | CC BY 3.0; sanatçı bazlı CC0 istisnaları | Skill, silah, buff/debuff ikonları | SVG → seçilmiş raster boyutları, ortak çerçeve ve palette | **KULLAN.** 239 ikon referansı mevcut. İkon bazında sanatçı ve lisans kaydı gerekir. |
| A21 [Cinzel](https://github.com/google/fonts/tree/main/ofl/cinzel), [lisans](https://github.com/google/fonts/blob/main/ofl/cinzel/OFL.txt) | SIL OFL 1.1 | Fantasy başlık ve karakter ismi | Ortak font/theme resource | **KOŞULLU, iyi aday.** İngilizce başlıklar; mevcut fontla kıyasla. Küçük uzun metin için ilk seçim değil. |
| A22 [Inter](https://github.com/google/fonts/tree/main/ofl/inter), [lisans](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt) | SIL OFL 1.1 | Mobil açıklama, diyalog ve sayı | Ağırlık/boyut/line spacing presetleri | **KOŞULLU, iyi aday.** Oyunun metni İngilizce. Japonca altyazı eklenirse ayrıca uygun fallback gerekir. |

### 3.4 Ses ve üretim araçları

| ID / kaynak | Lisans | İş | Ortak kullanım | Karar |
| --- | --- | --- | --- | --- |
| A23 [Kenney UI Audio](https://kenney.nl/assets/ui-audio) | CC0 | Click, confirm ve cancel | Seçilen dosyalar + mevcut Audio Director event eşlemesi | **İLK DENE, audio aşamasında.** Dinleme ve miks kontrolü yapılmadı. |
| A24 [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | CC0 | Daha geniş menü geri bildirim seçkisi | A23 ile kıyasla; aynı iş için tüm sesleri oyuna taşıma | **KOŞULLU.** Ses seçimi/dinleme bekliyor. |
| A25 [Kenney RPG Audio](https://kenney.nl/assets/rpg-audio) | CC0 | Adım, silah ve foley | Olay/animasyon zamanlarına eşleme | **İLK DENE, audio aşamasında.** Müzik veya Japonca karakter VO paketi değildir. |
| A26 [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) | CC0 | Darbe katmanı ve vuruş çeşitleri | VFX ile birlikte seviye/pitch/varyasyon düzeni | **KOŞULLU.** Kritik vuruş miksine katkısı dinlenerek seçilmeli. |
| A27 [Godot Sound Manager](https://github.com/nathanhoad/godot_sound_manager) | MIT | Pooled player, music crossfade ve UI/local ses ayrımı | Belgeli GDScript API | **BEKLET.** 4.6+; oyunda Audio Director var. Somut eksik kanıtlanmadan ikinci ses sahibi ekleme. |
| A28 [Material Maker](https://github.com/RodZill4/material-maker) | Depo çoğunlukla MIT; açık dosya istisnalarını kontrol et | Noise, büyü maskesi ve procedural yüzey dokusu | Araçta üretim → PNG → Godot resource; her iki asistan çıktıyı kullanır | **KOŞULLU.** Ücretsiz kaynak/GitHub yolu; grafik editör otomasyonu orta düzey. Runtime bağımlılığı gerekmiyor. |
| A29 [Pixelorama](https://github.com/Orama-Interactive/Pixelorama) | MIT | Pixel sprite ve spritesheet düzenleme | PNG/kare/spritesheet çıktıları | **KOŞULLU.** Ücretsiz GitHub sürümleri. Pixel-art odaklı; yüksek çözünürlüklü Fadyme için ana araç değil. |
| A30 [Aseprite Wizard](https://github.com/viniciusgerevini/godot-aseprite-wizard) | MIT eklenti | Aseprite animasyonlarını SpriteFrames/AnimationPlayer'a alma | Tag, frame süreleri ve animasyon kitaplığı importu | **BEKLET.** Eklenti ücretsiz; hazır Aseprite executable'ı ücretsiz varsayılamaz. Aseprite zaten varsa kullanılabilir, ücretli araç gerektiren yeni yol önermiyorum. |
| A31 [Dialogue Manager](https://github.com/nathanhoad/godot_dialogue_manager) | MIT | Dallanan diyalog editörü/runtime | Metin `.dialogue`, koşullar ve GDScript entegrasyonu | **BEKLET.** Güncel 4.x sürüm 4.6+; mevcut story/dialogue sistemini göç ettirmek ayrı kapsam. Mevcut VO/mapping işini çözmek için zorunlu değil. |

Karakter/chibi, final müzik ve Japonca VO için bu listede hazır ticari kullanıma uygun ve mevcut tasarımla eşleştiği doğrulanmış tam paket yok. Bu alanların eksikliği gizlenmiyor: özgün üretim ve seçilmiş karakter kaynakları gerekiyor. Ücretsiz kaynaklar burada yardımcı malzeme ve teknik temel sağlıyor.

## 4. Skill depolarının somut değerlendirmesi

Skill dosyaları bu araştırmada kaynak olarak incelendi; yabancı skill'lerin talimatları çalıştırılmadı ve otomatik install scriptleri yürütülmedi.

| Paket | Lisans ve destek | Seçim |
| --- | --- | --- |
| [Awesome GameDev Agent Skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills), [LICENSE](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/LICENSE) | **Apache-2.0**, taşınabilir SKILL.md, Codex ve Claude desteği beyanı | **Ana temel.** Projede birçok uyarlanmış karşılığı zaten var. Eksik shader/audio ve asset üretim referanslarını seç; genel router'ı yeniden ekleme. Önceki minhhoit bağlantısı yerine güncel ana depoyu kullan. |
| [GodotPrompter](https://github.com/jame581/GodotPrompter), [LICENSE](https://github.com/jame581/GodotPrompter/blob/master/LICENSE) | **MIT**, Godot 4.3+; Codex ve Claude yolları belgeli | **Seçili ek kaynak.** Mobil, responsive UI, particles ve kamera referansları. Genel hooks, tüm agent'ler ve zorunlu soru turları projeye topluca aktarılmayacak. |
| [vl4dt/godot-skills](https://github.com/vl4dt/godot-skills), [LICENSE](https://github.com/vl4dt/godot-skills/blob/main/LICENSE) | **MIT**, taşınabilir skills; Godot 4.7 kapsamı beyanı | **İkinci kaynak.** README skill sayısı gerçek tree ile eşleşmiyor; networking açıklamasında eski `rset` ailesi, perf örneğinde kontrol gerektiren API adları var. 4.7 etiketi kalite garantisi değil. Olduğu gibi ana paket olarak kurma. |
| [hybridindie/godot-mcp skills](https://github.com/hybridindie/godot-mcp/tree/main/skills), [README](https://github.com/hybridindie/godot-mcp/blob/main/skills/README.md) | **MIT**, istemciden bağımsız üç skill | **Alternatif MCP kullanılırsa.** `godot-getting-started`, `godot-playtest-and-debug`, `godot-expert` kendi sunucusunun araç adlarını öğretir. Mevcut Godot AI'a birebir uygulanamaz. |
| [GD-Agentic-Skills](https://github.com/thedivergentai/GD-Agentic-Skills) | LGPL-3.0 beyanı | **İlk pakete alma.** Ücretsiz fakat kapsamı ve orchestration düzeni daha büyük. İlk hedef için mevcut+MIT/Apache kaynaklar yeterli; ayrı lisans/bağımlılık incelemesi olmadan uyarlanmış dağıtım seçilmiyor. |

Kaynak kodu açık ve ücretsiz olmak, yönergelerin doğru veya projeye uygun olduğu anlamına gelmez. Özellikle renderer değişimi, yeni singleton'lar, yerel save/economy, alternatif test harness'i ve yayın adımları bu projede otomatik uygulanmaz.

## 5. Ortak skill seçimi: mevcutları paylaş, eksikleri tamamla

### 5.1 Yeniden kurulmayacak mevcut skill'ler

Hepsi aynı `.codex/skills/` ana kaynağında kalacak; Codex'e özel içerik sahipliği ifade etmez.

| Alan | Mevcut skill'ler | Somut iş |
| --- | --- | --- |
| Engine/GDScript | `uomd-setup-engine`, `uomd-godot-gdscript`, `uomd-code-review` | Gerçek sürüm/API kontrolü, strict typing, parse/lifecycle inceleme |
| Scene ve resource | `uomd-godot-nodes-scenes`, `uomd-godot-resources`, `uomd-godot-signals-groups` | Ortak `.tscn/.tres`, olay bağlantıları ve kaynak sahipliği |
| Chibi/animasyon | `uomd-chibi-animation`, `uomd-godot-animation` | Rig/atlas yöntemi, state/clip sözleşmesi, interruption ve ayak anchor'ı |
| VFX/kamera | `uomd-vfx`, `uomd-camera-systems`, `uomd-cutscene`, `uomd-game-feel` | Bounded efektler, cinematic shot, uniform ve Reduced Motion |
| UI/UX | `uomd-godot-ui-control`, `uomd-game-ui-ux`, `uomd-ux-design`, `uomd-ux-review` | Touch/Back, responsive theme, Large Text, kontrast ve durumlar |
| Performans/test | `uomd-perf-profile`, `uomd-test-setup`, `uomd-godot-gdscript-headless-testing` | Ölçüm, mevcut GUT, cleanup/replay doğrulaması |
| Art ve kaynak takibi | `uomd-art-bible`, `uomd-asset-spec`, `uomd-asset-audit`, `uomd-asset-pipeline` | Identity, üretim manifesti, hash/license, handoff |
| Yönlendirme/ilişki | `uomd-router`, `uomd-graphify`, `uomd-architecture-review` | Minimum ilgili skill, bağımlılık sorgusu ve mevcut sınırlar |

### 5.2 Eklenmesi veya mevcut skill'e referans olarak alınması önerilen içerikler

Buradaki **yerel adlar öneridir**, kurulu skill gibi sunulmuyor. Her skill tüm `references/`, kaynak lisansı ve upstream revizyonuyla alınmalı. Aynı konuda iki ayrı aktif skill oluşturmak yerine mevcut skill genişletilebilir.

| ID / önerilen yerel ad | Gerçek GitHub kaynağı | Amaç / aktarım kararı |
| --- | --- | --- |
| S01 `uomd-godot-shaders` | [godot-shaders/SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-shaders/SKILL.md) | **Yeni teknik skill.** CanvasItem, uniforms ve screen texture. 3D/renderer'a özel kısımları ayır; `uomd-vfx` buraya yönlendirsin. Apache-2.0. |
| S02 `uomd-godot-audio` | [godot-audio/SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/godot/godot-audio/SKILL.md) | **Yeni teknik skill.** AudioServer/bus, stream ve sync; mevcut Audio Director'a bağla, yeni manager oluşturma. Apache-2.0. |
| S03 `uomd-particles-reference` | [particles-vfx/SKILL.md](https://github.com/jame581/GodotPrompter/blob/master/skills/particles-vfx/SKILL.md) | `uomd-vfx` altında **referans olarak** al. GPU/CPU tercihini hedef cihaz ve renderer ölçümü belirlesin; GPU default tavsiyesini evrensel kural yapma. MIT. |
| S04 `uomd-responsive-ui-reference` | [responsive-ui/SKILL.md](https://github.com/jame581/GodotPrompter/blob/master/skills/responsive-ui/SKILL.md) | `uomd-godot-ui-control` altında referans. 1080×1920'ı koru; safe area, farklı portrait oranları ve Large Text. Genel 44 px örneğini bütün cihazlar için fiziksel ölçü varsayma. MIT. |
| S05 `uomd-android-lifecycle` | [mobile-development/SKILL.md](https://github.com/jame581/GodotPrompter/blob/master/skills/mobile-development/SKILL.md) | **Yeni scoped skill.** Background/resume, Android Back, izinler ve native sınırlar. Örnek local SaveManager, yeni IAP/ads/keystore veya renderer değişimini dışarıda tut. MIT. |
| S06 `uomd-android-performance-reference` | [godot-optimization/SKILL.md](https://github.com/jame581/GodotPrompter/blob/master/skills/godot-optimization/SKILL.md) | `uomd-perf-profile` referansı. Frame dağılımı, texture/object sayısı ve pooling. Genel draw-call eşikleri proje bütçesi sayılmaz; CanvasGroup ve physics tavsiyeleri ölçümsüz uygulanmaz. MIT. |
| S07 `uomd-phantom-camera-reference` | [phantom-camera/SKILL.md](https://github.com/jame581/GodotPrompter/blob/master/skills/phantom-camera/SKILL.md) | `uomd-camera-systems` altında; **yalnız A10 seçilirse**. Yüklenecek addon sürümünün API'siyle karşılaştır. MIT. |
| S08 `uomd-art-production-reference` | [create-game-assets/SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/create-game-assets/SKILL.md) | `uomd-asset-pipeline` referansı. Style families, manifest ve oyun ölçeğinde inceleme; mevcut canon/approval/handoff düzeni üstün. Apache-2.0. |
| S09 `uomd-import-reference` | [assets-pipeline/SKILL.md](https://github.com/jame581/GodotPrompter/blob/master/skills/assets-pipeline/SKILL.md) | Import seçeneklerini asset audit'e ekle. Genel texture compression reçetelerini alpha kenarı ve mobil görsel testle doğrula. Mevcut `.uid/.import` korunur. MIT. |
| S10 `uomd-touch-input-reference` | [input-handling/SKILL.md](https://github.com/jame581/GodotPrompter/blob/master/skills/input-handling/SKILL.md) | UI review altında touch/drag/back ve input tüketimi; gereksiz keyboard/gamepad scope ekleme. MIT. |
| S11 `uomd-godot-live-review` | Projeye özel yazılacak; [Godot AI araçları](https://github.com/hi-godot/godot-ai/blob/main/docs/TOOLS.md) ve mevcut `preview_session.gd` | **Yeni ortak skill.** Gerçek MCP tool inventory kontrolü, fixture, native frame/screenshot/log ve refresh. Başka MCP'nin tool adlarını kopyalama. Henüz yazılmadı. |
| S12 `uomd-accessibility-review` | Projeye özel yazılacak; [Godot Control](https://docs.godotengine.org/en/4.7/classes/class_control.html) ve mevcut UX checklist | Reduced Motion, Large Text, renk dışı anlam, touch/Back ve safe area; screen-reader davranışı hedef platformda doğrulanır. Yeni runtime plugin gerekmiyor. Henüz yazılmadı. |
| S13 `uomd-shared-skill-validation` | Projeye özel yazılacak; [Agent Skills standardı](https://agentskills.io/specification) ve [Claude skills](https://code.claude.com/docs/en/skills) | Ad/frontmatter, relative refs, iki loader, eş hash ve kaynak notice kontrolü. İstemciye özel hook/komutlar ortak gövdeden ayrılır. Henüz yazılmadı. |

S01/S02/S05/S11 ilk yeni skill grubu; diğerlerinin çoğu mevcut skill'e referans ekleme işi. S12/S13 ortak çalışma kalitesini tamamlar. Native Skeleton2D için mevcut chibi + animation skill'lerine resmî demo ve 2D rig yönergelerini eklemek yeterli; ikinci bir genel animasyon framework'ü şart değil.

## 6. Araçlar: asset olmayan fakat gerekli ortak temel

| ID / araç | Lisans / ücret durumu | Seçim ve doğrulama |
| --- | --- | --- |
| T01 [Godot AI](https://github.com/hi-godot/godot-ai) | MIT; kendi başına ücretli generation API zorunlu değil | **Mevcut 4.3.0'ı kullan.** Codex/Claude belgeli. Dock'un ürettiği sürüme uygun attach config'i iki istemcide ayrı ayarlanmalı. Yeni main snapshot'ı mevcut addon üstüne kopyalama. Canlı erişim burada test edilmedi. |
| T02 [Godot 4.7 dokümanları](https://docs.godotengine.org/en/4.7/) | Ücretsiz resmî doküman | API doğruluğunun ana başvurusu. Skill içeriği çelişirse kurulu motor class/property sorgusu ve ilgili resmî sürüm dokümanı esas. |
| T03 [GUT](https://github.com/bitwes/Gut) | MIT; projede 9.7.1 kaydı | **Mevcut harness.** Parse, import, resource binding ve kritik cleanup testleri; görsel kaliteyi tek başına kanıtlamaz. |
| T04 [Perfetto](https://github.com/google/perfetto), [doküman](https://perfetto.dev/docs/) | Apache-2.0; tracing aracı ücretsiz | **Android ölçümünde koşullu.** Gerçek device trace'te CPU, scheduling ve frame süreleri; cihaz/adb route'u gerekli. Bu oturumda cihaz testi yok. |
| T05 Mevcut Graphify ve `tools/graphify_project.py` | Mevcut proje aracı; yeni upstream kurulumu seçilmiyor | İlişki sorgusu ve asset bağımlılıkları. PATH komutu çalışmadı; kurulumu/çalışan interpreter ayrıca doğrulanacak. Lisansı incelenmemiş yeni Graphify paketi bu kataloğa eklenmedi. |
| T06 [FFmpeg](https://ffmpeg.org/legal.html) + mevcut native preview | FFmpeg çoğunlukla LGPL, build seçenekleri GPL bileşen içerebilir | **Üretim/inceleme aracı.** Temas sayfası/animasyon video kanıtı ve ses dönüşümü; oyuna FFmpeg binary'si dağıtma önerisi yok. Mevcut executable bulundu. |

[Hybridindie Godot MCP](https://github.com/hybridindie/godot-mcp) MIT bir alternatif. Mevcut Godot AI ihtiyacı karşılayamazsa karşılaştırmalı denemeye alınır; iki editor-control eklentisini sebepsiz birlikte etkinleştirmek önerilmiyor.

## 7. Codex ve Claude için tek kaynak düzeni

### 7.1 Ortak skill dosyaları

Mevcut `.codex/` otoritesini koruyan öneri:

```text
.codex/skills/uomd-*/          # tek gerçek SKILL.md + references/scripts kaynağı
.agents/skills -> ../.codex/skills
.claude/skills/uomd-foo -> ../../.codex/skills/uomd-foo
.agents/library/              # kaynak/lisans/revizyon ve capability kayıtları
AGENTS.md                     # ortak kurallar ve sahiplik
CLAUDE.md                     # Claude giriş noktası; aynı ortak kurallara referans
```

Claude için **skill başına relative symlink** öneriyorum; resmî doküman bu keşif yöntemini destekliyor. Windows'ta Git symlink davranışı/Developer Mode veya yerel junction kurulumu doğrulanmalı. Bootstrap mevcut normal klasörü silmemeli ve checkout taşındığında bağlantıları yeniden kurabilmeli. Eski arşivlenmiş `.claude` hooks/agent framework'ü geri getirilmez. [Claude project skills ve symlink desteği](https://code.claude.com/docs/en/skills).

Kopyalar yerine tek kaynak: aynı isim, aynı skill hash'i, aynı referanslar. Claude Code'un istemciye özel `allowed-tools`, dinamik shell substitution ve hook özellikleri ortak skill gövdesine zorunlu bağımlılık olarak yazılmaz. Temel `name`, `description` ve düz Markdown iki istemcinin ortak paydasıdır. Asistanın gerçek araç listesi her oturumda yeniden kontrol edilir; dosyanın varlığı otomatik çalıştığını kanıtlamaz.

### 7.2 Ortak asset dosyaları

```text
Mevcut referans/provenance yolları       # upstream özgün kaynak ve notices
narrative/15_Art_Workbench/             # Codex'in üretim, varyant ve preview çıktıları
narrative/15_Art_Workbench/handoff/     # Claude'un okuyacağı somut teslim sözleşmesi
game/assets/                           # yalnız seçilmiş ve entegre edilen türevler
game/addons/                           # yalnız gerçekten gerekli pinned addon'lar
```

Yeni bir Codex-only veya Claude-only asset ağacı oluşturulmaz. Ortak assetin kimliği aynı kalır. Handoff: `asset_id`, sürüm, source URL/revizyon, hash, lisans, alpha/dimensions, feet/pivot/atlas, klip/event listesi, preview evidence, runtime destination ve export sınıfı. Kod/scenes/script-bearing resources content patch'e rastgele eklenmez; mevcut AAB/content ayrımı korunur.

### 7.3 Aynı editörde çalışma

- İki asistan aynı Godot/plugin sürümünü ve aynı ana skill dosyalarını kullanır.
- Her istemci kendi MCP attach yapılandırmasını tutar; capability/token ve kişisel ayarlar ortak Git'e girmez.
- Aynı sahne veya resource'a eşzamanlı yazma yapılmaz. Codex tasarım/üretim paketini tamamlar; Claude handoff üzerinden bağlar.
- Tool adları ve yetenekleri canlı inventory ile doğrulanır; bir MCP'nin skill'i diğer MCP'ye isim değiştirerek otomatik uyarlanmış sayılmaz.
- Ortak skill erişimi iki rolün de bilgiye ulaşmasını sağlar; görev kapsamını veya runtime değişiklik yetkisini genişletmez.

## 8. Sürüm sabitleme ve kaynak kayıtları

Mevcut kaynakları hash/revizyon kayıtlarından yeniden kullan. Yeni paketlerin moving `main/master` sürümünü production'a sabitlemeden bağlama. Aşağıdaki commit'ler araştırmada gözlenen kaynak snapshot'larıdır; test edilmiş release önerisi değildir.

| Kaynak | Araştırmada gözlenen commit / mevcut pin |
| --- | --- |
| Phantom Camera | `21d3762492e2dc51b448f55438b89b3c19349f96` |
| Universal Transition Shader | `c4e3e659e1338894fc0818f96e69e422a54d67ed` |
| Tween Suite | `a60fc246ae112e46e46876ccdf663d8231e31ff3` |
| Skeleton2D Helper | `5b9203776863795163e6119031e91ef7f5273198` |
| Sprite Sheet Builder Importer | `77143bc9a4b3b0f62090d909ae88007efed0cf30` |
| Mevcut Kenney Particle GitHub kaynağı | `ab7086639ee73be31abd87feb21bf1402d4e8144` |
| Mevcut Godot VFX Library seçkisi | `6e8fc84ef426f82f747cd540823e1d5e1fdc563a` |
| Mevcut resmî sprite/particle demo seçkisi | `b761b4cd5718a7118f2c95eb55f181d0a5f004f1` |
| Mevcut Game-icons seçkisi | `82d948812bfe3f269ef8f731dcdb07b08160edc4` |
| Mevcut GDQuest shaderları | `f6034a88877f6ea144ae487694cc8fde82d4da7f` |

Skill depolarında recursive tree incelemesi de yapıldı: Awesome ana depo, GodotPrompter ve vl4dt için gerçek `SKILL.md` yolları teyit edildi. Kurulum sırasında seçilen dosyalar ve referansları **commit SHA + dosya hash'i** ile kaydedilmeli; API'nin tree SHA'sı commit SHA yerine kullanılmamalı.

Lisans kaydı:

- **CC0:** ticari kullanıma uygun; zorunlu attribution yok, kaynak takibi yine korunur.
- **MIT:** kaynakla copyright ve lisans bildirimi tutulur.
- **Apache-2.0:** lisans, mevcut notice'lar ve uyarlama/değişiklik kayıtları korunur.
- **CC BY 3.0:** seçilen ikonun sanatçısı, kaynak/lisans bağlantısı ve değişiklik bilgisi kaydedilir.
- **OFL:** font lisansı/copyright fontla birlikte tutulur; değiştirilmiş fontlarda reserved-name şartları ayrıca kontrol edilir.
- **GDQuest mixed license:** kod lisansı ile orijinal sanat lisansı birleştirilmez. NC sanat production seçkisine girmez.

## 9. Kurulum sırası ve kabul ölçütleri

### Faz 1 — Ortak AI altyapısı

1. Mevcut skill/provenance envanterini manifestle kaydet.
2. Claude skill keşif bağlantılarını ekle; mevcut Codex köprüsünü koru.
3. S01/S02/S05 ekleri ve S11 live-review yönergesini projeye uyarlayarak hazırla.
4. Mevcut Godot AI'ın iki istemci bağlantısını ve gerçek 4.7.2 ikilisini doğrula.

**Kabul:** iki istemci aynı skill'lerin aynı hash'ini okuyor; relative references çözülüyor; aynı `game/` kökünü ve renderer'ı raporluyor; sahne ağacı ve hata kaydı read-only sorguları başarılı. Claude bu ortamda kurulu olmadığından bu kabul henüz gerçekleşmedi.

### Faz 2 — Ücretsiz görsel üretim temeli

1. Mevcut A01–A07 seçkilerini kullan.
2. A09 resmî Skeleton2D demosunu game dışında referans olarak değerlendir.
3. Fadyme için gerekli gerçek rig parçaları/klipleri üret ve workbench'te doğrula.
4. A10 kamera ve A11 geçiş shaderını ayrı örneklerde karşılaştır.

**Kabul:** silhouette/feet/facing sabit; idle/attack/cast/hit klipleri gerçek hareket içeriyor; event timing ve interruption sözleşmesi var; native preview ve logs temiz. Camera2D/UI sınırı korunuyor. Yeni paketler mevcut runtime'a otomatik bağlanmıyor.

### Faz 3 — UI, erişilebilirlik ve import

1. A18/A19/A20'den küçük tutarlı seçki oluştur.
2. A21/A22'yi mevcut fontlarla mobil boyutta kıyasla.
3. S04/S09/S10 referanslarını ve S12 accessibility incelemesini ortak skill'lere ekle.

**Kabul:** portrait oranları ve safe area, Large Text, Reduced Motion, Android Back, touch alanları, English text expansion; hiçbir bilgi yalnız renk üzerinden iletilmiyor. Alpha kenarı/filter ve atlas bleed gerçek görüntüde kontrol edilmiş.

### Faz 4 — Ses ve Android performansı

1. Audio aşamasında A23/A25 seçkisini dinle; A24/A26'yı gerekirse karşılaştır.
2. Mevcut Audio Director ile event/mix eşlemesini Claude yapar.
3. Gerçek Android cihazda düşük/yüksek efekt senaryosu ölçülür; gerektiğinde T04 trace alınır.

**Kabul:** clipping yok, VO/metin/event timing korunuyor, enter/exit/replay sonrası player/particle/node sayıları kalıcı artmıyor; cihaz, build türü, örnek süresi ve frame-time dağılımı kaydediliyor. 60 FPS hedefi için yaklaşık 16,67 ms frame bütçesi kullanılır; bunun sağlandığı ölçülmeden iddia edilmez.

## 10. Araştırma sınırları ve önceki listeye düzeltmeler

- Bu rapor mağaza/depo varlığı, lisans ve entegrasyon biçimi araştırmasıdır; paket runtime test raporu değildir.
- Mevcut kaynaklarla yeni adaylar ayrıldı; araştırmada hiçbir paket kurulmadı veya addon etkinleştirilmedi.
- Skill depoları tam paket olarak güvenilir kabul edilmedi; gerçek dosyalar ve lisanslar incelendi, somut uyarlama noktaları yazıldı.
- Ortak skill desteği **Codex ve Claude Code** için dosya/MCP düzenini ifade ediyor. Claude web sohbeti, Cowork veya her hosted ortamın aynı yerel dosyaları otomatik yükleyeceği iddia edilmiyor.
- Önceki “ücretsiz Aseprite akışı” yorumu düzeltildi: importer ücretsizliği dış editör executable'ını ücretsiz yapmaz.
- Skeleton2D ve SpriteFrames ücretsiz native seçeneklerdir; kaliteli animasyon için gerekli görsel parçalar/kareler yine üretilmelidir.
- Görsel test, gerçek Android performansı, ses dinleme ve iki istemcili keşif doğrulaması bu araştırmada yapılmadı.
- Terminal PATH Godot 4.6.3 iken proje kayıtları 4.7.2 hedefli. Doğru toolchain seçimi kurulum/entegrasyon fazının ilk kontrolüdür; araştırma sırasında motor değiştirilmedi.
- Asset/skill/shared bağlantıların kurulumu, runtime promotion ve final voice kayıtları bu belgenin hazırlanmasıyla yapılmış veya onaylanmış sayılmaz.

**Önerilen ilk uygulama paketi:** mevcut skill'leri iki istemciye aç + Godot AI bağlantısını doğrula + eksik shader/audio/mobile skill'lerini ekle + mevcut 2D kaynakları kullan + Skeleton2D/Phantom Camera/Universal Transition Shader denemelerini hazırla. Bu sıra en büyük eksikleri giderirken mevcut oyuna ikinci bir mimari eklemeyi önler.
