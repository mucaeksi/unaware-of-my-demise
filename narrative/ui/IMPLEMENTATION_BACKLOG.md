# UOMD — UI eksikleri ve üretim sırası

2026-10-05 · DESIGN_DRAFT · Bu liste yeni tasarım ile mevcut oyunun arasındaki işi gösterir. Seçili Narrative kaynakları BATCH-0005 ile aktarıldı; kaynak/runtime farkları [aktarım kaydında](../migration/README.md).

## P0 — İlk oyuna giriş
- [x] Onaylı key art / logo ile giriş taslağı; 10 release/login/snapshot senaryosu: [ENTRY_SCREEN.md](ENTRY_SCREEN.md), [entry/index.html](entry/index.html).
- [ ] Godot title/boot Control yerleşimi; mevcut SignInFlow, Online ve ClientRelease sonuçlarını yeni yüzeye bağlama.
- [ ] Gerçek gizlilik ve mağaza adresleri; Android Back, cutout/safe-area ve native hesap seçimi cihaz doğrulaması.

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
- [ ] 20 karakterin tutarlı koleksiyon/detay portre seti. Mevcut Sığınak prototipinde yalnız Fadyme sheet ve Mahmut key art crop'u var; diğer 18 kartta simge kullanıldı. Aktarılan onaylı sheet'ler önce değerlendirilir; Aveline, Sable, Nara, Cael ve Yseldra'nın bekleyen sheet işleri kaynak durumuyla korunur.
- [ ] Weapon/armor/accessory/material ikonları, rarity frame ve set/skill işaretleri; kaynak kimlikleri korunmalı.
- [ ] Equip/level/upgrade/reroll/dismantle karşılaştırma ve maliyet/onay ekranları; prototip bu backend işlemlerini çalıştırmaz.
- [ ] Aktif limited artwork, doğru hedef seçimi, guarantee/Fate Knot ve süre; kalıcı/sınırlı sayaçları ayır.
- [ ] Çağrı sonucu/history: exact server ödülü, duplicate/shard, pending/retry ve tekrar gönderim engeli.
- [ ] Günlük/haftalık gerçek quest tanımları ve ödülleri; demo satırlarını içerik olarak taşımama.

## P1 — Hikâye ve erişilebilirlik
- [ ] Companion/Codex/Event tüketicileri ve gerçek gate'ler. Denetimdeki Codex runtime `always` farkı kapatılmalı.
- [ ] VN doğru background/bust, JP VO ve music cue; Auto/Log/Skip. Hub'ın yeni görseli canon'a sessizce eklenmemeli.
- [ ] Mevcut Native Android Google giriş altyapısının yeni UI ile bağlantısı; oturum/bağlantı yüzeyleri ve gerçek Settings wiring.
- [ ] Büyük metin, contrast, keyboard/Android Back, screen-reader labels ve reduced motion cihaz üzerinde doğrulama.

## P2 — Son görsel geçiş
- [ ] Yeni karakter tasarımı yerine onaylı kaynaklardan UI portre/kart varyantları; approved/draft açık ayrımı.
- [ ] Tüm ortak ikon ve panel stillerinde üretim raster/vector paketleri, import ayarları ve atlas budget.
- [ ] Kısa screen geçişleri, claim feedback, loading/error/empty yüzeyleri ve hafif UI SFX. Müzik/VO hattını bağımsız koru.
- [ ] Düşük cihaz bellek/FPS, farklı aspect ratio, büyük font ve gerçek network failure smoke pass.

## Önceki Narrative denetiminden bekleyen işler
163 seçili dosya aktarıldı, mevcut 26 kilitli referans doğrulandı; diğer dosyalar gerekçeleriyle Drive envanterinde tutuldu. Story Bible/canon aktif ve emekli kopyaları ayrı yollar ve hash'lerle korundu. [Karşılaştırma ve eksik listesi](../migration/RECONCILIATION.md): kaynak/runtime 419/409 satır (10 eksik, 2 ortak satırda farklı metin), 51/1 music cue, 9 Codex gate ve 40 VO unlock farkı. Fadyme JP scripti DRAFT: 201 satıra karşı 25 seçili OGG, 176 satır için seçili ses yok. Costume guide STALE; Rikka/Hana silah çelişkileri, Nixie saç sorunu ve Brin/Kera r2 işleri ayrıca bekliyor. Bu farklar Narrative kaynak aktarımıyla veya UI tasarımıyla çözülmüş sayılmaz; runtime dosyaları korunmuştur.

Gemini hattını kaldırma kararı ertelenmiş durumda. Bu çalışma OpenAI ile bir UI ortam adayı üretti; karakter tutarlılığı, variant üretimi ve maliyet/kalite karşılaştırması tamamlanmadan mevcut araçları silmek gerekmez. Ses/müzik API ihtiyacı ayrıca belirlenir.
