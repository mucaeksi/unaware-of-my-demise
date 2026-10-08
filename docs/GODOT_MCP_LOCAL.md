# Godot MCP — yerel kurulum

> **İptal edildi — 2026-10-06:** Kullanıcı isteğiyle NPGameDev MCP kaldırıldı ve resmî Godot AI 4.3.0 ile değiştirildi. Aşağıdaki kayıt tarihsel kurulum bilgisidir; aktif ayar veya devam noktası değildir. Güncel durum: [Godot AI yerel raporu](GODOT_AI_LOCAL.md) ve root `GODOT_AI_READY.md`. Eski addon ve köprü arşivlendi, `godot` sunucu kaydı kaldırıldı. Eski reconnect görevi geçersiz; yeni editor ve native Codex round-trip başarılı.

2026-10-06. Kullanıcı isteğiyle kuruldu. GitHub'a push yapılmadı.

## Kurulum

- Godot MCP Toolkit **1.0.3**: `game/addons/godot_mcp_toolkit/`. Mevcut 1.0.2 klasörü yedeklenerek yükseltildi.
- npm köprüsü **@npgamedev/godot-mcp-server 1.0.3**, sabit sürüm: `C:/Users/PC/AppData/Local/uomd-toolchain/godot-mcp-1.0.3/`.
- Codex sunucu adı: **godot**. Kullanıcı ayarı: `C:/Users/PC/.codex/config.toml`.
- Node executable doğrudan çağrılır; her bağlantıda npx ile yeniden indirme yapılmaz. Proje ve cwd: `F:/unaware-of-my-demise-main/game`.
- Başlangıç zaman aşımı 30 saniye; araç zaman aşımı 120 saniye. Düzenleme araçları kullanılabilir; READ_ONLY etkinleştirilmedi.
- WebSocket yalnızca `127.0.0.1` üzerinde. Proje keşfi, oturum token'ı ve eklentinin path guard kontrolleri korunur.

## Ayarlar

Arka planda editör yanıtlılığı açık; bekleme 16666 µs. Script/kayıt okuma sınırı 256 KB, WebSocket tamponu 4 MB. Yerel audit açık ve 2 MB ile sınırlı. Dosya taraması bekleme süresi 15 saniye. Ekran görüntüleri diske tam çözünürlükte kaydedilir; görüntüleme için bu dosyalar kullanılır.

UI işinde gerektiği kadar araç grubu yüklenir: editor_advanced, runtime_advanced, theme, resource_io, classdb ve LSP analiz araçları. Tüm grupları birden yüklemek gerekmez.

## Uyumluluk düzeltmesi

Projedeki `gdscript/warnings/untyped_declaration=2`, eklentinin dinamik Logger kodunda hataya dönüşen uyarılar çıkarıyordu. `logging/log_buffer.gd` içinde iki `buf` değişkeni Variant; Logger callback'in backtrace parametresi `Array[ScriptBacktrace]`; yaşam süresi referansı RefCounted olarak tiplendi. Genel proje tip kontrolü azaltılmadı.

Geliştirme kontrolü: `godot_console --headless --path game -s res://tools/validate_mcp_logger.gd`. Önce Parse error, düzeltmeden sonra OK görüldü. Loglar: `build/mcp-install/logger-before.log`, `logger-after.log`. Eklenti tekrar güncellenirse bu küçük uyumluluk düzeltmesini kontrol et.

## Doğrulama ve günlük kullanım

- MCP ile açık sahne ağacı ve proje ayarları okundu.
- Entry scriptleri derleme kontrolünü geçti.
- MCP `game_start` ile `res://scenes/art_review/entry_preview.tscn` çalıştırıldı; runtime bağlantısı hazır döndü.
- MCP ile Tap to start tıklanıp giriş ekranının tam çözünürlüklü görüntüsü alındı. Önizleme Google veya oyun sunucusuna istek göndermez.
- Editör hata konsolu sıfır hata döndürdü; son Title key art henüz tanımlı olmadığından pilot portre kullanıldığına dair asset uyarısı var.
- Android preset PCK envanterinde **0 MCP addon dosyası** var. Her iki preset eklentiyi açıkça exclude eder; export plugin geliştirme autoload'unu bake sırasında kaldırır. Doğrulama: `build/mcp-install/export-inventory.json`.

Codex'in bu sohbetin yerleşik araç listesini yenilemesi için Ayarlar → MCP sunucuları → godot → Restart kullanılabilir. Bu kurulumda bağlantı ve çalıştırma doğrudan MCP SDK istemcisiyle de doğrulandı.

**İş akışı:** Aynı proje için görünür editör açıkken ikinci `--editor` süreciyle headless export açmak ortak token dosyasını değiştirip registry kaydını silebiliyor. Headless export/derleme işlerini görünür editör kapalıyken çalıştır; ardından editörü aç ve playtest'i tekrar başlat. Bağlantı bu işlemden sonra AUTH_FAILED verirse sahneleri kaydedip editörü yeniden aç veya Project Settings → Plugins bölümünde toolkit'i kapatıp tekrar aç. Token'ı elle değiştirme veya kontrolleri kapatma.

## Son durum

Entry önizlemesi ayrı görünür oyun penceresinde tekrar çalıştırıldı. Durum seçicisi ekran geçişleriyle eşitlendi; gerçek runtime açılışında script hatası yok, yalnızca yukarıdaki pilot Title asset uyarısı var. Scripti doğrudan `--check-only --script` ile yüklemek Audio/Game autoload adlarını çözmediği için bu proje için uygun bir doğrulama değildir; gerçek proje runtime'ı kullanıldı.

Paket kontrolünün ardından GUI editörünün MCP kaydı kayboldu; daha önce başarılı olan editör bağlantısının son yenilemesi henüz tamamlanmadı. Editör kapatma isteğiyle açık kaldı. Windows Computer Use görüntüleme iki kez zaman aşımına uğradı (`FrameArrived timed out`, `window capture timed out`); kullanıcıdan Godot çıkış onayını kapatması istendi. Ardından görünür editör yeniden açılmalı ve MCP sahne okuma/game_start kontrolü tekrarlanmalı. Ayrı önizlemeyi de önce kapat; yeni editör token'ı eski runtime oturumuna uymaz.

Yeni ekran düzeni adımı kullanıcının kararıdır; bu çalışma Entry ile sınırlıdır.

Yedekler: `local-backups/godot-mcp-before-20261006/`, kullanıcı config yedeği `C:/Users/PC/.codex/config.before-godot-mcp-20261006.toml`.

Kaynaklar: [Toolkit](https://github.com/NPGameDev/godot-mcp-toolkit/tree/v1.0.3), [npm köprüsü](https://github.com/NPGameDev/godot-mcp-server/tree/v1.0.3), [Codex MCP ayarları](https://learn.chatgpt.com/docs/extend/mcp?surface=cli).
