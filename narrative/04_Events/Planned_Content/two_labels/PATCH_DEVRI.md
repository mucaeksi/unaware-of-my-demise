# İki Etiket — gelecekteki patch için içerik devri

**İçerik tasarımı tamamlandı; bu klasör yayınlanabilir imzalı release değildir.** Tamamlanan tasarım daha sonra ilgili event framework hazır olduğunda alınabilir.

## Son kullanıcı yönlendirmesi

- Bu içerik ve atölyedeki diğer adaylar **ileriki patch’larda** eklenecek.
- İçerikler ana hikâyede belirli eşiklere gelince açılacak. İki Etiket için mevcut canon eşiği **4-5**.
- Ödüller şimdilik belirsiz. Tür, adet, yüzde, first-clear/replay ayrımı ve dağıtım takvimi seçilmedi; reward binding `null`.

## Dosya ayrımı

| Dosya grubu | İşlev | İstemciye doğrudan gönderilebilir mi? |
|---|---|---|
| `story_json/*.json` | 31 sahne; mevcut StoryScene grammar ile parse edildi | Uygun asset/karakter/cue ve güvenli event adapter bulunan release’te sahne verisi olabilir |
| `authoring/event.json` | Aktlar, tam metin, event graph, unlock ve karar alanları | Mevcut event schema/adapter henüz bunu doğrudan tüketmiyor; authoring girdisi |
| `authoring/encounters.json` | 8 tam encounter brief’i ve slot/rol düzeni | Sayısal/izinli unit/skill bağlama ve Encounter export’u sonradan yapılır |
| `authoring/state_contract.json` | Hesaba bağlı state, replay, retry ve revision ilkeleri | API/storage adaptörü için içerik sözleşmesi; çalışan endpoint değil |
| `authoring/media_requirements.json` | Kullanılan görsel/ses key’leri | Art manifest üretiminin girdisi; dosyalar henüz üretilmedi |
| `scripts/*.md`, diğer `.md` dosyalar | İnsan tarafından okunabilir yapım dosyaları | Proje patch allowlist’i `.md` kabul etmez; authoring-only |
| `VO_LINE_LIST.csv` | Çeviri ve kayıt kuyruğu | Authoring-only; voice export’u daha sonra onaylı biçimde |
| `VALIDATION.json` | Bu oturumun kontrol kanıtı | QA kaydı; oyuncu progression verisi değil |

## Uygulama kabiliyetleri

İçerik yayınlanacağı istemci/sunucu sürümünde şunlar gerçekten bulunmalı:

1. **Sunucu stage gate:** 4-5’in actual main-story stage ID’sini published chapter progression’a eşleyen mapping. İlk tutorial’daki T-1/T-2’yi sayıp “dördüncü bölüm bitti” varsayımı yok. `runtime_stage_mapping` bu nedenle şimdi `null`.
2. **Event graph:** Bir story node bitince kayıtlı choice key’lerine göre bir sonraki node; battle node için doğrulanmış victory. Bu grafikte geri döngü yok.
3. **Kalıcı seçim/state:** Hesap + event ID + story revision; route/prep/approach/focus ve completed nodes. Yeni hesabın eski local flag’leri kullanılamaz.
4. **Story resume:** Mevcut VM’nin save/restore’unu gerçek sahne/UI/medya durumuna bağlayan adapter. Bu teslim sadece VM checkpoint restore’unu test etti.
5. **Karakter/düşman içerikleri:** Kera/Tilda/Iona/Odelia’nın skills ve media’sı; ücretsiz beşinci slot seçenekleri; event düşman varyantlarının istemci ve sunucuda aynı unit pack’i.
6. **Battle validation:** Published revision’a bağlı encounter seçimi, deterministic replay ve idempotent node completion.
7. **Replay izolasyonu:** Alternatif yol/son konuşma görüntüleme ilk tur state’ini ve gelecekte bağlanacak reward claim’ini değiştirmez.
8. **Art/audio mapping:** Bu paketteki dokuz location key’i, üç cue ve onaylı portrait emotion mapping’i.

Bu adlar mevcut ContentManifest’e eklenmiş field’lar değildir; tasarım kabiliyet listesidir. Gerçek schema’ya kontrollü mapping yapılır. Gerekli min-client-version bilinmediği için uydurma sürüm numarası yok. Server/client gerekli behavior’ı taşımıyorsa içerik uyumlu sürüme kadar yayınlanamaz.

## Kanonik event kimliği ve tekrar ödül koruması

Yeni çalışma kimliği `event_two_labels`; kaynak kimliği `event_guild_salt_fever`. Bunlar yayın sırasında iki farklı tamamlanma/ödül yolu gibi ele alınmamalı. Kaynak event daha önce oyuncuya açılmışsa alias/migration planı gerekir; aynı kaynak üç sahneyi ve aynı ilerleme hakkını iki kez yayınlayıp ödül üretmekten kaçınılır. Hangi kimliğin public canonical event key’i olacağı entegrasyonda kararlaştırılır, kaynak kayıt sessizce yeniden adlandırılmaz.

Ödül tablosu sonradan seçildiğinde bundle’deki boş referans alanlarına bağlanır. Boş bağlama “0 Token vermeyi onayladık” diye yorumlanmaz. Ödül fonksiyonu story dialogue’dan, kasalardan, ekmek prop’undan veya bir anlatıcı cümlesinden çıkartılmaz.

## Yayın öncesi yapılacak gerçek kontroller

- Yamasız/sunucuda yayınlanmamış içerik görünmez; yayınlandıktan sonra sadece 4-5’i bitirmiş hesapta açılır.
- Aynı release’te all references: graph → scene → media, battle → unit/skill → art. Safe path/hash/signature/client version doğrulanır.
- 32 kombinasyon gerçek UI üzerinden tamamlanır; her yolda 5 battle, üç kaynak scene sırası ve callback’ler doğru.
- Scene/choice/battle anında kapat/aç; slow/offline/ağ cevabı kaybı/retry aynı ilk tur kararlarını korur.
- İlk tura devam ile replay birbirine karışmaz; ilk rota kaydı, replay sonunda overwritten olmaz.
- Ödüller belirlendikten sonra server idempotency, eşzamanlı claim ve future archive/source-event alias senaryoları test edilir.
- Türkçe yapım metni ve authoring-only dosyalar player bundle’ına yanlışlıkla dahil edilmez.
- Gerçek savaş dengesi, medya playback, Android touch/safe-area/audio ve patch sonrası sahne preload denenir.

Bu liste uygulama işlerinin şu anda yapıldığı iddiası değildir. Kod/endpoint geliştirmesi Claude’un kulvarında kalır; bizim teslimimiz tam hikâye ve içerik sözleşmesidir.


## Seçim önizlemelerinin sunumu

Authoring choice seçeneklerindeki `consequence_en` metinleri oyuncuya karar öncesi gösterilecek önizlemelerdir. Mevcut StoryScene choice export’u seçenek ID/etiketini taşır; ayrı consequence alanı yoktur. Gelecekteki event/UI adaptörü bu önizlemeyi authoring metadata’dan sunmalı veya onaylı içerik derleyicisi seçenek metnine dahil etmelidir. Mevcut oyunda ayrı önizleme paneli uygulanmış olduğu varsayılmaz.

Export/doğrulama araçları narrative tesliminin dışında tutuldu. Kontrol sonuçları VALIDATION.json ve COMBAT_FEASIBILITY_VALIDATION.json içinde kayıtlıdır.
