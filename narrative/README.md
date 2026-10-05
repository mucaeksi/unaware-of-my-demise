# Narrative — Unaware of My Demise

Hikâye, canon, karakter, sanat ve ses üretim kaynaklarının düzenli giriş alanı. **2026-10-05 / BATCH-0005:** seçili Google Drive Legacy kaynakları aktarıldı; runtime verileri ve kilitli referanslar korunur. Legacy orijinalleri değiştirilmedi.

| Alan | İçerik | Giriş |
|---|---|---|
| Canon | Canon ledger, kaynak önceliği, spoiler ilkeleri | [canon/](canon/README.md) |
| Hikâye | Story Bible, tam script, villain bible, bölüm/runtime indeksi | [story/](story/README.md) |
| Özgün JSON | 7 bölüm / 51 sıra / 419 ana hikâye satırı, companion/event/lore/VO | [content/](content/README.md) |
| Dünya lore | World rules, timeline, faction, history, location, karakter modelleri | [lore/](lore/README.md) |
| Karakter paketleri | 20 playable; kaynak lore, skill, companion, voice ve görsel bağlantıları | [characters/](characters/INDEX.md) |
| Sanat | Art Bible, stale costume uyarısı, plan, mevcut/pending sheetler | [art/](art/README.md) |
| Kilitli referanslar | Fadyme, logo/key art, orman ve pilot ikon; 26 dosya | [references/](references/README.md) |
| Ses / müzik | Fadyme JP script, 25 seçilmiş OGG, onaylı looplar ve sidecar'lar | [audio/](audio/README.md) |
| Promptlar | Onaylı reference promptları, sheet/asset/music/brand kaynakları | [prompts/](prompts/README.md) |
| Üretim araçları | 13 Legacy script; kaynak koruma, adaptasyon ve çalıştırma ayrı | [tools/](tools/README.md) |
| Teknik teslim | Özgün Narrative handoff | [docs/](docs/README.md) |
| Tasarım referansı | Legacy root GDD; güncel kararlar ayrıca geçerlidir | [design/](design/README.md) |
| UI taslakları | AFK Arena benzeri mobil gezinme + karanlık tema; DESIGN_DRAFT | [ui/](ui/README.md) |
| Tarihsel kopyalar | İki emekliye ayrılmış belge ve özgün archive açıklaması | [archive/](archive/README.md) |
| Aktarım / eksikler | Tam envanter kararları, hash, kaynak/runtime farkları | [migration/](migration/README.md) |

Mevcut oyun paketi [game/data/content/](../game/data/content/) içinde: 409 ana hikâye satırı, 76 companion parçası ve 220 karakter repliği. Özgün Narrative kaynağındaki 10 ek satır, 2 replik farkı, cue ve unlock ayrıntıları [karşılaştırmada](migration/RECONCILIATION.md); henüz runtime'a terfi edilmedi.

Her aktarım: Drive ID / gerçek kaynak yolu → hedef → eylem → dönüşüm → hash/boyut/Git blob doğrulaması → kaynak statüsü. [BATCH-0005 manifesti](../docs/migration/BATCH-0005.manifest.json) 558 Narrative envanter kaydı ve 1 supplemental GDD kaydını kapsar. 163 yeni dosya (~38,1 MB), 26 zaten kilitli dosya; geri kalan dosyalar gerekçeleriyle Drive'da kalır. `.secrets/` ve cache içerikleri açılmadı.

Source metni/embedded metadata değiştirilmez; wrapper indeksleri ayrı yazılır. `PENDING`, `DRAFT`, `APPROVED_WITH_ISSUE`, `SUPERSEDED` korunur. Dosyanın burada bulunması yaratıcı onay, active runtime/AAB/PCK veya yeni canon anlamına gelmez. [CLAUDE.md](../CLAUDE.md) ve [referans kilidi](references/REFERENCE_SET.lock.json) geçerlidir.
