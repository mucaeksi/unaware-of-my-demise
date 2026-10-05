# Narrative / UI checkpoint — 2026-10-05

Bu kayıt Narrative ve UI tasarım işine aittir. Infrastructure ekibinin `active.md` kaydı ve runtime değişiklikleri ayrı sahipliktedir.

## Tamamlanan kaynak aktarımı

- Main commit: `395c4b909c62cd0c883b546d3aa542e09fe46b06` / BATCH-0005. LEGACY Narrative `1Xw7Hqw4RDdeYeaiJiaX_Rjt9bbcxuXkK` canlı olarak listelendi: 558 kayıt; ayrıca root GDD okundu.
- 163 seçili dosya aktarıldı; 26 kilitli referans yeniden kullanılmak üzere doğrulandı. Drive orijinalleri, kaynak byte'ları ve statüleri korundu. Her dosya ID/yol/hedef/hash/boyut/Git blob kaydıyla [manifestte](../../docs/migration/BATCH-0005.manifest.json).
- 55 mevcut referans/runtime dosyası `7440328` main baseline'ına göre değişmedi. 12 PNG ve 29 OGG decode; kaynak JSON ve 13 üretim scripti statik okuma kontrolü geçti. Legacy scriptleri çalıştırılmadı.
- 20 karakter paketi, canon/story/lore/art/audio/tools dizinleri ve indeksleri düzenlendi. Eski Story Bible/canon kopyaları archive'da korunur.
- Runtime'a otomatik içerik terfisi yapılmadı. [Eksikler/farklar](../../narrative/migration/RECONCILIATION.md): 10 kaynak repliği, 2 metin farkı, music cue ve unlock kayıpları; stale costume/weapon çelişkileri; JP editör ve eksik seçili ses işleri.

## UI / 01 — giriş / patch öncesi araçlar v03

- Owner düzeltmesi: ilk girişten itibaren bütün oyuncu metni/altyazı İngilizce, seslendirme Japonca. [Dil kuralı](../../narrative/ui/LANGUAGE_POLICY.md). Önceki aktif wireframe etiketleri de İngilizceye düzeltildi; eski Türkçe görseller tarihsel kayıt.
- [ENTRY_SCREEN.md](../../narrative/ui/ENTRY_SCREEN.md), [entry/index.html](../../narrative/ui/entry/index.html): SignInScreen, giriş sonrası PatchScreen, sağ üst Settings/Help/Sign Out, ayrı EntrySettingsScreen/EntryHelpScreen ve çıkış onayı. Onaylı key art byte'ları değişmedi.
- Her eklenen sayfa/bileşen ayrı spec/view, kalıcı ID/ad ve planlanan Godot yol/sinyalleriyle [SCREEN_REGISTRY.json](../../narrative/ui/SCREEN_REGISTRY.json) içinde kayıtlı. Gerçek .tscn/.gd eklenmedi.
- Teknik ekibin `10b42fb` main değişikliği alındı: TitleScreen ve yeni oyuncunun opening/tutorial yönlendirmesi korunur. App release preflight → native Google/session → patch → snapshot → opening/Hub/recovery. update_content auth yolu ile eşleme belgeli. Sayfa gezinmesi indirmeyi yeniden başlatmaz; Sign Out için kontrollü transport/atomic install iptal sınırı Godot binding işi olarak açık. D-01 support adresi Help içinde kullanılır; D-15 hukuk/politika metni ayrı bekler. Yeni audio_cues slotları null kalır.
- [ENTRY_VERIFICATION.json](../../narrative/ui/ENTRY_VERIFICATION.json): güncel tarayıcı ölçümleri/akış kontrolleri. Gerçek hesap, Godot veya Android cihaz kabulü değildir. Sadece cihaz tercihlerinin localStorage kaydı var; token/player verisi yok. Ses oynatılmaz; ana tema korunur.
- Godot/runtime/server/deploy değişikliği yapılmadı. Başarılı örnek geçiş eski Sığınak prototipindeki örnek roster/cüzdana gider; bu veriler gerçek yeni oyuncu başlangıcı değildir.

## Son kullanıcı kararı / yeniden başlangıç — yalnız plan kaydı

- [Tam döküm ve eksik listesi](../../narrative/design/WORK_COMPLETED_2026-10-05.md), [yeni oturum başlangıç promptu](../../narrative/design/CREATIVE_RESTART_PROMPT.md) kaydedildi. İnceleme baseline'ı `402bb8c`. Kullanıcı yeni oturumdan başlatacak; bu kayıt üretim yetkisini bu tur uygulamaya geçirmez.
- Yeni artwork Codex ile üretilecek; eski görsel reference pack'leri/Gemini görsel zorunluluğu gelecekte aktif otorite olmaktan çıkarılacak. Son talimat eski görsel kilit kuralını günceller. Bu tur dosyalar/kilit/hash kayıtları değiştirilmedi; Drive orijinalleri ve tarihsel kaynak izi korunur. Audio/music API yolu ve owner'ın ana teması bu görsel reset ile kaldırılmaz.
- Yeni stil hedefi kullanıcının Gothic/anime/light-novel afiş ekidir. Özgün byte'lar yerel dosya olarak kaydedilmedi; yeni oturumda bu görsel prompta yeniden eklenmeli. Hash/target uydurulmaz.
- Sıra: SovTaym Studios adı araştırması → ortak sanat dili ve görsel paket geçişi → Godot yazılı açılışta ana tema fade-in → stüdyo → TitleScreen → giriş/patch araçları → HubScreen ve bütün UI → final Fadyme sheet/poz/chibi animasyonları → diğer karakter/mekânlar. **Her tasarım adımı Godot entegrasyonunu da içerir.** Önceki ayrı/son entegrasyon yaklaşımı güncellendi.
- `SovTaym Studios` araştırılmadı. Native splash öncesinde audio mümkün olmayabilir; tema ilk oyun kontrollü Godot yazılı sahnede başlar, scene geçişlerinde kesilmez. Mevcut main engine splash siyah; kullanıcı cihazındaki build doğrulanmadı. D-16 kullanım yönü tarif edildi, tema dosyası/cue ve uygulama açık.
- Yeni görsel, web/marka araştırması, referans kaldırma, Godot/runtime/backend veya deployment işlemi yapılmadı. Sonraki oturum güncel main'i ve promptu okuyarak başlamalı; mevcut hikâye ve teknik ekibin çalışmaları korunmalı. Narrative farkları ayrı terfi işi olarak açık kalır.
