# Son kaynak oyunu çalıştırma prompt'u

Repository'yi gören Codex/Claude oturumuna ver:

> `unaware-of-my-demise` deposunda güncel main'i incele ve son kaynak oyunu çalıştır. AGENTS.md, CLAUDE.md ve ortak `.codex` skill'lerini oku. `docs/design/FULL_GAME_REVIEW_2026-10-09_TR.md` raporunu esas al. Tam Godot 4.7.2-stable kullan. Kökteki `OYUNU_AC.cmd` üzerinden varsayılan **Full Story Review** modunu başlat: `game/scenes/art_review/desktop_game_review.tscn`. Mevcut yerel kaydı koru; ben sıfırlama istemedikçe `-ResetReview` kullanma. Açılış, üç eğitim savaşı, yedi bölüm/35 savaş, yol-kamp sahneleri, itiraf ve Clockless reveal erişilebilir olsun. Story Records'ta görülen sahneleri ve koşulları açılmış companion parçalarını doğrula. `-OpeningOnly` moduna geçme. Import/runtime hatası görürsen loglarını incele, düzelt, yeniden doğrula. Yerel savaşlar destekli provadır; online ödül/satın alma uydurma. Yeni AAB/PCK üretme ve `release/current` paketini değiştirme. Sonunda açılan mod, engine sürümü, kayıt durumu ve gerçek üretim/platform eksiklerini kısa bildir.

GitHub Desktop → Fetch/Pull → `OYUNU_AC.cmd` çift tık. İlk açılışta doğru exe seçimi istenebilir.

```bat
OYUNU_AC.cmd
```

Exe yolunu doğrudan vermek için:

```bat
OYUNU_AC.cmd -GodotPath "C:\Tools\Godot_v4.7.2-stable_win64.exe"
```

Yalnız baştan yeni prova istediğinde `OYUNU_AC.cmd -ResetReview` kullan. Normal açılış kayıt silmez. Yerel kayıt `user://desktop_story_review`; Google/purchases için `-Online` ayrı moddur. Final sanat ve ses eksikleri tasarım raporunda kayıtlıdır.
