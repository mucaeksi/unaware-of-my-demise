# İki Etiket — görsel/ses ve sahne yönetimi

Metinler tamamlandı; medya üretimi yapılmadı. Mevcut onaylı karakter kimlikleri korunur. Tüm yeni generative medya README’deki Google hattından, ayrı bütçe/onay/üretim adımıyla gelir; bu paket harcama yapmadı.

## Görsel kimlik

Kül/pas dokulu lonca kâğıdı, deniz tuzu beyazı, solgun deniz yeşili ve Kera’nın kontrollü ember ışığı. Gothic-anime dili korunur. Event UI’si modern hastane arayüzüne, başka oyunun kart minigame’ine veya şenlik pazarına dönüşmez.

Etiket okunabilirliği önemlidir; süs yazısı gerçek seçim metnini zorlaştırmamalı. İki şişe arasındaki fark yalnız renk değil, metin/işaret ve yapanın adıyla anlaşılır. Ekranda gerçek ilaç dozu, gerçek formül ya da tüketilebilir tıbbi tarif verilmez.

## Mekânlar

| Location ID | Kadraj / sahne ihtiyacı | Kaynak veya yeni iş |
|---|---|---|
| `undercity_antidote_archive` | Masada üç kasa, temiz bez, etiket ve dar arşiv rafları | Mevcut canon mekân; event kadrajı gerekir |
| `tl_archive_yard` | Yıkılmış taşıma kapısı; açık 5v5 zemini | Yeni event alt-kadrajı |
| `tl_salt_fork` | Sol tarafta deniz yolu işareti, üstte eski yük yolu; bütün metin UI’da | Yeni event alt-mekân |
| `tl_coast_path` | Deniz duvarı, ağlar, eski basamaklar; düşman hattı okunur | Yeni event alt-mekân; iki rota savaşında paylaşılır |
| `tl_load_road` | Tuz depoları, devrik araba, yağmurdan koruyan duvar | Yeni event alt-mekân; iki rota savaşında paylaşılır |
| `salt_road_coast` | Canon kıyı/satıcı sahnelerinin geniş görünümü | Mevcut canon mekân; yeni medya gerekebilir |
| `tl_harbor_square` | Kuru bank, kapı ve görünür yol dönüşü; lantern hook | Yeni event alt-mekân |
| `tl_clinic_table` | Fırının yan odası; kuru masa, bench ve etiket yakın planı | Yeni event alt-mekân; NPC’ler portre zorunluluğu yaratmaz |
| `tl_harbor_lane` | Son teslimat sokağı; ilaç kasası combat zemininin dışında | Yeni event alt-mekân |

Bu **9 logical location** 9 tamamen farklı illüstrasyon zorunluluğu yaratmaz. Kıyı/square/lane tek ana harbor plate’inden uygun kompozisyonlarla türeyebilir; arşiv/yards ayrı katmanlarla paylaşılabilir. Sahneler netleştirilmeden raster üretim sayısı veya maliyet verilmez. Aynı üretim farklı location key’lerine bağlanacaksa art manifest bunu açık tanımlar.

## Portre ve NPC sunumu

- Kera: focused/composed, wry, defensive/annoyed, quiet; şapka ve goggles kimlik korunur. Fadyme’ye benzeyen yeni saç/kostüm yok.
- Tilda: focused, dry, quiet; hasta kaygısına sertlik değil, bakımın gerekliliğine açıklık.
- Iona: gentle/calm; soyut peygamberlik veya yeni saat büyüsü yok.
- Odelia: hesitant/quiet, serious/field certainty, small smile; açık kahkahadan çok küçük rahatlama.
- Mevcut üç canon sahnesindeki source emotion tag’leri aynen tutulur. Bütün tag’lerin runtime image mapping’i gerekirse aynı portreye fallback yapabilir; her tag için ayrı yeni çizim şart değil.
- Fırıncı/hasta/araba sürücüsü: event-scoped isim plakası ve sahne içi siluet/prop yeterli. `tl_baker`, `tl_patient`, `tl_carter` yeni kalıcı roster değildir.
- Ledger Agent’ın kaynak speaker ID’si korunur; yeni boss art’ı yok.

Story export’u iki portre slotuyla çalışır. Kera solda, diğer konuşan event karakteri sağda; önceki sağ portre gizlenerek değiştirilir. Branch girişinde slotlar temizlenir, böylece bir önceki konuşmacının portresi başka dalda kalmaz. Sahne kalabalığı için üç/dört portreli yeni UI primitive’i şart koşulmadı.

## Müzik ve ses

| Cue ID | Kullanım | Yönetim |
|---|---|---|
| `tl_work` | Arşiv, klinik, kısa ekip anları, dönüş | Alçak yaylılar, nefes alan kısa motif; komediye slapstick vurgu yok |
| `tl_threat` | Savaş öncesi açık tehdit | Aynı motifin ritmik basıncı; konuşmayı örtmez |
| `tl_market` | Mevcut iki etiket/satıcı sahnesi | Çatışmayı büyüten değil, konuşmaya alan veren düşük dinamik |

Müzik henüz üretilmedi. Cue ID’ler tasarım key’leridir; mevcut R2 dosyası iddiası yok. Loop start/duration gerçek export ölçülmeden doldurulmaz. SFX ihtiyaçları: kâğıt, kasa/şişe, yağmur, uzak deniz ve kapı; bu seslerin mevcut export story komutlarında yeni `sfx` op’u yok. İstenirse uygulamanın önceden desteklediği ortam ses sistemine bağlanır; indirilen yeni executable komut eklenmez.

[VO_LINE_LIST.csv](VO_LINE_LIST.csv) bütün İngilizce kaynak satırlarını, karakterleri ve voice track’leri içerir. Japonca metin alanı boş, recording status bütün satırlarda `not_recorded_in_this_package`. Çeviri, native editor, seçilen ses ve kayıt daha sonraki üretim adımıdır; mevcut kaydı varmış gibi işaretlenmedi.

## Kamera ve pacing

- Yalnız mevcut background/show/hide/music/fade/say/narrate/choice/checkpoint/end komutları export edildi.
- 0,35 sn sahneye giriş fade’i; konuşma esnasında otomatik shake/flash yok.
- Tehdit niyet paneliyle gösterilir, jumpscare’e veya okunamayan VFX’e dönüştürülmez.
- Vurgu: Odelia’nın durduğu basamak, Tilda’nın kuru bez katı, Iona’nın lantern sınırı ve Kera’nın etikette açtığı yer. Görüntü metne yeni canon eklemez.
- Medya çalışmıyorsa sessiz metin sunumu mümkün olabilir; bozuk/eksik görseli “başarılı sahne” diye tamamlayıp geçmek doğru olmaz. Teknik hata politikası uygulamada ayrıca ele alınır.

[Yapılandırılmış ihtiyaç listesi](authoring/media_requirements.json) scriptlerde kullanılan location, cue ve emotion key’lerinden üretildi. Asset’ler gelince semantic reference/hash/media kontrolü yapılmalı; mevcut doğrulama bu dosyaların gerçekten var olduğunu söylemez.
