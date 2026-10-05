# Oyun tasarım referansı

## Güncel tasarım devri — 2026-10-05

Owner önceki bütün görsel adayları reddetti; yeni görsel tasarım dış AI'a devredildi. **Tek stil referansı owner'ın yeniden gönderdiği Gothic/anime afişi; UI, buton, chibi ve bütün artwork aynı dili taşıyacak.**

- [İlk görev ve oyun tanıtımı promptu](EXTERNAL_DESIGNER_INTRO_PROMPT_TR.md): diğer AI'a afişle birlikte verilecek kapsamlı ilk mesaj.
- [Tek referansın görsel özeti ve erişim sınırı](VISUAL_REFERENCE_BRIEF_2026-10-05.md).
- [Reddedilmiş görsel arşivi](../archive/visuals_rejected_2026-10-05/README.md): 222 dosya/123 medya, kaynaklar/varyantlar/önizlemeler/video/prompt/provenance ve runtime karşılıkları hash eşitliğiyle saklandı.

Yeni üretim burada durdu. Android ikonunun henüz commit edilmemiş runtime ayarları geri alındı. Önceki kod/sahne bağlantıları yeni teslimleri alacak geliştirme altyapısıdır; mevcut görseller final referans olarak kullanılmaz. Sıradaki somut iş owner'ın dış AI tasarımlarını uygun Godot tüketicilerine entegre etmektir. Aşağıdaki aşamalar tarihsel kayıttır.

## Güncel yaratıcı yeniden başlangıç — 2026-10-05

- **2. adım uygulandı:** [Ortak sanat sistemi v02](ART_SYSTEM_V02.md), gerçek aktif UiTheme/UiKit, iki oyun logo dizgisi, 15 SVG glyph ve 9-slice frame. [1080×1920 kimlik](../art/system/v02/previews/identity_1080x1920.png), [bileşenler](../art/system/v02/previews/components_1080x1920.png), [üretim/katalog/geçiş/doğrulama](../art/system/v02/README.md). Yeni sanat candidate, bütün ekran yerleşimleri final değil.
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
