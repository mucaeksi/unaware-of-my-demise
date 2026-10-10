# Part I düşman tasarımları — v001

Tarih: 2026-10-10. Yeni görsel öneriler; mevcut hikâye/skill/phase/ID kayıtları değiştirilmedi. 20 standart düşman + 6 boss = 26 kimlik. The Bell-Widow/Yseldra ve Cael ayrı ayrı yapılmak üzere sona ayrıldı.

Bu paket tasarım sayfaları ve koreografi brief’idir. Alpha sprite, animation frame, VN portresi, ses veya runtime entegrasyonu tamamlanmış sayılmaz. İki mevcut tutorial düşmanının kaynakları korunur. İleri sürülen yüz, saç, ekipman ayrıntıları kanon onayı yerine geçmez.

## Ash Wolf — `ash_wolf`

Bölüm 1 · flanker · Ember

[Görsel sayfa](boards/ch01_whispering_ash_v001.png)

**Kanon:** Wolves that ate from bell-ash in the Whispering Forest. They hunt whoever walks apart from the pack.

**Siluet:** Alçak, uzun kama; sivri burun ve geriye uzanan kuyruk.

**Renk/malzeme:** Kül kaplı füme kürk; göğüste az miktarda amber çatlak.

**Kıyafet/prop:** Çan külü yemiş normal kurt; tasmaya veya insan silahına ihtiyaç yok.

**Saldırı okunurluğu:** Pack Lunge: arka ayaklar sıkışır, gövde hedefe yönelir; hedef işareti sıçramadan önce görünür.

**Animasyon yönü:** Dört ayak, nefes, çömelme, sıçrama, darbe, yere yığılma.

**Sınır:** Diğerinden daha küçük ve çevik; Ash-Maw ile aynı boy/çene yapılmaz.

## Bellbound Dead — `bellbound_dead`

Bölüm 1 · swarm · Veil

[Görsel sayfa](boards/ch01_whispering_ash_v001.png)

**Kanon:** Hollows wired to a bell by their own chains. Alone they are weak; the bell never sends one alone.

**Siluet:** Çökük göğüs, sarkık uzun kollar; zincirle bölünmüş ince dikey gövde.

**Renk/malzeme:** Kömür bez, kirli kemik, soğuk pirinç.

**Kıyafet/prop:** Göğüs çanı; göğüs ve bileği bağlayan kendi zincirleri. Mevcut tutorial tasarımı korunur.

**Saldırı okunurluğu:** Tolling Grab: bilek zinciri gerilir, çan eğilir; kavrama ve Dread işareti ayrı okunur.

**Animasyon yönü:** Çan salınımı, uzanma, zincir çekme, darbe, çökme.

**Sınır:** Ağır zırhlı şövalye değildir; kırmızı parıltı bütün yüzeyi kaplamaz.

## Hollow Pilgrim — `hollow_pilgrim`

Bölüm 1 · slow_vanguard · Veil

[Görsel sayfa](boards/ch01_whispering_ash_v001.png)

**Kanon:** A pilgrim whose hours ran out on the road but whose feet did not. Slow, stubborn, heavy.

**Siluet:** Kambur geniş üçgen; yük çantası ve yere basan tek kalın asa.

**Renk/malzeme:** Kül beji kaba dokuma; mat kahverengi deri.

**Kıyafet/prop:** Yüzü karanlık başlıkta; yıpranmış yol yükü. Mevcut tutorial kimliği korunur.

**Saldırı okunurluğu:** Pilgrim’s Weight: iki el asaya geçer, ağır salınım; Stoneguard sonrası ayaklar sabitlenir.

**Animasyon yönü:** Yavaş adım, yük nefesi, asa kaldırma, ağırlıklı vurma, diz çökme.

**Sınır:** Havada uçan hayalet ya da hızlı suikastçı yapılmaz.

## The Ash-Maw — `boss_ash_maw`

Bölüm 1 · beast_boss · Ember

[Görsel sayfa](boards/ch01_whispering_ash_v001.png)

**Kanon:** A wolf carcass fused with a shard of the Whispering Bell. Not a wolf: what the bell left wearing one.

**Siluet:** Derin dev göğüs; alçak dört ayak; asimetrik parçalanmış alt çene.

**Renk/malzeme:** İs siyahı kürk levhaları, kül beyazı yarık, amber boğaz.

**Kıyafet/prop:** Whispering Bell parçası alt çeneye kaynamış; break hedefi jaw_bell.

**Saldırı okunurluğu:** Jaw-Bell: çene parçası keskin kenar ışığı alır; Ash Howl öncesi boğaz açılır. Kırılınca yankı kesilir.

**Animasyon yönü:** Ağır nefes, çene hazırlık, uluma, kesintiye uğrama, ikinci faz, düşüş.

**Sınır:** Boynuz/ejderha/ikinci kafa yok; çeneye takılan tam bir kolye çanı değil.

**Mevcut hedef ID’leri:** `jaw_bell`

## Choir Knight — `choir_knight`

Bölüm 2 · elite_guard · Dawn

[Görsel sayfa](boards/ch02_saint_luthos_v001.png)

**Kanon:** Oath-armor of the Saint Luthos choir guard. It sings without breath and strikes back when a brother is struck.

**Siluet:** Yüksek organ-borusu miğfer; simetrik dar zırh ve düz kılıç.

**Renk/malzeme:** Mat kirli ivory, oksit pirinç, sönük Dawn altın.

**Kıyafet/prop:** Saint Luthos oath-armor; boş miğfer yarığı ve koro levha ritmi.

**Saldırı okunurluğu:** Unison Verdict: kılıç dik tutulur, miğfer yarıkları aynı ritimde parlar; saldırı yönü sonra açılır.

**Animasyon yönü:** Dik nöbet, bir arada rezonans, kılıç hükmü, zırh sarsılması, boş zırh düşüşü.

**Sınır:** Dawn iyi/kötü etiketi değildir; modern kilise haçı veya Yseldra maskesi kullanılmaz.

## Hollow Cleric — `hollow_cleric`

Bölüm 2 · ranged_caster · Veil

[Görsel sayfa](boards/ch02_saint_luthos_v001.png)

**Kanon:** A grave scribe that still keeps its ledger. It mends its own and curses whoever looks weakest.

**Siluet:** Eğik uzun cübbe; açık defter tek büyük yatay leke.

**Renk/malzeme:** Kül ivory, kararmış mürekkep, mat mor-gri.

**Kıyafet/prop:** Mezar kayıt kâtibi; defter, kemik inceliğinde parmaklar, mum izi.

**Saldırı okunurluğu:** Grave Litany: yaralı müttefike dönüp defter açma=iyileştirme; zayıf kahramana dönüp kapatma=lanet.

**Animasyon yönü:** Sayfa çevirme, müttefike okuma, düşmana lanet, darbe, dizlerin çözülmesi.

**Sınır:** Healer/caster iki hareketi ayrılır; yeni bir summon veya sahte rahip kimliği eklenmez.

## Inkbound Dead — `inkbound_dead`

Bölüm 2 · ranged_caster · Veil

[Görsel sayfa](boards/ch02_saint_luthos_v001.png)

**Kanon:** A corpse wrapped in erased records. The ink it bleeds marks the living for the dead.

**Siluet:** Asimetrik kâğıt sargılar; bir kolda yere sarkan kayıt şeritleri.

**Renk/malzeme:** Kirli parşömen; mat siyah mürekkep; soğuk gri.

**Kıyafet/prop:** Silinmiş kayıtlarla sarılı ceset; harfler okunur spoiler metni değildir.

**Saldırı okunurluğu:** Black Margin: kayıt şeritleri hedefe yönelir, mürekkep kenarı oluşur; Trail Mark ikonu darbeden bağımsız.

**Animasyon yönü:** Şerit kıpırtısı, işaret yazma, mürekkep atımı, parçalanan sargı, çökme.

**Sınır:** Kafatası ana kimlik değildir; Estate Wraith’in portre çerçevesi kullanılmaz.

## Corrupted Mercenary — `corrupted_mercenary`

Bölüm 3 · bruiser · Ember

[Görsel sayfa](boards/ch03_oakhaven_v001.png)

**Kanon:** Hired blades of the Red Vial ledger wing, fed on red glass that makes them strong and careless.

**Siluet:** Geniş omuzlu kısa kama; ağır tek balta ve eksik eşleşen zırh.

**Renk/malzeme:** Paslı çelik, koyu deri, az oxblood; kırmızı cam doz cebi.

**Kıyafet/prop:** Ledger wing tarafından tutulmuş yaşayan paralı asker; Rusk birliğinin yıpranmış rengi.

**Saldırı okunurluğu:** Paid in Blood: doz cebine el, göğüste kısa güç vurgusu, sonra ağır saldırı; HP bedeli okunur.

**Animasyon yönü:** Yaşayan nefes, doz alma, ağır yarma, gerileme, silahı bırakma.

**Sınır:** İskelet veya şeytan yapılmaz; kırmızı cam güç verir, beden sürekli yanmaz.

## Orchard Ghoul — `orchard_ghoul`

Bölüm 3 · bruiser · Veil

[Görsel sayfa](boards/ch03_oakhaven_v001.png)

**Kanon:** The Oakhaven dead, bloated from the red harvest. The more it feeds, the harder it becomes to cut.

**Siluet:** Şişkin armut gövde; eğik küçük baş; çamura basan geniş ayaklar.

**Renk/malzeme:** Soluk kül ten, çürük hasat oxblood, toprak kahvesi.

**Kıyafet/prop:** Oakhaven’in red harvest ölüsü; yırtılmış iş önlüğü, hasat çuvalı parçaları.

**Saldırı okunurluğu:** Rooted Bite: çömelip köklenir, çene öne açılır; beslenme sonrası kabuk vurgusu DEF artışını gösterir.

**Animasyon yönü:** Ağır salınım, çömelme, ısırma, geri beslenme, düşme.

**Sınır:** Gore yok; bitki elementi/gerçek ağaç canavarı veya yeni kök immobilize yeteneği eklenmez.

## Red Vial Scout — `red_vial_scout`

Bölüm 3 · flanker · Gale

[Görsel sayfa](boards/ch03_oakhaven_v001.png)

**Kanon:** A Guild courier with a poison dart and a route-marking shot. It reports to whoever pays in seals.

**Siluet:** İnce öne eğilen diagonal; kısa pelerin ve tek küçük dart arbaleti.

**Renk/malzeme:** Soluk deri, kömür bez, kısıtlı kırmızı vial; Gale soluk gümüş.

**Kıyafet/prop:** Yaşayan Guild kuryesi; rota silindir kutusu, az sayıda cam iğne.

**Saldırı okunurluğu:** Glass Needle: arbalet arka sıraya yönelir; rota çizgisi ve venom damlası şekille ayrılır.

**Animasyon yönü:** Hızlı adım, nişan, dart salma, yanal kaçınma, diz çökme.

**Sınır:** Kera veya diğer oynanabilir alchemist kıyafetleri kopyalanmaz; görünmezlik yok.

## Captain Rusk — `boss_captain_rusk`

Bölüm 3 · duelist_boss · Gale

[Görsel sayfa](boards/ch03_oakhaven_v001.png)

**Kanon:** A mercenary captain carrying an order sealed by someone the Crown buried years ago.

**Siluet:** Uzun asimetrik kaptan pelerini; tek ince uzun düello kılıcı, yükselen sancak.

**Renk/malzeme:** Kömür deri, eski bakır, mat oxblood, sert Gale gümüş.

**Kıyafet/prop:** Yaşayan paralı asker kaptanı; eski mühürlü emir kılıfı ve ayrı signal_banner. Yüz/saç öneridir.

**Saldırı okunurluğu:** Captain’s Duel: tek Front hedefe kılıç ucu; Banner Call: sancak yönüne açık el. Banner kırılınca çağrı söner.

**Animasyon yönü:** Kendinden emin nefes, düello hazırlığı, kesiş, çağrı, sancak kesintisi, yenilgi.

**Sınır:** Oren’in kraliyet üniforması değil; Yseldra gibi çan/maskeye sahip değil.

**Mevcut hedef ID’leri:** `signal_banner`

## Chain Cultist — `chain_cultist`

Bölüm 4 · support · Veil

[Görsel sayfa](boards/ch04_undercity_v001.png)

**Kanon:** Chain-bearers of the First Eclipse. They pray to an eclipse that never moves and share one another's wounds.

**Siluet:** Kapalı başlık altında düğüm göğüs; iki yana açılan zincirlerle geniş üçgen.

**Renk/malzeme:** Kömür bez, kurşun gri, az mor Veil.

**Kıyafet/prop:** Yaşayan First Eclipse mensubu; göğüste zincir düğümü. Kırık tutulma biçimi tasarım önerisi.

**Saldırı okunurluğu:** Knot the Breath: eller düğüm üstüne kapanır; düşman müttefiklerine ince zincir hatları=soul_link.

**Animasyon yönü:** Düğüm solunumu, ortak dua, bağlama, bağ kopması, yere düşüş.

**Sınır:** Bağlı hedefler kahramanlar değil kendi müttefikleri; yeni düşman çekme yeteneği yok.

## Glass Viper — `glass_viper`

Bölüm 4 · assassin · Tide

[Görsel sayfa](boards/ch04_undercity_v001.png)

**Kanon:** A glass-scaled serpent bred in the Red Vial cisterns. Fast, fragile, and never sold to anyone who asked what it was for.

**Siluet:** İnce S kıvrımı; sivri küçük baş; kırılgan cam sırt ritmi.

**Renk/malzeme:** Kirli saydam mavi-gri cam, soğuk Tide iç ışığı, çok az kırmızı tortu.

**Kıyafet/prop:** Red Vial sarnıçlarında yetişmiş cam pullu yılan; doğal yılan anatomisi.

**Saldırı okunurluğu:** Brittle Venom: S kıvrımı sıkışır, küçük diş öne yönelir; venom damla biçimi.

**Animasyon yönü:** S kıpırtısı, sıkışma, hızlı atılma, cam darbe titreşimi, çözülme.

**Sınır:** Kobra kanadı/insan gövdesi/ejderha yok; kırılganlık ağ gibi çatlakla gösterilir.

## Red Vial Alchemist — `red_vial_alchemist`

Bölüm 4 · ranged_caster · Ember

[Görsel sayfa](boards/ch04_undercity_v001.png)

**Kanon:** A ledger-wing bomber. Break the flask rack and the formula breaks with it.

**Siluet:** Geniş alet önlüğü; sağ-sol rack çıkıntısı; atış eli ayrı okunur.

**Renk/malzeme:** Kömür deri, kirli cam teal, Ember amber, kontrollü kırmızı vial.

**Kıyafet/prop:** Yaşayan ledger-wing bomber; yüzü sade yarım solunum örtüsüyle kapalı öneri.

**Saldırı okunurluğu:** Corrosive Phial: seçili flask yukarı kalkar, arka sıra hedefi açılır; atış tek temiz yay izler.

**Animasyon yönü:** Flask seçme, omuz hazırlığı, atış, sıçrama geri tepmesi, yenilgi.

**Sınır:** Kera’nın özgünlüğü korunur; normal rack gameplay break hedefi olarak eklenmez.

## The Red Vial Matron — `boss_red_vial_matron`

Bölüm 4 · alchemist_boss · Ember

[Görsel sayfa](boards/ch04_undercity_v001.png)

**Kanon:** Head of the Red Vial ledger wing. She believes the heir's blood is the last ingredient.

**Siluet:** Dik yetişkin yönetici; geniş iş önlüğü ve iki ayrı düşük flask rack.

**Renk/malzeme:** Kömür ceket, şarap kırmızısı, kirli cam teal, mat bakır.

**Kıyafet/prop:** Ledger wing başı; hesap defteri ve iki ayrı flask rack. Erişkin yüz/saç öneridir.

**Saldırı okunurluğu:** Glass Ward: iki rack arasında ince koruma konturu; Corrosive Flasks: iki aşamalı atış, rack kırılınca ward söner.

**Animasyon yönü:** Hesap kontrolü, ward, çift atış, rack kesintisi, ikinci faz, yenilgi.

**Sınır:** Pin-up/çılgın cadı değil; Fadyme’nin kanını tasarımda gore ile göstermeyin.

**Mevcut hedef ID’leri:** `flask_rack_left`, `flask_rack_right`

## Bridge Revenant — `bridge_revenant`

Bölüm 5 · spectral_guard · Veil

[Görsel sayfa](boards/ch05_forsaken_bridge_v002.png)

**Kanon:** A drowned sentry of the old span. It still hooks anyone who stands at the front, as if the gate had never fallen.

**Siluet:** Kambur uzun nöbetçi; aşağı sarkan tek kancalı zincir büyük negatif boşluk açar.

**Renk/malzeme:** Islak kurşun zırh, çamurlu kül bez, soğuk gri su izleri.

**Kıyafet/prop:** Boğulmuş eski köprü sentry’si; zincir kancası, paslı dar miğfer.

**Saldırı okunurluğu:** Chain Drag: kanca Front hedefe uzanır, zincir gergin tek çizgi; Fracture sonrası kırık levha işareti.

**Animasyon yönü:** Islak salınım, kanca hazırlık, çekiş, darbe, zincirle çöken gövde.

**Sınır:** Bellbound’dan göğüs çanı olmamasıyla ayrılır; yaşayan Oren askeri gibi yüz verilmez.

## Corrupted Crown Guard — `corrupted_crown_guard`

Bölüm 5 · elite_guard · Stone

[Görsel sayfa](boards/ch05_forsaken_bridge_v002.png)

**Kanon:** Crown Guard soldiers still following Crown-era orders. The shield comes up before the signal strike, as it was drilled.

**Siluet:** Kompakt dikdörtgen; büyük tam kalkan ve kısa mızrak.

**Renk/malzeme:** Eski slate çelik, mat oxblood, kirli ivory kraliyet kumaşı.

**Kıyafet/prop:** Yaşayan eski Crown Guard; disiplinli sıra kıyafeti, hasarlı crest.

**Saldırı okunurluğu:** Formation Brace: kalkan önce yükselir, yaralı düşman müttefikine koruma açılır; sonra kısa saldırı.

**Animasyon yönü:** Asker nefesi, brace, koruma, mızrak vuruşu, yenilgi.

**Sınır:** Royal Hollow ile aynı ceset yüzü değil; crest tamamen kazınmış Crownless da değil.

## Lost-Vow Knight — `lost_vow_knight`

Bölüm 5 · elite_duelist · Stone

[Görsel sayfa](boards/ch05_forsaken_bridge_v002.png)

**Kanon:** A dead knight of a broken order. It punishes every shield it sees, because its own failed.

**Siluet:** Yırtık oath pelerini; kırılmış eski kalkan kalıntısı ve iki elli geniş kılıç.

**Renk/malzeme:** Kül çelik, soluk kirli beyaz, sönen Stone gri.

**Kıyafet/prop:** Bozulmuş yeminin ölü şövalyesi; eski kalkanının kırığı belde.

**Saldırı okunurluğu:** Oath Sever: kılıç zırh çizgisinde yükselir; hedef kalkanında kesik şekli; shield hasarı ayrı okunur.

**Animasyon yönü:** Ölü nöbet, iki elli kurma, yarma, darbe, zırhın boşalması.

**Sınır:** Yaşayan Crownless ile karıştırılmaz; kırık kendi kalkanı elinde etkin block yapmaz.

## Marshal Oren — `boss_marshal_oren`

Bölüm 5 · commander_boss · Stone

[Görsel sayfa](boards/ch05_forsaken_bridge_v002.png)

**Kanon:** Mahmut's former commander. He signed the order; he did not know the rite would hollow her out.

**Siluet:** Geniş disiplinli yetişkin komutan; ağır heater shield, tek uzun komuta kılıcı.

**Renk/malzeme:** Mat slate çelik, oxblood pelerin, yıpranmış ivory, az eski altın.

**Kıyafet/prop:** Mahmut’un eski komutanı; ters çevrilmiş eski Crown crest; ayrı signal_standard. Yüz önerisi olgun, kısa gri saç.

**Saldırı okunurluğu:** Shield Formation: kalkan yatay hizaya oturur; Bridge Strike: komuta eli/standard sinyali ve Front sıra vuruş hattı.

**Animasyon yönü:** Nöbet, emir, kalkan formasyon, köprü darbesi, tereddüt, yenilgi ama ölüm animasyonu değil.

**Sınır:** Yaşayan insan; demon/çürümüş yüz yok. Sivilleri kurtarıp köprüde kalışını silmeyin.

**Mevcut hedef ID’leri:** `signal_standard`

## Estate Wraith — `estate_wraith`

Bölüm 6 · spectral_caster · Veil

[Görsel sayfa](boards/ch06_ashen_estate_v001.png)

**Kanon:** A noble shade of the Ashen estate. Having lost its name, it borrows the strongest protection it can see.

**Siluet:** İnce kayan üst gövde; küçük kırık oval portre çerçevesi ve kaybolan etek.

**Renk/malzeme:** Kül gri soylu kumaş, kirli altın, soğuk cam teal.

**Kıyafet/prop:** Büyük evin adını yitirmiş noble shade’i; portre/mirror bağını taşır.

**Saldırı okunurluğu:** Portrait Borrowing: çerçeve korunacak kahramana yönelir; kopyalanan buff sembolü çerçevede tek kez görünür.

**Animasyon yönü:** Portre salınımı, yüz yankısı, buff kopya, cam vuruş, silinme.

**Sınır:** Ashen Lord’un yüzü her sıradan wraith’e eklenmez; yeni yüz canon’ı oluşturulmaz.

## Noble Retainer — `noble_retainer`

Bölüm 6 · support_guard · Dawn

[Görsel sayfa](boards/ch06_ashen_estate_v001.png)

**Kanon:** The ghost of a household attendant. It still steps in front of the most wounded master.

**Siluet:** Alçak eğilen hizmetkâr; iki yana açılan kollar ve geniş servis kumaşı.

**Renk/malzeme:** Mat eski ivory, kömür hizmet ceketi, çok az soğuk teal.

**Kıyafet/prop:** Hanenin ölü attendant’ı; hizmet tepsisi görsel öneri, silah değil.

**Saldırı okunurluğu:** Household Interpose: en yaralı düşman müttefikine dönüp önüne geçer; bir darbe intercept okunur.

**Animasyon yönü:** Servis nöbeti, sahip önüne geçiş, tek intercept, sarsılma, hayaletin sönmesi.

**Sınır:** Yaşayan insan veya şövalye yapılmaz; data faction farkı raporlanır, sessizce değiştirilmez.

## The Ashen Lord's Wraith — `boss_ashen_lord_wraith`

Bölüm 6 · spectral_boss · Veil

[Görsel sayfa](boards/ch06_ashen_estate_v001.png)

**Kanon:** The Ashen Lord, who once hid the bell-keeper's daughter from the Crown. He kept her face and lost her name.

**Siluet:** Uzun soylu üst gövde; büyük dikdörtgen ayna çerçevesi; dumanla kaybolan alt beden.

**Renk/malzeme:** Kül gri, tarnished gold, soğuk cam teal.

**Kıyafet/prop:** Yaklaşık 60 yaşında portrait’teki asil; isim plakası kesilmiş; mirror_frame ayrı hedef.

**Saldırı okunurluğu:** Portrait Double: çerçevede tek savunma buff yankısı; Falling Gallery: üstte boş portreler yönlenir ve arka sıraya kırık cam düşer.

**Animasyon yönü:** Sessiz portre, emir eli, aynada kopya, çerçeve kesintisi, düşen galeri, sönme.

**Sınır:** Kafatası/gore yok; kişisel adı Part I oyuncu etiketinde yazılmaz; gizleyen son görevi korunur.

**Mevcut hedef ID’leri:** `mirror_frame`

## Crownless Knight — `crownless_knight`

Bölüm 7 · elite_guard · Stone

[Görsel sayfa](boards/ch07_first_eclipse_v003.png)

**Kanon:** A knight who stripped his own crest, not out of defiance but despair. It hates shields and ignores fear.

**Siluet:** Dik yaşayan düellocu; kazınmış crest alanı, ince iki elli kılıç, kalkansız açık gövde.

**Renk/malzeme:** Kömür slate, kül ivory, çıplak kazınmış metal.

**Kıyafet/prop:** Crest’ini çaresizlikten kendi sökmüş yaşayan Crown Guard kalıntısı.

**Saldırı okunurluğu:** Crestless Challenge: kılıç ucu hedef kalkanına sabitlenir; savunma yarmadan önce omuz geriye döner.

**Animasyon yönü:** Yaşayan nefes, meydan okuma, shield kesiş, gerileme, diz düşüşü.

**Sınır:** Lost-Vow’dan canlı yüz/crest boşluğu/kalkansızlık ile ayrılır; yeni fear büyüsü yok.

## Eclipse Sentinel — `eclipse_sentinel`

Bölüm 7 · warder · Veil

[Görsel sayfa](boards/ch07_first_eclipse_v003.png)

**Kanon:** Warders of the First Eclipse who feed the altar's barrier through its pylons.

**Siluet:** Dik sütun; elde küçük üç ayaklı pylon anahtarı, geniş omuz mantle.

**Renk/malzeme:** Kömür taş bez, kirli pirinç, kısıtlı Veil mor.

**Kıyafet/prop:** Yaşayan First Eclipse warder; pylon biçimli asa tasarım önerisi.

**Saldırı okunurluğu:** Pylon Ward: asa yere iner; kendi müttefikleri çevresinde segmentli koruma konturu.

**Animasyon yönü:** Nöbet, asa indirme, ward, kanal bozulması, yenilgi.

**Sınır:** Construct/robot değildir; Cael’in watch/scale coat sembolleri taşınmaz.

## Royal Hollow — `royal_hollow`

Bölüm 7 · armored_vanguard · Stone

[Görsel sayfa](boards/ch07_first_eclipse_v003.png)

**Kanon:** A palace guard still standing at a post that no longer exists. It blocks one blow each round, as it always did.

**Siluet:** Dik boş taht nöbeti; çok geniş katı kalkan, yüksek boş miğfer.

**Renk/malzeme:** Kül çelik, soluk ivory tabard, kararmış altın.

**Kıyafet/prop:** Artık bulunmayan saray postunu koruyan ölü guard; donmuş disiplin.

**Saldırı okunurluğu:** Empty Throne: kalkan ilk darbe için kapanır; blok konturu kırılınca tekrar vurulabilirliği açık gösterilir.

**Animasyon yönü:** Ölü nöbet, ilk block, kısa strike, zırh sarsılması, boş zırh düşüşü.

**Sınır:** Corrupted Crown Guard’dan boş miğfer/nefessiz duruş ile ayrılır; tahta oturan kral değildir.

## Eclipse Construct — `boss_eclipse_construct`

Bölüm 7 · mythic_construct_boss · Veil

[Görsel sayfa](boards/ch07_first_eclipse_v003.png)

**Kanon:** The hinge of the First Eclipse Altar, built around the Eclipse Bell. It is the instrument, not the author.

**Siluet:** Dev dik mekanik çerçeve; boş kırık taç halkası, iç Eclipse Bell, dış zincir eklemleri.

**Renk/malzeme:** Kömür taş, eski bronz, kül ivory, küçük soğuk Veil çekirdek.

**Kıyafet/prop:** Hinge: mekanizma, ölü/tanrı/Cael’in bedeni değil. İki kol ve iki ayak, solda/sağda joint ve tek ankle anchor; üç ayrı altar pylon.

**Saldırı okunurluğu:** Crownless Frame: Front sweep çizgisi; üç joint açık hedef. Aether Ward: 50% geçişte segmentli ward; pylons ve Eclipse Pulse ayrı okunur.

**Animasyon yönü:** Mekanik nöbet, sweep kurma, eklem break/stagger, tek faz geçişi, ward pulse, makine çöküşü.

**Sınır:** Üçüncü faz icat edilmez; Cael final boss diye etiketlenmez; background pylons gövdeye kaynamaz.

**Mevcut hedef ID’leri:** `chain_joint_left`, `chain_joint_right`, `ankle_anchor`, `altar_pylon_left`, `altar_pylon_center`, `altar_pylon_right`

