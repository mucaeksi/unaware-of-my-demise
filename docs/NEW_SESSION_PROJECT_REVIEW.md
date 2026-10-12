# Yeni Codex oturumu — kapsamlı proje incelemesi

Aşağıdaki promptu, `mucaeksi/unaware-of-my-demise` deposunu proje olarak açtığın yeni Codex oturumuna gönder. İnceleme güncel main üzerinden yapılır; bu metindeki geçmiş bilgiler yeni erişim/dağıtım kanıtı sayılmaz.

```text
mucaeksi/unaware-of-my-demise projesinde Codex ile Claude birlikte geliştirmeye devam edeceğiz. Güncel main'i kapsamlı incele; mevcut durumu ve yapılması gerekenleri Türkçe, somut kanıtlarla bana yaz. Sonra işleri benim seçimimle adım adım uygulayacağız.

İLK AŞAMA: İNCELEME VE ÖNCELİKLENDİRME
Bu aşamada yalnızca incele. Uygulama kodunu, Claude/Codex ayarlarını, belgeleri, anlatı kanonunu veya bulut verilerini değiştirme; commit/push/deploy, migration/seed, kaynak oluşturma, paket yükseltme, ücretli medya üretimi ve canlı oyuncu işlemi yapma. Gerekli yerel kontrolleri yalnızca uygun izolasyonla çalıştır; çıktıları scratch/disposable checkout'ta tut ve testlerin gerçekten yerel olduğundan emin ol. Önceden verilmiş normal geliştirme yetkisi bu ilk inceleme aşamasını uygulamaya dönüştürmez.

1. Depoya erişimi, git durumunu ve origin/main'in güncel commit'ini doğrula. Başkasının çalışma ağacına dokunma. README'yi tamamen oku; AGENTS.md, docs/CODEX_SKILLS.md ve ilgili skill'leri yükle. Claude'un .claude/, CLAUDE.md, .mcp.json ve bootstrap/lock düzenini koru. Araç/skill bildirimini çalışan bağlantı sayma; mevcut yetenekleri doğrula. Alt ajan başlatmadan incele.

2. README tek mühendislik ana kaynağı, narrative/ kanon kaynağıdır. Phaser 4, Android/Google Play önceliği, D1-only backend, tek ana para birimi eclipse_token, sunucu otoriteli ekonomi, Google-only onaylı üretim medyası ve imzalı veri yamaları kararlarını koru. docs/BUILD_STATE.md, DEV_TRACKER.json, INFRA_ROADMAP.md, GAME_FLOW.md, QA_ANDROID.md, MONITORING.md ve ilgili raporları güncel kodla karşılaştır. Tasarım/plan, yazılmış kod, çalıştırılmış test ve canlıda doğrulanmış davranışı ayrı değerlendir. Eski veya çelişen belgeyi güncel gerçek gibi sunma; karar gerektiren çelişkileri belirt, kanonu kendin değiştirme.

3. Şu alanları uçtan uca incele:
   - Mimari, bağımlılıklar, derleme/test düzeni, Claude-Codex eş zamanlı çalışma ve mevcut Cloudflare Workers Builds akışı.
   - Oyunun açılış/giriş/patch akışı; prolog, T-1/T-2/T-3, kayıt/devam/restart; anlatı-script uyumu, karakter/animasyon/UI/ses/i18n/erişilebilirlik.
   - 5v5 savaş, deterministik sunucu doğrulaması, karakter/takım/eşya/gelişim, gacha/pity, görev/mail/AFK/Auto/Sweep ve bunların ilk sürüm kapsamı.
   - Google kimliği, oturum/hesap kurtarma/silme; D1 şema/ledger/idempotency/eş zamanlılık; AdMob SSV/UMP ve Google Play Billing/abonelik/RTDN/refund/acknowledgement.
   - Admin paneli, Access/RBAC/audit, otomatik loglar, oyuncu ve ekonomi istatistikleri, tazelik/hata durumları, health/yedek/restore ve yayın sürümü görünürlüğü.
   - R2/imzalı data-only patch, bütçeli Google medya hattı, kaynak/provenance/lisans ve kısmi indirme/bozuk hash/rollback.
   - Gerçek Android AAB/native bridge/SDK hazırlığı, fiziksel cihaz ve Play sandbox kabulü, performans, gizlilik/Data Safety ve yayın engelleri.

4. Gerekli mevcut testleri ve kontrolleri kapsamlarına uygun değerlendir. Çalıştırdığın kontrolleri, sonucunu ve incelediğin commit'i yaz. Çalıştıramadığın cihaz/bulut/credential kontrolünü 'doğrulanamadı' diye belirt; geçmiş test sayılarını yeni başarı gibi sunma. Güvenlik incelemesini kaynak temelli sınırlı değerlendirme olarak tut; açık talep olmadan tam security-audit/pen-test süreci veya canlı saldırı denemesi başlatma. İlk bulguda durma; tüm kapsam için yeterli harita oluştur, derin incelemediğin alanları açıkça belirt.

5. Cloudflare erişimi varsa önce ilgili okuma yetkisini doğrula; kod sürümü ile canlı Worker version/tag'lerini karşılaştır. SSV, ödeme ve panel loglarını yalnızca güvenli reason/status/timestamp/Ray/version alanlarından incele. İmza/token/raw callback URL/kişisel veri paylaşma. Callback geçmişte https://uomd-game-staging.muratcaneksiii.workers.dev/api/v1/ads/ssv idi; adresi ve canlı durumu yeniden doğrula. Önceki oturumda foreign-unit AdMob doğrulama callback'i HTTP 200, granted:false, reason:ad_unit_not_ours olarak görülmüş ve otomatik panel logu doğrulanmıştı. Bunu yeni oturumdaki canlı durumun kanıtı sayma. Gereksiz doğrulama callback'i veya canlı ödeme isteği gönderme.

RAPOR VE SEÇİM
Önce kısa gerçek durum özeti ver. Her alanı 'çalışıyor / kısmi / eksik / doğrulanamadı' olarak gerekçelendir; dosya:satır, test veya güvenli canlı kanıt ekle. Doğrulanmış hata, kabul eksikliği, teknik borç ve tercihe bağlı iyileştirmeyi ayır; doğrulanmamış ihtimali kesin hata gibi sunma.

Yapılacakları numaralı bir tabloda sırala: ID, iş, neden/etki, öncelik (P0/P1/P2), bağımlılık, yaklaşık büyüklük (S/M/L), somut bitiş/kabul ölçütü, gereken erişim/cihaz/karar. Önce yayın/güvenlik/para/veri kaybı engellerini, sonra oyuncu deneyimi ve ekonomi/izleme önceliklerini ele al. Zaten tamamlanmış işlere tekrar görev açma. Büyük işleri bağımlılık sırasındaki küçük, tamamlanabilir adımlara böl.

En sonda önerdiğin ilk 3–5 işi ve başlamak için tek tavsiyeni belirt. Bana 'Hangi ID ile başlayalım?' diye sor ve uygulamaya geçmeden seçimimi bekle. Ben bir ID seçince yalnızca o işi ve zorunlu bağımlılıklarını ayrı çalışma dalında tamamla, uygun testlerle doğrula ve README'deki doğrulanmış-main politikasına göre teslim et. Seçilen iş için yetki yeterliyse rutin adımlarda tekrar izin isteme. Bitince sonucu, commit'i, gerçek testleri ve varsa canlı kanıtı yaz; sonraki iş için seçimimi bekle. Ek kapsam gerekirse nedenini açıklayıp seçmeme bırak.
```
