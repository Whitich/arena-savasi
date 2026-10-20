# Arena Savaşı · 3.6.3

Arkadaşlarınla bağlantıyı paylaş, tarayıcıdan arenaya katıl. İndirme ve oyuncu hesabı gerekmez.

**[Oyunu oyna](https://arena-savasi.onrender.com/)** · [GitHub Pages](https://whitich.github.io/arena-savasi/oyun.html)

## Hızlı başlangıç

1. Oyuncu adını, sınıfını ve görünümünü seç.
2. **Oda oluştur** sekmesinde mod seç. Oda kodunu boş bırakırsan otomatik üretilir.
3. **Oda linkini kopyala** düğmesiyle arkadaşlarını çağır. Link veya kodla katılanlar odanın seçili moduna girer.

Oda kapasitesi 16 oyuncudur. Oda kodu parola değildir.

## Oyun modları ve kazanma hedefleri

| Mod | Kazanma hedefi | Kurallar |
|---|---|---|
| Normal Arena | 30 bireysel öldürme | Herkes tek; testere, taret ve lav tehlikeleri |
| Takım Ölüm Maçı | 50 takım öldürmesi | Dengelenen kırmızı/mavi takımlar, dost ateşi kapalı |
| Bayrak Taşıma | Toplam 100 taşıma saniyesi | Taşıyıcı saniyede 1 puan alır; öldüren bayrağı devralır; eski puanlar korunur |
| Alan Hakimiyeti · Tekli | Toplam 100 alan saniyesi | Tek oyuncu alanı tutarsa puan alır; rakip girince durur |
| Alan Hakimiyeti · Takımlı | Toplam 100 takım saniyesi | Rakipsiz takım saniyede yalnızca 1 ortak puan alır; rakip girince durur |

Alan her 15 saniyede taşınır. Tehlikeler yalnızca Normal Arena'dadır. Metal testereler dönüş izi, mekanik taretler atışta namlu parlaması gösterir. Lav aktifleşmeden önce ısınma uyarısı verir; kızgın çatlaklar ve korlar aktif bölgeyi belirginleştirir. Bu görseller hasarı veya tehlike sürelerini değiştirmez. Takımlı modlarda ölüm ekranından sınıf değiştirilebilir; yeniden doğuş 5 saniyedir. Diğer modlarda 3 saniyedir.

Hedef tamamlanınca kazanan ve sonuç tablosu gösterilir. Bağlı herkes **Rövanşa Hazırım** dediğinde aynı odada yeni tur başlar. Skor, can, buff ve yetenek beklemeleri sıfırlanır; görünüm ve oyuncu kimliği korunur.

## Kontroller

| İşlem | Varsayılan |
|---|---|
| Hareket | W / A / S / D; varsayılan hareket atamalarında oklar da çalışır |
| Ateş | Sol tık veya Boşluk |
| Yetenekler | Q / E / R |
| Sesi aç/kapat | M |

**Tuş ayarları** menüsünden değiştirilebilir. Atamalar bu tarayıcıda saklanır. Sol tık ateş etmeye devam eder.

Sınıf kartlarında buffsız temel mermi hasarı, mermi hızı, atış aralığı, saniyedeki atış sayısı, hareket hızı ve mermi ömrü gösterilir. Q/E/R açıklamaları hasar, süre, menzil ve bekleme bilgilerini içerir. Çoklu atış toplamı bütün mermilerin isabet etmesi içindir.

## Sekiz sınıf

Parantezler bekleme süresidir; etkilerin süresiyle aynı değildir.

| Sınıf | Can | Q | E | R |
|---|---:|---|---|---|
| 🔷 Sekici | 95 | Kayarak Kaçış (5 sn) | Sekme Ustası (12 sn) | Çapraz Yaylım (18 sn) |
| 🔮 Büyücü | 90 | Işınlanma (14 sn) | Buz Mührü (12 sn) | Arkan Küre (7 sn) |
| 🗡 Suikastçı | 80 | Gölge Atılımı (6 sn) | Görünmezlik (11 sn) | Hançer Salvosu (16 sn) |
| 🃏 Soytarı | 90 | Yan Adım (5 sn) | İkiz Aldatmaca (13 sn) | Konfeti Salvosu (16 sn) |
| ⚔ Akıncı | 100 | Atılma (4 sn) | Seri Tetik (11 sn) | İtici Darbe (16 sn) |
| 🏹 İzci | 85 | Uzun Atılma (5 sn) | Adrenalin (12 sn) | Üçlü Keskin Atış (17 sn) |
| 🛡 Muhafız | 145 | Hücum (6 sn) | Kale · 5 sn (14 sn) | Yer Sarsıntısı (18 sn) |
| 💣 Bombacı | 105 | Kaçış Atılması (5 sn) | Kara Mayını (10 sn) | Bomba Salvosu (17 sn) |

- **Sekici:** Hızlı mermiler 3 kez seker ve uzun yaşar. E: 4 saniye daha fazla sekme. R: beşli seken yaylım.
- **Büyücü:** Q: fareye doğru en fazla 380 birim ışınlanma; duvar içine girmez. E: uzun menzilli buz, 22 hasar ve 0,5 saniye sabitleme. R: delip geçen arkan küre (34 hasar).
- **Suikastçı:** E: 1 saniye görünmezlik; saldırı veya hasar alınca bozulur. Q: atılma. R: yakın mesafeli üçlü hançer.
- **Soytarı:** E: 2 saniye aynı görünen, yürüyen ve hafif hasarla ateş eden kopya. Q: kaçış. R: yavaşlatan üçlü salvo.
- **Akıncı:** Q: atılma. E: 3 saniye %30 hızlı ateş. R: öne doğru koni, 38 hasar ve geri itme.
- **İzci:** Hızlı ve kırılgan. Uzun atılma, hız patlaması ve R ile ayrı ayrı kullanılan üç adet 42 hasarlık keskin atış.
- **Muhafız:** Yüksek can, düşük hız. Hücum, 5 saniyelik 95 canlık kalkan. R: 40 yakın alan hasarı ve 2 saniye yavaşlatma.
- **Bombacı:** Alan kontrolü. Kaçış, düşmana tetiklenen mayın ve üç bombalık salvo.

İzci'nin R yeteneği üç ayrı basışla kullanılır, üçüncü atıştan sonra beklemeye girer. Büyücü Q ile fareye doğru en fazla 380 birim ışınlanır; E buz büyüsü 22 hasar ve 0,5 saniye sabitleme uygular; R arkan küre 34 hasar verir ve en fazla üç hedefi deler. Suikastçı'nın görünmezliği saldırı veya hasarda bozulur; bayrak taşıyıcısı gizlenemez. Soytarı kopyası iki saniye yürür ve hafif hasarla ateş eder; oyuncu sayısına ve hedef puanına dahil değildir.

## Karakter ve silah özelleştirme

Bütün seçenekler kozmetiktir: hasar, hız, menzil ve çarpışma alanını değiştirmez. Karakter ve silah görünümü diğer oyunculara da gönderilir; rastgele görünüm düğmesi bütün görünümü yeniler.

- **Karakter:** 10 renk, 4 desen, 3 aura ve 2 vizör (kapatılabilir).
- **8 başlık:** Gökkuşağı Unicorn, Kedi Kulakları, Büyücü Şapkası, DJ Kulaklık, Samuray Miğferi, Taç, Boynuz ve Anten. Başlıksız seçenek de var.
- **7 hareket izi:** Gökkuşağı, Kalp İzi, Yıldız Tozu, Buz Parçaları, Kuyruklu Yıldız, Kıvılcım ve Neon Şerit. Kapatılabilir.
- **6 silah görünümü:** Klasik, Neon Ray, Altın İşçilik, Şeker Kamışı, Kozmik ve Buz Kristali. Silah rengi karakter renginden ayrı seçilir (10 renk).

Gökkuşağı Unicorn başlığı beyaz kulaklı bir başlık, renkli yele ve gökkuşağı çizgili tek boynuz içerir. Lobi önizlemesi seçimleri gösterir. Görünüm bu tarayıcıda kaydedilir. **Hafif efekt** ayarında hareket izleri çizilmez ve parçacıklar azaltılır; oyun kuralları aynıdır.

## Sana özel beş harita görünümü

**Neon Tersane · Kadim Orman · Buz Üssü · Çöl Harabeleri · Kızıl Dökümhane**

Lobiden veya maç içindeki harita görünümü düğmesinden seçilir. Zemin desenleri, duvar malzemeleri ve renkler değişir. Herkes kendi temasını görür; engeller ve çarpışmalar herkes için aynıdır. Seçim yalnızca bu tarayıcıda saklanır. Görünüm menüsü maçı duraklatmaz.

## Kalkan, can ve savaş geri bildirimi

- Kalkan gelen hasarı önce kendi canından karşılar; taşan hasar normal cana geçer. **Kalkan canı 5 saniye sonra kendiliğinden silinir.** Yeni kalkan kazanımı süreyi yeniler. Bufflarla toplam en fazla 120 kalkan canı olur.
- Titan Zırhı'nın kalkan kısmı 5 saniye, hasar azaltma kısmı 10 saniyedir.
- Pasif can yenileme, son hasardan 8 saniye sonra saniyede 1 candır.
- Yeniden doğuş koruması ayrı olarak 1 saniyedir.
- İsabet işareti, hasar sayıları, kalkan kırılma efekti, öldürme sesi ve kritik can uyarısı vardır. Yakındaki oyuncuların ateş sesleri mesafe ve yöne göre duyulur.
- TNT patladıktan 20 saniye sonra geri gelir; üzerinde oyuncu varsa bekler.

## 22 buff · beş nadirlik

Haritadaki halkalar, nadirlik yazısı ve 1–5 küçük işaret kademeyi gösterir. İlk buff 2 saniyede, sonrakiler uygun yer bulunursa **6,5 saniyede bir** çıkar. Aynı anda en fazla **4 buff** bulunur; alınmayan buff 26 saniye sonra kaybolur.

| Nadirlik | Renk | Çıkış ağırlığı |
|---|---|---:|
| Sıradan | Gri | %28 |
| Gelişmiş | Yeşil | %30 |
| Nadir | Mavi | %23 |
| Destansı | Mor | %13 |
| Legendary | Sarı | %6 |

Aynı kademe içindeki bufflar eşit olasılıklıdır. Aynı süreli buffı tekrar almak süreyi yeniler; aynı etkiyi sınırsız katlamaz. Ölümde aktif bufflar temizlenir. Lobideki **Buff rehberi** süreleri ve birleşimleri gösterir.

### Sıradan · Gri

- **✚ İlk Yardım:** Anında +15 can.
- **⌛ Enerji Parçası:** Yetenek beklemelerinden 2 saniye düşürür.

### Gelişmiş · Yeşil

- **♥ Can Paketi:** Anında +25 can.
- **⚡ Hız:** 8 saniye %45 hızlı hareket.
- **➤ İvme Mermisi:** 10 saniye silah mermileri %25 daha hızlı.
- **🧲 Mıknatıs:** 12 saniye buffları 90 birimden topla; duvar arkasını çekmez.
- **✚ Yenilenme:** 8 saniye +2 can/sn; son 2 saniyede hasar aldıysan durur.

### Nadir · Mavi

- **🛡 Kalkan:** 5 saniyelik +35 kalkan canı. Toplam en fazla 120; tekrar alınca süre yenilenir.
- **💥 Güçlü Mermi:** 9 saniye silah hasarı %40 artar.
- **◆ Çelik Deri:** 9 saniye alınan hasar %20 azalır. Titan ile en güçlü koruma geçerli.
- **◉ Odak:** 10 saniye yetenek beklemeleri %25 hızlı dolar.
- **❄ Buzlu Mermi:** 9 saniye normal silah isabetleri 0,6 saniye yavaşlatır. Bombaya uygulanmaz.

### Destansı · Mor

- **🔫 Çift Namlu:** 9 saniye iki mermi; her biri %76 hasar. Bomba ile birleşir.
- **🎯 Uzun Menzil:** 14 saniye mermi ömrü %70 artar (en fazla 3 saniye).
- **◇ Sekme Çekirdeği:** 10 saniye silah mermilerine +1 sekme. Sekici ve bombayla birleşir.
- **⇢ Delici Mermi:** 9 saniye silah mermisi bir ek hedefi deler; aynı hedefe tekrar vurmaz. Bomba hariç.
- **◎ Avcı İçgüdüsü:** 9 saniye %35 canın altındaki rakiplere %20 fazla hasar.

### Legendary · Sarı

- **⚡ Hızlı Tarama:** 10 saniye atış aralığı %42 azalır.
- **🚀 Bomba Fırlatıcı:** 12 saniye silahın patlayıcı bomba atar. Çoklu atış ile birleşir.
- **🩸 Can Çalma:** 10 saniye verdiğin gerçek can hasarının %20’sini iyileş.
- **✴ Yıldız Salvosu:** 9 saniye üçlü atış (%60 hasar). Çift Namlu ile dörtlü (%50), bomba ile de birleşir.
- **⬟ Titan Zırhı:** 5 saniyelik +35 kalkan, 10 saniye %30 hasar azaltma; karşılığında %10 yavaş hareket.

Üçlü atış + Çift Namlu dört mermiye dönüşür; Bomba Fırlatıcı ile de birleşir. Çoklu bombaların hasarı ve yarıçapı denge için azaltılır. Delici/Buzlu Mermi bombalara uygulanmaz; Sekme Çekirdeği uygulanır. Çelik Deri ve Titan birlikteyken en güçlü hasar azaltma geçerlidir. Mıknatıs duvar ve TNT arkasındaki buffı çekmez.

## Geliştirme ve yayın

Sunucu için Node.js 22 veya üzeri gerekir. Oyuncuların Node.js kurmasına gerek yoktur.

```sh
npm ci
npm start
# http://localhost:8080
npm test
```

- **oyun.html:** lobi, HUD ve menüler.
- **client.js:** çizim, sesler, kişisel ayarlar, giriş ve ağ istemcisi.
- **game-core.js:** ortak tanımlar ve sunucunun işlettiği oyun simülasyonu.
- **server.cjs:** HTTP/WebSocket, odalar ve oturumlar.
- **render.yaml:** Render dağıtım tanımı.

Oyun ve WebSocket sunucusu aynı Render hizmetinde çalışır. GitHub Pages istemcisi de canlı sunucuya bağlanır. Bu kurulumda güncellemeden sonra Render'da **Manual Deploy → Deploy latest commit** kullanılır. **/health** içindeki release sürümü ve version commit'i yayın kontrolü için kullanılır. Açık oyun sekmelerini yeni yayından sonra Ctrl+F5 ile yenile.

Odalar ve skorlar bellekte tutulur; sunucu yeniden başlatıldığında sıfırlanır. Boş odalar beş dakikada temizlenir; kısa kopuşlarda oyuncu oturumu 30 saniye korunur. Ücretsiz servis boşta kaldığında uyuyabilir, ilk açılış gecikebilir.

Sunucu 40 Hz simülasyon ve 20 Hz durum yayını kullanır. Konum, hasar, skor, mermi, hedef ve buff hesapları sunucudadır. Yönetim anahtarları istemciye konmaz. Kapsamlı bot veya DDoS koruması iddiası yoktur.

Testler; sınıfları, mod hedeflerini, rövanşı, kalkan süresini, buff birleşimlerini, nadirlik havuzlarını, hareket/çarpışmayı, görünmezliği ve gerçek WebSocket akışlarını kapsar.
