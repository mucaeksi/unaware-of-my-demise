# Yerel UI entegrasyon raporu

**Tarih:** 5 Ekim 2026  
**Çalışma klasörü:** `F:\unaware-of-my-demise-main`  
**Durum:** Ortak bileşen altyapısı entegre edildi; ekranların nihai kompozisyonları sırayla geliştirilecek.

## Yapılanlar

- İkincil Production klasöründeki UI Component Kit v001'in 18 PNG'si birincil projeye aktarıldı. PNG pikselleri korunuyor; SHA256 eşleşmeleri kayıt altında.
- Panel, hero, modal, sheet, portre kartı, rozet, gezinme zemini ve primary/secondary/destructive buton durumları gerçek Godot StyleBoxTexture/9-slice stillerine bağlandı.
- Projenin ortak temasına Cinzel + Source Sans 3 fontları, yeni palet ve metin ölçekleme desteği eklendi. Font lisansları oyunun Licenses ekranında bulunuyor.
- Ekran, buton, onay modali, durum görünümü, alt gezinme, kart, giriş alanı, checkbox, slider ve progress bar için 10 tekrar kullanılabilir `.tscn` şablonu oluşturuldu.
- Loading, Empty, Locked, Disabled, Error, Offline, Insufficient Resource, Pending ve Confirmed ortak durum bileşeni hazırlandı. Pending/Loading/Locked/Disabled aksiyonu engelliyor.
- Title gerçek bir başlangıç butonu kullanıyor. Hub özeti panel içinde; Formation/Battle/Defeat ana aksiyonları ortak kit stilini kullanıyor. Loading ve başlangıç hataları ortak durum görünümünü kullanıyor.
- Seçili butonlarda renk yanında kenar/işaret ipucu var. Rozet ve büyük metindeki gezinme kırılmaları görsel kontrolde yakalanıp düzeltildi; başarısız → başarılı regresyon testleri kaydedildi.
- Etkileşimli Godot önizlemesi ve üç telefon oranında tam boy görüntü alma aracı eklendi. Önizleme, testler ve araçlar oyuncu paketine alınmıyor.
- Production kaynağını karşılaştıran/yenileyen yerel aktarım aracı eklendi. Değiştirilen mevcut dosyaların kopyaları `local-backups/ui-kit-before-20261005/` altında.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Godot 4.7.2 import ve betik yükleme | Geçti |
| Tam GUT turu | **384/384**, 51 betik, 142787 assertion |
| Son font lisansı kontrolü | 4/4 geçti |
| Kaynak PNG eşleşmesi | 18/18 SHA256 ve boyut/RGBA/slice kontrolü |
| 720×1600 | %125 metin ve modal görüntü kontrolü |
| 1080×1920 | Panel/durum/kontrol görüntü kontrolü |
| 1080×2400 | %125 metin, kart ve beşli gezinme görüntü kontrolü |
| Gerçek ana sahne cold-start | Studio → Title; title tap/account request yapılmadan görüntülendi |
| Android preset üzerinden yerel PCK | 18 doku, iki font ve import verileri, lisanslar içeride; önizleme/test/araçlar dışarıda |

Test kapanışında önceden görülen dört ObjectDB / bir resource temizleme uyarısı sürüyor. Test assertion'ları geçti. Android cihaz/emülatör üzerinde bu UI için dokunma, yoğunluk, kesik ekran ve erişilebilirlik doğrulaması henüz yapılmadı.

## İzleme ve dosyalar

```powershell
.\tools\Start-UiPreview.ps1
```

Üstteki seçim kutusu **Components / Surfaces / States / Controls / Entry / Hub / Formation / Battle / Results** sayfalarını açar. **Aa +** metni %125 yapar. Bu sahnenin cüzdanı ve karakter listesi demo verisidir; hesap/server isteği göndermez. Modal Cancel/Back ve Confirm davranışları gerçek ortak bileşeni kullanır.

- Aktif düzenlenebilir tema: `game/theme/uomd_production_v001.tres`
- Ortak şablonlar: `game/scenes/ui/common/`
- Önizleme sahnesi: `game/scenes/art_review/production_ui_preview.tscn`
- Aktarım kaydı: `docs/ui/production-v001/integration-manifest.json`
- Teknik kullanım: `docs/ui/production-v001/README.md`
- Test/görüntü kayıtları ve yerel paket: `build/ui-review/`, `build/ui-full-gut.log`

## Sonraki ekran sırası

**Entry → Shelter/Hub → Journey → Formation → Battle → Results**, ardından menü modülleri ve VN.

Bu tur ortak kitin entegrasyonudur. Kaynak board'lardaki nihai ekran yerleşimleri, gerçek Sign-in/Patch utility akışı, Journey/Records ekranları ve authoritative Results kompozisyonu sonraki ekran çalışmalarına aittir. Beşli gezinme bileşeni hazır; bu hedeflerin gerçek controller'ları tamamlandıkça oyuna bağlanacak.

Title için temiz, metinsiz runtime key art henüz bağlanmadığı için placeholder kullanılıyor. Owner ana müzik dosyası mevcut runtime yolunda bulunmadığından cold-start kaydı sessiz; yeni müzik eklenmedi. Art ve audio ekleme, ilgili içerik aşamasında yapılacak.

GitHub'a push, PR, merge veya dağıtım yapılmadı. Geliştirme ve çıktılar yerelde.
