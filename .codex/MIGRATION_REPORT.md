# Unified Skills & Agents — geçiş raporu

Tarih: 8 Ekim 2026. İşlem yerel yapıldı; GitHub'a push veya yayın yapılmadı.

| Ölçüm | Sonuç |
|---|---:|
| Bulunan SKILL.md | 98 |
| Kaynak dağılımı | .claude: 73; .agents: 24; .codex: 1 |
| Benzersiz mevcut yetenek | 90 |
| Birleştirilen aynı adlı, birebir aynı içerikli gruplar | 8 |
| Codex'e uyarlanan mevcut skill | 28 |
| Yeni sunum skill'i | 4 |
| Aktif skill | 32 |
| Sonraki aşamalar için korunan mevcut yetenek | 62 |
| Envanterlenen eski agent rolü | 40 |
| Gerçek Codex TOML subagent | 6 |
| İndekslenen doküman/workflow/kural/yardımcı kaynak | 239 |

Birleştirilen gruplar: art-bible, asset-audit, asset-spec, design-system,
team-polish, team-ui, uomd-asset-pipeline ve ux-review. İki kaynaktaki içerikler
aynıydı; kaynakların tamamı hash ve köken bilgisiyle korundu. Aktif proje skill'leri
`uomd-` ad alanında; ilk testte görülen 15 global/proje ad çakışması giderildi.

Yeni skill'ler: uomd-chibi-animation, uomd-cutscene, uomd-vfx ve
uomd-screen-presentation. Bunlar mevcut kaynaklarla sınırlı sunum iş akışlarıdır;
yeni hikâye kanonu, savaş AI, ekonomi, summon seçimi veya progression geliştirmez.
Mevcut uygulama kapsamı Entry'dir; sonraki ekranı sahibi seçer.

Altı subagent: art-director, ui-engineer, animation-artist, technical-artist,
asset-pipeline-specialist ve qa-reviewer. Her biri `name`, `description` ve
`developer_instructions` alanlarıyla bağımsız TOML tanımıdır. Model/effort ve
izin/MCP/plugin ayarları mevcut kullanıcı yapılandırmasından miras alınır.
Yeni Codex oturumu altısını da kullanılabilir agent olarak ilan etti.

```text
.agents/
  skills/                  -> yerel keşif bağlantısı: ../.codex/skills
  library/
    capabilities.json      90 yetenek, aktif/ertelenmiş eşleştirmesi
    capabilities/          birleştirilmiş kapsam ve kaynak kartları
    roles/                 40 standartlaştırılmış tarihsel rol kartı
    agent-role-map.md       altı işlevsel agent'in rol eşleştirmesi
    documentation-inventory.json
    migration-inventory.json
  archive/20261008/         doğrulanmış, çalıştırılmayan özgün kaynaklar
.codex/
  skills/                  32 kanonik aktif skill
  agents/                  6 TOML subagent
  standards/               görsel, UI, chibi, cutscene, VFX, pipeline, Godot, test
  workflows/               Entry UI, animasyon, audit, kalite, graph ve bakım
  references/              ilgili şablonlar ve ayrıntılı referanslar
  scripts/                 bootstrap, audit, sistem ve gerçek keşif doğrulaması
  validation/              kişisel yapılandırma içermeyen test sonuçları
  config.toml              ek override gerektirmeyen geçerli TOML
```

Aktif dosyalar yalnızca `.codex/` içinde düzenlenir. `.agents/library/` birleşimin
kapsam/köken/ertelenmiş yetenek kaynağıdır; arşiv eski araç çağrılarını tarihsel
veri olarak saklar. İkinci bir aktif skill kopyası tutulmaz. `.claude/` silinmedi
ve özgün içeriğinin hash'leri değişmedi. Eski komut klasörü mevcut değildi.

Eski skill/agent tanımları, tasarım şablonları, 13 kural, 10 script ve 14 hook
kaynağı arşivde korunur. Claude frontmatter alanları, model alias'ları, gömülü
shell ifadeleri, özel araç adları, otomatik ekran ilerletme ve rutin yazma-onay
döngüleri aktif skill'lerden çıkarıldı. Yerel çalışma, Entry kapsamı, gerçek
Compatibility renderer, kilitli referanslar ve mevcut test altyapısı geçerli
otorite olarak belirlendi; ayrıntılar `standards/authority.md` içinde.

Windows sembolik bağlantı denemesi WinError 1314 nedeniyle başarısız oldu.
Junction ayrı test deposunda ve gerçek depoda doğrulandı; Codex aynı skill'i
tek kez gördü. Junction Git ile taşınmaz. Bu yüzden `.agents/skills/` Git'te
ignore edilir; klonlama/taşıma sonrasında kanonik skill'lerden bağlantı kuran
`scripts/bootstrap_skills.ps1` kullanılır. Script, yetki varsa göreli symlink,
Windows'ta gerekirse junction oluşturur; dolu normal klasörü değiştirmez.
Taşınmış checkout'taki eski junction'ı güvenli biçimde düzeltmesi de test edildi.

Kullanılan biçimler resmi [skill keşfi](https://learn.chatgpt.com/docs/build-skills)
ve [özel subagent](https://learn.chatgpt.com/docs/agent-configuration/subagents)
dokümanlarıyla kontrol edildi. Eski Claude agent dosyaları doğrudan çalışır
sayılmadı. Projede config.toml yoktu; kullanıcı ayarlarını miras alan, yalnızca
açıklamalardan oluşan bir dosya oluşturuldu. Kişisel config/MCP/plugin ayarları
değiştirilmedi.

| Test | Sonuç |
|---|---|
| Geçiş öncesi ZIP yedeği ve dosya hash'leri | PASS; özgün kaynaklar özel yerel yedekte |
| Arşiv kaynağı bütünlüğü | PASS; 327 dosya doğrulandı |
| 32 SKILL.md frontmatter/name/description ve referans yolları | PASS |
| Aktif Claude araç/komut kalıntıları | PASS; bulunan eski yollar düzeltildi |
| 6 agent TOML ve config TOML | PASS |
| Yeni Codex app-server, strict-config, forceReload keşfi | PASS; 32/32 proje skill'i, 83 toplam, 0 mükerrer ad, 0 parse hatası |
| Gerçek geçici Codex oturumunda skill çağrısı | PASS; uomd-asset-audit ve uomd-screen-presentation |
| Gerçek oturumda custom agent ilanı | PASS; 6/6 tanım |
| Asset audit örneği | PASS; iki 512x512, 8-bit PNG, farklı hash'ler, 0 tekrar; kaynak hash/boyut eşleşmesi |
| Audit script hata/koruma davranışı | PASS; kesik PNG/IEND yokluğu, tekrar tespiti, kaynak koruma, rapor üzerine yazmayı reddetme |
| Bootstrap tekrarı, dolu klasör koruması, taşınma onarımı | PASS |
| Python script derleme | PASS |
| Paylaşılan kaynakta literal token/private-key taraması | PASS; eşleşme yok; kişisel Claude config taşınmadı |
| Godot AI canlı durum kontrolü | PASS; 4.7.2, mevcut Entry preview/runtime canlı |
| Graphify native update + Godot project helper | PASS; dış LLM API çağrısı yok; yön ve paralel ilişkiler korunuyor |
| Bundled skill-creator quick_validate.py | UNAVAILABLE; mevcut Python'larda PyYAML yok. Paket kurulmadı; gerçek Codex parser ve yerel validator geçti |

Keşif, bu sohbetin sabit başlangıç kataloğuna bakılarak varsayılmadı: yüklü
`codex-cli 0.162.0-alpha.2` ile yeni app-server ve ayrı geçici model oturumu
kullanıldı. Sahibinin masaüstü sohbeti/editor/game yeniden başlatılmadı.
Ham test çıktıları özel yerel yedekte; paylaşılabilir özetler `validation/` içinde.

Bu geçişin yazma işlemleri `.agents/`, `.codex/`, AGENTS.md ve `.gitignore` ile
sınırlıydı. Koruma kontrolü 8.352 başlangıç dosyasını karşılaştırırken eşzamanlı
çalışma alanı değişiklikleri gördü: altı oyun/test/tool kaynak dosyası ve 21 Android
build çıktısı. Bunlar geri alınmadı veya değiştirilmedi; bu nedenle çalışma
alanının tamamının başlangıçtan beri değişmediği iddia edilmez. Ayrıntılı yollar
`validation/preservation.json` içinde. Kaynak `.claude/` bütünlüğü doğrulandı.

Kalan uyumluluk sınırları: tarihsel hook'lar otomatik Codex hook'u olarak
etkinleştirilmedi. Önceden mevcut `.codex/hooks.json` ve yedeği, ilgili Graphify
kurulumunu korumak için değiştirilmedi; Bash matcher'ın bu sürümde çalıştığı
iddia edilmez. İlk native Graphify update geçti; son tekrarda araç, Godot ile
genişletilmiş haritayı daha dar native çıktısıyla değiştirmeyi shrink guard
nedeniyle reddetti. Güncel AST'den proje helper'ı başarıyla tam haritayı yeniden
kurdu: 30.230 düğüm, 58.228 ilişki, sıfır dangling endpoint; yön/paralel ilişkiler
korundu ve shrink override kullanılmadı. Graphify güncellemesinde mevcut Gradle dosyası için extractor
uyarısı ve yeni/taşınmış dokümanlar için semantic-review işaretleri var; bunlar
oyun parse hatası veya başarısız migration testi olarak yorumlanmadı. Yeni
dokümanların yapısal indekslenmesi, yeni LLM semantic onayı anlamına gelmez.

Geri dönüş: özel yedek `$CODEX_HOME/backups/uomd-unified-20261008/` altında
`originals.zip`, `baseline.json`, başlangıç Git durumu/diff'i ve rollback
talimatlarını içerir. Yedeği ortak depoya taşımayın; kişisel kaynak config içerir.
Geri dönüşten önce yeni kullanıcı değişikliklerini ayrıca koruyun. Oyuna veya
eşzamanlı çalışma değişikliklerine geri dönüş işlemi uygulanmaz.
