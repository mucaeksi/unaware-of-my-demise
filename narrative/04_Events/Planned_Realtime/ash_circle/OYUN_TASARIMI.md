# Kül Çemberi — oyun tasarımı

Oyuncu açılması gereken bir yolun içinde sürekli yön değiştirmek zorundadır. Hareket ve otomatik saldırı Survivors türünün tanıdık temelidir; avluya özgü rota işleri, yerel bir işçi hikâyesi ve oyuncunun parti tercihi bu oyunun kimliğini kurar. Referanslardan varlık, harita, arayüz, silah adı veya evolution zinciri kopyalanmaz.

## Kapsam

İlk sürümde tek 4096×3072 dünya, 10 ayrı bölüm, beş düşman ailesi, 10 türetilmiş boss profili, 20 sahip olunan karakter için altı silah ailesine dayalı adapter bulunur. 3D, ağ üzerinden ortak arena, beş hareket eden kahraman, sonsuz düşman, otomatik farm, main combat effect interpreter'ı, yeni para ve gacha eklentisi kapsam dışındadır. Bunlar eksiği örtmek için bırakılan isimler değildir; ilk oynanabilir dilimin teslim edilebilir sınırlarıdır.

## Giriş ve kontrol

Home → Events → Ash Circle → bölüm/kademe seçimi → kayıtlı 5'li parti → briefing → koşu. İlk girişte opening ve ton seçimi izlenir. Sahip olmayan oyuncuya eksik karakter sayısı ve mevcut ücretsiz edinim yolu gösterilir; satın alma çağrısı yapılmaz. 4-5 gate etiketi server'ın gerçek stage/node kaydına açıkça eşlenmeden mod açılmaz.

Dokunmatik hareket, serbest konumlanan sol joystick veya oyuncunun seçtiği sabit joystick ile yapılır. Sağda objektifle etkileşim, boss odak aç/kapat ve pause vardır. Otomatik saldırı hedefi yakın tehditten seçer. Bir saniyelik etkileşim sırasında hareket veya alınan hasar kanalı keser; tüketilmiş kaynak yoktur. İlk bölümde en yakın objektif simgesi ve oku görünür. Gamepad/klavye aynı kuantize komutları üretir. Sürükleyerek dünyada teleport etme kullanılmaz.

Liderin ölümü koşuyu bitirir. Desteklerin ayrı canı ve AI hareketi yoktur. Ne cooldown ne saldırı kameranın render FPS'ine bağlıdır. Ana oyunun Auto/Sweep/Ration/boss görevleri bu moda otomatik aktarılmaz.

## Koşunun akışı

0–2 dakika: birinci iş, düşman dili ve ilk yükseltmeler. 2–4: ikinci iş ve farklı yaklaşım hattı. Tam 4. dakikada bir kez kısa hikâye arası; dünya ve tüm sayaçlar donar. 4–6: üçüncü iş ve boss yolunu açma. 6. dakikada üç iş de tamamlanmadıysa açık gerekçeli yenilgi. Tamamsa kalan normal düşmanlar XP vermeden çıkarılır, yerdeki XP toplanır, boss uyarısı saat dururken gösterilir. Boss için en fazla 2 dakika vardır. Boss öldüğü ve lider hayatta kaldığı tick'te zafer; aynı tick'te lider ölümü yenilgidir. Tahliye gibi sıralı işler son anda atlanamaz.

Seviye yükselince dünya durur ve üç farklı kart gösterilir. Tek kart seçilir. RNG, seçenekler ve seçim input'u kayda girer. Seçim bekleyen uygulama kapanırsa aynı üç kartla açılır; yeni teklif için uygulama kapatma yolu yoktur. Kartlar sadece bu koşuda kalır. 20. seviyede teklif penceresi biterek koşu devam eder.

## Hikâye omurgası

4-5 sonrası Oakhaven'a dönen Jori, köyün erzak yolunun Rusk'ın yenilgisine rağmen kapalı olduğunu görür. Avlu görevlisi Tovin bunu eski bir sıkışıklık gibi anlatır. Kayıt tutan Mera, yavaşça ortaya çıkan ücret silmeleri, kapatılmış aile sığınağı ve gönderilmemiş defin talebiyle bu açıklamayı sınar. Tovin'in suç ortaklığı tek sürpriz cümleye sıkıştırılmaz: tartıda imza, rotada bahanenin çökmesi, defterde ödeme ve arabada gönderilmeyen talep aşamaları vardır.

Finalde bir tanık mucizesiyle bütün ölüler kurtarılmaz. Yol açılır, kanıt korunur, eksik adlar için köyün gerçek tanıkları çağrılır. Tovin sorumluluk alır ve orada kalır; bağışlandığını söyleyen toplu bir cümle yoktur. Jori kendi canon kapı nöbetine döner. Fadyme'nin sırrı, sealed order, C.V. ve Part II bu yerel olayın cevabı yapılmaz.

## Tekrar oynanabilirlik

Temel 10 bölüm hikâyeyi bitirir. Aynı arena daha sonra kayıt üzerinden rekonstrüksiyon olarak oynanır; avlunun gerçekten yeniden kapandığı veya yüzlerce kez yeni ölü çıktığı iddia edilmez. Her kademenin 10 bölümü önceki kademeden daha yüksek sayısal baskı taşır, fakat uyarı süreleri kısalmaz ve eşzamanlı hard cap artmaz. Değişik lider, dört destek ve kart sıraları kişisel rekoru iyileştirmeyi sağlar. Yeni rank eklemek oyuncunun eski zaferlerini silmez.

## Erişilebilirlik

Uyarı tehlikesi kontur, şekil ve yönle anlatılır; renk tek bilgi taşıyıcısı değildir. Kül efekti hasar alanını örtmez. UI büyütme, sabit joystick, titreşim kapatma, azaltılmış ekran hareketi ve hasar metni kapatma seçenekleri gerekir. Hikâye satırı veya yükseltme seçimi aktif kaçış üstüne bindirilmez. Pause süresi skoru değiştirmez; daha düşük kalite aynı düşman sayısı ve hasarı korur.
