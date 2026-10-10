# Claude için düşman sanat teslimi

Bu paket **tasarım aşaması** teslimidir. `game/` altında bağlama/ithal etme için hazır sprite atlası değildir. Codex’in yeni talebi sanat üretimi; Claude’ın runtime/entegrasyon sahipliği korunur.

## Korunacak kimlikler

`design_cards.json` içindeki 26 `enemy_id`, source skill/phase/objective ID’leriyle birebir eşleşir. `boss_bell_widow` = Yseldra; ayrı canavar değildir, tasarımı son ayrı aşamada. Cael bu Part I combat registry’sinde yoktur ve yeni boss node’u eklenmez.

`bellbound_dead` ve `hollow_pilgrim` mevcut tutorial sprite’ları otomatik değiştirilmez. Tasarım sayfası bu kimliklere ait devam brief’idir. Aynı `inkbound_dead` Ch.2 ve Ch.6’da tekrar kullanılır; iki ayrı kimlik üretmeyin. Sheet üst satırındaki full-body ve alt satırdaki hareketler alternatif çizimdir, düzenli animation frame’leri değildir.

## Bir sonraki üretim kontratı

Her düşmanı sayfadan ayrı ImageGen türevi olarak üretin: temiz alpha, metin/zemin/gölge kutusu olmayan tam siluet. Yeni sürüm ve prompt/source hash kaydı kullanın; source master’ları yerinde koruyun. Humanoid battle gövdelerini Fadyme’nin güncel chibi oranına normalize edin; bu konsept sayfalarındaki bazı yetişkin boy oranları battle kabulü sayılmaz.

Öneri: normal figürler ekranda 160–210 px, boss 230–300 px yükseklik; 1080×1920 ve 540×960 native referanslarda HUD/hasar etiketi örtüşmesi kontrol edilmeli. Bunlar üretim hedefleri, ölçülmüş final sprite boyları değildir. Mekanik bilgi renk kadar silhouette/prop/pose ve mevcut intent metninden okunur.

Pivot: basan ayağın alt merkezi; dört ayaklı hayvanda destek yüzeyinin merkezi; wraith’te sabit mantıksal zemin. Ayrı shadow/VFX/weapon katmanı gerektiğinde ayrı dosya üretin. Tek PNG’ye bone animation yapılmış gibi davranmayın.

Gerçek idle/attack/hit/defeat frame’leri ve skill telegraph/resolve/recover aşamaları ayrıca üretilecek. `animation_handoff_tr` yalnızca yönlendirmedir. Boss faz geçişi ve hedefler mevcut data’nın dışına taşmaz. Oren’in yenilgisi ölüm değildir; Ashen Lord etiketi kişisel adını açıklamaz.

Break prop’ları ayrı alpha asset/resource gerektirir: Ash-Maw jaw_bell; Rusk signal_banner; Matron iki flask rack; Oren signal_standard; Ashen Lord mirror_frame; Construct üç zincir/ankle hedefi ve üç pylon. Bell-Widow wax_seal sonraki Yseldra paketinde.

Runtime yolu, import/compression/atlas hücreleri ancak gerçek alpha dosyaları ve native battle testleri hazır olduğunda kesinleştirilir. Mevcut `battle_art_v001.json` mekanizması incelenerek stable ID üzerinden bağlanmalı; source content’e sırf görsel için dokunmayın. Bu staging paketi dışarıda `narrative/` altında kalır, AAB/PCK’ye otomatik girmez.

## Bulgu ve sınırlar

- Kanon bestiary `noble_retainer` için Ashen estate Wraith der; data faction halen crown_remnant. Görsel Wraith kimliğiyle tasarlandı. Oyun/veri etiketi bu sanat turunda değiştirilmedi; içerik sorumlusu güncel faction kararıyla değerlendirmeli.
- Bell-Widow lore ve eski villain bible `skill seal` tarif eder; current enemy effect_ops charged attack + Dread kullanıyor. Yseldra tasarımında wax_seal hedefi mevcut; yeni skill-disable davranışı sessizce eklenmemeli. Son ayrı Yseldra turunda kapsam kararı verilmelidir.
- Choir Knight’ın karşılık verme lore’u yeni counter animasyonu/mechanic onayı sayılmaz; mevcut registry/hook okunmalı.
- Asıl owner afişinin dosyası bu workspace’te mevcut değil. Yazılı güncel owner görsel brief’i ve mevcut Fadyme/approved key-art yerel türevleri incelendi; kayıp dosyaya hayali hash/ref verilmedi.
- Alchemist/Matron yüz-saç, normal kıyafet ayrıntıları ve türetilen crest çizimi görsel önerilerdir, onaylanmış yeni world canon değildir.
- Ses, VN yüz ifadeleri, gerçek alpha sprite ve animasyonlar, mobil battle okunurluğu ve AAB kapsamı tamamlanmış ilan edilmez.
