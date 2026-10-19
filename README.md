# Arena Savaşı · 3.0

Arkadaşlarla tarayıcıdan oynanan arena. Oyuncular dosya indirmez, hesap açmaz.

**Canlı oyun:** https://arena-savasi.onrender.com/

## Oda ve kontroller

Oyuncu adını, kişisel görünümünü ve sınıfını seç. **Oda oluştur** sekmesinden mod seçip oda kur; boş kod otomatik oluşturulur. **Oda linkini kopyala** ile arkadaşlarını çağır. Kodla katılan oyuncu odanın mevcut moduna girer. Oda başına en fazla 16 oyuncu vardır; oda kodu parola değildir.

Varsayılanlar: WASD/oklar hareket, sol tık/boşluk ateş, Q/E/R yetenekler, M ses. Ana menüde tuşlar değiştirilebilir ve tarayıcıda saklanır. Görünüm için 10 renk, 4 desen ve taç/boynuz/anten seçenekleri vardır. Takım renkleri ayrı halkayla gösterilir.

## Dört mod

- **Normal Arena:** herkes tek; öldürme puanı. Hareketli testere, dönen taret ve aralıklı lav tehlikeleri yalnızca bu moddadır.
- **Takım Ölüm Maçı:** kırmızı/mavi takımlar dengelenir; dost ateşi kapalıdır. Bireysel öldürme ve takım toplamları gösterilir. Ölüm ekranında başka sınıf seçilebilir; seçim 5 saniyelik yeniden doğuş sonunda uygulanır. Takım, görünüm ve skor korunur. Yeni sınıfın yetenekleri yarım bekleme süresiyle başlar.
- **Bayrak Taşıma:** bayrak sende kaldıkça her saniye +1 puan. Canlı bir rakip seni öldürürse bayrak ona geçer; eski puanlar silinmez. Taşıyıcı ayrılırsa veya geçerli öldüren yoksa bayrak yere düşer. Bayrak taşıyıcısı görünmez olamaz.
- **Alan Hakimiyeti:** herkes tek. Alan içinde tek başına kalınca her saniye +1 puan; birden fazla oyuncu girerse çekişme boyunca puan durur. Alan 15 saniyede bir en az 300 birim uzaktaki geçerli konuma taşınır. Puanlar korunur. Kopyalar alan puanı kazanmaz ve alanı çekişmeli yapmaz.

## Sekiz sınıf ve ilk denge ayarları

| Sınıf | Can | Hız | Ana mermi | Q | E | R |
|---|---:|---:|---|---|---|---|
| Akıncı | 100 | 260 | 25 hasar / 0,24 sn | Atılma | 55 can kalkan | 38 alan hasarı |
| İzci | 85 | 305 | 24 / 0,27 sn | Uzun atılma | 3 sn adrenalin | Ayrı ayrı 3 × 42 keskin atış |
| Muhafız | 145 | 215 | 32 / 0,32 sn | Hücum | 95 can kalkan | 60 yakın alan hasarı + yavaşlatma |
| Bombacı | 105 | 245 | 27 / 0,28 sn | Kaçış atılması | Kara mayını | 3 × 38 patlayıcı salvo |
| Sekici | 95 | 255 | 18 / 0,29 sn; hız 920, ömür 1,65 sn, 3 sekme | Kayma | 4 sn sekme +2 ve hız +%15 | 5 × 15 hasarlı, 4 kez seken yaylım |
| Büyücü | 90 | 245 | 23 / 0,28 sn | 30 alan hasarı | 40 can bariyer | Fareye doğru en fazla 380 birim ışınlanma |
| Suikastçı | 80 | 310 | 20 / 0,25 sn | Gölge atılımı | 1 sn görünmezlik | 3 × 17 yakın menzilli hançer |
| Soytarı | 90 | 275 | 21 / 0,27 sn | Yan adım | 2 sn hareket eden, hafif ateş eden kopya | 3 × 18 hasar + 1 sn yavaşlatma |

İzci R'si tek basışta üç mermi saçmaz: her basış bir atış kullanır. Basışlar arasında en az 0,22 saniye vardır. Üçüncü atış 17 saniyelik ortak bekleme süresini başlatır. Haklar ekranda görünür. Ölüm, kullanılmamış kısmi şarjı bedelsiz yenilemez.

Işınlanma menzili sunucuda sınırlandırılır. Hedef doluysa hedef çizgisinde geri gelerek uygun yer aranır; oyuncu duvarın veya TNT'nin içine yerleştirilmez.

Görünmezlik saldırı veya hasarla bozulur. Rakiplere gönderilen konum listesinden oyuncu çıkarılır; kendisi ve takım arkadaşları saydam siluet görür. Bayrak taşıyıcısı gizlenemez.

Soytarı'nın kopyası aynı isim, görünüm ve sınıfla görünür; rakibin oyun ekranında kopya etiketi bulunmaz. Sahibi ve takım arkadaşları ayırt edebilir. Kopya yön değiştirir, ilerler ve yaklaşık 0,33 saniyede bir 8 hasarlık hafif mermi atar; en fazla 2 saniye yaşar. Kopya öldürülmesi skor üretmez ve oyuncu sayısını artırmaz. Bu görsel aldatmaca, istemci verilerini inceleyen kişiye karşı bir gizleme garantisi değildir.

## Kalkan ve iyileşme

Kalkan bir süreli dokunulmazlık değildir. Gelen hasar önce kalkan canından düşer; kalkan tükenince kalan hasar normal cana geçer. Kalkan zamanla azalmaz, öldüğünde temizlenir. Yetenek yeniden kullanımı kendi bekleme süresine tabidir. Kalkan buffı +35 kalkan verir; toplam en fazla 120 olur. Yeniden doğuşta ayrı, kısa 1 saniyelik doğuş koruması vardır.

Pasif iyileşme: 8 saniye hasar almadan bekledikten sonra saniyede yalnızca +1 can.

## Buff birleşimleri

Normal bufflar: hız, çift namlu, güçlü mermi, +25 can, kalkan. Efsanevi bufflar: %70 uzun menzil (14 sn), hızlı tarama (10 sn), bomba fırlatıcı (12 sn), %20 can çalma (10 sn). Yeni buff doğumlarında efsanevi seçilme olasılığı %23'tür.

Çift namlu + bomba fırlatıcı iki bomba atar. Hızlı tarama bu silahın aralığını da kısaltır; güç patlama hasarını, menzil mermi ömrünü artırır ve can çalma gerçek can hasarına uygulanır. Denge için çift bombanın her biri daha düşük hasar ve yarıçap kullanır. Normal çift atış da mermi başına daha düşük hasarlıdır. Aktif yeteneklerin salvo hasarları ayrıca sabittir. Sekici'nin pasif sekmesi bomba buffıyla da çalışır. Sekme, mermi ömrünü sıfırlamaz; toplam ömür 3 saniyeyle sınırlıdır.

TNT 50 can taşır, patladıktan 20 saniye sonra geri gelir; üzerinde oyuncu varsa güvenli çıkış için bekler. Alan hasarı ve zincirleme patlamalar sunucuda hesaplanır. Yakındaki diğer oyuncuların ateş ve yetenekleri mesafeye ve sağ/sol konumuna göre duyulur.

## Yayın ve test

Node.js 22+: `npm ci`, `npm start`. Yerel adres http://localhost:8080. Oyuncular Node kurmaz. Oyun sayfası ile WebSocket sunucusu aynı Render hizmetindedir; GitHub Pages istemcisi aynı sunucuya bağlanır.

Kod `main` dalına gönderilir. Bu kurulumda otomatik tetikleme doğrulanamadığı için Render'dan **Manual Deploy → Deploy latest commit** kullanılır. `/health` içindeki `version` Git commit'iyle ve `release` sürümle eşleştirilir. Açık sekmeler yeni sürümü almak için yenilenmelidir.

Ücretsiz Frankfurt hizmeti, 15 dakika trafik almayınca uyuyabilir; sonraki ilk açılış yaklaşık bir dakika sürebilir. Skorlar ve odalar bellektedir; yayın/yeniden başlatmada sıfırlanır. Boş odalar beş dakikada temizlenir. Kısa kopuşlarda oyuncu oturumu 30 saniye korunur. Kaynaklar: https://render.com/docs/free ve https://render.com/docs/websocket.

`npm test`: sınıflar, sekme geometrisi ve ömrü, kalkan kırılması/taşan hasar, üç şarjlı ulti, ışınlanma sınırları, görünmezlik için alıcıya göre veri süzme, kopya davranışı, buff birleşimleri, ölümde sınıf seçimi, alan puanı/çekişme/taşınma ve gerçek WebSocket akışları.

Sunucu 40 Hz simülasyon, 20 Hz durum yayını yapar. Konum, hasar, mermi, skor, sınıf, buff ve hedefler sunucu tarafından hesaplanır. İstemci bildirimleriyle can/puan/öldürme verilemez. Bu kapsamlı bot veya DDoS koruması anlamına gelmez. Yönetim anahtarları istemciye konmaz; yeniden bağlanma belirteci yalnızca oyuncunun kısa süreli oda oturumuna aittir.
