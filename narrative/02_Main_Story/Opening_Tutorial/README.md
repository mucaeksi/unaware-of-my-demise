# Açılış ve tutorial senaryoları

Güncel runtime metinleri:

- [Before the Road — 120 saniyelik açılış](PROLOGUE_CURRENT_SCRIPT.md).
- [The First Step / A Road Forgotten / A Roof Before Dawn — üç tutorial bölümü](TUTORIAL_CURRENT_SCRIPT.md).
- [Byte eşit prologue JSON kopyası](../../09_VN_Scripts/Runtime_Snapshot/game/data/entry/prologue_v001.json).
- [Byte eşit tutorial JSON kopyası](../../09_VN_Scripts/Runtime_Snapshot/game/data/entry/tutorial_v001.json).

Kaynak karar ve revizyon belgeleri:

- [İlk tutorial senaryo önerisi](TUTORIAL_SIDE_BY_SIDE_v001_2026-10-08.md): özgün taslak; mevcut runtime'ın yerine kullanılmaz.
- [Uygulanmış opening/tutorial revizyonu v006](OPENING_TUTORIAL_REVISION_v006_2026-10-08.md).
- [Before the Road ilk senaryosu](ENTRY_PROLOGUE_BEFORE_THE_ROAD_v001.md).
- [Sinematik v002](ENTRY_PROLOGUE_CINEMATIC_V002_2026-10-07.md).
- [Grounding v004](ENTRY_PROLOGUE_GROUNDING_V004_2026-10-07.md).
- [Prologue uygulama notları](ENTRY_PROLOGUE_IMPLEMENTATION_2026-10-07.md).

Opening'in hareket/şot yönetmeni ve teknik okuyucusu `game/scripts/ui/entry/entry_prologue.gd`, `prologue_shot.gd` ve `entry_prologue_script.gd` içindedir. Tutorial oynatıcısı `tutorial_battle.gd` içindedir. Bunlar uygulama kodudur; anlatı metni JSON'lardan okunur. Runtime script dosyalarının yerleri değişmedi.

Şu anki senaryoyu görmek için iki `CURRENT_SCRIPT` dosyasını oku. Son kullanıcı yönü, [güncel master prompt](../../../docs/coder/MASTER_PROMPT_SONNET_GOOGLE_VULKAN_FIRST_AAB_2026-10-10_TR.md) ile birlikte değerlendirilir. First-AAB export ve patch sınırı ayrı teknik yapılandırmadır.
