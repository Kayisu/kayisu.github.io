# Arcadia Protocol — Gece Vardiyası

Sekiz bağımsız mini oyun, üç seçilebilir başrol ve oyun hedefleriyle açılan ortak bir hikâye. Türkçe, bağımlılıksız HTML/CSS/Canvas demosu.

## Çalıştırma

`dist/` dizinini herhangi bir statik HTTP sunucusuyla sunun. GitHub Pages sürümü `public/arcadia/` altında bulunur ve Astro tarafından `/arcadia/` yoluna kopyalanır. Tüm kaynak bağlantıları görecelidir.

## Oyunlar

| Makine | Tür | Kontrol | Hikâye hedefi |
| --- | --- | --- | --- |
| Drift Alley | Trafikten kaçış | A/D veya oklar | 15 aracı geç |
| Crate Tower | İstifleme | Space / dokun | 8 kasa |
| Circuit Breaker | Lights Out | Hücreye tıkla/dokun | Bütün ışıkları söndür |
| Neon Courier | Koşu / çift zıplama | Space / yukarı / dokun | 12 veri parçası |
| Ghost Signal | Savunma | A/D ve Space | 20 sinyal |
| Memory Leak | Hafıza eşleştirme | Tıkla/dokun | 8 çift |
| Last Metro | Yılan | Oklar / WASD | 8 yolcu |
| Pulse Kitchen | Dört kanallı ritim | D/F/J/K | 20 doğru vuruş |

P veya duraklatma düğmesi oyunu durdurur. Esc makineyi kapatır. Mobilde ekran tuşları vardır. Karakter, hikâye kayıtları ve rekorlar `localStorage` içinde bu tarayıcıya kaydedilir. Ayarlar menüsünden JSON olarak indirilebilir. Sekiz kayıt son epiloğu açar.

## Kaynaklar

- `index.html`: salon, arşiv, karakterler, erişilebilir diyaloglar
- `style.css`: masaüstü ve mobil düzenler
- `art.js`: özgün şehir, portreler ve oyun görselleri; tamamı Canvas ile çizilir
- `games.js`: bağımsız oynanışlar, girdi, duraklatma, zamanlayıcı ve Web Audio
- `app.js`: karakter oluşturma, hikâye, hedefler, kayıt, gezinme

Uzak font, CDN, görsel veya oyun kütüphanesi kullanılmaz. Sunucu, kullanıcı hesabı veya analitik yoktur. Sesler ilk etkileşimden sonra Web Audio ile üretilir.

## Doğrulama

Sites kaynağında: `node qa/gameplay.cjs dist/`

GitHub deposunda: `node scripts/arcadia/gameplay.test.cjs public/arcadia/`

Dokuz senaryo sekiz motorun çizimini, gerçek girdi olaylarıyla hedeflerini, bulmaca çözülebilirliğini, duraklatmayı, hafıza zamanlayıcısını ve ritim vuruş pencerelerini denetler. Masaüstü tarayıcı akışı, bulmaca sonucu → arşiv kaydı ve 390 px mobil düzen ayrıca kontrol edilmiştir.

Demo 0.1. Yeni oyunlar ve daha uzun bölümler için başlangıç sürümü.
