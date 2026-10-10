# Düşman tasarım doğrulaması — 2026-10-10

**Tasarım kapsamı tamamlandı: 26 kimlik, 7 aktif bölüm sayfası, 26 Türkçe tasarım kartı.** 20 standart düşman + 6 boss. Yseldra/The Bell-Widow ve Cael, owner’ın istediği son ayrı aşamalara bırakıldı.

## Yapılan kontroller

- Mevcut 27 enemy kaydının tamamı sayıldı. 26 kart ile tek dışlanan `boss_bell_widow` kaydı birebir eşleşir; bu kayıt Yseldra’dır. Cael’e yeni boss ID’si yaratılmadı.
- Her kartın ad/rol/element/skill/phase/objective ID’si güncel source data’dan alınır. Yeni mekanik veya üçüncü Construct fazı eklenmedi. Yinelenen Ch.2/Ch.6 Inkbound tek kimlik olarak tutuldu.
- 10 üretilmiş PNG tam decode edildi: 7 aktif sayfa ve 3 korunmuş taslak. Sayfalar 1774×887; malikâne sayfası 1536×1024. Opaque konsept panolarıdır; alpha sprite kabulü yapılmadı. SHA-256, boyut, kaynak ve tam prompt kayıtları envanter/provenance altında.
- Mevcut Godot 4.7.2 Editor ve canlı oyun korundu. `preview_session.gd` ile mevcut native Local UI Preview kullanıldı. Yedi aktif sayfa ImageTexture olarak yüklendi; 26 üst görünüm yalnızca geçici AtlasTexture bölgeleriyle gösterildi. Yedi native capture kaydedildi; decode/save hata sayısı 0. Kanıt: [native_result.json](native_result.json) ve `native/`.
- Önizleme TextureRect minimum boyut taşması düzeltildi; genişleme modu texture/size’dan önce verildi. Ch.7’nin eşit olmayan çizim sütunları elle ölçülmüş review bölgeleriyle ayrıldı. Bu değerler production sprite atlası kontratı değildir.
- Kayıtların ve kanon dosyalarının HEAD kaynak byte’ları korundu. `game/`, `server/`, content kayıtları ve `release/current/` bu tasarım işinde değiştirilmedi. Canlı önizleme yalnızca geçici bellekte, profil/save değiştirilmeden oluşturuldu.
- HTML galerisindeki yerel dosya bağlantıları, JSON kayıtları ve aktif dosya hash’leri kontrol edildi. Galeri yerel tarayıcı içindir; hosting/publish yapılmadı.

## Düzeltilen görsel hatalar

1. Lost-Vow Knight’ın fazla sağlam görünen kalkanı küçük, işe yaramayan jagged fragment oldu; iki elli kılıç kimliği korundu.
2. Oren’in kraliyet arması üç uçlu ters taç olarak netleştirildi. İnsan yüzü, eski komutan kimliği ve ölüm olmayan yenilgisi korundu.
3. Construct’un belirsiz alt bedeni iki basan mekanik ayakla düzeltildi. Sağ ankle anchor ve iki kol zincir eklemi görünür; üç pylon ayrı prop.
4. Construct sütununun kompozisyonu daraltıldı; diğer kimliğin alanına taşma temizlendi. Son aktif sayfa Ch.7 v003, Ch.5 v002; önceki dosyalar silinmedi.

## Üretime geçmeden kalanlar

Konsept panoları oyun sprite’ı değildir. İnsan/boss konseptlerinin bazılarındaki uzun gövde oranları Fadyme battle chibi referansına göre ayrıca normalize edilmelidir. Ayrı alpha dosyalar, gerçek hareket frame’leri, skill VFX, named-boss VN ifadeleri ve ses bu paketle üretilmiş ilan edilmez. Native kontrol konsept görünümü içindir; gerçek battle sahnesinde silhouette/HUD/arka plan/touch/performance kabulü pending.

İki içerik farkı [Claude teslim notunda](../HANDOFF_TR.md) ayrıntılı: Noble Retainer faction etiketi ile Wraith lore’u; Yseldra’nın eski skill-seal açıklaması ile güncel Dread/charged attack effect_ops’u. Bu sanat turu bunları sessizce yeni gameplay davranışına çevirmedi.

Owner’ın özgün stil afişinin dosyası workspace’te yok. Güncel yazılı görsel yön ve incelenen yerel Fadyme/key-art türevleri kullanıldı; kayıp dosyaya kaynak hash’i uydurulmadı. Yeni owner onayı verilmiş gibi kaydedilmedi.

Bu değişiklik runtime source/test davranışını değiştirmez; önceki oyun testlerinin yeniden çalıştırılması tasarım kabulü yerine sunulmadı. Yeni AAB hazırlanmadı.
