# Narrative toplama kaydı — 10 Ekim 2026

Hikâye, karakter, senaryo ve ilgili yaratıcı kaynaklar tek merkezden okunabilir hâle getirildi. [Narrative ana indeksi](../../README.md).

- `docs/design` altındaki altı açılış/tutorial belgesi `02_Main_Story/Opening_Tutorial` içine taşındı.
- Üç ilgili tasarım/audit belgesi `12_Production_Notes/Current_Design` içine taşındı.
- Hikâye/karakter şablonu `Templates` içine, VO kataloğu `10_VO/Recording_Notes` içine taşındı.
- Eski 11 belge yolunda kısa yönlendirmeler bırakıldı; mevcut linkler ve JSON `source` alanları çalışır. Taşınan belgelerde yalnızca göreli Markdown bağlantıları yeni konuma uyarlandı.
- Önceki Narrative session checkpoint'i `Session_History` içine byte eşit kopyalandı; operasyon kaydı yerinde kaldı ve tarihî statüsü korunur.
- Runtime veri dosyalarının byte eşit kopyaları, otomatik okuma metinleri ve 20 karakter + antagonist indeksi üretildi. [Kaynak/runtime kontrol sonucu](SOURCE_RUNTIME_STATUS.json).
- Canon ledger, özgün karakter profilleri, authored script JSON'ları, medya ve oyun dosyaları değiştirilmedi. Okuma metinlerinin üretimi her line_id'nin korunmasını ve manifestteki ana hikâye sırasını denetler.

[RELOCATION_MANIFEST.json](RELOCATION_MANIFEST.json) eski/yeni yolları, orijinal/hedef hash'lerini ve link uyarlamalarını kaydeder. Önceki kaynakların byte eşit yedeği:

`C:\Users\PC\Documents\Codex\2026-10-10\u-an-projenin-i-inde-hangi\narrative-consolidation-backup-20261010`

Güncel kontrol ana hikâyede **419/419 replik** eşleşmesi gösterir. `Migration_Audits/RECONCILIATION.md` içindeki 409 runtime/10 eksik satır bilgisi 5 Ekim'e ait tarihî bulgudur; bugünün durumu olarak kullanılmaz. Bu rapor geçmişi değiştirmek için yeniden yazılmadı.

Yenileme: `python tools/collect_narrative.py`. Salt okunur kontrol: `python tools/collect_narrative.py --check`. Var olan canon/runtime regresyonu: `python -m unittest tools.test_narrative_sources`.

Tamamlanan kontroller: koleksiyon güncelliği/line_id sırası, ana indeks ve yeni karakter indeksinin bağlantıları, dört mevcut canon/runtime regresyon testi ve Git whitespace kontrolü geçti. Önceden mevcut 2.336 kaynak/oyun dosyasının SHA-256 karşılaştırmasında yalnızca üç gezinme README'si değişti; canon metinleri, karakter profilleri, özgün script JSON'ları ve oyun dosyaları aynı kaldı. Taşınan 11 belgenin metinleri link hedefleri dışında özgün yedeklerle eşleşiyor.

Tarayıcı, Godot, Android cihaz, ses telaffuzu veya AAB kabul testi bu belge toplamanın parçası değildir.
