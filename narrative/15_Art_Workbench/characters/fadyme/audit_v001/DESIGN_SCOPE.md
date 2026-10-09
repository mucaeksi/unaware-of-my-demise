# Fadyme — üretime başlanacak tasarım paketi

Status: DESIGN_SCOPE_DRAFT. Character ID: `fadyme`. Yeni asset ID'leri veya creative approval icat edilmedi. Bu belge üretim grubunu tanımlar; bütçe/timing önerileri test edilmeden kesin motor sözleşmesi olmaz.

## Kimlik ve görsel dil

22 yaş yetişkin; Veil support-DPS, rear, free starter. Kontrollü mizahın altında acıyı saklar, kurtarılacak görev olmaktan çok yol arkadaşı olmak ister. Ash-blonde saç ve violet göz; deep plum hood, black dress, silver-lilac embroidery, ivory scarf. Üç belirteç ayrı ve görünür konumları doğru: hood alın kenarında kırık crown fragment, yüz yanında küçük bell hairpin, zincirde thorn-clapper silver bell. Silah ID `weapon_fadyme_signature` / The Hour Between Bells; çan yalnız büyüde çalar. Sunum yeni summon mekaniği veya farklı sınıf doğurmaz.

Kaynak sırası: özgün canon `narrative/06_Characters/Playable/fadyme.md` + güncel owner direction; tarihsel kilitli masterlar için `reference_resolution.json`; mevcut pilot ve üretim adayları için `narrative/FADYME_MEDIA_ALL/` manifestleri. Yeni pilotla kilitli r2 sheet farkları review konusu; hiçbir masterın üzerine yazılmaz. Lisans ve araç provenance mevcut kayıttan taşınır; bilinmeyen status NOT ASSESSED kalır.

## Grup 1 — VN ifade yönlendirmesi ve tutorial

Girdi: `current_lines.json` içindeki 241 ID; mevcut beş expression PNG. Teslim: her duygunun sahne bağlamına uygun ifadesi, gerçekten yeni yüz gereken ID listesi, açı/framing ve spoiler-state tablosu. 154 fallback satırı toplu olarak yeni görsel üretmek yerine bağlamla değerlendirilir. `warm`/`wry` doğrudan alias açığı ayrı teknik handofftur. Yeni karşılaşmada kibar mesafe, Mahmut'la yumuşak alay, kendi iç sesinde sessiz korku okunur; yüz/çan/elin kadrajı dialogue panelinde örtülmez.

Mevcut VN PNG: 1086×1448 RGBA; genel planned runtime spec: 640×960. Yeni türev ölçüsü sahne testinden sonra seçilir. Şeffaf arka plan; bake edilmiş metin/çerçeve yok. Kaynaklar ayrı sürümde korunur. Kabul: tutorialın altı before/after sahnesi, mahrem mektup açılışı ve finalden örneklerle doğru yüz; 540×960 native preview ve gerçek telefon ölçüsü ayrı kanıt.

## Grup 2 — chibi hareket ve savaş VFX

Girdi: v003 atlas 1774×887, manifestin sekiz crop'u ve ayrı 1254×1254 ultimate PNG; `battle_alpha.json` foot/pivot kanıtı. Facing right, sağlıklı baseline; hastalık spoilerı default sprite'a eklenmez. Teslim: sekiz durumun key pose/ara kare veya gerçek ayrılmış katman kaynakları, loop/anticipation/action/recovery planı, anchor/region metadata, kesilme/ölüm sonrası temizleme, Reduced Motion ve x1/x2/x3 sunum notları. Flattened PNG rig diye sunulmaz. Mevcut animasyon yöntemi pilotun procedural tweenidir.

| Stable skill ID | Görsel anlam | Tasarım teslimi |
|---|---|---|
| `fadyme_basic_veilglass_thorn` | Tek hedef Veil/Thorn, Dread hedefte Focus ilişkisi | Çandan başlayan yönlü okunur büyü, cast-release + hedef aksanı, glow/iz kaynakları |
| `fadyme_active_borrowed_hour` | Enemy damage/Dread + düşük HP ally heal | Düşman ve müttefik etkisini ayrı işaretleyen iki aksan; hedef/hp okunur |
| `fadyme_passive_a_smile_kept` | Düşük HP koşulunda ally Veil resistance | Sürekli tüm ekran aurası yerine kısa destek işareti; illness sprite varyantıyla karışmaz |
| `fadyme_ultimate_the_bell_that_forgets` | All-enemy Dread/damage, ally cleanse + koşullu heal | Çan/cutin, düşman alan aksanı ve destek çözülmesi; ayrı VFX katmanları ve UI güvenli alan |

Format: şeffaf PNG sprite/VFX kaynakları veya açıkça ayrı katmanlar; renderer GL Compatibility. Event/timing gerçek replay sözleşmesinden gelir; yeni combat multiplier/cooldown eklenmez. Particle cap, overdraw ve texture budget cihazda ölçülene kadar UNMEASURED. Shader/scene entegrasyonu Claude'un işi.

## Grup 3 — ses ve müzik yönlendirmesi

Girdi: 201 mevcut JP draft satırı + 40 tutorial English satırı; Sulafat casting ve kilitli 11 satırlık referans; 25 mevcut seçilmiş OGG. Teslim: 40 tutorialın gözden geçirilmiş JP çevirisi ve sahne grupları; mevcut seçimlerde dinleme kontrolü; 216 eksik kaydın ID korunarak küçük onaylı gruplarla üretimi; duration/take/source/hash metadata. `fadyme_thought` iç ses kimliğini korur. Runtime hedef `assets/audio/voice/<speaker_id>/<line_id>.ogg`.

Google API adımları kullanıcıyla birlikte; bu belge paid call veya batch başlatmaz. Kullanılacak model/config mevcut canonical kayıttan ve gerçek API availability'den teyit edilir, model adını belgeye yazmak erişilebilirlik kanıtı değildir. Mevcut Sulafat kimliği/tema yeniden üretilmez. Fadyme loop'un sahne/cue ataması, loop offset ve seviyeleri test edilir; main theme kullanıcının ayrı kaydıdır. Bell/thorn, cast, hit, Dread/heal/cleanse SFX için yalnız yön/cue planı hazırlanır; burada yeni müzik/ses promptu uydurulmadı.

## Grup 4 — hikâye halleri ve sinematik kaynakları

Girdi: `scene_requirements.json`, canon ve gerçek stage/unlock. Teslim: default, kanı gizleme, 5-4 sonrası bone-white lock ve final lanet/itiraf için yüz/el/saç/atkı katmanları; mektup, dua kitabı ve anne portrait/pin props; sahne/shot planı ve ilgili çevre/karakter dependency listesi. Story-state assetlerinin unlock eşiği gerçek script/karardan alınır. Muharebe baseline'ı ve varsayılan UI aynı kalır. Yeni lore veya Part II reveal icat edilmez.

Sinematik katmanları: karakter/prop/foreground/background ayrı kaynaklar mümkün olduğunda; kameranın güvenli hareket alanı, kadraj ve metin bölgesi kaydedilir. Baked subtitle/UI/logo yok. Finalin yalnızlık/itiraf tonunu genel ultimate power shot ile aynı kompozisyona indirgemeyiz.

## Grup 5 — UI portreleri, weapon/skill işaretleri

Girdi: UI portrait kaynak manifestinde MenuAvatar 256², BattleHUD 512², Roster 512², CompanionCard 768×1024; bunlar `runtime_candidate`. Runtime profile 1254² ve existing Entry portrait ayrıca var. Teslim: seçilen ekranın layoutuna göre doğru crop ve readability; yapışık frame/rarity/text yok; mevcut character/weapon/skill mark ID'leriyle yeni sürüm kaynakları. Candidate kontrolü ve explicit handoff sonrası Claude bağlar. Kaynakta dosya varsa yeniden üretilmesi şart değil.

## Handoff kabulü

Her üretim grubunda mevcut stable ID, sürüm, kaynak hashleri, gerçek araç/model/prompt, generation zamanı, lisans, candidate/approval durumu, dimensions/alpha/facing/pivot/atlas region, kullanılan scene/line/state, runtime destination, base-AAB/patch/reference-only kararı bulunur. Source master + export türev ayrıdır. Mevcut byte-exact locked master korunur. Import/native görünüş, mobile readability, performans ve ses dinleme kontrolü ayrı kanıtlardır. Kod/server/economy/summon/AI ve release işi bu tasarım paketinin parçası değildir.
