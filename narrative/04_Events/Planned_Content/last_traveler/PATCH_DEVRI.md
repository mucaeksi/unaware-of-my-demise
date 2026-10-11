# Son Geçen İçin — sonraki patch için devir

Bu bir authoring paketi; yayımlanabilir imzalı release değildir. Kullanıcı kararı: sonraki patch’lar, hikâye eşiği, ödüller açık.

## Teslim edilen ve ileride bağlanacak

| Grup | Durum |
|---|---|
| story_json | 15 sahne mevcut StoryScene grammar; asset/portrait/cue mapping henüz bağlı değil |
| authoring/event.json | Tam metin, graph, 1-4 gate, geçerli seçim test örnekleri; çalışan event endpoint değil |
| authoring/encounters.json | 4 düzen/rol brief’i; sayısal/skill/AI profilleri henüz bağlanmadı |
| authoring/state_contract.json | Kalıcı ilk tur ve izole replay sözleşmesi; API/storage kodu değil |
| authoring/replay_catalog.json | Alternatif sahne/konuşma sınırları; runtime host uygulaması gerekir |
| scripts, Markdown ve VO CSV | Yazım/prodüksiyon kaynağı; oyuncu patch dosya allowlist’ine dahil edilmez |
| VALIDATION.json | Yerel yazım/akış kontrol kanıtı; cihaz veya canlı oyun testi değil |

## Gate ve event kimliği

Tasarım kimliği `side_quest_last_traveler`. Canon kaynak kimliği `yok; yeni kalıcı yan görev`. Yeni görev mevcut companion veya main-story kaydının yerine geçmez. Tamamlanması gelecekteki Brin/Nixie karakter görevlerinin kendiliğinden tamamlandığı anlamına gelmez.

Sunucu, patch’in yayınlanmış olmasıyla `1-4` ana hikâye tamamlanmasını birlikte doğrular. Runtime stage mapping, min-client-version, yayın ve expiry tarihi null; uydurma ID/tarih/sürüm bağlanmadı. Permanent side quest tasarımında kalıcı erişim önerilir; fiilî dağıtım politikası ve arşiv uygulaması henüz bağlı değil.

## State ve replay

method_replays seçilmeyen üç sahnelik yöntemi ayrı açar ve lt_a3_watch öncesinde biter. Yöntem içindeki plan seçimi replay oturumuna yazılır. conversation_replays iki kapanışı açar; scene_replays tüm sahneleri kapsar. Genel state_keys Cartesian çarpımı 16 üretir ama sekizi geçersiz yöntem/plan eşleşmesidir: validation_cases yalnız sekiz anlamlı kombinasyonu içerir.

İlk tur anahtarları player_id + event_id + story_revision. Active node, scene cursor, choices ve completed node’lar sunucuda tutarlı kaydedilir; sadece local flag’e güvenilmez. Pending choice’ta henüz cevap yoktur; seçenek onayından sonra state kaydı ve sonraki node geçişi tutarlı işlenir. Standart battle victory doğrulanmadan ilerleme yapılmaz. İlerlemekte olan oyuncu revision’a sabitlenir; patch geldikçe bütün hikâye sessizce sıfırlanmaz. Replay kendi geçici state’iyle çalışır ve ilk tur/claim kayıtlarını değiştirmez.

Ödül/enerji alanları null; tür/adet veya first-clear/replay politikası seçilmedi. Yazıdaki yiyecek, işaret ve yol açılması ekonomik ödül sayılmaz.

## Gerçek entegrasyon kabulü

1. Gate öncesi ve patch yayını öncesi görünmez; yayın sonrası yalnız uygun hesabın karşısına çıkar.
2. Bütün 8 geçerli kombinasyon gerçek UI’da bir savaştan sonra doğru ortak sonuca ulaşır. Method/plan uyuşmazlığı sunucu tarafından reddedilir; farklı yönteme ait planla encounter seçilemez.
3. Story/choice/battle anında kapatıp açma, ağ yanıtı kaybı ve retry progression’ı bozmadan sürer. Yerel kontrolde yalnız sahne sonu VM checkpoint restore denendi.
4. Scene, portrait, background, music, enemy, skill ve attack intention referansları aynı published revision’da bulunur.
5. Ücretsiz kadro ile iki ön/üç arka slot düzeni ve bütün varyantların gerçek dengesi simüle edilir.
6. Replay sınırında durur; ilk tur seçimleri overwritten olmaz. Ödüller seçilince idempotent claim ve kaynak event migration testleri eklenir.
7. Android landscape/touch/safe-area/audio ve güvenli patch path/hash/signature/client-version doğrulanır.

Buradaki uygulama kabiliyetleri mevcut istemcide çalışıyor varsayılmadı. Kod/endpoint işleri Claude’un kulvarında; bu teslim ona aktarılabilecek tam içerik kaynağıdır.

## Seçim önizlemelerinin sunumu

Authoring choice seçeneklerindeki `consequence_en` metinleri oyuncuya karar öncesi gösterilecek önizlemelerdir. Mevcut StoryScene choice export’u seçenek ID/etiketini taşır; ayrı consequence alanı yoktur. Gelecekteki event/UI adaptörü bu önizlemeyi authoring metadata’dan sunmalı veya onaylı içerik derleyicisi seçenek metnine dahil etmelidir. Mevcut oyunda ayrı önizleme paneli uygulanmış olduğu varsayılmaz.
