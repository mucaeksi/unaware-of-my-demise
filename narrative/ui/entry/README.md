# İlk giriş prototipi

[index.html](index.html) tarayıcıda doğrudan açılabilir. HTTP: repository kökünde `python -m http.server 8765`, ardından `/narrative/ui/entry/`.

Ekran 390×844 temelinden 320×640 / 360×800 / 1080×1920 portrait hedeflerine göre tasarlanır. Masaüstü panelindeki 10 durum yalnız review içindir; oyun içinde scenario seçici yoktur. Telefon için query parametreleri: `first`, `returning`, `offline`, `cancelled`, `no_account`, `unavailable`, `maintenance`, `update`, `content`, `sync_error`.

Durum geçişleri bellek/timer tabanlıdır, yeniden yüklemede sıfırlanır. Gerçek giriş veya oyuncu işlemi yapılmaz. [Tasarım ve teknik eşleme](../ENTRY_SCREEN.md), [kontrol raporu](../ENTRY_VERIFICATION.json).
