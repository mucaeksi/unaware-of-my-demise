# Unaware of My Demise — dünya, hikâye ve karakter tasarım brief’i

Tarih: **2026-10-05**. Durum: **SOURCE_REVIEW_COMPLETE / DESIGN_BRIEF**, final artwork onayı değildir. İncelenen yerel commit: `d5c5cadd2357a5c97aab0b2aac52977151f602bd`, branch: `work`. Ardından yapılan gerçek `git fetch origin main`, inceleme baseline’ının uzak main ile aynı olduğunu doğruladı.

**İç kullanım: Part I’nin tamamı ve kayıtlı Part II sırları aşağıda bulunur. Bu metin oyun ekranlarına veya mağaza açıklamasına doğrudan aktarılmaz.**

Kullanıcının bu oturumdaki talimatı: yeni Gothic/anime referansını hikâyeye göre geliştirebiliriz; çizimden önce dünyaya, ana hikâyeye ve bütün karakterlere hâkim olmalıyız. Bu yüzden [yeniden başlangıç sırasına](CREATIVE_RESTART_PROMPT.md) önce kapsamlı kaynak okuması eklendi. Bu belge mevcut canon’ı özetler, tasarım sonuçlarını öneri olarak ayırır; kaynaklarda açık olan gizemlere cevap üretmez.

## 1. Okuma kapsamı ve kaynak önceliği

[Story Bible](../story/STORY_BIBLE_PART1.md), [Villain Bible](../story/VILLAIN_BIBLE_PART1.md), [tam script ve bütün ekleri](../story/PART1_FULL_SCRIPT.md), [canon ledger](../canon/canon.md), dünya kuralları, timeline, glossary, tarih, faction/mekân/bestiary kaynakları ve 20 karakterin lore modelleri okundu. Voice/visual matrix, karakter paketlerinin statü notları, Art Bible, Costume Guide, marka rehberi ve character/location brief’leri karşılaştırıldı. Sable/Vespera sheet prompt’ları C42 ile karşılaştırıldı; geçmiş üretim araçları çalıştırılmadı.

Kaynak JSON’ların metinleri, baştan sona okunmuş tam script ile programatik olarak karşılaştırıldı. Apostrof, Unicode ve boşluk normalizasyonundan sonra bütün **1.072 metin kaydı** okuma kopyasında bulundu. Bu kontrol bir metnin varlığını doğrular; ID/sıra eşitliği veya her metadata alanının eşitliği iddiası değildir.

| Kapsam | Doğrulanan sayı | Kaynak |
|---|---:|---|
| Ana hikâye | 7 bölüm, 51 sıra, 419 benzersiz line_id | [bölüm JSON’ları](../content/README.md) |
| Oynanabilir karakter | 20 | [karakter paketleri](../characters/INDEX.md) |
| Companion hikâyeleri | 76 parça, 388 line_id | [character_stories_part1.json](../content/character_stories_part1.json) |
| Event hikâyeleri | 4 event, 12 sahne, 45 line_id | [events_part1.json](../content/events_part1.json) |
| Karakter VO kataloğu | 220 line_id | [character_voice_lines_part1.json](../content/character_voice_lines_part1.json) |
| Kullanılan mekân kimlikleri | 44 | [location registry](../lore/locations/registry.md) |

Dosya hash’leri, okuma yöntemi ve sayı/fark sonuçları [SOURCE_REVIEW_2026-10-05.json](SOURCE_REVIEW_2026-10-05.json) içinde. İnceleme depoya aktarılmış seçili kaynaklar üzerindedir; Drive’da bırakılan 300 dosyanın bu oturumda okunduğu iddia edilmez.

Karar önceliği: **son kullanıcı talimatı → onaylı canon kararları ve satır kaynakları → dünya/karakter modelleri → bu modellerle tutarlı görsel brief’ler → türev kataloglar**. Eski görsel pack ve Gemini görsel zorunluluğu yeni üretimi yönetmez. Hikâye/yaş/akrabalık/özgün nesneler sanat yenilemesiyle kendiliğinden değişmez. Runtime içerik kaynağı `game/data/content/`; Narrative snapshot’ı bunun üzerine otomatik yazılmaz.

## 2. Dünyanın temeli: Veyrhold

Veyrhold, eski çan muhafızı **House Veyr** adını taşıyan feodal krallıktır. Kraliyet hanedanı **House Carrow**’dur. Veyr’in çan soyu anneden kıza geçer; aynı evin erkek üyeleri bu soyun Ledger kefili değildir. Fadyme’nin kraliyet varisliği babası King Audren’den, çan soyundaki yeri annesinden gelir.

Gündelik dünya taş, demir, deri, yün, eski kâğıt, cam ve mum ışığıyla kurulur. Halk zamanı yakındaki çanlarla sayar; kapılara, ağaçlara ve yol kayıtlarına isim yazar. İsmin kayıttan silinmesi malını kaybetmekten daha korkutucudur. Kayıtlı ailesi olmayan yol çocuklarına **Vale** yazılır; Nixie ve Yseldra’nın aynı soyadını taşıması akrabalık değildir.

**Law of Hours**, dünyanın neden böyle göründüğünü açıklar:

1. Hayatın saatleri gerçek bir cevherdir; sayılır, verilir, alınır veya borç olur.
2. Yedi çan tek **Ledger**’ın yedi hesabıdır. Çanlar iyileştirmez; sayar ve tahsil eder. Ses için tokmağa ihtiyaç duymazlar.
3. İsim, saatin tanığıdır. İsmiyle hatırlanan ölüm kapanır; tanıksız kalan ölüm **Hollow** bırakır. İsim silmek daha çok Hollow üretir.
4. Çan yalnız bronz gövde değildir: Ledger’daki yeri, adı ve hesabıdır. Yeniden dökülen çan ve kırık parça da saymaya devam eder.
5. Krallık borcunu ödeyemediğinde Crown, çan soyundan bir kadını **Last Bell** olarak mühürler. Yedi çan sayar; yaşayan taşıyıcı öder.
6. Uzaklık tahsilatı yavaşlatır, durdurmaz. Fadyme’nin yıllarca saklanarak yaşayabilmesi ve çanlara yaklaştığı yolun tehlikesi buradan gelir.
7. İsmini yeniden yazmak ve her gün tanıklık etmek ödeme anını erteler; borcu ve hastalığı iyileştirmez.
8. Saat transferi **rıza ve tanık** gerektirir. Cael’in Mahmut’a bir teklif yapması bu nedenle gereklidir.
9. Cael’in Ledger’dan çıkardığı **Unwritten Hour**, Crownfall öncesindeki son kaydedilmemiş saattir. O saatin içindeki olaylar bilinmez; kaydedilmiş zamandan çıkan kişinin adı/yüzü hafızadan kayar. Onun yazısını elinde tutan kişi onu tanıyabilir.
10. Bir Inquisitor’ın çağrı çanı seçtiği taşıyıcıya bağlı kalır. Yseldra’nın kırmızı iple bağladığı tokmak sesi durduramaz.

Tam 11 kuralın kaynağı [world_rules.md](../lore/world_rules.md). Yukarıdaki özet aynı kuralları gruplayarak anlatır.

**Tasarım sonucu (öneri):** dünya yalnız yıkık katedrallerden oluşmamalı. Kayıt tahtası, silinmiş isim, boş mühür yuvası, tamir izi, mum ve paylaşılan yemek gibi gündelik nesneler de aynı ağırlığı taşımalı. Küçük sıcak ışıklar ve yaşayan yerleşimler, dünyanın kaybını ve korunmaya değer tarafını görünür kılar.

## 3. Tarih, kurumlar ve karşıtlıklar

**Crownfall altı yıl önce oldu.** Silent Bell en az on beş yıldır suskun; daha önce yedi taşıyıcı harcandı. Fadyme’nin annesi Ashen estate’te saklandı; Fadyme orada doğdu. Annesi öldüğünde yedi yaşındaydı; Audren onu gizlice tanıdı ve korunan av köşkünde büyüttü. On üçünde saraya getirildi; Mahmut on dokuz yaşında onun muhafızı oldu. Crownfall’da Fadyme on altı, Mahmut yirmi iki yaşındaydı.

Emir zinciri: Audren’in ölümünden sonra Cael, Inquisition mührüyle taşıyıcının mühürlenmesini ve sonra First Eclipse Altar’a teslimini emretti. Yseldra Fadyme’yi **başkentte Silent Bell’in altındaki çan sunağında** mühürledi; ikinci emri Oren’e taşıdı; Oren imzaladı; Mahmut teslim emrine karşı çıkıp Fadyme’yle kaçtı. Kaçışta ayrıldılar; dört yıl sonra yeniden buluştular. Başkentteki mühürleme sunağı ile Part I sonunda ulaşılan First Eclipse Altar aynı yer değildir.

| Kurum | Hikâyedeki işlev | Görsel kimlik / dikkat |
|---|---|---|
| Council of Dukes | Yedi evin Crownfall sonrası ateşkesi; taht boş kalsın diye isimleri siler ve Oren’i finanse eder | Tek kordonda **kesilmemiş yedi mühür**; dük adları açık |
| Royal Inquisition | Çan ayinleri ve mühürlü kayıtlar; Crownfall sonrası parçalanmış kurum | **Yedi çentikli gri balmumu**; Yseldra’nın ayrı yarım maskesi |
| Crown Guard remnant | Eski emirleri onur sayan askerler; Oren’in takibi | Crown arması; Mahmut’ta yıldız kalır, üstündeki taç sökülmüştür |
| Saint Luthos | Yol kayıtları, ibadet ve halkın bakımı; kurbanları teşekkür kaydına saklayan kurum | Çanın içindeki mum; Aveline ile bakım, kayıt ve kurum çatışması |
| Red Vial Guild | Archive kanadı tıp; ledger kanadı insanları malzeme ve hesap olarak kullanır | Kırmızı cam şişe; Kera’yı Matron’la aynı ahlaki tarafta göstermemeli |
| First Eclipse Cult | Tutulmayı korur, zincirleri ve sunak düzenini besler | Yedi zincirin tuttuğu siyah güneş; kült inancı ile dünya gerçeğini ayır |
| House Veyr | Çanların kefil evi; neredeyse tükenmiş anne-kız soyu | Küçük gümüş çan biçimli **saç tokası** |
| Clockless Court | Cael’in kayıtlı zaman dışındaki sarayı; Part II hedefi | Konumu ve üyeleri açık; bu inceleme bir mekân tasarımı icat etmez |

Kaynaklar: [faction registry](../lore/factions/_registry.md), [Crownfall](../lore/history/crownfall.md), [timeline](../lore/timeline.md).

## 4. Ana hikâyenin duygusal omurgası

Part I, **Unaware, I Fade**: Fadyme baştan beri ölmekte olduğunu bilir; bunu saklar. Mahmut mührün tehlikeli olduğunu bilir fakat onu zaten öldürdüğünü anlamaz; makineyi kırınca çözüm bulacağına inanır. Oyuncu Fadyme’nin iç sesleri sayesinde daha fazlasını görür. Başlıktaki körlük öncelikle Mahmut’un bilmeyişidir; Fadyme’yi kendi durumundan habersiz çizmek hikâyeyi yanlış anlatır (C41).

Fadyme’nin başlangıç amacı, saklanırken köylerin ödediğine inandığı borcu sunakta kendi seçimiyle kapatmaktır. Bunu bir iyileşme yolculuğu gibi sunar. **7-3’te sunulmak yerine tanıklık edilmesini ister; 7-5’te yaşayanların ödemesini reddeder.** Onu her görselde kaderine teslim olmuş, yalnız ağlayan bir kurban olarak göstermek bu dönüşümü kaybettirir. İnce mizah, nezaket, küçük sevinçler ve başka insanları kurtarma iradesi ana ifadelerdir.

Mahmut’un sorunu zekâ eksikliği değildir: gerçekçi açıklamalara, saklanan kayıtlara ve Fadyme’nin ona verdiği umuda inanır. Koruma anlayışı, gerçeği saklayıp onun adına karar vermeye dönüşür. Yseldra bu eğilimin daha sert aynasıdır. Fadyme kendi geleceğini verirken Cael zamanı kendi geçmişine geri çekmek ister.

| Bölüm | Hikâye dönüşü | Çizim için gerekli somut öğeler |
|---|---|---|
| Açılış / 1 — Whispering Ash Forest | Özel mektup, ilk Yseldra karşılaşması; iki kişinin karşılıklı saklayışı; ilk yol yoldaşları | İsim kazınmış ağaçlar, yağmur, kömür/kül yaprakları, bakılan yol tapınağı, Mahmut’un kalkanındaki gri mühür |
| 2 — Saint Luthos | Koruyucu ayinin bedeli ve silinen kayıt; Mahmut’un Yseldra’yı bildiği açığa çıkar | Halatsız çan, su basmış nef, kırık gül pencere, kesilmiş kayıt satırı, Yseldra’nın kesilmiş mühürleri |
| 3 — Oakhaven | Köyün isimleri ve canlı hayatı korunur; Fadyme kanı saklar; Jori katılır; C.V. izi | Meyveli çıplak elma ağaçları, boş isim tahtaları, kuyu, beyaz çamaşır/atkı, ocak, şarkı ve han |
| 4 — Undercity | Fadyme’ye özel süre tahmini; eksik iksir ve insan üzerine yazılmış tarif | Glassford altındaki sarnıç, yosun/mantar ışığı, bir temiz masa, kırmızı cam, kıyı düğümlü tebeşir okları |
| 5 — Bridge of the Forsaken | Mahmut’un eski kumandanı ve imzaladığı emir; Fadyme’nin beyaz tutamı | Sisli taş açıklık, kuşatma vinçleri, sinyal kulesi, kesilen çan ipi, ters Crown rengi, geçiş yapan siviller |
| 6 — Ashen estate | Anne portresi, Mirel’in suç ortaklığı, yıkılan arşiv ve kurtarılan tek sayfa | İsimsiz portreler, ayrı cam konservatuvar, akrepsiz/yelkovansız saat resmi, taş kemer altındaki çocuk, hizmetli geçidi |
| 7 — First Eclipse Altar | İsmin geri yazılması; makine düşse de borç sürer; itiraf, sonra Cael | Taç biçimli krater, yedi zincir, yuvarlak arşiv, üç pylon, siyah taş yansıması, ince kızıl tutulma halkası |

Part I yaklaşık üç haftadır; rota günleri [part1_route.md](../lore/locations/part1_route.md) ve script ile belirlenir. Bütün yoldaşlar sürekli yirmi kişilik bir kafile oluşturmaz: sivil tahliyesi, klinik, arşiv ve kendi işleri için ayrılıp yeniden gelirler.

**Final iki ayrı vuruştur:** Eclipse Construct savaşı → mahrem ve ilk konuşmasında müziksiz itiraf → sessizlik → Cael’in yansıma üzerinden teklifi. Cael Part I savaş boss’u değildir. Fadyme iyileşmez. Mirel’in yazdığı isim, Clem’in günlük kaydı ve Iona’nın gecelik okuması süreyi erteleyen gerçek tanıklıktır; yalnız teselli değildir.

**Part II için kayıtlı sır:** Cael’in kamuya anlattığı hedef Crownfall öncesine dönüş; gerçek gizli hedefi iki yıl daha önce kaybettiği Liora ve Aren’e ulaşmaktır. Fadyme’nin başlangıçta yazdığı mektup artık yolun sonunda değişen isteğiyle aynı durumda değildir; Mahmut’u yeminden serbest bırakır, başkasının saatlerini ödememesini ister, kralın son sayfasını içerir. Bu sırlar title/giriş görsellerine taşınmaz.

## 5. Mekân, çan ve düşman ayrımı

Yedi bölüm, yedi ayrı çan mekânı demek değildir. **Ashen estate’te çan yoktur; Schedule vardır. Silent Bell başkent Carrowgate’tedir ve Part I’de ziyaret edilmez.** Glass Bell, Glassford altındaki en aşağı sarnıçtadır. Whispering / Ropeless / Harvest / Glass / Forsaken / Silent / Eclipse ayrı tarih ve nesne kimlikleri taşır; Pippa’nın charm’ı Silent Bell parçasıdır.

[Location registry](../lore/locations/registry.md) 44 kullanılan ID içerir. Yedi hub, alt mekânları ve altı yan yol aynı resme indirgenmez. [Location brief’leri](../prompts/asset_pipeline/location_briefs.md) altı yan yol için de metin içerir; registry’deki eski “none” notları bunun güncel durumunu göstermiyor. Ormanın `ordered / uneasy / chaotic` varyantları ayrıdır: bakılan sağlam shrine ile çökmüş shrine aynı anda varsayılan hâl değildir.

[Bestiary](../lore/bestiary.md) ayrımı çizim davranışını belirler: Hollow eski işini tekrarlar; Bellbound zincirle çana bağlanır; Inkbound silinmiş kayıtlarla sarılıdır; Wraith portre/ayna üzerinden tutunur; Ashbound hayvan çan külü yemiştir; Construct ölü beden değil makinedir. Yaşayan Oren, Rusk, Matron, Yseldra ve kült üyeleri aynı zombi görünümüne çevrilmez.

## 6. Yirmi oynanabilir karakter: kimlik ve çizim karşılığı

Buradaki görsel ayrıntılar yeni sheet değildir; [lore modellerinin](../lore/characters/_README.md) kaynak brief’idir. Yeni tasarımda çizgi, yüz işlenişi, malzeme ayrıntısı ve kompozisyon geliştirilebilir. Hikâyenin kullandığı nesneler ve kimlikler aynı anda korunur. Yaş/element/rarity ve dört skill adı [runtime character pack](../../game/data/content/characters_part1.json) ile de karşılaştırıldı.

### Mahmut — `mahmut` · 28 · Stone · 5★

Carrowgate’li nalbant oğlu; Crown Guard’da Oren’in yetiştirdiği muhafız. Fadyme’yi teslim etmeyi reddettiği için hain ilan edildi. Dört yıllık arayış ve son iki yıllık beraberlik, uykusuz bakışına ve farklı köylerde tamir edilmiş zırhına yansır. Onun gelişimi, korumayı başkası adına karar vermekten ayırmaktır.

Uzun, geniş omuzlu; koyu dağınık saç, hafif sakal, kahverengi göz; yıpranmış yarım plaka, parçalanmış oxblood pelerin. Göğüste yıldız ve üstünde **dövülerek boş bırakılan taç yuvası**; kılıç kabzasındaki arma yuvası sade demirle doldurulmuş. Kalkan heater biçiminde, görünür yamalı; açılış sonrası kenarında Yseldra’nın gri mührü var. Kısa, kuru mizahlı konuşur; öfke sessizliktir. Pozu koruyucu ama sürekli kahramanca bağıran değildir. Kaynak: [mahmut.md](../lore/characters/mahmut.md), `cs_mahmut_1–2`.

### Fadyme — `fadyme` · 22 · Veil · 5★

Kralın tanınmış kızı ve anne tarafından son yaşayan çan soyu kızı. Başta durumunu saklar; yolun sonunda tanıklık edilmesini ve kendi seçimini ister. “Kurtarılacak görev” olmaktan çok yol arkadaşı olmayı arzular. Yüzünde ağırbaşlılık, ince mizah ve saklanan yorgunluk birlikte bulunmalı; mutluluk sahneleri de kimliğin parçasıdır.

Uzun soluk kül sarısı saç, **mor göz**, derin erik kapüşon, siyah yüksek yakalı elbise, gümüş-lila işleme, beyaz atkı. Alında kapüşonun ön kenarındaki kırık gümüş taç parçası; yüzün yanında ayrı küçük gümüş çan saç tokası; zincirde **gümüş diken tokmaklı çan**. Bu üç nesne birbirinin yerine kullanılmaz. Default art’ta hastalık izi yok; sahne varyantları ayrı. Mahmut’tan korunmayı bekleyen pasif duruş yerine nazik ama kesin seçimler ve gerektiğinde birlikte savaşma iradesi. Kaynak: [fadyme.md](../lore/characters/fadyme.md), A-001/002/004, C33–35, C40/43.

### Kera Voss — `kera_voss` · 20 · Ember · 4★

Glassford’lu camcı kızı ve Red Vial archive simyacısı; sormadan yaptığı kan analizlerinin suç ortaklığıyla yüzleşir. Hesper Doyle’ın şapkası ve pirinç havanı kişisel mirastır. Saçı on dört yaşındaki bir kaza nedeniyle kül gümüşüdür, Veyr akrabalığı nedeniyle değildir. Kusursuz formülden etik sorulara geçer; Part II’de eksik formülü Cael’e alternatiftir.

Küçük, hızlı; kısa/omuz boyu dağınık kül gümüşü saç, amber göz; çok geniş koyu şapka ve kor gözlüğü, krem önlükte tek yanık izi, şişe kemeri, pirinç el havanı. Şapka silüeti saçı baskın biçimde ayırır; Fadyme’nin kapüşonu yok. Kahverengi/krem/pirinç, kor turuncusu. Hızlı teknik sözler, yüksek sesle saklanan bakım. Kaynak: [kera_voss.md](../lore/characters/kera_voss.md), `cs_kera_voss_1–4`.

### Brin Alder — `brin_alder` · 23 · Stone · 4★

Köy muhafızı ve oduncu; babası Bram’ın çocukları kurtarırken çatıyı tutup ölmesi, onun yükü tek başına taşıma alışkanlığının kaynağıdır. Part I’de yardım istemeyi öğrenir. İsmi yeniden oyulan baba ağacı ve iki çatı sahnesi kişisel hikâyesinin somut resimleridir.

Sağlam gövde, uzun tek kahverengi örgü; pine pelerin ve soluk kurt kürkü yaka, krem gambeson; el baltası ve **yuvarlak demir buckler**. Mahmut’un heater’ını, Nara’nın ağır plakasını kullanmaz. Az konuşur; sıcaklık küçük gülümseme ve işe yarayan hareketlerde görünür. Kaynak: [brin_alder.md](../lore/characters/brin_alder.md), `cs_brin_alder_1–4`.

### Nixie Vale — `nixie_vale` · 19 · Gale · 4★

Yol kaydına yazılmış, Ochre Wheel kervanında büyümüş izci. Sahiplenilmekten korkar; aidiyeti kendi seçmek ister. Yalan söyleyen haritası, kervandan ayrılma nedeni ve hawk tüyü gerçek geçmişine bağlıdır. Hikâye sonunda ev bir kasaba değil, hareket eden yoldaş çevresidir.

Açık, hızlı ve çok ifadeli yüz; **açık kahverengi saç, amber göz**; teal kapüşonda ochre astar, tüy iğnesi, uzun bağcıklı çizme, kısa yay, harita kutusu. Kapüşon gevşek/çoğunlukla geride; Fadyme’nin yüz saklayan derin kapüşonuyla ayrılır. Tehlikede neşeden düz ciddiyete geçer. Kaynak: [nixie_vale.md](../lore/characters/nixie_vale.md), C5, `cs_nixie_vale_1–4`; eski sheet hair issue açık.

### Sister Aveline — `sister_aveline` · 26 · Dawn · 5★

Saint Luthos rahibesi; bir tahliyede eksik saydığı çocuk yüzünden daima iki kez sayar. Bakımı kurumdan öne koyar; önceki taşıyıcıları teşekkürle kaydeden Kilise’nin hakikatiyle yüzleşir. Silahının ışığı azizin değil kapının içindeki kişinin içindir.

Kısa bakır/kumral saç, kahverengi göz, çiller, dove-grey örtü; ivory/gri habit, saha önlüğü ve bandaj çantası; kendisinden yüksek **güneş diski fenerli reliquary staff**. Dawn altını küçük ışık odağı. Yumuşak yüz ama kriz anında kesin sayım ve öncelik. C42’ye göre örtülü tasarım. Kaynak: [sister_aveline.md](../lore/characters/sister_aveline.md), `cs_sister_aveline_1–4`.

### Sable Wren — `sable_wren` · 21 · Veil · 5★

Eski Wren Post kuryesi; Crownfall’dan bir ay sonra Oren’in takip emrini taşıdı. Crownfall teslim emrinin taşıyıcısı değildir. Mühürleri kırıp artık içerideki insanlara kapı açar; karanlıkta sakladığı sırdan başkalarına bıraktığı fenerlere geçer. Hana’ya itirafı karakterin özel bağıdır.

Siyah çene boyu bob ve tek uzun yan tutam, soluk gri göz, ink-blue/charcoal deri, amber **kırık kurye mühürleri**; ters tutulan çift kısa bıçak, kesilmiş çan ipi. Kapüşon aşağıda; iş anında ağıza çekilen cowl. C42’de açık omuz/yakayı destekleyen, opak ve kontrollü zarafet; VN/sheet ve ağır hikâye sahnelerinde sakin, mesleğine uygun kompozisyon. Fısıltılı, kuru, ölçülü; gri Inquisition mühürleriyle karıştırılmaz. Kaynak: [sable_wren.md](../lore/characters/sable_wren.md), [sheet prompt](../prompts/sheets/sable_wren_sheet.md), C36/42.

### Tilda Fen — `tilda_fen` · 24 · Tide · 4★

Tuz yolu salgınlarında Old Marta’dan öğrendiği açık sözlü sağlıkçı; Iona’yla Undercity kliniğini kurdu. Umut veremeyeceği sözü vermez. Fadyme’nin gizlediği süreye karşı, hastanın zamanını konuşarak kullanmasına izin veren dürüst prognosis aynasıdır.

Bronz ten, çiller, kısa koyu kıvırcık saç, sea-green baş bağı; yağmurluk/oilcloth cape, kıvrılmış kollar, bitki çantası, cam şişeli kamış değnek. Sea green/sand/driftwood. Sürekli işin ortasında, sert görünen ama hastayı bırakmayan yüz. Iona’nın dinleyen ve fener kaldıran duruşuyla ayrılır. Kaynak: [tilda_fen.md](../lore/characters/tilda_fen.md), `cs_tilda_fen_1–4`.

### Rikka Ember — `rikka_ember` · 18 · Ember · 4★

Kiln company tören muhafızı; sessiz Hollow gecesinde ninesini kaybetmesi gürültüsünün nedenidir. Korkuyu kahkaha ve gösteriyle taşır. Son kişisel sahnede uyuyan Fadyme’ye ilk kez sessizlik ve insanların nefesini sunar.

Parlak kızıl çift kalın örgü, yüzde kurum, geniş grin; kapalı kırmızı lamellar, altın kordon; **çan püsküllü mızrak**. Eski görsel JSON’daki forge hammer kullanılmaz; runtime da `spear` der. Kera’nın turuncu şişelerine karşı brick/red/gold ve öne atılan silüet. Kaynak: [rikka_ember.md](../lore/characters/rikka_ember.md), `cs_rikka_ember_1–4`.

### Mirel Quill — `mirel_quill` · 25 · Dawn · 5★

Eski saray kâtibi; Crownfall sonrası kırk silme emrini hızına gurur duyarak kopyaladı. Kendi el yazısını tanıyıp aynı elle isimleri geri yazmayı seçer. Aveline’le kaydı/duayı düzeltme bağı ve Odelia’nın kardeşine tanıklığı, kişisel ilişkileridir.

Siyah sıkı topuzda iki pirinç stylus, yuvarlak pirinç gözlük, mürekkepli parmak; **bottle-green** uzun kollu elbise, belge çantası, astrolabe folio ve stylus dagger. Özenli ve wry; korkarken resmîleşir. C42’den önceki kostüm/renk türevleri kullanılmaz. Kaynak: [mirel_quill.md](../lore/characters/mirel_quill.md), `cs_mirel_quill_1–4`.

### Odelia Pike — `odelia_pike` · 22 · Tide · 4★

Kıyı gözcüsü; Undercity’ye giden kardeşi Tomas’ın düğüm biçimli tebeşir izlerini takip eder. Kaçınan konuşması arazi okurken kesinleşir. İzlerin sonunu öğrenmesi kardeşinin adıyla tanıklık edilmesine bağlanır; onu geri getirmiş gibi resmedilmez.

Güneşte koyulaşmış ten, kısa koyu ve tuz sertliğinde saç, **kırmızı örme liman şapkası**, gri-mavi yün ceket, ip düğmeleri, uzun yay, ağ düğümlü oklar. Yerdeki izi okuyan crouch. Nixie’nin kısa yayı, tüyü ve büyük gülüşüyle ayrılır. Kaynak: [odelia_pike.md](../lore/characters/odelia_pike.md), `cs_odelia_pike_1–4`.

### Pippa Bell — `pippa_bell` · 20 · Gale · 4★

Gezici oyuncuların çocuğu; isimleri listeden daha uzun hatırlanan şarkılara yazar. Silent Bell parçası charm’ı başkentli bir mülteciden aldı. Şarkısı kaydın karşısında tanıklık eder; 7-3’te charm cevap verir.

Rose-pink kıvırcık saç, eğik tüylü şapka, eski konser afişlerinden yamalı ceket, küçük lute-sling, titreyen çan charm’ı. Rose/cream/mustard; ayağı sandalyede, çalarken görünen silüet. C42 sahne bluzu için açık omuz izni verir; frame kişiliği ve performans içindir. Neşe bir kostüm filtresi değildir; korkunca şaka kesilir. Kaynak: [pippa_bell.md](../lore/characters/pippa_bell.md), C42, `cs_pippa_bell_1–4`.

### Nara Vell — `nara_vell` · 27 · Stone · 5★

Beş kuşaktır köprü bekçisi Vell ailesinden; annesi Oren’i eğitti. İnsanları emrin önünde tutar. Üç kış önce yetişemediği araba yüzünden saniye ve mesafeleri ölçer. Oren’in yaşadığını söyleyip sonrası hakkında tahminde bulunmaması karakterinin doğruluk sınırıdır.

Küçük ama ağır zırhlı; **koyu kahverengi ten**, kısa siyah saç ve tıraşlı yanlar; stone-grey plaka, dizde Vell armaları, **glaive ve compact kite shield**. Yerleşmiş dik/kapıyı tutan duruş, slate/moss-copper. Brin’in kürk/baltasına ve Mahmut’un pelerinine çevrilmez. Kaynak: [nara_vell.md](../lore/characters/nara_vell.md), `cs_nara_vell_1–4`.

### Clem Marr — `clem_marr` · 19 · Veil · 3★

Glassford’lu mezarcının torunu; okumayı taşlardan öğrendi, eski mezar isimlerini ve kilitli kayıt odalarını çözer. Fadyme’nin yalanına ilk açık tanıklardan biridir. Sonunda onun adını her gün en iyi yazısıyla kaydeder; Hana’yla isimsiz mezar sırasına döneceklerdir.

Küçük yuvarlak yüz, tebeşirli mouse-brown bob; heather-grey iş ceketi, mustard atkı, tebeşir/fırça cepleri, kesik sembollü **ritual lantern**. Diz çöküp taşı okur; macabre mizahı vardır ama yalnız sıkılmış ürkütücü yüz değildir. Kaynak: [clem_marr.md](../lore/characters/clem_marr.md), `cs_clem_marr_1–4`.

### Vespera Wisp — `vespera_wisp` · 23 · Veil · 5★

Cam ve zaman araştırmacısı; Glass Bell ward’ına bilerek kendi saatleriyle ödeme yaptı. Genç ama uykuyla düzelmeyen yorgunluğu ve saçındaki tek beyaz tutam bunun izidir. Ana sahnede eksik anlattığı deneyimi companion hikâyesi tamamlar; Cael’in teklifinde rızadan önce bedeli öğrenmeyi savunur.

Uzun midnight-blue saçta **yalnız tek frost-white tutam**, soluk mavi yorgun göz; cam boncuklu yüksek yakalı midnight/teal elbise. C42 ve güncel sheet subject açık omuz/üst sırt ve ayrı bell sleeves tarif eder; eski “fully covered” checklist bununla çelişir. Altıgen eskitilmiş altın cam fener ve sağ elde focus ring; soluk teal/beyaz kırılma ışığı, mor büyü değil. Çok sakin ve ölçülü duruş; zarafet mesafesinden gelir. Kaynak: [vespera_wisp.md](../lore/characters/vespera_wisp.md), [sheet prompt](../prompts/sheets/vespera_wisp_sheet.md), C42.

### Hana Birch — `hana_birch` · 18 · Stone · 3★

Ashen estate bekçisinin kızı; babası evin emirlerini reddedip gittikten sonra çocuklara bakmak için kaldı. Korku titreyen elde görünür, cesaret kapıyı yine açmasındadır. Fadyme’nin gördüğü kolunu saklama sözü taşınan yükdür; finale kadar sessizliğine gerekçe verir.

Bal-kahverengi kısa saç, **birch-white bandana**, rust kapitone saha kıyafeti, diz üstü shield plate, halat ve **küçük kapan + kısa balta**. Eski recurve-bow/staff türevi kullanılmaz; runtime `hatchet_trap`. Sabit crouch, mesafeli çekingen bakış; harekette kesinleşir. Kaynak: [hana_birch.md](../lore/characters/hana_birch.md), `cs_hana_birch_1–4`.

### Thistle Roe — `thistle_roe` · 21 · Gale · 4★

Saint Luthos bahçıvanlarının büyüttüğü, çan külünde bitki yetiştiren kişi. Owing-bell çiçeğinin borçlu saat yanında açmasını bilir; botanik bilgisi kozmetik değildir. Son kış tohumu hediyesi, baharı kendi görmeden başkası için ekme fikridir.

Chestnut çift alçak topuz, geniş **hasır şapka**, kalın bahçe eldiveni, sage elbise üstünde topraklı önlük, tohum kutuları ve thorn crook. Sage/straw/earth. Kera’nın sivri saha şapkasına benzemez. Hafif kekemelik, elleri ne yapacağını bildiğinde kaybolur. Kaynak: [thistle_roe.md](../lore/characters/thistle_roe.md), `cs_thistle_roe_1–4`.

### Iona Mist — `iona_mist` · 24 · Tide · 4★

Glassford nehir fenercilerinden; boğulanların adını tekneler geçerken okuyarak tanıklık eder. Tilda yaşayanı tedavi ederken Iona kayıp kişiyi ve hatırayı kıyıya yöneltir. Fadyme’nin adını her gece söyleme sözü Law of Hours içinde süreyi erteleyen iştir.

Olive ten, uzun düz siyah saçta mavi parıltı; deep-navy oilskin yağmurluk, kapüşon aşağı; **cam nehir feneri ve tidal censer**. Amber fener ışığı/fog-grey, başı dinlerken hafif eğik. Tilda’nın kıvırcık saçını veya Vespera’nın altıgen fener/sihir silüetini kopyalamaz. Kaynak: [iona_mist.md](../lore/characters/iona_mist.md), `cs_iona_mist_1–4`.

### Jori Flint — `jori_flint` · 20 · Ember · 3★

Oakhaven demircisi; ailesinin “köprü” diye ürettiği zincirlerin kafes oluşuyla yüzleşir. Kapı yerine insanın yanında hareket eden kalkan yapmak ister. Part II hedefi kırıp geçmek değil, açacak anahtarı üretmektir.

Kısa deriyle bağlı ginger saç, burunda kurum, kollarda yanık çilleri, kalın deri önlük ve kol koruması; **yuvarlak küçük kalkan ve demirci çekici**. Soot/iron/copper; kalkan önde, çekiç hazır. Rikka’ya yanlış aktarılan çekiç silüeti burada anlamlıdır. Kızgın grumbling altında utanç; bakımını emir gibi söyler. Kaynak: [jori_flint.md](../lore/characters/jori_flint.md), `cs_jori_flint_1–4`.

### Marek Vane — `marek_vane` · 30 · Gale · 4★

Eski sınır askeri ve Crown habercisi; Mahmut’un hainlik emrini on bir köyde okudu. Artık kâğıt yerine insan taşır; gerçeği herkesin önünde geri ilan eder. Yolu “emre uyup yürümek” yerine birlikte yürümeyi kabul eden insanlardan kurar.

Uzun koyu kahverengi bağlı saç, kısa sakal, gri göz; yol pelerini ve kapalı deri ceket; sırtta **viola**, elde **flaması kaldırılmış spear-horn**. Road-brown/faded-blue/brass; yürüyen silüet ve sayılan ritim. Eski visual JSON’daki asılı banner pennant takılmaz. Kaynak: [marek_vane.md](../lore/characters/marek_vane.md), `cs_marek_vane_1–4`.

## 7. Antagonist, NPC ve boss brief’leri

- **Yseldra Vale, 34:** eski Inquisitor; yedi kurbanın suçluluğu ve seçim hakkını kaldıran koruma. Uzun dik duruş, koyu saç; yas örtüsünün altında **ayrı kemik beyazı yarım maske**, bir göz boyunca çatlak; black-plum mail/surcoat; yedi **gri, kesilmiş, çentikli** mühür; kırık pirinç çağrı çanı ve tokmağı bağlayan kırmızı ip. Kafatası veya porselen yüz maskenin yerine geçmez. 2-5 ölümü değil kaçışı gösterir. [yseldra.md](../lore/characters/yseldra.md).
- **Cael Veyr:** Crownfall’da 41; güncel yaş bilinmez, otomatik 47 yazılmaz. Fadyme’nin **dayısı**; kendi geçmişini kurtarmak için hesabı tekrar yazan nazik tehdit. Koyu saç, gri göz; yüksek siyah court collar, antique-gold scale paneller, boş signet yuvası, **boş kadran ve ibresiz saat**. Yüzü parçalı yansımada; kalıcı maske yok. [cael.md](../lore/characters/cael.md).
- **Marshal Oren:** Mahmut’un eski öğretmeni; eksik emri onur sayan, köprüyü insanlara açık tutmakta geç kalmış kumandan. Düşmanlığı, pişmanlığı ve sivillere verdiği son hizmet birlikte görünmeli. Köprüden canlı ayrılır; sonrasını ve yaşını icat etmeyiz. Kaynak: 5-5, `cs_nara_vell_2/4`, C2/27.
- **Captain Rusk:** C.V. ve Inquisition mührünü taşıyan paralı asker; signal banner/volley okunur. Yseldra’nın emrini taşıyan her kişiyi onun sadık astı gibi çizmek yanlış. Kaynak: 3-5 ve enemy lore.
- **Red Vial Matron:** ledger kanadının insanı tarif malzemesi sayan yöneticisi; glass ward, flask racks ve korozif vapor. Kera’nın archive mirasıyla aynı nesneleri farklı amaç için kullanır. Kaynak: 4-5 ve Red Vial faction.
- **Ashen Lord / Lord Edric Aske:** yaklaşık altmış yaşındaki asil portresinden tutunan Wraith; Schedule muhafızı, Fadyme’nin annesini sakladı, Cael’e Schedule’ı vermeyi reddetti. Son “Crown’dan sakla” emri hizmetlileri kapatan eve dönüştü. Soot-grey/tarnished-gold/cold-glass; ayna çerçevesi kimliği taşır. **Edric Aske adı Part I’de söylenmez.** [ashen_lord.md](../lore/characters/ashen_lord.md), C38.
- **Ash-Maw:** çene içinde Whispering Bell parçası taşıyan ölü kurt; sıradan büyük kurt değildir. Shard hâlâ sayar, common loot süsü yapılmaz. 1-5, world rule 7.
- **Eclipse Construct:** cathedral ölçeğinde pirinç/taş Hinge, içinde boş çan; crown arches, zincir eklemleri, sunak blokları. Canlı beden veya Cael’in canavar biçimi değildir. Üç pylon, iki faz; makine düşer, çan ve borç sürer. [Story Bible §5](../story/STORY_BIBLE_PART1.md).

Yan NPC’ler de okundu: shrine keeper, old priest, Undercity alchemist, hizmetliler, mülteciler, innkeeper, potter, ledger agent, Council herald. Adı geçen Hesper Doyle, Old Marta, Tomas Pike, Bram Alder, Liora ve Aren’in yeni yüz/yaş tasarımı bu okuma ile icat edilmedi.

## 8. Ortak sanat dili için hikâye kaynaklı sonuçlar

Kullanıcının bu mesajdaki ChatGPT üretimi afiş + mağaza mockup’ı **görülmüş stil referansı**dır. Yerel özgün dosya/file ID sağlanmadı; erişilebilir `library-files` ve `shared` alanlarında dosya yok. Bu yüzden hash, dosya hedefi veya üretim modeli uydurulmadı. Sonraki gerçek üretimde sohbet görseli kullanılabilir; özgün byte’lara erişildiğinde staging source/provenance kaydı tamamlanır. Referansın yeniden gönderilmesi bu incelemenin şartı değildir.

Korunacak yön: kömür/siyah temel, kontrollü bordo/kızıl, kemik renkli serif, yıpranmış metal/kumaş, sisli Gothic kütleler, ince anime çizgisi ve dokulu painterly shading, dramatik kenar ışığı. İyileştirme önerileri:

1. **Karakter ayrımı:** yüz, saç, ten, silüet ve özel renkleri yukarıdaki kimliklerle kur. Afişteki bütün açık saçlı figürleri canon kadro sanma; herkesi Fadyme’ye benzetme.
2. **Yüz ve nesne okunurluğu:** siyah kumaşın içinde yüz, el, çan, kalkan ve metal konturları seçilsin. Doku ve sis küçük mobil metnin altını kapatmasın.
3. **Hikâyeye ait logo:** C41, eski cross-sword’ü emekliye ayırır. Aday merkez sembol **gümüş çan + gümüş diken tokmak + kırık taç parçası + ince kızıl tutulma halkası**dır. Yeni tasarım adaydır; final onay durumu ayrı kaydedilir.
4. **Yerel renk:** ortak dil bütün mekânları bordo/siyah yapmaz. Oakhaven ochre/linen, Undercity teal/amber, Cathedral cold-stone/Dawn, Estate soot/gold/glass gibi kaynak ayrımları kalır.
5. **İnsan ölçeği:** mum, yemek, peynir şakası, yardım eli, kayıt ve sığınak ile karanlık atmosferin içinde hayatı göster. Fadyme’nin sevinci de key art/VN paketinin parçasıdır.
6. **Dikey yeniden kompozisyon:** afiş/mağaza sütunları telefon ekranı değildir. 1080×1920 portrait TitleScreen ve HubScreen ayrı işlevlerdir; metin gerçek UI katmanıdır. Artwork text-safe alanlar ve yüzlerin safe area içinde kalmasıyla üretilir.
7. **İki resim ölçeği:** detailed sheet/VN’de yüz ve malzeme; battle chibi’de okunur silüet, aynı saç/nesne/palet ve uygun sadeleştirme. Sprite PNG varlığı animasyon tamamlandı demek değildir.

Google Play kartı, yıldız/indirme sayıları, install düğmesi ve tagline mockup verisidir; gerçek ürün verisi veya oyun ekranı olarak aktarılmaz. Göz rengi/karakter kimliği de referanstan canon’a terfi etmez.

## 9. Spoiler, ifade ve durum kuralları

[SPOILER_UNLOCK_POLICY.md](../canon/SPOILER_UNLOCK_POLICY.md) kaynak gate’lerini korur. Fadyme’nin Veyr soyadı ilk 7-3’te söylenir; Cael’in kimliği/dayılığı itiraftan sonra gelir. Başlangıç title/giriş artwork’ünde klinik prognosis, akrabalık şeması, kralın son sayfasının okunabilir içeriği veya geç hikâye curse state kullanılmaz. Dünya adı Veyrhold ve çan/tutulma sembolleriyle kimlik kurulabilir.

Fadyme’nin dört durumunun onaylı yönü: pale cold fingers → beyaz atkıya saklanan küçük kan lekesi → 5-4’te bir bone-white lock → 7-5’te ince black-gold çizgiler. Crimson curse çizgisi yok. Açılış kaynak metnindeki erken kan iziyle C43 sıralaması arasındaki açık konu aşağıdadır; sıradan profile/default görselde kan veya işaret yok.

C42 kostüm yönü, eski matrix/Costume Guide’ın “dört mildly open karakter” notunu günceller: Sable ve Vespera Tier A; Pippa sahne kostümü Tier B; kalanlar örtülü. C42’de figürü vurgulayan sınırlı kullanım alanları ayrı; sheet, VN ve ağır hikâye CG’si bu kullanım değildir. Chibi oranı yetişkin yaş/kimliğini değiştirmez.

UI/subtitles **İngilizce**, voice **Japonca**. Ses tonları birbirinden farklıdır: Brin sorumlulukla, Sable meslekle, Nara eylemle, Vespera mesafeyle, Hana çekingenlikle, Iona dinlemeyle sessizdir. Tek “quiet girl” yüzü/sesi kullanılmaz. Dialogue’a contraction ekleme ya da eski “never says” sınırlarını rastgele değiştirme işi bu sanat brief’inin parçası değildir.

## 10. Çelişkiler ve açık bilgiler

| Kayıt | Kanıt / sorun | Bu üretim için yaklaşım |
|---|---|---|
| Costume/visual türevleri | Costume Guide kendini 15 karakter için STALE işaretler; palette/iş/silüet farklılıkları var | Yeni brief’in lore/karar kaynağını kullan; türev JSON’u referans kabul etme |
| Rikka ve Hana silahı | Derived visuals: hammer / bow-staff; lore ve runtime: spear / hatchet-trap | Yeni çizimde mızrak ve balta/kapan; runtime mekaniğini değiştirmeden |
| Nixie hair issue | Lore/identity açık kahverengi; eski sheet `APPROVED_WITH_ISSUE` | Yeni aday açık kahverengi; eski byte/hash/statü kaydını koru |
| F-004 ifade eskiliği | Canon F-004, Veyr’e dair cümleyle “reigning line is Fadyme’s father’s” der; C3/22/23, world ve glossary açıkça Carrow hanedanı / maternal Veyr ayrımı kurar | Kraliyet hanedanı Carrow, çan soyu anne tarafından Veyr; ledger’ın satırı bu tur değiştirilmedi |
| Yseldra mühür rengi | Eski visual_reference V2 zincirde kırmızıya yorum önerir; güncel `yseldra.md` zincirde de gri kesilmiş mühür der | Gri, yedi çentikli, ayrı kesilmiş mühürler; kırmızı yalnız tokmağı bağlayan ip |
| Vespera/Sable prompt iç tutarlılığı | Vespera subject ve C42 açık omuz derken checklist örtülü; Sable subject cowl çoğunlukla aşağı derken checklist çoğunlukla ağızda | Yeni promptta C42 + bağlama göre cowl; tarihsel prompt rewrite edilmedi |
| Açılışta kanın zamanı | `opening_sad_scene.direction_en` blood-marked glove, `opening_007` red stain der; C43 kanı 3-3 adımıyla tarif eder | Özel opening CG üretmeden olay sırasını netleştir; default art’ta kan yok. Yeni başlangıç hikâyesi uydurma |
| 7-4 takım yönergesi | `vn_7_4.battle_transition_en`: iki lead + “four chosen allies” = altı; hemen sonraki sahne ve battle sözleşmesi beş der | Story CG kadrosunu bu tutarsız ifadeyle kilitleme; normal battle beş. Source satırı bu tur değiştirilmedi |
| Yan yol registry’si | Registry altı yan yolu “none” işaretler; location_briefs 2026-09-30 altısını da içerir | Mevcut brief’leri kullan; registry notunu üretim adımında güncelle |
| Source/runtime terfisi | 419/409; 10 eksik line_id, 2 değişen metin; scene music_cue 51/1; VO unlock 40/0; 9 Codex farkı | [RECONCILIATION.md](../migration/RECONCILIATION.md) ve evidence JSON ile ayrı içerik işi; tasarım adına snapshot overwrite yok |
| Ana tema | `audio_cues_part1.json` içinde `flow.title=null`; bulunan Fadyme reference theme, owner’ın ana teması değildir | Owner dosyası/cue eşlemesi doğrulanmadan startup müziği tamam sayılmaz |
| JP ses | 201 satırlık Fadyme script DRAFT/native review pending; 25 seçilmiş dosya | 220 VO metin kaydı üretilmiş kayıt sayısı değildir; audio kabulü ayrı |

**Açık gizemler:** Clockless Court’un konumu/üyeleri; Mahmut’un “bir saat”inin kesin anlamı; Silent Bell’i kimin, neden susturduğu; Audren’in katili; Oren’in sonraki yeri; taşıyıcıların henüz verilmeyen isimleri. Court’un varlığı ve bazı sırlar tasarımda bilinirken oyuncunun bilgisi sınırlıdır. Kaynakların `LIKELY / RUMORED / UNKNOWN` statüleri final gerçek diye kullanılmaz.

## 11. Bu aşamanın sonucu ve sonraki iş

Dünya/ana hikâye/20 karakter ve yan içerik okuması tamamlandı. Bu belge çizim brief’lerinin ortak bilgi tabanıdır. Mevcut kaynakların tüm geleceği yazılmış değildir: Part II’nin tamamına ait senaryo olduğu iddia edilmez; kaynaklar yeni karar gelirse yeniden okunur.

Okuma tamamlandıktan sonra **SovTaym Studios** için [gerçek web ön araştırması](STUDIO_NAME_RESEARCH_2026-10-05.md) yapıldı; resmî kayıt sorgularının erişim eksikleri açık kaldı. [İlk ortak sanat sistemi](ART_SYSTEM_V01.md), key-art adayları ve ayrı Godot inceleme sahnesi hazırlandı. Sonraki somut üretim ilk oyun kontrollü **EngineSplashScreen**, ardından stüdyo/title akışıdır; tema dosyası ve aday stüdyo adı somut eksik olarak izlenir. Her oyuncu ekranının önizleme, ayrı ID ve Godot bağlantısı aynı adımda tamamlanır; TitleScreen ile HubScreen ayrılır. UI sisteminden sonra final Fadyme paketi, diğer karakterler ve mekânlar sırayla tamamlanır. Kullanıcının yeni bir öncelik vermesi bu sırayı günceller.

Kaynak okuması önce tamamlandı; yaratıcı üretim bundan sonra başladı. Eklenen artwork ve Godot aday tema/inceleme sahnesi ayrı üretim kaydındadır; kaynak canon/script ve aktif startup/auth/patch/backend değiştirilmedi. Eski üretimin sanat otoritesi güncellendi; orijinaller ve hash kanıtları korundu. Kaynak/render/device kabulü birbirinin yerine kullanılmadı. Okuma için ilgisiz oyun test turu eklenmedi; yeni inceleme sahnesinin kendi import/parse, davranış ve render kontrolleri yapıldı.
