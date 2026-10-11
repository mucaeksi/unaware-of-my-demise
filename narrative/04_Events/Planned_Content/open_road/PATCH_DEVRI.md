# Açık Yol — future patch devri

Bu klasör tam narrative kaynağıdır; imzalı canlı release değildir. Data delivery ancak gerekli client/server sürümü, onaylı asset/roster ve release mapping’iyle yapılabilir.

Tasarım ID: `side_quest_open_road`. Canon kaynak: `yok; yeni yaratıcı yan içerik`. Gate `5-5`; runtime mapping henüz null.

Sivillerle kalan ikilinin mevcut yan rotası; Mahmut/Fadyme geri dönmez. Köprünün kaderi ve Oren’in yeri hakkında yeni bilgi yok. Last Cart, Oren’s Teacher ve Refugee Measure tekrarlanmaz. Yalnız bilinen Hollow düşmanlar kullanılır; yaşayan Crown Guard bu paketten çıkarıldı.

Gereken bağlantılar: sunucu ana hikâye gate’i ve yayın kontrolü; sabit graph/choice state; server verified victory; güvenli VM/UI resume; scene/media/portrait eşlemesi; gerçek battle roster ve skill binding; bağımsız replay session; revision pin ve progress migration. Bunlar çalışan endpoint olarak teslim edilmedi.

Bütün 4 seçim yolu VM’de tamamlandı. İlk turda 1 battle, 2 ulaşılabilir karşılaşma tasarım varyantı var. Pending-choice öncesi, her line sonrası ve scene checkpoint save/restore denendi. [Kanıt](VALIDATION.json).

Yayından önce gerçek Android UI üzerinden bütün yollar, stage gate öncesi/sonrası, patch sonrası visibility, scene/choice/battle ortasında resume, network retry, free/loan roster dengesi ve replay izolasyonu kontrol edilecek. Ödül belirlendikten sonra idempotent server claim/source alias testleri bağlanacak.

.md ve CSV yapım kaynağıdır; executable veya player patch allowlist dosyası değildir. Combat feasibility fixture’ı QA-only ve yayımlanmaz. Story export’ları mevcut grammar ile parse edilir; event graph ve encounter brief’leri adaptöre ihtiyaç duyar. Ödül, enerji, takvim ve min-client-version bu teslimde açık bırakıldı.

[Üretim/ayar yüzeyi](AYARLAMA_VE_URETIM.md) · [State](authoring/state_contract.json) · [Replay](authoring/replay_catalog.json).
