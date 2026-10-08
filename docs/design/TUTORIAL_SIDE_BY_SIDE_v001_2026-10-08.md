# Yan Yana — Side by Side

Üç bölümlü oynanabilir tutorial mini hikâyesi · v001 · 2026-10-08

**Durum:** Sahibin yeni kapsamına göre hazırlanmış senaryo önerisi. Yeni olaylar ve replikler taslaktır; canon ledger, mevcut bölüm metinleri veya çalışma zamanı değiştirilmedi. İngilizce oyun metni; Türkçe tasarım ve yönetmen notları.

## Sahibin belirlediği kapsam

- Tutorial, main story öncesinde yer alacak ve mevcut 1-1'e bağlanacak.
- Üç bölüm boyunca oynanabilir karakterler yalnızca `fadyme` ve `mahmut`.
- Düşman çeşidi en fazla iki; düşük seviye, common karşılaşmalar. Yeni boss veya elit yok.
- Üç bölümün verileri, görselleri, sesleri ve oynatmak için gereken bağımlılıkları ilk AAB içerisinde olacak. Geri kalan içerik patch ile gelecek.
- Önce senaryo üzerinde çalışılıyor. Klasör düzenlemesi sonraya bırakıldı.

İlk AAB kapsamı, 7 Ekim auditindeki tutorial'ın ilk zorunlu pakette olabileceği önerisinin yerine sahibin bu oturumdaki yönünü esas alır. Bu belge bir AAB veya paket uygulaması yapmaz.

## Ana fikir

**Küçük amaç:** Fadyme ve Mahmut, hava kararmadan orman yolundaki terk edilmiş yol tapınağına ulaşmak ve geceyi bir çatı altında geçirmek ister.

Oyuncu önce iki insanın yol arkadaşlığını tanır: Mahmut kısa, pratik cümlelerle önünü kollar; Fadyme kuru mizahla onun yanında yürümeyi seçer. Ardından yolun artık sıradan olmadığını fark eder. Üç bölümün sonunda küçük amaç tamamlanır; güvenli görünen durak, ana hikâyenin mevcut açılışının sahnesi olur.

Önerilen toplam ilk oynanış: yaklaşık 8–10 dakika; üç kısa karşılaşma ve aralarındaki VN sahneleri. Bu bir süre hedefidir, ölçülmüş çalışma zamanı değildir. Yan görev, keşif haritası, serbest dolaşma veya yeni hareket sistemi varsayılmaz; mevcut VN + otomatik savaş biçimi kullanılır.

## Zaman ve devamlılık

Bu olaylar Part I açılışından hemen önceki akşam ve geceye yerleştirilir. İkili zaten birbirini bulmuştur; tutorial bir ilk tanışma veya yeniden kavuşma değildir. Yeni adlandırılmış köy, tarihî olay, aile bilgisi veya düşmanların kökenine ilişkin açıklama eklenmez.

Akış:

`Entry / mevcut sunum → T-1 → T-2 → T-3 → main story paketi hazır olunca opening_sad_scene → 1-1 The Road That Whispers`

`opening_sad_scene` tapınakta şafak öncesi başlar. Mektup, kan lekesi, hekim tahmini, Yseldra'nın ilk görünüşü ve kendiliğinden çalan çağrı çanı o sahnede kalır. Tutorial bunları önceden oynatmaz. T-3 ile açılış arasında kısa bir zaman kesmesi yeterlidir; yeni bir hikâye durağı gerekmez.

## İki düşman

| Tür | Mevcut ID | Tutorial rolü |
|---|---|---|
| Bellbound Dead | `bellbound_dead` | Tek başına zayıf, doğrudan yakın saldırılar; ilk savaşın okunabilir tehdidi. |
| Hollow Pilgrim | `hollow_pilgrim` | Yavaş ve daha dayanıklı ön saf düşmanı; niyet simgesi ve Ultimate zamanlaması için ikinci karşılaşma. |

İkisi de mevcut Chapter 1 bestiary'sinde bulunur. Bellbound Dead katalogda açıkça düşük tier ve tek başına zayıf olarak tanımlanır. Hollow Pilgrim daha yüksek HP/DEF, düşük hız ve düşük saldırıyla ayrışır. Buradaki **common**, önerilen tutorial karşılaşma kapsamıdır: katalogda ayrı bir enemy rarity alanı yoktur; `necropolis_inspiration_tier` oyun rarity'si veya kesin güç sıralaması olarak kullanılmaz.

Mevcut iki düşmanın da Veil direnci vardır. Fadyme'nin katkısı zarar vermenin yanında Dread, iyileştirme ve temizlemeden görünür kılınmalı; anlatı uğruna element veya beceri kuralları sessizce değiştirilmemeli. Sayılar ve savaş süresi uygulama aşamasında iki karakterle ölçülecek.

## T-1 — İlk Adım / The First Step

**Hikâye:** Günün son ışığı, ıslak taş yol. Mahmut çamurda daha sağlam basılacak yeri seçer; Fadyme bunun bile küçük bir başarı olduğunu söyleyerek onun ciddiyetini yumuşatır. Yolun daraldığı yerde iki Bellbound Dead yaklaşır. İkili ilk kez oyuncunun önünde birlikte savaşır.

**Karşılaşma önerisi:** 2 × Bellbound Dead, tek kısa karşılaşma. Yeni tür, boss veya faz yok.

**Öğrenme:** Mahmut önde, Fadyme arkada. Savaş otomatik ilerler; hız statı tur sırasını belirler, Basic/Active beceriler kurallarıyla çalışır. Oyuncu niyet simgelerini ve iki karakterin katkısını görür. x1 gösterilir; x2 açılmaz. Manuel Basic/Active düğmesi öğretilmez.

**Sahne başı — İngilizce replik taslağı:**

> MAHMUT: “Keep to the stones. The mud gets deeper ahead.”
>
> FADYME: “The stones have already claimed one boot.”
>
> MAHMUT: “Both boots are still with us.”
>
> FADYME: “Then the road is being generous.”

**Savaş sonrası:**

> MAHMUT: “Are you hurt?”
>
> FADYME: “Only my opinion of this road.”
>
> MAHMUT: “We can rest.”
>
> FADYME: “A little farther. While there's still light.”

**Duygusal sonuç:** Fadyme korunacak bir yük gibi sunulmaz; ilerlemek konusunda söz sahibidir. Mahmut endişesini fark edilmeden önce savaş ve dinlenme önerisiyle gösterir.

## T-2 — Yolunu Unutan / A Road Forgotten

**Hikâye:** Aynı yolun daha dar kesiminde bir Hollow Pilgrim aynı taşların üzerinden tekrar tekrar geçer. Fadyme bir an onu izler; düşmanın bir zamanlar sıradan bir yolcu olabileceğini düşündüren kısa bir sessizlik olur. Pilgrim ikiliyi fark edip üzerlerine yürüdüğünde Mahmut kalkanını kaldırır.

Hollow'un alışkanlık tekrarlaması mevcut dünya kaynağına dayanır. Fadyme'nin yol hakkında söylediği söz, kayıp bir tapınağı veya yeni tarihî olayı doğrulamaz; bir tahmindir.

**Karşılaşma önerisi:** 1 × Hollow Pilgrim. Adı olan özel bir düşman, mini boss veya üçüncü tür değildir.

**Öğrenme:** Düşmanın görünen niyeti, otomatik koruma ve destek, Focus birikmesi ve oyuncunun Ultimate zamanlaması. Mahmut'un `Last Wall at Dusk` becerisi mevcut etki kurallarıyla gösterilir. Normal saldırı seçimi veya saldırıyı refleksle engelleme mekaniği eklenmez.

**Sahne başı:**

> MAHMUT: “It has crossed this patch three times.”
>
> FADYME: “Perhaps the road used to end here.”
>
> MAHMUT: “Stay back. It has seen us.”
>
> FADYME: “Then let's give it room.”

**Savaş sonrası:**

> MAHMUT: “Your footing is steady.”
>
> FADYME: “So is your shield. I checked.”
>
> MAHMUT: “Again?”
>
> FADYME: “It was a thorough inspection.”

**Duygusal sonuç:** Sadece Mahmut'un Fadyme'yi kurtardığı bir ilişki kurulmaz. Fadyme'nin `Borrowed Hour` desteği ile Mahmut'un korunması da görünür; mizah zafer gösterisi yerine kısa bir rahatlama sağlar.

## T-3 — Bir Çatı Altında / A Roof Before Dawn

**Hikâye:** Yağmur başlarken yol tapınağının çatısı görünür. Yaklaşımda iki Bellbound Dead ve bir Hollow Pilgrim yolu kapatır. Tanınmış iki tehdit ilk kez aynı savaşta bulunur. İkili geçidi açar ve tapınağa ulaşır.

**Karşılaşma önerisi:** 2 × Bellbound Dead + 1 × Hollow Pilgrim. Son savaş bir tekrar ve birleşimdir; boss barı, elit varyant, çok faz veya yeni düşman yoktur.

**Öğrenme:** İki rolü birlikte okumak, Focus/Ultimate bilgisini uygulamak, Fadyme'nin `The Bell That Forgets` becerisiyle destek ve temizleme katkısını görmek. İlk manuel kullanımın ardından Auto Ultimate seçeneği kısaca tanıtılabilir. Oyun kendisi Basic/Active kullanmaya devam eder.

**Sahne başı:**

> MAHMUT: “A roof. We stop there.”
>
> FADYME: “That sounded almost like a plan.”
>
> MAHMUT: “It is a plan.”
>
> FADYME: “A good one, then.”

**Savaş sonrası ve mini hikâyenin kapanışı:**

> MAHMUT: “Dry enough inside. I'll find something for supper.”
>
> FADYME: “Do we have something for supper?”
>
> MAHMUT: “We have possibilities.”
>
> FADYME: “Try not to burn all of them.”
>
> MAHMUT: “Come in when you're ready.”
>
> FADYME: “In a moment.”

Mahmut yiyecek ve dinlenme yerini hazırlamak için içeri geçer. Fadyme eşikte kısa bir an kalır. Yağmur ve uzaktaki ağaçlar; sonra kararma. Mektup açılmaz, hastalık açıklanmaz, çağrı çanı çalmaz.

**Kapanış ekranı önerisi:** “A roof for the night. The road continues at dawn.”

Mini hikâyenin amacı tamamlanmıştır. Main story hazır olduğunda şafak öncesi tapınak açılışı başlar. Oradaki mevcut “You missed supper. I saved the part that did not burn.” repliği, tutorial'daki küçük yemek şakasına karşılık verir; yeni bir açıklama yazmadan devamlılık kurar. Ardından mevcut 1-1 oynanır.

## Tutorial ve 1-1 sorumlulukları

- T-1/T-2/T-3 ayrı onboarding kimlikleri; 1-1/1-2/1-3 olarak yeniden adlandırılmaz. Main story'nin 35 düğümü korunur.
- Üç tutorial karşılaşması için no-Ration ve iki karakterli ayrı istisna önerilir. Mevcut runtime bu istisnayı yalnızca 1-1 için tanır; üç yeni istisnanın hazır olduğu varsayılmaz.
- 1-1'in mevcut sahneleri, düşmanları ve ücretsiz iki karakterli kuralı korunur. Daha önce görülen `tutorial_auto_basics`, `tutorial_ultimate`, `tutorial_speed_x1` kartları tutorial durumu üzerinden ikinci kez zorunlu gösterilmez; tekrar yardımından erişilebilir kalır. Bu bir önerilen değişikliktir, henüz uygulanmadı.
- 1-2'nin beş kişilik formasyon/story-loan eğitimi, Brin/Nixie/Kera ve First Oath akışı tutorial'a taşınmaz. x2'nin mevcut 1-4 açılması korunur.
- Tutorial için sabit başlangıç kitleri ve tekrar oynanabilirlik önerilir. İlerleme, envanter, ödül ve açılma kimlikleri aynı değildir: T-3 tamamlanması 1-1'i tamamlanmış saymaz, Brin veya First Oath vermez. Tamamlama ödülleri bu taslakta belirlenmedi.
- Düşük seviye düşmanların erken ölmesi nedeniyle Focus gösterimi atlanmamalı. Guided savaşın başlangıç Focus'u, dalga zamanlaması veya stat ölçeği mevcut kurallarla ayrıca tasarlanıp ölçülmeli; bu belgede sahte bir sayısal balans veya otomatik galibiyet iddia edilmez.

## İlk AAB ve sonraki patch sınırı

**İlk AAB:** Üç tutorial'ın bütün karakter/düşman katalog bağımlılıkları, beceriler ve efektler; iki karakterin savaş/VN varlıkları; iki düşmanın varlıkları; yol ve tapınak yaklaşımı görselleri; seçilecek yerel ses/müzik; tutorial yönlendirmeleri, ilerleme kaydı ve mevcut bootstrap/Entry/client renderer kodu. Üç yakın çevre aynı görsel setin düzenlenmiş varyasyonlarıyla üretilebilir; buna rağmen gerek duyulan dosyalar build envanterinde tek tek doğrulanmalı.

**Patch:** Mevcut Part I tapınak açılışı ve 1-1 dahil main story; diğer karakterler/düşmanlar, alanlar ve hikâye medyası. Kullanıcının “geri kalan tüm content” yönü esas alınır. Çalıştırıcılar ve client yetenekleri AAB'de kalır; bu taslak mevcut içerik-only paket sınırını aşan bir script patch'i önermez.

**Geçiş:** Main story paketi T-3 sonunda hazırsa kısa kesme ile mevcut açılışa devam edilir. Hazır değilse tamamlanan mini hikâyenin ardından anlaşılır indirme/devam durumu gösterilir. T-3 ilerlemesi korunmalı; indirme iptali veya hatası tutorial'ı kaybettirmemeli. Tutorial, main story paketinin hazır olmasına bağlanmamalı. Bu içerik bağımsızlığı tüm hesap/servis işlemlerinin çevrimdışı olduğu anlamına gelmez.

Mevcut Entry/GameFlow bootstrap sırası ve tek kümülatif pack kurulumu bu ayrım için sonraki uygulamada ele alınacak. Senaryo aşamasında export, installer, account state veya canlı UI değiştirilmedi.

## Kaynaklar ve yaratıcı sınır

Doğrulanan kaynaklar:

- `narrative/00_Canon/canon.md`: Fadyme'nin bildiği ve Mahmut'tan sakladığı gerçekler, ayrılık ve yeniden buluşma.
- `narrative/06_Characters/Playable/fadyme.md`: Yol arkadaşı olma isteği, kesin ve kuru mizahı, Veil destek rolü.
- `narrative/06_Characters/Playable/mahmut.md`: Kısa cümleler, kuru mizah, koruma ve Stone tank rolü.
- `narrative/05_Codex_Lore/world.md`: Hollows'un eski alışkanlıklarını tekrarlaması.
- `narrative/07_Enemies_Bosses/bestiary.md`: İki seçilen türün Chapter 1 kaydı.
- `narrative/02_Main_Story/Chapters/story_script_ch01.json`: `opening_sad_scene`, mevcut 1-1 ve tutorial kartları; 1-2 formasyon/loan akışı.
- `narrative/01_Story_Bible/STORY_BIBLE_PART1.md`: 35 düğüm, iki karakterli mevcut istisna, x2 açılması ve reveal sırası.
- `game/data/content/characters_part1.json`: Gerçek otomatik Basic/Active ve Ultimate becerileri.
- `game/data/content/enemies_part1.json`: İki düşmanın mevcut rol, stat ve Veil direnci.
- `docs/design/BOOTSTRAP_CONTENT_AND_PROLOGUE_AUDIT_2026-10-07.md`: Önceki paket önerisi ve henüz ayrılmamış bootstrap/two-hero tutorial sınırı.

Bu kaynaklar önerilen yeni replikleri veya tutorial olaylarını önceden onaylanmış canon yapmaz. Hikâyedeki yeni olay dizisi, başlıklar, karşılaşma sayıları, süre ve paket geçişi bu belgeye ait tasarım önerileridir.
