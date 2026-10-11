# Mühendislik devri — uygulanabilir kapsam ve sıra

Phaser 4.2.1 + TypeScript + Vite + Capacitor8 yapısı bu mod için yeterli görünüyor. Önceki izole engine deneyinde movement, enemy pursuit, auto-fire, overlap, pool, XP ve pause-upgrade yolu çalıştı. Bu **Android benchmark, nihai shared sim veya bu 10 bölümün playable testi değildir**. 80/160/320 düşmanlık headless Linux/SwiftShader örneğinde pool reuse ve hatasız scene akışı gözlendi; renderer timing'leri cihaz kapasitesi kanıtı sayılmaz. 320 düşman release hedefi seçilmedi.

## Mevcut koddan çıkan zorunluluklar

`apps/game/src/main.ts` WebGL scene listesinde realtime arena yok ve physics config etkin değil. `BattleScene` turn-based @uomd/combat kullanır; onun içine canlı yüzlerce entity eklemek ayrı bir realtime module yerine geçmez. `UnitView` per-unit containers/bars/text/tweens horde çizimi için doğrudan çoğaltılamaz. `apps/api/src/progress/service.ts` main battle replay doğrulaması max600 skillId/targetId aksiyonuna göre kuruludur; hareket input log'u ayrı session türü ve server doğrulayıcı gerektirir. SafeAssetPath executable JS/WASM/HTML patch'i reddeder. Yeni scene/sim/API native client ve backend release'inde gelir; yalnız narrative JSON patch'i oynanabilir mod açmaz.

Phaser Arcade araştırma prototipi için uygundur. Otoriter tasarım **integer shared realtime sim** kullanır: 30 ticks/s, 1/256 birim position/velocity, seed'li PRNG, sabit entity işleme sırası, integer circle/segment collision, ceil/floor sırası açık. Phaser yalnız bu state'i çizer; render FPS ve Arcade callback ordering server sonuç üretmez. Worker'da renderer/DOM/GPU bulunmayacağından Phaser'ı backend'e taşımak doğru değildir. Main turn simulator değiştirilmez.

## Önerilen dosya sorumlulukları — henüz oluşturulmadı

| Yer | Sorumluluk |
|---|---|
| `packages/realtime-survival` | input quantization, fixed-step sim, RNG vectors, collision, scheduler, upgrade, checkpoint/replay |
| `packages/content-schema` | strict SurvivalMode/Arena/Chapter/Weapon/Boss/Tuning schema; forward unsupported-op reject |
| `apps/game/.../AshCircleScene` | pooled sprites, camera, joystick, shape warnings, paused choices, recap |
| `apps/game/.../AshCircleController` | mode menu, party ownership, StoryRunner triggers, session pin, local atomic save |
| `apps/api/.../survival` | prepare/chunk/checkpoint/finish/resume APIs, canonical loadout, server replay, D1 progress |
| `apps/admin` | validated chapter/rank preview, references, compatibility/digest checks, publish disabled by default |

İsimler yön gösterir; mevcut modülleri bulmadan alternatif master architecture dayatılmaz. Queue, D1 ve R2 proje stack'i kullanılır; yeni backend ürünü veya paid SDK eklenmez.

## Geliştirme dilimleri ve teslim koşulları

1. **Çekirdek deney:** C1, tek düz arena, beş ücretsiz adapter, placeholder şekiller, fixed30 sim, hero movement, auto-hit, 3 objektif, bir boss, 3 kart seçimi. Headless seed tekrarında digest aynı; playtest kazan/kaybet ve 8 dakika sınırı. Placeholder player preview'da açık belirtilir.
2. **Kayıt ve Android yaşam döngüsü:** atomic resume, pending offer, VN breather, background/foreground, render context loss ve safe areas. Gerçek Android low/mid cihazda C1; gameplay render FPS'den bağımsız. Fatal reload'ın pinned run'ı kaybettirmemesi gerekir.
3. **Sunucu kapısı:** session prepare, sahiplik snapshot, compressed input chunk, checkpoint replay, idempotent progress. Manipule upgrade/speed/time/results reddedilir. 14400-tick worst-case replay Worker CPU planında ölçülür; yetmezse Queue bölümlü doğrulama, provisional result. Benchmark olmadan synchronous request varsayılmaz.
4. **Rota çeşitleri:** C2–C6 dalga ve hazardları, boss şekilleri, kayıt delili sahneleri. Spawn placement ve birleşik güvenli alan testleri tüm kamera kenarlarında. Main combat unit ve integration testleri regression olarak korunur.
5. **Son rota:** C7 araba, C8 gust, C9 heat, C10 üç faz ve reconstructed replay. Hard caps loglanır; shared pools hiçbir hücrede büyümez. Önceki sim revisions korunur.
6. **Üretim:** approved chibi/arena art, localization, VO opsiyonel, quality tiers, sixty cells balance pass, control-center strict content build. Gate mapping, min client version, sim revision ve owner reward binding ancak bu noktada runtime enable için uygun olur.

Her dilim tamamlanınca yalnız kendi dosyaları doğrulanır ve normal reviewable commit yapılır. Claude'ın devam eden work branch'ini değiştirmeden ayrı feature checkout üzerinde uygulanabilir. İlk playable slice sonrası şekil/denge geri bildirimi bütün paketi yeniden yazmadan tuning üzerinden alınır.

## Input ve kaynak bütçeleri

Bir koşu max14400 ticks. Signed int8 iki eksen, interact/focus, pause/resume ve card choice event'leri stable sıralıdır. En fazla30000 events, compressed262144 bytes, expanded2097152 bytes; chunk1024 event. Bu tavanlar JSON şişmesini sessizce kesmek yerine açık reject üretir. Sıkıştırma bombası, backward tick, illegal draft, stale session ve oyuncunun sahiplendiğini iddia ettiği unit reddedilir. QoS katmanında yalnız görsel scale/effect düşer; sim düşman cap'i cihaza göre oynanmaz.

160 enemy, 96 player projectiles,32 enemy projectiles,80 XP,3 ambient hazards. Lead için12 projectile slot reserved; boss self shapes projectile slot gibi yanlış çoğaltılmaz. Bosses sayısal stat çarpanlarını ayrı alır. HP final damage integer sırası ve stat floor'ları sim golden vectors'a dahil edilir. Sadece pools hazır diye server denge onayı verilmez.

## Resmî motor kaynakları

- [Phaser 4.2.1 README](https://github.com/phaserjs/phaser/blob/v4.2.1/README.md)
- [Arcade World](https://github.com/phaserjs/phaser/blob/v4.2.1/src/physics/arcade/World.js)
- [Group pool API](https://github.com/phaserjs/phaser/blob/v4.2.1/src/gameobjects/group/Group.js)

Önceki erişim kontrollü araştırmada resmî GitHub/raw kaynakları okunabildi; bazı docs/game siteleri proxy403 döndürdü. Bu kısıt proje motorunun desteklemediği anlamına gelmez. Referans oyunların son patch'leri doğrudan oynandı iddiası yoktur.
