# Arena Savaşı · 2.0

Tarayıcıdan arkadaşlarla oynanan çok oyunculu arena. Oyuncular indirme yapmaz, hesap açmaz.

**Canlı oyun:** https://arena-savasi.onrender.com/

## Oda oluşturma

1. Oyuncu adını ve sınıfını seç.
2. **Oda oluştur** sekmesinden oyun modunu seç. Oda kodunu boş bırakırsan otomatik üretilir.
3. Oyuna girdikten sonra **Oda linkini kopyala** düğmesini kullan.
4. Arkadaşların linki açıp kendi sınıfını seçerek **Odaya katıl** düğmesine basar. Modu oda belirler.

Oda kodu bir parola değildir. Odaya en fazla 16 oyuncu katılabilir. Ana menüye dönerek başka sınıfla yeniden katılabilirsin.

## Modlar

- **Normal Arena:** herkes tek oynar; bireysel öldürme skoru. Hareketli testereler, dönen taretler ve aralıklı lav kapanları vardır.
- **Takım Ölüm Maçı:** sunucu oyuncuları kırmızı ve mavi takıma dengeli dağıtır. Hem bireysel öldürmeler hem takım toplamı görünür. Dost ateşi kapalıdır. Harita tehlikeleri yoktur.
- **Bayrak Taşıma:** herkes tek oynar. Ortadaki bayrağı alan oyuncu her tam saniyede 1 puan kazanır. Taşıyıcı öldürüldüğünde bayrak öldüren canlı oyuncuya geçer; önceki puanlar korunur. Geçerli bir taşıyıcı yoksa veya taşıyıcı ayrılırsa bayrak yere düşer. Harita tehlikeleri yoktur.

Puanlar oda oturumu boyunca tutulur. Sunucu yeniden başladığında veya güncellendiğinde odalar ve puanlar sıfırlanır. Boş odalar beş dakika sonra temizlenir. Kısa bağlantı kopuşlarında oyuncu oturumu 30 saniye korunur.

## Dört sınıf

| Sınıf | Can / hız | Q | E | R |
|---|---|---|---|---|
| Akıncı | 100 / 260 | Atılma | 1,4 saniyelik kalkan | Şok dalgası |
| İzci | 85 / 305 | Uzun atılma | 3 saniyelik adrenalin | 65 hasarlık keskin atış |
| Muhafız | 145 / 215 | Hücum | 2,8 saniyelik kalkan | Hasar ve yavaşlatan yer sarsıntısı |
| Bombacı | 105 / 245 | Kaçış atılması | Kara mayını | Üç bombalık salvo |

Her yeteneğin ayrı bekleme süresi vardır. Ana menüde **Tuş ayarları** ile hareket, ateş, üç yetenek ve ses tuşları değiştirilebilir. Varsayılanlar WASD, sol tık/boşluk, Q/E/R ve M'dir. Ok tuşları, başka eyleme atanmadıkları sürece varsayılan harekete alternatif olabilir. Tuşlar bu tarayıcıda saklanır.

## Bufflar ve denge

Normal bufflar: hız, çift namlu, güçlü mermi, +25 can ve kısa kalkan.

Altın renkli **efsanevi** bufflar: %70 uzun menzil (14 saniye), hızlı tarama (10 saniye), patlayıcı bomba fırlatıcı (12 saniye), %20 can çalma (10 saniye). Yeni buff doğumlarının %23'ü efsanevi türlerden seçilir. Bufflar süreli ve harita üzerinde ortak alınır.

Pasif iyileşme, sekiz saniye hasar almadan bekledikten sonra saniyede yalnızca bir candır. Önceki 7 can/saniyeye göre ciddi biçimde düşürülmüştür.

TNT'ler patladıktan 20 saniye sonra tekrar çıkar; üstünde oyuncu duruyorsa güvenli çıkış için bir saniye daha bekler. Zincirleme patlama ve alan hasarı sunucuda hesaplanır.

Ateş, bomba ve yetenek sesleri diğer oyunculara da iletilir. Sesler mesafeye göre zayıflar ve sağ/sol konumlandırılır. Tarayıcı sesini başlatmak için oyuna giriş etkileşimi gerekir; M ile susturulabilir.

## Sunucu ve yayın

Oyun sayfası ile WebSocket sunucusu aynı Render hizmetindedir. GitHub Pages istemcisi de `server-config.js` üzerinden aynı sunucuya bağlanır. GitHub Pages kendi başına Node sunucusunu çalıştırmaz.

Kod `main` dalına gönderilir. Render'ın Auto-Deploy ayarı `On Commit` olmasına rağmen bu kurulumda GitHub gönderimi tetiklemesi doğrulanamamıştır; güncellemede **Manual Deploy → Deploy latest commit** ile son sürüm yayına alınmalı ve `/health` çıktısındaki `version` Git commit'i ile eşleştirilmelidir. Açık oyun sekmeleri yeni istemciyi almak için yenilenmelidir.

`render.yaml`, ücretsiz plan ve Frankfurt bölgesini seçer. Ücretsiz hizmet trafik almadan 15 dakika beklerse uyur; sonraki ilk açılış yaklaşık bir dakika sürebilir. Platform kotaları ve yeniden başlatmaları geçerlidir. Kaynaklar: https://render.com/docs/free ve https://render.com/docs/websocket.

## Geliştirme ve test

Node.js 22+ ile `npm ci`, ardından `npm start`. Yerel adres: http://localhost:8080. Oyuncular Node kurmaz.

`npm test`: sınıf yetenekleri, takım dengesi ve dost ateşi, bayrak aktarımı/puan koruma, iyileşme hızı, TNT yenilenmesi, efsanevi silah davranışı, mermi çarpışması, tuş atamaları ve gerçek WebSocket üzerinden öldürme/skor senkronizasyonu.

`game-core.js` ortak simülasyonu içerir. Sunucu 40 Hz hesaplama ve 20 Hz durum yayını yapar. İstemci kendi hareketini tahmin eder, diğer oyuncuları ara değerlerle çizer. Hasar, mermi, skor, sınıf yetenekleri, buff alma, harita tehlikeleri ve yeniden doğuş sunucu tarafından hesaplanır; istemciden gelen konum, can, öldürme veya puan bildirimleri kabul edilmez. Bu, tek başına kapsamlı bot veya DDoS koruması anlamına gelmez.

Render/GitHub yönetim anahtarları istemci dosyalarında bulunmaz. Yeniden bağlanma belirteci yalnızca oyuncunun kısa süreli oda oturumuna aittir; yönetim erişimi sağlamaz.
