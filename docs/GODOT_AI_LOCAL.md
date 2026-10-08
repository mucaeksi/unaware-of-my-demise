# Godot AI — yerel kurulum

## Güncel checkpoint — 2026-10-07

Geçerli Godot proje kökü `F:/unaware-of-my-demise/game`. `C:/Users/PC/.codex/config.toml` içindeki yalnız `mcp_servers.godot-ai.cwd` eski klasörden bu yola düzeltildi; byte karşılaştırması ilgisiz ayarların korunmasını doğruladı. Profil yedeği: `C:/Users/PC/.codex/config.before-entry-path-20261007-9b89e2c8.toml`. İptal edilmiş NPGameDev toolkit'in kalan `game/.mcp.json` kaydı temizlendi; resmî addon değiştirilmedi.

Resmî authenticated attach üzerinden MCP SDK ile mevcut editörde **60 başarılı çağrı** yapıldı; proje yolu/sürümler, Entry runtime, UI etkileşimleri, loglar ve screenshot'lar doğrulandı. Godot 4.7.2 / Godot AI 4.3.0; game/editor error 0. Mevcut 111 editor uyarısı ve eksik Title art uyarısı raporda kayıtlı. Son kontrolde Editor çalışmıyor. Bu sohbetin araç kataloğu yenilenirse normal Godot AI araçları kullanılabilir; fallback eski MCP sunucusunu çalıştırmadı.

Son tam GUT **395/395** ve doğrulanmış Android debug APK dahil güncel sonuçlar: [Entry audit raporu](F:/unaware-of-my-demise/docs/ui/production-v001/ENTRY_AUDIT_2026-10-07.md). Gerçek Android cihaz QA'sı bekliyor. Git deposu kapanışta mevcut (`main`, `b862576`); çok sayıdaki mevcut değişikliğe dokunulmadı, commit/push yapılmadı. Aşağıdaki yol/açık editor/PCK/Git ifadeleri tarihsel kurulum checkpoint'idir.

## Tarihsel kurulum checkpoint'i — 2026-10-06

2026-10-06. Kullanıcının onayıyla eski NPGameDev Godot MCP iptal edildi ve resmî **hi-godot/godot-ai 4.3.0** kuruldu. Çalışma yerel; kapsam Entry.

## Dağıtım doğrulaması

Resmî stable release `v4.3.0`, source commit `b82b5c519b1b17228f70d8effce1626f391bd1dd`. Canonical `godot-ai-v4-plugin.zip`, manifest ve detached signature kullanıldı. Repository source ZIP, Asset Library ve v3 migration paketi kullanılmadı.

Resmî `v4-release` doğrulayıcısı release kimliğini, RSA SHA256 imzasını, arşiv hash'ini ve tam dosya ağacını doğruladı. ZIP SHA256: `dbc3d16e1aa7a5f3ae8038a150bf4191162112f4329c79611aa6f656e3ca4e58`. Kurulu 313 dosyanın tamamı manifest ile aynı; eklenti kaynaklarına uyumluluk patch'i uygulanmadı.

## Ortam ve bağlantı

- Godot: 4.7.2 stable official; proje `F:/unaware-of-my-demise-main/game`.
- Plugin: `game/addons/godot_ai/plugin.cfg`; otomatik enabled.
- uv/uvx: resmî Astral kurucusu ile 0.12.23, `C:/Users/PC/.local/bin`. Sistem PATH'i değiştirilmedi.
- Codex CLI: 0.160.0; kullanıcı config'inde `godot-ai` sunucusu.
- Transport: authenticated STDIO `godot-ai attach`; kalıcı bare HTTP MCP kaydı yok.
- Plugin'in kendi Codex configurator'ü canlı editörde çağrılarak kesin launch komutu üretildi. Resmî Windows `pythonw` wrapper'ı, izole uvx çözümleyici parametreleri ve `godot-ai==4.3.0` pin'i korunuyor.
- Yerel backend 127.0.0.1:8000 / WebSocket 127.0.0.1:9500. Timeout: başlangıç 60 s, araç 360 s.
- Telemetry kapalı. Tool domain dışlama yok. Yalnız `godot-ai` kaydı için `default_tools_approval_mode="approve"`; kullanıcının otomatik yerel kurulum/geliştirme yetkisi doğrultusunda araç çağrıları kullanılabilir.
- Resmî kısa ömürlü yerel capability kaydına kullanıcı ayrıca izin verdi. Kimlik kaydı plugin tarafından AppData'da yönetilir; elle token/API key oluşturulmadı ve projeye secret yazılmadı.

## Gerçek doğrulamalar

| Kontrol | Sonuç / kanıt |
|---|---|
| İmzalı release ve exact tree | PASS — `build/godot-ai-install/verify.log` |
| Gerçek editor initialize/authentication | PASS — `editor-ready.log` |
| MCP SDK editor round-trip | PASS — `read-check-ready.log` |
| Native Codex MCP read-only round-trip | PASS — `codex-readonly-final-result.json`, `codex-readonly-final.log` |
| Entry runtime/helper | PASS — `runtime-start.log` |
| Title → Sign In, phase selector | PASS — `runtime-entry-final.log` |
| Runtime screenshot | `entry-title.png`, `entry-sign-in.png` |
| Export/PCK | PASS — `export-check.json` |

Native Codex testi live session, proje yolu, Godot/plugin sürümleri, current scene, hierarchy, Entry araması ve editör loglarını okudu. Bu test hiçbir oyun dosyasını değiştirmedi. Runtime testi `project_run(mode="custom", autosave=false)` ile `res://scenes/art_review/entry_preview.tscn` başlattı. UI fiziksel pencere boyutu 540×960; runtime control rect'leri 1080×1920 mantıksal ölçüde raporlanır. Mouse input pencere koordinatlarıyla gönderildi. Sign In ekranı ve üstteki phase selector eşleşti.

Read-only testte editör hatası 0. Runtime sonrasında editör kayıtlarında 111 proje uyarısı, hata 0; game logunda eksik `ui/title_key_art` uyarısı var. Entry pilot görsel kullanır. Mevcut kod uyarıları bu kurulumda değiştirilmedi. Native testin ilk denemeleri ve hata kayıtları tarihsel kanıt olarak tutuluyor; eski `codex-readonly-result.json` yerine **`codex-readonly-final-result.json`** güncel sonuçtur.

İki Android preset Godot AI dosyalarını dışlar; resmî export plugin geliştirme autoload'unu kaldırır. PCK içeriği 367 dosya, sıfır Godot AI/eski MCP dosyası ve sıfır MCP autoload'u. Bu APK/AAB veya cihaz testi değildir.

## Günlük kullanım ve devam

Bu açık sohbetin araç kataloğunda henüz Godot AI görünmüyor. **Codex → Ayarlar → MCP sunucuları → godot-ai → Restart** ile yenile; gerekirse Codex'i yeniden aç. Yeni native Codex istemcisi bağlanıp canlı testleri geçti. Godot ve Entry önizlemesi açık bırakıldı.

Canlı editör işlemlerinde Godot AI öncelikli. Karmaşık scene/theme düzenlemelerini uygun editör araçlarıyla yap; anlamlı değişiklikten sonra gerçek runtime, log ve gerekiyorsa screenshot kontrolü yap. Yalnız Entry üzerinde ilerle. Kullanıcı sonraki ekranı seçer. Üretim kaynaklarını değiştirme, GitHub'a push yapma.

## Eski MCP ve yedekler

Eski `godot` Codex kaydı, `godot_mcp_toolkit` plugin'i, MCPRuntimeServer autoload'u ve eski MCP ayarları kaldırıldı. Eski addon ve validator `local-backups/godot-mcp-canceled-20261006/` altında; köprü `C:/Users/PC/AppData/Local/uomd-toolchain/godot-mcp-1.0.3-canceled-20261006` olarak arşivlendi. Yeni bağlantı doğrulayıcısı bu arşivden yalnız genel MCP SDK kütüphanesini kullanır; eski sunucuyu çalıştırmaz.

Mevcut GUT/native plugin, tema, autoload'lar ve `gdscript/warnings/untyped_declaration=2` korundu. Kurulum configurator'ünü çağıran geçici yardımcı plugin kendini devre dışı bıraktı ve `local-backups/godot-ai-setup-20261006` altına taşındı. İmzalı addon'a ek dosya kalmadı.

Config yedekleri kullanıcı profilinde tutulur: `C:/Users/PC/.codex/config.before-godot-ai-20261006.toml` ve `config.before-godot-mcp-cancel-20261006.toml`. İçerikleri projeye kopyalanmadı. Mevcut ilgisiz ayarlar korundu; uygulamanın canlı `node_repl` oturum parametrelerine dokunulmadı. Geri alırken config'in tamamını körlemesine geri yükleme; yalnız ilgili sunucu bölümünü değiştir ve sonradan oluşmuş kullanıcı ayarlarını koru.

Bu çalışma dizininde `.git` bulunmuyor. Son `git status`, `git diff` ve `codex mcp list` çıktıları `build/godot-ai-install/` altında tutuldu.

## Kaynaklar

- [Resmî Godot AI 4.3.0 release](https://github.com/hi-godot/godot-ai/releases/tag/v4.3.0)
- [Resmî dağıtım ve doğrulama prosedürü](https://github.com/hi-godot/godot-ai/blob/b82b5c519b1b17228f70d8effce1626f391bd1dd/docs/packaging-distribution.md)
- [Resmî uv kurulum yöntemi](https://docs.astral.sh/uv/getting-started/installation/)
- [Codex MCP ayarları](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
- [Codex config referansı](https://learn.chatgpt.com/docs/config-file/config-reference)
