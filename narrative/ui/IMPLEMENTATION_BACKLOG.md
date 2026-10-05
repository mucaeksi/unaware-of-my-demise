# UOMD — UI eksikleri ve üretim sırası

2026-10-04 · DESIGN_DRAFT · Bu liste yeni tasarım ile mevcut oyunun arasındaki işi gösterir. Narrative tam aktarımı ayrı kayıt: `../migration/README.md`.

## P0 — Ana menüyü oyuna almak
- [ ] Ortak Godot theme, font ve ikon bileşenleri; lisanslı Türkçe font seçimi, 1080×1920 ve safe-area ölçekleme.
- [ ] Sığınak artwork adayının görsel değerlendirmesi; kaynak PNG/prompt/hash kaydı hazır. Dokunma hotspotları artwork'ten ayrı Control katmanı.
- [ ] HubScreen + kalıcı 5 tab; doğru geri navigasyonu ve restore edilen scroll/selection.
- [ ] Profil, currencies, Ration/UTC timer, ready quest ve Inn Meal gerçek snapshot/claim durumlarına bağlanmalı.
- [ ] Devam kartı StoryDirector'ın gerçek chapter/node ve clear durumuna bağlanmalı; 1-1 iki kişi/0 Ration istisnası korunmalı.

## P1 — Oynanabilir döngü
- [ ] Yolculuk/stage sheet: enemy/drop kartları ve gerçek unlock kuralları; prototip bunları sayı uydurmadan yer ayırır.
- [ ] Formasyon: owned/guest/locked; 2+3 slot, gerçek hedef/Ultimate policy enum'ları, başlangıç tutorial'ı ve İlk Yemin eligibility.
- [ ] BattlePlayback canvas: onaylı chibi/sprite'lar, sıra/Focus/status/telegraph, hız/skip ve sonuç doğrulama.
- [ ] Zafer/yenilgi/pending-result yüzeyleri; yalnız confirmed victory Ration ve ödül yazımı.

## P1 — Yoldaş, ekipman ve çağrı
- [ ] 20 karakterin tutarlı koleksiyon/detay portre seti. Bu prototipte yalnız Fadyme sheet ve Mahmut key art crop'u var; diğer 18 kartta simge kullanıldı. Drive'daki mevcut onaylı referanslar önce aktarılıp değerlendirilir, sonra gerçekten eksik varyant üretilir.
- [ ] Weapon/armor/accessory/material ikonları, rarity frame ve set/skill işaretleri; kaynak kimlikleri korunmalı.
- [ ] Equip/level/upgrade/reroll/dismantle karşılaştırma ve maliyet/onay ekranları; prototip bu backend işlemlerini çalıştırmaz.
- [ ] Aktif limited artwork, doğru hedef seçimi, guarantee/Fate Knot ve süre; kalıcı/sınırlı sayaçları ayır.
- [ ] Çağrı sonucu/history: exact server ödülü, duplicate/shard, pending/retry ve tekrar gönderim engeli.
- [ ] Günlük/haftalık gerçek quest tanımları ve ödülleri; demo satırlarını içerik olarak taşımama.

## P1 — Hikâye ve erişilebilirlik
- [ ] Companion/Codex/Event tüketicileri ve gerçek gate'ler. Denetimdeki Codex runtime `always` farkı kapatılmalı.
- [ ] VN doğru background/bust, JP VO ve music cue; Auto/Log/Skip. Hub'ın yeni görseli canon'a sessizce eklenmemeli.
- [ ] Native Android giriş/oturum, bağlantı durumu ve gerçek Settings wiring.
- [ ] Büyük metin, contrast, keyboard/Android Back, screen-reader labels ve reduced motion cihaz üzerinde doğrulama.

## P2 — Son görsel geçiş
- [ ] Yeni karakter tasarımı yerine onaylı kaynaklardan UI portre/kart varyantları; approved/draft açık ayrımı.
- [ ] Tüm ortak ikon ve panel stillerinde üretim raster/vector paketleri, import ayarları ve atlas budget.
- [ ] Kısa screen geçişleri, claim feedback, loading/error/empty yüzeyleri ve hafif UI SFX. Müzik/VO hattını bağımsız koru.
- [ ] Düşük cihaz bellek/FPS, farklı aspect ratio, büyük font ve gerçek network failure smoke pass.

## Önceki Narrative denetiminden bekleyen işler
Tam Drive aktarımı henüz yapılmadı. Önceki analizde: ana scriptte kaynak/runtime 419/409 satır farkı; cue ayrıntılarının runtime'da kaybı; VO unlock ve Codex gate farkları; stale costume guide ve iki karakterin silah tanımı çelişkileri; Fadyme JP script/VO seçim ve dosya kapsamı; eski/yeni Story Bible kopyalarının kaynak iziyle karşılaştırılması. Bunlar yeni UI üretimiyle çözülmüş sayılmaz.

Gemini hattını kaldırma kararı ertelenmiş durumda. Bu çalışma OpenAI ile bir UI ortam adayı üretti; karakter tutarlılığı, variant üretimi ve maliyet/kalite karşılaştırması tamamlanmadan mevcut araçları silmek gerekmez. Ses/müzik API ihtiyacı ayrıca belirlenir.
