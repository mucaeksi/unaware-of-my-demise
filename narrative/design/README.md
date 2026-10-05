# Oyun tasarım referansı

## Güncel yaratıcı yeniden başlangıç — 2026-10-05

- [Tamamlanan işler ve eksik listesi](WORK_COMPLETED_2026-10-05.md): kaynak aktarımı, UI prototipleri, doğrulama sınırları ve son kullanıcı kararları.
- [Yeni oturum başlangıç promptu](CREATIVE_RESTART_PROMPT.md): stüdyo adı araştırması, yeni ortak sanat dili, Godot → stüdyo → title açılışı/ana tema, sayfa sayfa Godot entegrasyonu, ardından final Fadyme ve diğer karakter/mekânlar.
- [Dünya, hikâye ve 20 karakter brief’i](WORLD_STORY_CHARACTER_BRIEF_2026-10-05.md): yeni oturumda tamamlanan kaynak okuması, karakterlerin psikoloji/görsel ayrımları, alınan stil referansı ve tasarım çelişkileri. **İç kullanım; tam hikâye spoiler’ları içerir.**
- [Kaynak inceleme kanıtı](SOURCE_REVIEW_2026-10-05.json): incelenen yerel commit, 116 kaynak hash’i, metin kapsamı ve yeniden ölçülen source/runtime farkları.
- [Stüdyo adı ön araştırması](STUDIO_NAME_RESEARCH_2026-10-05.md): SovTaym Studios birebir/benzer ad sorguları; resmî kayıt, domain ve handle kontrolündeki açık erişim eksikleri.
- [Ortak sanat sistemi v01](ART_SYSTEM_V01.md): lore’a göre üretilmiş key-art v01/v02 adayları, palet/font/butonlar ve ayrı Godot inceleme sahnesi. [Üretim izi](../art/direction/PROVENANCE.json), [Godot doğrulaması](../art/direction/VERIFY_V01.json).
- [Godot → stüdyo → title ve gelecekteki ana tema](STARTUP_AUDIO_V01.md): gerçek startup sahneleri, bekleyen `bgm_main_theme.ogg`, lifecycle/readiness ve telefon capture’ları. [Doğrulama](STARTUP_VERIFY_V01.json).
- **Güncel açılış:** [SovTaym logolu sayfa v02](STUDIO_SPLASH_V02.md): Godot’un kendi native ekranı geri açıldı, ikinci Godot yazılı sayfa akıştan çıkarıldı; şeffaf kuzgun/kum saati amblemi gerçek Godot sahnesinde. [Üretim](../art/studio/PROVENANCE.json), [doğrulama](../art/studio/VERIFY_V02.json), telefon görüntüleri/video.

Önceki checkpoint yalnız plan kaydıydı. Yeni oturumda kullanıcı stil görselini yeniden ekledi ve çizimden önce bütün dünya/hikâye/karakter kaynaklarını okumayı istedi; bu hazırlık tamamlandı. Ardından gerçek web ön araştırması, ilk sanat adayları ve ortak tema/ayrı Godot inceleme sahnesi üretildi. Owner’ın ana tema henüz hazır değil yanıtı üzerine gerçek Engine/Studio açılışı mevcut TitleScreen’e bağlandı ve gelecek müzik dosyası için sessiz rezervasyon kuruldu. Stüdyo adı kesinleşmedi; title’ın final sanat tasarımı ve final Fadyme açık. Son kullanıcı yönlendirmesi eski görsel pack/Gemini zorunluluğunu ve entegrasyonu sona bırakma yaklaşımını günceller; Drive orijinalleri, hikâye ve sesler korunur. Görsel bu sohbette incelendi; özgün dosya byte’ları ve hash’i henüz yerel olarak erişilebilir değil.

## Tarihsel GDD

[Unaware_of_My_Demise_Part1_GDD.md](Unaware_of_My_Demise_Part1_GDD.md), Narrative dışında `LEGACY/` root'undan alınmış ortak tarihsel GDD'dir. Kaynak kimliği, parent, boyut/hash ve hedef yolu BATCH-0005 manifestinde ayrı supplemental kayıt.

GDD bütün güncel teknik/ekonomi kararlarının yerine geçmez; [proje kararları](../../docs/DECISIONS.md), güncel runtime ve son kullanıcı yönlendirmeleriyle karşılaştırılır. Canon ve özellikle costume/visual türevleri için [canon önceliğini](../canon/README.md) kullan. UI yönü kullanıcı talebiyle AFK Arena benzeri gezinme + daha karanlık dünya; mevcut [UI taslakları](../ui/README.md) burada ayrı geliştirilir.
