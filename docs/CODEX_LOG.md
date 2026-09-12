# Codex log

## 2026-09-12 — K01 temizlik-ve-rota

- Varsayım: YKS aracının İngilizce karşılığı olmadığı için ortak başlıktaki dil değiştirici `/` adresine gider; bu, iş tanımındaki yönlendirmedir.
- Varsayım: Türkçe oyun dizini İngilizce oyun verisini ve tekil sandbox rotasını kullanır; iş tanımı sandbox’ı tek rota olarak bırakmayı ister.
- Çelişki çözümü: Örnek proje silinince Merkür geçici olarak boş kalır; ancak aynı işte istenen YKS proje kaydı Merkür’e eklendiği için nihai durumda Merkür bu gerçek proje kaydını gösterir. Boş durum stili değiştirilmedi.

## 2026-09-12 — K02 icerik-girisleri

- Varsayım: CogniSpace Earth’e taşındığı için Earth oyun keşfi, proje listesi dolu olsa da görünmeye devam eder ve iki dilde sözlük üzerinden yerelleştirilir.
- Varsayım: Mevcut YKS Tercih Sihirbazı girişinin türü, mevcut açıklamasına uygun olarak `tool` olarak işaretlenir.

## 2026-09-12 — K03 gunes-profil-kaynagi

- Varsayım: Profildeki iki proje bağlantısını tek bir güncel durum satırında erişilebilir biçimde göstermek için `now` alanı düz metin yerine metin ve isteğe bağlı bağlantı içeren öğeler kullanır; tüm profil içeriği yine tek kaynakta tutulur.

## 2026-09-12 — K04 kapi-duzeltmeleri

- Varsayım: Başlık ve alt bilgideki About bağlantısı, landing içi ankordan ziyade Sun profil sayfasını açmalıdır; landing içindeki `#about` kimliği bölüm için korunur.
- Karar: YKS sayfası herkese açık olduğundan sitemap üretilmemesine yönelik bir koruma eklenmedi; sitemap kabul edilebilir.
