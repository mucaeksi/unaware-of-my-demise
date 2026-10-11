# Bağımsız ilerleme ve kayıt

Hikâye eşiği bir defa `unlock_granted` açar. Sonrasında campaign node, ana gear ve afk state bu moda girmez. Hücre ID'si `rank*10 + chapter` (1–60). Başlangıç highest_verified_cell=0, ilk seçilebilir hücre 1. Server onaylı sıradaki zafer alanı bir artırır; eski hücre replay'i artırmaz. Seçim <=min(60,highest+1) şartıyla daha önce açılmış hücreleri içerir. Rank0 chapter10'dan sonra rank1 chapter1, sonra aynı sıra devam eder. Rank5 chapter10 mevcut paketin son onaylı hücresidir; event menüsü ve tekrar oynayış kapanmaz. Gelecek ranklar ayrı QA ile eklenir.

Permanent stat, event para, talent ağacı, ücretli ekstra deneme ve rastgele kalıcı item yoktur. Hesapta bölüm/kademe ilerlemesi, görülen sahneler, ton notu ve kişisel best kalır. Koşunun XP'si, kartları, objektifleri ve canlı düşmanları o run'a aittir. Yenilgi ve abandon yalnız run'ı kapatır. Bu ekonomi kararı ödül miktarı seçildi demek değildir: rewards.binding=null, energy_cost=null taslak ayarını ifade eder; yayın öncesi sahibi açıkça bağlar. Runtime null'ı otomatik free Ration veya standart boss loot olarak yorumlamaz.

## Session durumları

`prepared → active ↔ paused → pending_verification → accepted/defeated/rejected`. Active veya paused açık abandon'a gidebilir. Accepted/defeated/abandoned/rejected terminaldir. Aynı run ikinci kez gönderildiğinde server aynı kayıt sonucunu döndürür. D1 unique(player,run) ve transaction ile birden çok ilerleme veya gelecekte çift ödül önlenir. Ödül bağlanana kadar reward claim alanı/grant handler'ı eklenmez.

Run başlangıcında cell, seed, simulation revision, içerik digest, sahiplikten normalize edilmiş loadout ve 5'li roster snapshot sabitlenir. UI'daki gear değişikliği mevcut run'ı etkilemez. Onaylanan ilerlemeden sonra clear scene tetiklenir. Scene skip sadece o metnin checkpoint'ini yazar; savaş sonucu üretmez. Server cevabı beklerken UI 'Checking this run...' der; client zafer yazıp sonra geri çekmez.

## Kaydetme ve uygulama yaşam döngüsü

900 tick / 30 savaş sn'de integer checkpoint + input prefix kaydı; her upgrade teklifinden ve VN açılışından önce ayrıca atomic yerel snapshot. Checkpoint yeni chapter kazanımı sayılmaz. Pause, Android background, telefon kilidi ve focus kaybı gameplay saatini durdurur; yeniden açıldığında geri sayım gösterilip explicit resume ile hareket başlar. Input joystick nötrleştirilir; bırakılmış pointer sürekli yürütmez. Ses geri dönüşte ayarlanır, play ödül tetiklemez.

Pending choice öncesindeki StoryRunner save alınır; interpreter pending choice sırasında save() yapmaz. Restore aynı choice IDs ve cursor ile yapılır. Pending upgrade üç ID'si teklif üretildiği tick'te kaydedilir; RNG yeniden çekilmez. Aynı headless sim input prefix'i yeniden oynatıp checkpoint'i doğrular; client snapshot tek başına güvenilir değildir.

Bir player/mode için tek authoritative session. İkinci cihaz resume veya açık abandon seçer; generation/CAS eski session'ın tamamlamasını reddeder. Ağ yoksa yerel practice mümkündür, doğrulanmış ilerleme yazılmaz. Ağ kesilmesinde accepted result kaybolmaz; pending session id ile sonuç polling idempotent'tir.

Sürüm güncellemesinde aktif run eski revision'a pinli kalır. Server en az ilan edilmiş 7 günlük session retirement penceresi boyunca eski sim'i tutmalıdır; bu altyapı kurulmadıysa mode publish edilmez. İlanlı server expiry, arka planda geçen zamanı savaş süresine çeviremez. Desteklenmeyen eski run kapanır, doğrulanmış bölüm kaybolmaz. Scene ID/cell ID migration tablosu silinerek baştan başlatılamaz.

## Kişisel kayıt

Best ayrı revision/rank/chapter anahtarındadır. Önce boss penceresinde daha çok kalan tick, eşitse daha az alınan hasar, eşitse lexical run ID. Pause süresi yarış metriği değildir. Party snapshot recapa eklenir; sonraki run başka beşliyle başlatılabilir. Rerun yeni canonical olay veya yeni ilk-clear claim oluşturmaz. Global leaderboard, daily görev ve ödül kodu bu hazırlığa dahil değildir.
