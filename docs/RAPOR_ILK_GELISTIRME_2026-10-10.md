# İlk geliştirme raporu — 2026-10-10

Dal: `claude/unaware-demise-dev-24ly57` · PR: https://github.com/mucaeksi/unaware-of-my-demise/pull/36
Bu rapor yalnızca bu ortamda gerçekten çalıştırılıp gözlenen şeyleri "doğrulandı" olarak işaretler. Ayrıntılı, yaşayan durum: `docs/BUILD_STATE.md`.

## 1. Denetim özeti
- **Repo**: `main` 59 commit. Godot 4 + Neon/Hyperdrive tabanlı eski uygulama 08–09 Ekim'de `main`'den kaldırılmış; yalnızca Git geçmişinde (`25dc0b2`). `narrative/` (258 MB) kanon kaynağı olarak duruyor; hiçbir şey silinmedi/yeniden yazılmadı.
- **Narrative**: 20 oynanabilir karakter profili, 27 düşman tanımı, Bölüm I (7 bölüm × 5 savaş), 120 sn prolog, 3 bölümlük tutorial, savaş kuralları JSON'u. Ayrıntı: `docs/AUDIT_2026-10-10.md`.
- **Riskler**: (1) Cloudflare hesabında eski üretim Worker'ları + Hyperdrive→Neon hâlâ canlı (dokunulmadı; README "yalnız D1" diyor, kaldırma kararı sizde). (2) Görsel kanon uyuşmazlığı: onaylı chibi sayfalarda kızıl pelerin, kilitli karakter sayfasında koyu erik başlık. (3) Motor, etki dilbilgisinin yalnızca 3/20 karakteri ve 9/27 düşmanı tam destekliyor. (4) Tercih dosyanız Godot 4.7.2 diyor; README ve yönerge Phaser 4.2.1 diyor — proje README'yi izliyor.

## 2. Skill / MCP durumu (gerçek çağrılarla)
| Araç | Durum |
|---|---|
| Graphify | Çalışıyor (`graphify update .` → 5840 düğüm / 8731 kenar; MCP sorguları yanıt verdi). Anlamsal doküman çıkarımı API anahtarı gerektirir, çalıştırılmadı |
| Ponytail, Phaser skill'leri (28), UI/UX Pro Max, Cloudflare security-audit | Yüklü ve kullanıldı (kod incelemesi, Phaser 4 API doğrulaması, güvenlik denetimi, tasarım jetonları) |
| Chrome DevTools MCP | Orijinal yapılandırma çalışmıyordu (Chrome yok, root). `tools/mcp_chrome_devtools.sh` ile düzeltildi; stdio JSON-RPC ile doğrulandı (30 araç). Sonraki oturumda devreye girer |
| Context7 | **Kaldırıldı** (sahip kararı, 2026-10-11) |
| Cloudflare MCP / GitHub MCP | Çalışıyor (OAuth); D1/R2/Workers/Access okuma ve D1/R2 oluşturma doğrulandı |
| Gemini | Erişilebilir; **hiç ücretli üretim yapılmadı** |

## 3. Cloudflare ve Google erişimi
**Doğrulandı**: GitHub secret `CLOUDFLARE_API_TOKEN` çalışıyor — staging için D1 migration + seed, iki Worker dağıtımı ve health check bu token ile başarıyla koştu (Actions run 38081525826 ve 38082535422).

**Eksik / sizden gereken** (yalnızca adlar; değerleri sohbete yazmayın):
| Ad | Nerede | Neden |
|---|---|---|
| Cloudflare Access uygulaması (`uomd-admin-staging.muratcaneksiii.workers.dev`) → GitHub **variable** `ACCESS_AUD_STAGING` (Application Audience tag; gizli değil) | Zero Trust → Access → Applications; sonra GitHub → Settings → Variables | Kontrol Merkezi şu an **bilerek kapalı** (503). Erişim politikası **onayınız** gerektirir (güvenlik izni genişletmesi); önerim yalnızca sizin kimliğiniz. Mevcut eski admin uygulamasında "Cloudflare account members" politikası var. Not: Access uygulamasını Cloudflare MCP üzerinden oluşturabilecek yetkim olabilir ama sizin onayınız olmadan yapmadım |
| İlk owner → GitHub **variable** `ADMIN_BOOTSTRAP_OWNERS_STAGING` (e-posta) | GitHub Variables | Admin'e ilk girecek kimlik; deploy iş akışı `wrangler deploy --var` ile geçirir, repoya yazılmaz |
| ~~`CONTENT_SIGNING_KEY`~~ | **Tamamlandı** — Worker secret (staging) | İş akışındaki `signing-key` job'ı anahtarı üretip yalnızca secret'a yazdı (hiç yazdırılmadı); `signing_configured:true` doğrulandı; genel anahtar `content/keys/trusted_public_keys.json` içinde |
| `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` (GitHub secrets) + `ADMIN_URL_STAGING` (variable) | GitHub → Settings → Secrets/Variables; Access → Service auth | `publish-content.yml` ile CI'dan içerik yayını (isteğe bağlı) |
| `GOOGLE_CLIENT_IDS`, Play servis hesabı, RTDN, AdMob kimlikleri | Google Cloud / Play / AdMob konsolları | Android aşamasında (bu milestone'da gerekmedi) |
| Google üretim bütçesi | `content/budget/media_budget.json` + GCP bütçe uyarısı | Ücretli üretimden önce onayınız (varsayılan 0 USD, kod ile engelli) |
Ayrıntı ve ek açıklamalar: `docs/SECRETS_AND_PERMISSIONS.md`.

## 4. Teknik mimari
npm workspaces monoreposu (TS strict). `packages/`: `shared` (sha256, kanonik JSON, ES256, seed'li RNG, harcama koruması), `content-schema` (zod; kapalı etki dilbilgisi — veri yeni mekanik icat edemez), `combat` (narrative `battle_rules`'tan deterministik motor, sunucuda yeniden oynatma), `story` (bildirimsel hikâye VM'i), `patch` (imza/üretim numarası/uyumluluk/bütünlük/geri alma). `apps/game` (Phaser 4.2.1 WebGL, 1920×1080 FIT), `apps/api` (Workers + Hono; D1 STRICT + append-only tetikleyiciler; R2 içerik-adresli nesneler; Access JWT kodda doğrulanır; RBAC), `apps/admin` (React). İçerik yalnızca veri: imzalı (ES256) manifest, monoton üretim numarası, geri alma/kill switch = yeni, daha yüksek üretim. Ayrıntı: `docs/ARCHITECTURE.md`, `docs/PATCHING.md`, `docs/COMBAT_RULES.md`, `docs/DECISIONS.md`.

## 5. Uygulama değişiklikleri (başlıca dosyalar)
- Oyun: `apps/game/src/{scenes,battle,content,audio,ui,platform}/**`, `tools/build_content.ts` (narrative + Git geçmişindeki onaylı eski sanattan içerik; sağlama toplamlı `content/provenance.json`), `content/base`, `content/patches/rel_0002_road_forgotten`.
- Backend: `apps/api/{migrations,src,test,seed}/**` (2 migration, 20 karakter seed'i), `wrangler.{game,admin}.jsonc` (yalnız dev/staging; **production ortamı yok**).
- Kontrol Merkezi: `apps/admin/src/**` (panel, karakterler, varlık kataloğu, yamalar, audit).
- Test/CI: `tests/e2e/**` (Playwright; masaüstü + telefon yatay), `.github/workflows/{ci,deploy,publish-content}.yml`, `eslint.config.js`.
- Güvenlik: `docs/SECURITY_REVIEW_2026-10-10.md` (5 bulgu düzeltildi: admin CSRF, health bilgi sızıntısı, workflow girdi enjeksiyonu, yerel durum ignore, eski imzalı artefakt), harcama koruması `packages/shared/src/budget.ts` + `tools/media_budget.ts`.

## 6. Doğrulama kanıtı (gerçekten çalıştırıldı)
- `npm run lint` temiz, `npm run typecheck` 0 hata (8 workspace).
- **124 birim/Workers testi geçti**: api 38 (Miniflare D1/R2; eşzamanlı defter, idempotency, CSRF, auth fail-closed), game 3, combat 20, content-schema 31, patch 13, shared 14, story 5.
- **Playwright e2e (gerçek Chromium/WebGL)**: masaüstü 1280×720 ve telefon yatay 1200×540 dokunmatik — 9 geçti, 1 bilinçli atlandı. Gerçek giriş ile BEGIN → diyalog → savaş (2 elle tur + Auto ×2) → zafer (3 yıldız) → **sunucu yeniden oynatmayla hash eşleşmesi** → devam → hikâye → bölümler; canlı yama (`rel_0002`: yeni bölüm düğümü + uygulama derlemesinde olmayan düşman) indirilir/doğrulanır/uygulanır, yeniden yüklemede kalıcıdır, geri alınır; Kontrol Merkezi gerçek D1/R2'ye karşı.
- **PR #36 CI (head `51ef302`) tamamen yeşil**: `lint, typecheck, unit + Workers tests, builds` ✓; `içerik Git'tekiyle birebir yeniden üretiliyor` ✓; Playwright e2e ✓ (9 geçti / 1 bilinçli atlandı). Yeşile üç koşuda ulaşıldı; kırmızı koşuların ikisi de oyunda değil **test yardımcılarında**, yavaş CI GPU'sundaki zamanlama hatasıydı: (1) sunucu sonucunu okumadan önce sabit 2,5 sn bekleme → yoklama; (2) skill paneli için 15 sn bekleme dar kaldı — runner'da **15,1 sn, yerelde 2,9 sn** ölçüldü → 120 sn + süre logu.
- **Dağıtılmış staging (gerçek)**: oyun https://uomd-game-staging.muratcaneksiii.workers.dev — `/api/v1/health` `ok:true` (D1 2 migration, R2 ok), uzak D1'de 20 karakter; admin https://uomd-admin-staging.muratcaneksiii.workers.dev — veri uçları **503 (fail-closed)** `curl` ile doğrulandı. Dağıtılan URL'ye karşı tarayıcı duman testi: masaüstü geçti (WebGL, T-1 zafere kadar oynandı); telefon bir kez giriş-zamanlama yarışıyla düştü, düzeltildi; GitHub Actions'taki otomatik duman testi (deploy iş akışındaki `smoke` işi) iki viewport'ta da geçti.
- Ekran görüntüleri: `docs/evidence/*.webp`. Gizli bilgi taraması: anahtar/jeton izi yok. `npm audit`: 1 düşük (esbuild geliştirme sunucusu, yalnız Windows).

## 7. Sonraki adımlar
1. Access uygulaması + `ACCESS_AUD` + ilk owner için onayınız → ardından `CONTENT_SIGNING_KEY` ve `rel_0001`/`rel_0002` staging yayını; sonra sunucu doğrulaması "release not published" yerine "✓ replay matches" gösterir.
2. Eski Neon/Hyperdrive/Worker kaldırma planı kararı; görsel kanon (kızıl pelerin / erik başlık) kararı; Google üretim bütçesi.
3. Motor etki kapsamı (sersemletme/kalkan/DoT aileleri) → 3/20 karakterden genişletme; T-3 tutorial sahnesini veri yaması olarak staging kanalında yayınlama.
4. Android (Capacitor) iskeleti ve gerçek cihaz testi; Google girişi — bu milestone dışında.

## Ek — sahip kararlarının uygulanması (2026-10-11)
Sahip yönergeleri ve yapılanlar (her adım `main`'e itildi; ana dal = geliştirme dalı = uzak dal):
1. **Access yetkisi verildi → uygulandı.** `uomd-admin-staging` Cloudflare Access ile korunuyor (politika: hesap üyeleri = yalnızca sahip; oturum 24 sa); `ACCESS_AUD` yapılandırıldı; ilk owner satırı staging D1'e (repoda e-posta yok) denetim kaydıyla eklendi. Doğrulama: yetkisiz istek artık Cloudflare giriş sayfasına **302**. Gerçek tarayıcı girişi yalnız sizin tarafınızdan doğrulanabilir.
2. **Eski yığın kaldırıldı.** Silinenler: 2 eski Worker, Hyperdrive→Neon yapılandırması, boş R2 `unaware-of-my-demise-content`, eski Access uygulaması, iki sahipsiz Access politikası (biri tüm gmail.com adreslerine izin veriyordu). Doğrulama: hesapta 2 Worker (staging), 0 Hyperdrive, 1 Access uygulaması; eski workers.dev adresleri 404; staging sağlıklı. **Bilerek bırakılan:** R2 `uomd-db-backups` (tek şifreli Neon dökümü, 117 KB; kendi 30 günlük kuralıyla ~2026-11-04'te silinir). **Sizin yapmanız gerekenler:** Neon projesini silme/askıya alma, eski GitHub secret'ları (`DATABASE_URL`, `STAGING_DATABASE_URL`, `R2_BACKUP_*`, `BACKUP_AGE_RECIPIENT`), R2 yedek token'ı, olası Play RTDN aboneliği (ayrıntı: `docs/BUILD_STATE.md` §4).
3. **Görseller baştan, yalnız Google ile.** Kararlar README'ye işlendi. 195 eski görsel/ses (170 MB) `main`'den çıkarıldı (hepsi `archive/pre-cleanup-2026-10-10` dalında birebir; SHA-256'lı `narrative/ARCHIVE_MANIFEST.tsv`; geri yükleme: `narrative/ARCHIVE.md`). Referans seti: `reference/` (kilitli Fadyme sayfaları birebir + 22 adet 1536 px türev, ~10 MB). `narrative/` 210 MB → 40 MB; temiz klonda içerik derlemesi birebir aynı çıktı verdi. Üretim hattı hazır: `tools/gen_image.ts` (kuru çalıştırma varsayılan; gerçek çağrı bütçe ayrılmadan imkânsız — doğrulandı). Not: `content/base` içindeki sanat geçicidir; Google çıktıları onaylandıkça imzalı yama olarak değiştirilecek.
4. **Google bütçesi — hangi API'yi kontrol ettim?** Yalnızca Gemini API **model listesi** (`generativelanguage.googleapis.com/v1beta/models`, proxy'nin enjekte ettiği anahtarla; bugün yeniden: 62 model, görsel/Lyria/Veo modelleri var). Bu çağrı faturalama, bütçe veya harcama limiti hakkında **hiçbir şey söylemez**. Faturalama/Budgets API'leri API anahtarını reddediyor ve bu ortamda OAuth kimliği yok; repo, README, Git geçmişi (61 commit) ve Drive'da onaylı bir tutar **bulunamadı** (`media_budget.json` = 0 USD). Önceki Chirp denemeleri `gen-lang-client-0955955681` projesinde sahibin yetkisiyle yapılmış. **Lütfen** AI Studio → Spend/Billing ve Cloud Billing → Budgets'ta bu proje için tutarı kontrol edip bana tutarı + parti başı üst sınırı söyleyin; ben `content/budget/media_budget.json`'a işleyeyim ve Google tarafında da sert limit koyun.
5. **Context7 kaldırıldı** (MCP, skill, ZIP). Ücretsiz katman anahtarsız kota sınırlıydı ("monthly quota exceeded"). Bootstrap yeniden üretildi; `skills_doctor` PASS.
6. **Godot tamamen kaldırıldı.** 36 Godot dosyası + Godot kanıt klasörleri (~50 MB) + 10 üçüncü taraf "discipline" skill'i + ZIP'leri silindi; README/CLAUDE.md'deki çelişen kurallar değiştirildi. Doğrulama: ağaçta 0 Godot uzantılı dosya, skill'ler 46. Kalan 58 dosyada "Godot" sözcüğü yalnızca tarihî oturum notları/karar kayıtlarında (provenance gereği olduğu gibi bırakıldı, başlıklarında "SUPERSEDED" notu var). Eski Godot ağacı `archive/godot-era` dalında.
7. **Düzen:** her doğrulanmış adım `main`'e itiliyor; CI artık her `main` itişi için ayrı sonuç üretiyor (`cancel-in-progress` yalnız PR'larda); iki salt-okunur arşiv dalı var. Hesabınızdaki Claude Preferences hâlâ "Godot 4.7.2" diyor — lütfen güncelleyin.

