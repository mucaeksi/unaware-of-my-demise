# KVKK m.9 — Yurt dışına kişisel veri aktarım haritası

> Durum: **taslak, hukuki inceleme için** (2026-10-05). Sahibin talimatı: Cloudflare, Google/AdMob/Play, veritabanı ve
> diğer yabancı sağlayıcılara hangi kişisel verilerin aktarıldığı haritalanacak; KVKK m.9 kapsamındaki uygun aktarım
> mekanizması belirlenecek; gerekiyorsa Kurul'un standart sözleşmesi sağlayıcıyla imzalanıp 5 iş günü içinde KVKK'ya
> bildirilecek. Bu belge haritayı ve mekanizma önerisini verir. **İmza ve bildirim kararı bir avukatla birlikte
> verilmelidir.**

Veri sorumlusu: Serpil Ekşi, Bahçelievler Mah. Emektar Sok. Taşkent Sitesi No:17 D:1, 59030 Süleymanpaşa/Tekirdağ.
İletişim: unawareofmydemise@gmail.com.

## 1. Temel tespit

- Kurul henüz hiçbir ülke için **yeterlilik kararı** ilan etmedi (m.9/1). Aktarımların hepsi yurt dışına gidiyor,
  Almanya'daki veritabanı dahil. Bu yüzden düzenli aktarımlar için **uygun güvence** (m.9/4) gerekir.
- Uygun güvenceler:
  - Kurul'un ilan ettiği **standart sözleşme**: imzadan sonra **5 iş günü içinde** Kurum'a bildirilir.
  - Bağlayıcı şirket kuralları.
  - Kurul izniyle yazılı taahhüt.
- **Arızi aktarım istisnaları** (m.9/6), açık rıza veya sözleşmenin ifası gibi, yalnızca **düzenli olmayan**
  aktarımlar içindir. Oyunun sunucu, veritabanı ve yedek akışları düzenli olduğundan bu istisnalara dayanılamaz.
- Standart sözleşme türleri (Yönetmelik, Temmuz 2024):
  - veri sorumlusundan veri sorumlusuna;
  - veri sorumlusundan veri işleyene;
  - veri işleyenden veri işleyene;
  - veri işleyenden veri sorumlusuna.
  
  Türkçe metin esastır ve imza şekline dikkat edilmelidir: Kurum, sıradan elektronik imzanın yeterli olmayabileceğini
  açıkladı.

## 2. Harita

| Sağlayıcı | Rol (tahmini) | Aktarılan kişisel veri | Nerede | Amaç | Önerilen mekanizma |
|---|---|---|---|---|---|
| **Cloudflare, Inc.** (Workers, Hyperdrive, R2, Access) | veri işleyen | her istekte IP adresi ve istek bilgisi (rate limit, log); oturum belirteci (sunucu hash'ler); oyun hesabına giden tüm istek içerikleri; R2'de şifreli yedekler (anahtar sahipte, okunamaz); içerik paketleri (kişisel veri yok); admin paneli için operatör e-postaları (Access) | küresel ağ, ABD şirketi | barındırma, güvenlik, yedek saklama | **SS: veri sorumlusu → veri işleyen.** Cloudflare'in Türkçe standart sözleşmeyi imzalayıp imzalamayacağı sorulmalı (DPA'sı AB SCC'lerine dayanıyor; KVKK sözleşmesinin yerini tutmaz) |
| **Neon** (Databricks, Inc.), AWS eu-central-1 | veri işleyen (alt işleyen: AWS) | veritabanındaki her şey: hesap kimliği, Google hesap bağlantısının SHA-256 özeti, takma ad, arkadaş kodu, ilerleme, envanter, ekonomi defteri, arkadaşlık/şikâyet kayıtları, satın alma token'ları, reklam ödül kayıtları, oturum hash'leri | Frankfurt, Almanya | veritabanı | **SS: veri sorumlusu → veri işleyen.** Neon'a sorulmalı |
| **Google LLC / Google Ireland** (Sign-In, Play Billing, Play Developer API, Pub/Sub, AdMob, UMP) | büyük ölçüde **bağımsız veri sorumlusu** (Google hesabı, ödeme, reklam); Pub/Sub ve Play API çağrılarında veri işleyen | giriş: Google kimlik token'ı (Google'dan gelir); satın alma token'ı ve hesap kimliği (`obfuscatedAccountId` olarak Play'e); reklam: AdMob'un cihazdan topladığı reklam kimliği, IP ve cihaz bilgisi, SSV'de rastgele hesap kimliği; Play bildirimleri (Pub/Sub) | küresel (ABD / İrlanda) | giriş, ödeme, reklam | Google'ın kendi kullanıcıdan topladığı veriler Google'ın sorumluluğunda. **Bizim gönderdiğimiz** (hesap kimliği Play/AdMob'a, Play API çağrıları) için **SS: veri sorumlusu → veri sorumlusu** (ve Pub/Sub için → veri işleyen) değerlendirilmeli. Google'ın Türkçe standart sözleşme sunup sunmadığı sorulmalı |
| **GitHub, Inc.** (Microsoft), Actions | veri işleyen | gecelik yedek ve restore provası sırasında çalıştırıcıda geçici olarak **şifresiz veritabanı dökümü** (çalıştırıcı silinir, artifact yapılmaz); izleme sorguları (kişisel veri dönmez) | ABD | yedekleme | **SS: veri sorumlusu → veri işleyen.** Alternatif: yedeği Cloudflare içinde (Worker cron) almak; o zaman GitHub aktarımı kalkar |
| **Google LLC** (Gmail, destek e-postası) | veri işleyen | destek yazışmaları, hesap kimliği | küresel | destek | **SS: veri sorumlusu → veri işleyen** veya Google Workspace'e geçiş değerlendirilmeli |

Oyun sunucusu hiçbir sağlayıcıya e-posta adresi, isim, fotoğraf, konum, rehber ya da ödeme kartı bilgisi göndermez;
bunları saklamaz da. Kaynak: `docs/legal/README.md` → kanıtlar.

## 3. Yapılacaklar (sırasıyla)

1. **Avukat görüşü:** her satırdaki rolün (sorumlu / işleyen) ve doğru standart sözleşme türünün teyidi; Google'ın
   doğrudan kullanıcıdan topladığı verinin bizim aktarımımız sayılıp sayılmadığı.
2. **Sağlayıcılara yazı:** Cloudflare, Neon, Google, GitHub. "KVKK m.9 kapsamında Kurul'un standart sözleşmesini
   (veri sorumlusundan veri işleyene) imzalar mısınız?"
3. İmzalanan her sözleşme **5 iş günü içinde** Kurum'a bildirilir (KEP veya Kurum'un bildirim modülü).
4. İmzalamayan sağlayıcı için seçenekler:
   - bağlayıcı şirket kuralları veya Kurul izinli taahhüt (sağlayıcıya bağlı);
   - aktarımı daraltmak, örneğin yedeği GitHub yerine Cloudflare içinde almak;
   - sağlayıcı değiştirmek.
   
   Açık rıza, düzenli aktarımlar için çözüm değildir.
5. Gizlilik Politikası'nın 4. bölümü, sonuca göre mekanizma adlarıyla güncellenir.
6. VERBİS: kayıt yükümlülüğünün istisna eşiklerinin altında kalınıp kalınmadığı kontrol edilir (çalışan sayısı ve
   bilanço). Ana faaliyet özel nitelikli veri işlemek değil.
