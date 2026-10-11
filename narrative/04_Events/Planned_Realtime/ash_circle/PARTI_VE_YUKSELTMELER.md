# Parti ve koşu geliştirmeleri

Oyuncu kendi envanterinden beş **farklı sahip olunan** karakter seçer. Sıralama bu moda özgüdür: slot 0 lider, 1–4 destek. Front/Rear kuralı taşınmaz. Party preset yalnızca bir kolaylık kaydıdır; server sahiplik ve adapter sürümünü her yeni session'da denetler. Story guest sahiplik sayılmaz. Canon'a göre Brin/Nixie ve First Oath selector ile beş kalıcı kahraman 1-5 öncesinde mümkündür; 4-5 eşiğinde ücretli karakter zorunluluğu yoktur. Başlangıç koşusu için gacha rolu zorunlu tutulmaz.

## Normalize etme

Her lider 100 HP, 240 hız, 72 pickup radius ile başlar. Ana level, rarity, duplicates, awakening, gear ve skill rank hesaplamaya girmez. Destekler bağımsız can/hareket yerine %65 hasarlı otomatik cast ve küçük rol pasifi sağlar. Gacha ya da rarity gizli çarpan yaratmaz. Dört destek aynı silah ailesini taşıyabilir; her slotun cooldown/rank'i ayrıdır. Bu çeşitlilik amacı gerçek karakter kitleri taşındı iddiası değildir.

20 canon ID `roster_adapters.json` içinde açıkça eşlendi. Her biri lider olabilir. Altı silah: Rivet Guard (sektör), Cinder Flask (küçük alan), Wind Needle (tek çizgi), Witness Mark (hedef alanı), Returning Mist (gidiş/dönüş), Shadow Thread (çizgi ışını). Main combat'ın heal/status/element/Focus/ultimate kuralları burada otomatik işlemez. Silah isimleri yeni mode-specific isimlerdir.

| Destek tipi | Verdiği etki | En fazla stack |
|---|---|---|
| brace | alınan temas hasarı −1 | 3 |
| veil_step | hasar sonrası iframe +3 tick | 1 |
| wide_cast | alan boyutları +%6 | 3 |
| scout | pickup radius +16 | 1 |
| mend | her 300 savaş tick'inde 1 HP | 3 |
| precision | slot hasarlarına +%4 | 3 |
| tempo | cooldown'a −%3 | 3 |

Lider pasifi ayrıca çalışmaz. Fazla stack'in uygulanmadığı loadout ekranında gösterilir; farklı karakterlerin aynı silah ailesini kullanması yasaklanmaz. Pasif trait toplamları ve kart bonusları tek, belirlenmiş sıra ile hesaplanır; ayrı UI tahmini hasar kaynağı olamaz.

## Kart havuzu

Beş slotun her biri için Force/Tempo/Reach bulunur: toplam 15 slot kartı. Vigor, Stride, Gather, Ward ve Recovery ile havuz 20 karttır. Her kart dört rank taşır. Force +%12/24/36/48 hasar; Tempo −%8/16/24/32 cooldown; Reach +%8/16/24/32 menzil/alan. Vigor +10/20/30/40 max HP ve yalnızca yeni eklenen fark kadar tek heal; Stride +%4/8/12/16 hız; Gather +16/32/48/64 pickup; Ward −1/2/3/4 hasar; Recovery her 300 tick'te 1/2/3/4 heal. Rank değerleri birbirine eklenmez, güncel toplam kullanılır. Minimum damage 1 ve minimum cast cooldown 12 tick korunur.

Seviye 1'den 20'ye kadar en fazla 19 seçim olur. Gereken XP 8,12,...,80'dir (sonraki level için ayrı eşik; toplam 836 XP). Tüm koşuların level20'ye ulaşması şart değildir. Uygun kartlar rank<4 koşuluyla seed'li seçilir; üç farklı ID teklif edilir, kullanılabilir slot şartı zaten beşli partiyle sağlanır. 19 seçimde en çok dört kart tam kapatılabilir; en az 16 uygun kart kalır. Reroll, banish veya satın alınan yenileme yoktur. Renk/rarity ile yanlış güç sınıfı anlatılmaz.

## Test edilecek üç farklı build

**Yakın muhafız:** Mahmut lider; Brin/Jori/Fadyme/Nixie destek. İlk kartlar lead Reach, Vigor, Ward; temas aralığı açılıp koridor tutulur. Risk: uzak hedefe yetişirken düşük damage ve eksik objectives. **Uzak rota:** Nixie lider; Mahmut/Jori/Fadyme/seçilmiş ücretsiz selector destek. Lead Force/Tempo, Stride, Gather; hatları keserken uzaktan isabet. Risk: küçük darbe havuzu yüzünden köşe girişleri. **Alan okuyucu:** Fadyme lider; Mahmut/Brin/Nixie/Jori destek. Support alan Reach, lead Force, Recovery; eski hareket izini okumayı ve alan temizlemeyi ödüllendirir. Risk: kestirme tekrarında ink ve hedef dağılması.

Bunlar gerçek balance sonucu değildir. Ücretsiz selector'ın yedi seçeneği ve beş free recruit setiyle her chapter base kademenin bitirilebilirliği playtest kapısıdır. 20 hero adapter'ı şimdilik family rolleri paylaştığı için tüm karakterlere birbirinden bütünüyle farklı aksiyon kitleri yazılmış değildir. İlk dilimden sonra sadece üretim bütçesi ve denge elverdiğinde özgün signature ayrıntıları eklenir.

## Sonsuz ölçeklenme yerine kontrollü zorlaşma

Rank0–5 arasında enemy HP 1/1.18/1.36/1.54/1.72/1.90; enemy damage 1/1.10/.../1.50; boss HP 1/1.15/.../1.75; batch başına +rank düşman. Speed küçük adımla en fazla 1.125. Warning sabit. Cap tüm ranklarda 160. Çok yüksek rankta projectile pool sıkışması support hasarını beklenmedik azaltabilir; QA cap-denied-cast oranını ayrıca ölçer. Bu yüzden rank5 sertifikalı geçilebilirlik değildir. Kademe sayısı gelecekte veriyle büyütülür; statlar artarken kontrol dili ve Android cihaz sınırları korunur.
