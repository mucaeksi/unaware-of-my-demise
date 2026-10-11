# QA ve yayın kabulü

Bu paket authoring doğrulamasıyla teslim edilir. Aşağıdaki release koşulları geliştirme yapılmadan PASS değildir. JSON data doğru diye boss dengesi, collision güvenliği veya Android performansı sonuçlandırılamaz.

## Hazırlık aşamasında doğrulananlar

Tam10 contiguous chapter, tek arena ref, 60 rank/chapter cell, tüm boss/family/card/triggers refs, scene ve line ID uniqueness, source hashes, bütün English metinlerin script/CSV/export eşliği. Current StoryScene Zod parse ve StoryRunner yürütmesi; satır öncesi/sonrası save-restore, pending choice öncesi save, tüm tone seçenekleri, checkpoint restore. Tasarım referans scheduler'i phase/batch/cap/time sınırlarını ve kağıt üstü HP yükünün kademeyle artışını ölçer. Reference progress model'i gating, defeat/abandon, retry, replay ve max cell davranışını denetler. Bu model gerçek D1/server veya collision sim değildir.

## İlk playable dilimin kabulü

1. Aynı seed/loadout/input headless ve browser sim digest'i aynı;30 render FPS ile60 FPS aynı sim sonucu.
2. Joystick tüm kamera kenarlarında çalışır; hareket sınırı, objective cancel ve target stable ordering altın fixture ile kanıtlı.
3. C1 üç objectif + boss kazanma; yanlış/eksik iş, ölüm ve timeout ayrı açıklamayla kaybetme. Aynı tick boss/hero death → loss; son tick geçerli boss kill → win.
4. Offer yalnız eligible3 farklı kart; rank cap taşmaz, pending offer ve XP kalan miktarı restore'da birebir. Level20 yeni offer açmaz.
5. Spawn portal hero220, objective160 ve warning sözleşmesine uyar; kamera kenar fallback görünür. Request fullcap'i aşmaz ve skipped spawn kuyruğu oluşmaz.

## Tüm 60 hücre için balance kapısı

Ücretsiz formation (Mahmut,Fadyme,Brin,Nixie,Jori), üç farklı lead ve yedi selector seçeneğiyle tutorial erişilebilirliği test edilir. Base10 hücrenin her biri bir uzman tek-perfect kiting videosuna dayanmadan tamamlanabilir olmalıdır. İlk kullanıcılar objektif deadline'ını görmeli, heat/ink için yanlışlıklarının sebebini anlayabilmelidir. Ortalama/medyan/p90 completion, boss kalan süre, düşülen HP, offer dağılımı, slot hasarı ve spawn/cast skip oranı toplanır. Farklı build'lerin her chapter eşit skor vermesi gerekmez; zorunlu tek gacha veya tek support aile kalmaması gerekir.

Tüm ranklar düşman hareket/uyarı okunabilirliğiyle bitirilebilirlik denemesinden geçer. C7 araba rotası kaçışı korur; C8 gust safe union test, C9 heat reserved quarter, C10 phase thresholds doğru. Cap doluyken chapter10rank5 bütün6 phases boyunca hasar/stall/XP yeterliliği ölçülür. Numerik monotonluk gerçek zorluğun monotonluğu olarak sunulmaz. Kolay bir rankın öncekinden daha sık skip etmesi görülürse tablolar ayarlanır.

## Kayıt ve server kapısı

Pending upgrade,VN choice,breather,objective channel,boss transition sırasında process kill; her birinde save atomik ve input digest yeniden doğrulanabilir. Abandon eski run_id finish'i reddeder. Tek zaferin 10 eşzamanlı callback'i tek progress commit'tir. İki cihaz eski generation/session sonucu reddedilir. Unknown revision/roster/impossible axis/card/time/checkpoint ve client-win with server-loss reddedilir. Network reconnect sonucu accepted ise tekrar grant yoktur. Offline practice verified hücre açmaz.

Main battle progress, Ration, AFK, gear, daily tasks ve düşman boss-set loot önceki testlerinde aynı kalır. Mode reward binding null iken hiçbir ekonomik grant olmaz. Future reward handler gelirse ayrıca server source, idempotency ve claim migration denetlenir.

## Android ve kaynak kapısı

Capacitor WebView'da adı kaydedilmiş low/mid iki hedef cihaz;C10rank5 tam8 dakikalık aktif clock soakı, yükseltme/VN pause'ları ayrıca. Hedef30 rendered FPS sabit; memory/pool büyümesi yok. 160/96/32/80/3 cap histogramları, input latency, p95 frame/memory ve thermal tekrarları raporlanır. Linux SwiftShader ölçümü bu satırı kapatmaz. Kill/back/phone-lock,webgl loss,reload,gesture safe-area ve sessiz SFX testleri yapılır. Low quality gameplay adetlerini azaltmamalı; başarısızsa shared cap yeni revizyonla aşağı çekilip tüm hücreler tekrar ayarlanır.

Cloudflare Worker input decode/full replay CPU benchmark ve seçili plan sınırı karşılaştırması zorunlu. Queue fallback gecikme/iş tekrarları idempotent; pending UI gerçeği yansıtır. Yük altında server input max ve session rate cap çalışır; hassas credential içerikleri loglanmaz.

## Runtime enable öncesi eksiksiz kapılar

Gerçek4-5 node mapping; owned-free erişim;strict new content schemas;shared sim golden/replay;D1 kayıt/idempotency; min_client ve pinned old revisions;60-cell balance;named Android proof;media fallback/localization;owner reward/energy kararı. Bu paket için yalnız tasarım ve script QA'sı PASS, diğerleri PENDING'dir.
