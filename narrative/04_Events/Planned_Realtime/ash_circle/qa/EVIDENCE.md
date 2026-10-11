# Kanıt kapsamı ve tekrar üretme

Hazırlık kontrolleri bu package'e aittir. Oynanabilir final arena simülasyonu çalıştırılmadı. İlerleme ve scheduler kontrolleri açıkça **referans modelleridir**; collision, boss dövüşü, gerçek party kit'i veya D1 implementasyonu kullanmaz.

Repo kökünde Python3 ve mevcut npm bağımlılıklarıyla:

```sh
python narrative/04_Events/Planned_Realtime/ash_circle/qa/validate_design.py
npx --no-install tsx narrative/04_Events/Planned_Realtime/ash_circle/qa/validate_story.mts
```

İlk komut phase/reference/cap/upgrade/progress ve source hash kontrollerini, ikinci komut güncel StoryScene/StoryRunner kontrollerini çalıştırır. Test dosyaları mevcut oyun package'i içine import edilmez; kendi QA çıktılarını yazar. Kaynakların hash'i gelecekte değişirse ilk komut bilerek hata verir: kaynağı yeniden okuyup gerçek uyumluluğu değerlendirerek kaynak kayıtları güncellenmelidir. Yalnız hash'i sessiz değiştirmek review yerine geçmez.

| Kayıt | Gerçekte ölçtüğü | Ölçmediği |
|---|---|---|
| DESIGN_VALIDATION | 14 kaynak hash'i, 10 chapter/6 rank referansları, 9500 teklif/cap kontrolü, 608 progress-model kontrolü | oyun balance, server sonuç güvenliği |
| STORY_VALIDATION | 34 scene Zod parse, 36 yürütme yolu, 193 satır save/restore, 3 tone choice ve 36 checkpoint | medya yükleme, event controller |
| SCHEDULER_DEMAND | 60 hücrede 3600 scheduled batch; zero-death cap stresi ve pre-cap HP matematiği | düşman collision veya gerçek difficulty artışı |
| OBJECTIVE_LOWER_BOUNDS | boş arenada yol ve tick alt sınırları | combat sırasında bitirilebilirlik |
| PROGRESSION_TRACE | reference modelde sırayla 60 cell, retry/replay/gap kuralları | canlı D1 transaction/CAS |
| PROTOCOL_VECTORS | önerilen integer RNG/joystick fixture değerleri | tam deterministik sim veya platformlar arası eşitlik |
| PREVIOUS_ENGINE_SMOKE | önceki izole Phaser4.2.1 API deneyinin gözlem çıktısı | bu event'in implementasyonu veya Android performansı |

Önceki engine smoke testi headless Linux Chromium/SwiftShader, 960×540 placeholder renderer ile yapıldı; hareket, enemy pursuit, autoattack, Arcade overlap, XP ve pause-upgrade yolları çalıştı. 80/160/320 enemy target'ları denenmişti; son ölçümde 319 active enemy vardı. Projectile pool 64 kaldı: tabloda 128/256 talep tavanı yazması o sayıda aktif projectile test edildi anlamına gelmez. Bu paket yeni hedefine 160 logical enemy önerir; tarihî lab bunun mobil cihaz kapasitesini kanıtlamaz. PREVIOUS_ENGINE_SMOKE dosyası eski deneyi taşır, yeniden çalıştırılmış sonuç gibi sunulmaz.

Gelecek implementasyon için `QA_VE_KABUL.md` açık kapıları tanımlar. VALIDATION.json içindeki `runtime_enable_allowed:false` bilinçlidir; bu commit'ten otomatik runtime açılması veya üretim sertifikası çıkarılamaz.
