# Fadyme · üretim paketi v002 · 2026-10-09

Kapsam: **yalnız asset/tasarım üretimi**. Oyun, runtime manifestleri, sahne akışı ve AAB değiştirilmedi. Yeni kaynaklar tasarım adayıdır; kullanıcı onayı uydurulmadı. Claude entegrasyonu ve sonraki buildleri yapar. [Yerel görsel inceleme](index.html) portre seçimi ve yürüme/bekleme animasyonu içerir; dosya olarak açılır, sunucu/uzaktan oturum gerektirmez.

| Grup | Teslim |
|---|---|
| VN | Mevcut beş portrenin byte-exact kopyası + yeni merak, kararlılık, saklanan ağrı ve itiraf portreleri. 241 satırın görsel yönü; kullanılan 68 duygu etiketi açık eşlemeli. Runtime fallback kodu değiştirilmedi. |
| Animasyon | Sekiz durum için AnimationPlayer klipleri + sekiz Reduced Motion karşılığı. Yeni sekiz yürüme ve dört bekleme karesi, SpriteFrames/AtlasTexture kaynakları. Aksiyonlar key-pose/property animasyonudur; kemik rig veya tamamen kare kare çizilmiş aksiyon paketi değildir. |
| VFX | Dört mevcut skill ID’si için ayrı ana efekt, iki müttefik restore/cleanse bileşeni. GDQuest MIT kodu + Kenney CC0 dokuları; NC sanat kullanılmadı. |
| Hikâye | Kanı gizleyen atkı; 5-4 sonrası kalıcı bone-white saç tutamı; Ch7 siyah-altın el çizgileri. Mevcut script eşikleriyle durum tablosu; yeni save flag yok. |
| Props | Zincir çan/diken tokmak, ayrı anne saç pini, kırık taç parçası, dua kitabı, mektup/eldiven, atkı, ibresiz saat, anne portresi. Sekiz bağımsız AtlasTexture. Anne yüzü yeni adaydır. |
| Sinematik | Mektup açılışı, Mahmut’la itiraf, Cael/Yseldra yansıma reveal çizimleri; mevcut scene ID’leriyle shot/altyazı/sessizlik yönergeleri. Tam sahne çizimleri düz kaynaklardır; ayrılmış background/actor katmanları veya bitmiş runtime sinematiği sayılmaz. |
| UI | Mevcut MenuAvatar/BattleHUD/Roster/CompanionCard, profile ve cut-in kaynakları aynen korunarak toplandı. Dört mevcut skill mark ID’si için yeni ikon atlası ve bağımsız AtlasTexture kaynakları. |
| Ses · son aşama | 40 tutorial JP taslağı tamamlandı; 201 önceki taslakla birlikte 241 satırlık yeni kayıt kuyruğu hazır. Eski Sulafat kayıtları byte-exact arşivlendi. Yeni Google Chirp 3 HD `ja-JP` setinde **241 satırın tümü yeniden kaydedilecek**; Google OAuth erişimi doğrulandı ve ortak 30 ses örneği üretildi (14 kadın, 16 erkek); Fadyme için voice seçimi ve 241 final kayıt henüz yapılmadı. Sekiz SFX cue tasarımı mevcut; SFX ses dosyası üretilmedi. Fadyme teması ve kullanıcının ana teması değiştirilmedi. |

Dosyalar kaynak masterlarını ezmez; ilk yürüme atlası ve props/reveal denemeleri açıkça kullanılmayan taslak olarak saklanır. [Provenance](provenance/) gerçek image_gen istemlerini ve kaynak hashlerini, [inventory](asset_inventory.json) çıktı ölçülerini/alpha/hashlerini içerir. Görsel üretim aracının gerçek model ID’si araç tarafından açığa çıkarılmadı; Gemini/model/seed etiketi uydurulmadı. Yeni oyun ID’si eklenmedi. Her şey `WORKBENCH_NOT_EXPORTED` statüsünde.

Godot 4.7.2 / GL Compatibility / Mesa llvmpipe masaüstü doğrulaması: 16 klip; altı VFX bileşeninin normal/azaltılmış hareket ve bitiş örnekleri; 12 locomotion karesi. 240 px gösterimde ölçülen core zemin farkı en fazla 0.0064 px. Altı efekt bitişte tamamen görünmez. İkonlar 48/96 px örneklerle ayrıca incelenir. [Native kanıt](validation/native_review.json), [VFX görünür alan ölçümü](validation/vfx_coverage.json). Bunlar Android cihaz performansı veya sanat onayı değildir.

Düz portreler her ifade × her hikâye hali birleşiminin ayrıca çizildiği anlamına gelmez. `story/scene_coverage.json` tüm 93 önceki direction kaydını taşır; 93 yeni background üretildiği iddia edilmez. Final voice/miks, gerçek telefon okunurluğu, runtime event/kapı/skip/replay bağlamaları Claude/kullanıcı aşamasındadır. Gerçek JP süreleri oluşmadan shot süreleri ve skill release süreleri kesinleşmiş motor sözleşmesi sayılmaz.

Eski VO: [arşiv manifesti](../../../../13_Archive/fadyme_voice_sulafat_2026-10-09/MANIFEST.json), 143 dosya/104 ses kopyası; 26 farklı ses içeriği. Eski 25 mevcut / 216 eksik sayısı tarihsel denetimdir; yeni kayıtta geçerli değildir. Arşivdeki casting/API scriptleri yeni TTS üretim yolu olarak kullanılmaz. Önceki denetim [audit_v001](../audit_v001/README.md) korunur.
