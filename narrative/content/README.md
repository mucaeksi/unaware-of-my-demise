# Özgün Narrative JSON kaynakları

Bu 13 JSON, Google Drive `LEGACY/narrative/content/` kaynaklarının byte-exact snapshot'ıdır. Mevcut oyun paketleri [game/data/content/](../../game/data/content/) altında kalır; bu dizin runtime'a otomatik yüklenmez.

- [Ana manifest](story_script_part1_manifest.json): 7 bölüm dosyası / 51 sahne sırası / 419 ana hikâye line_id.
- [Companion hikâyeleri](character_stories_part1.json): 20 karakter / 76 parça.
- [Etkinlik hikâyeleri](events_part1.json): 4 etkinlik / 12 sahne.
- [Lore metinleri](lore_text_part1.json): Codex ve diğer lore kayıtları; kaynak unlock koşulları korunur.
- [Karakter replikleri](character_voice_lines_part1.json): 220 kayıt; 40 unlock alanı.
- [Türev görsel katalog](character_visuals_part1.json): kaynak snapshot; Costume Guide'ın STALE uyarısını dikkate al.

Kaynak/runtime farkları [rapor ve makine kaydında](../migration/RECONCILIATION.md). Kaynak dosyalar yeniden compile edilmedi; mevcut oyun JSON'ları üzerine yazılmadı.
