# Admin Panel

Adres (production örneği): `https://api.yourgame.com` API + ayrı host üzerinde `/` admin. İstersen admin panelini aynı Next.js uygulamasında `https://admin.yourgame.com` veya `https://yourgame.com/admin` olarak yayınlayabilirsin.

## Modüller

- Dashboard: oyuncu sayısı, aktif banner, 5★ catalog sayısı, günlük draw.
- Oyuncular: email/ad arama, cüzdan görünümü, inventory adedi.
- Grant: test/kompansasyon için soft/premium currency ekleme.
- Karakterler / Itemler: catalog kaydı oluşturma.
- Gacha Bannerları: banner oluşturma, aktif/pasif etme, maliyet ve pity parametreleri.
- Banner Pool / Oranlar: item pool, rarity, weight, featured yönetimi.
- Çekiliş Geçmişi: son 100 çekiliş, player/banner/request bilgisi.
- Patch / Content: content manifest ve sürüm görünümü.
- Audit Log: admin işlemlerini izleme.

## Production öncesi yapılması gerekenler

Starter'daki `ADMIN_API_TOKEN` mekanizması basit kurulum içindir. Public production için RBAC + MFA + session/cookie auth, CSRF koruması, rate limiting, IP/role audit ve admin kullanıcı tablosu eklenmelidir.
