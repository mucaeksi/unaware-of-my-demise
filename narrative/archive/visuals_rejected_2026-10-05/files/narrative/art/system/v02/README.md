# Ortak sanat sistemi v02

2. adımın gerçek Godot teması, yeni oyun amblemi, iki logo dizgisi, 15 SVG utility glyph ve 9-slice frame. Sanat **CANDIDATE**; yerel entegrasyon doğrulandı, owner/Android final kabulü bekler.

- [1080×1920 kimlik panosu](previews/identity_1080x1920.png)
- [1080×1920 bileşen panosu](previews/components_1080x1920.png)
- [1080×1920 modal](previews/modal_1080x1920.png)
- [Sanat sistemi/spec](../../../design/ART_SYSTEM_V02.md)
- [Üretim izi](PROVENANCE.json), [asset bağlantıları](ASSET_MANIFEST.json), [eski set replacement haritası](REPLACEMENT_MAP.json), [doğrulama](VERIFY.json)

Görseller gerçek viewport capture'larıdır; düşük çözünürlüklü dosyalar büyütülmedi. Yeni kaynaklar bu klasördedir; runtime kopyaları hash eşittir. Eski orijinaller/audio değiştirilmedi.

Repository root'undan:

```bash
godot --path game res://scenes/art_review/art_system_review_v02.tscn
godot --path game res://scenes/art_review/art_system_review_v02.tscn -- --system-page=components
```

Gallery dev incelemesidir ve Android export'ta dışarıda kalır; ortak UiTheme/UiKit oyuncu ekranlarında aktiftir. Buradaki Sign out yalnız bileşen demonstrasyonudur. Final title ve gerçek SignIn/Patch/SignOut tasarımları kendi adımlarında tamamlanır.
