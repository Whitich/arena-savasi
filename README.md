# Arena Savaşı

Arkadaşlarla aynı linkten, tarayıcıda oynanan oyun. Oyuncuların indirme veya hesap açma ihtiyacı yoktur. Oda kodu URL'nin # bölümündedir; aynı linki paylaşın.

## Ücretsiz internete yayın

[Render üzerinde ücretsiz sunucuyu oluştur](https://render.com/deploy?repo=https://github.com/Whitich/arena-savasi)

1. Render hesabına giriş yapın veya ücretsiz hesap açın.
2. Yukarıdaki bağlantıdaki Blueprint'i açın. Plan `Free`, bölge `Frankfurt` olarak tanımlıdır.
3. Dağıtım tamamlandığında verilen `https://...onrender.com` adresini açın.
4. Oyuna girin ve oda kodunu da içeren adresi arkadaşlarınıza gönderin.

Oyunun kendisi ve WebSocket sunucusu aynı adresten çalışır. Endpoint yazmak veya arkadaşların bilgisayarına bir şey kurmak gerekmez. GitHub Pages tek başına Node sunucusunu çalıştıramaz; yeni oyunu Render adresinden açın. Eski GitHub Pages adresi, özel sunucu ayarlanmamışsa geçici P2P modunda kalır.

Ücretsiz plan 15 dakika trafik almayınca uyur; ilk açılış yaklaşık bir dakika sürebilir. Kota ve platform yeniden başlatmaları vardır; sıfır gecikme veya kesintisiz 7/24 hizmet garantisi yoktur. Kart eklenmezse kota aşımında ücret yerine hizmet durdurulur. Skorlar oturum içindir; sunucu yeniden başladığında sıfırlanır. Kaynak: https://render.com/docs/free ve https://render.com/docs/faq.

## Geliştirme

Node.js 22+ ile `npm ci`, ardından `npm start`. Adres: http://localhost:8080. Aynı yerel ağda diğer cihazlar bilgisayarın yerel IP adresini kullanabilir; internetten erişim için yukarıdaki barındırma gerekir. Arkadaşlar Node kurmaz.

`npm test` oda ayrımı, konum yayını, skorun sunucudan dağıtılması, yinelenen ölüm bildirimi, yeniden bağlanma ve kimlik/puan sahteciliği kontrollerini çalıştırır. İki gerçek tarayıcıyla ateş, öldürme, iki skor tablosu ve yeniden doğuş da doğrulanmıştır.

## Ağ davranışı

Özel sunucuda MQTT, P2P host seçimi ve ortak TURN hizmeti kullanılmaz. Hareket saniyede 25 kez iletilir; istemci çizimi yerelde yapar. Kuyruk dolduğunda eski konumlar atlanır; skor ve ölüm olayları güvenilir bağlantıdan gider. Ping doğrudan oyun sunucusuna ölçülür, FPS ayrıca gösterilir. Skorun tek kaynağı sunucudur; konum paketleri skorun üzerine yazamaz. Kopuşta yerel oyun durur ve bağlantı tekrar denenir.

Bu sürümün skor ve oda yönetimi sunucudadır; hareket, çarpışma ve hasar hesaplamaları hâlâ istemcidedir. Arkadaşlarla oyun içindir; rekabetçi hile koruması sağlayan tam sunucu simülasyonu değildir.
