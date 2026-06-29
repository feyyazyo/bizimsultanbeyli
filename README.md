# Bizim Sultanbeyli — Cloudflare Pages sürümü (ÜCRETSİZ host)

Ücretsiz, ticari kullanıma açık, sınırsız trafikli **Cloudflare Pages** için hazırlandı. Üç parça:

- **Otomatik akış** → `functions/api/news.js` (Google Haberler'den Sultanbeyli haberleri; sen dokunmazsın)
- **Senin yazıların** → `functions/api/posts.js` + `admin.html` (özgün içerik; AdSense onayı buradan gelir)
- **AI taslak (opsiyonel)** → `functions/api/draft.js` (konu ver, taslak yazsın; sen düzenle)

```
index.html              → site
admin.html              → yayın paneli  (adresin/admin.html)
functions/api/news.js   → otomatik haberler
functions/api/posts.js  → özgün yazılar (KV)
functions/api/draft.js  → AI taslak (opsiyonel)
```

## Yayına alma (Cloudflare Pages — ücretsiz)

1. cloudflare.com'da ücretsiz hesap aç.
2. Bu klasörü bir GitHub deposuna yükle (ya da Wrangler CLI ile `npx wrangler pages deploy .`).
3. Cloudflare panel → **Workers & Pages → Create → Pages → Connect to Git** → depoyu seç → Deploy. Build komutu **boş**, output dizini **/** (kök).
4. Çıkan `https://...pages.dev` adresi sitendir. Kendi alan adını panelden bağlarsın (alan adı tek masraf, ~500 TL/yıl).

## Özgün yazılar için KV (5 dakikalık tek seferlik kurulum)

Yazılar Cloudflare KV'de saklanır (ücretsiz: günde 100 bin okuma).
1. Panel → **Storage & Databases → KV → Create namespace** → ad: `sultanbeyli_posts`.
2. Pages projen → **Settings → Functions → KV namespace bindings → Add**:
   - Variable name: `POSTS`  →  seçtiğin namespace.
3. **Settings → Environment variables** kısmına ekle:
   - `ADMIN_TOKEN` = uzun, rastgele bir şifre (paneline giriş anahtarın — kimseyle paylaşma).
   - `ANTHROPIC_API_KEY` = (opsiyonel) AI taslak istiyorsan Anthropic API anahtarın. Yoksa AI butonu kapalı kalır, panel yine çalışır.
4. **Redeploy** et. Bitti.

> KV bağlamazsan site yine çalışır — sadece "Yerel" yazılar görünmez. Otomatik akış KV olmadan da akar.

## Panel nasıl çalışır (adresin/admin.html)

1. `ADMIN_TOKEN` ile gir.
2. İstersen "AI ile taslak oluştur" → konu yaz → taslak forma dolar.
3. Taslağı **oku, düzenle, yerelleştir** → "Yayınla". Yazı anında sitede "Yerel" etiketiyle görünür.
4. Otomatik haberler kaynağa yönlendirir; senin yazıların **tamamı sitende** açılır (kendi içeriğin olduğu için yasal).

## AdSense onayı için: önce şunları yap

Saf toplayıcı reddedilir. Onay için: **15-30 özgün yazı**, bir **Hakkımızda**, **İletişim** ve **Gizlilik** sayfası, ve görünür yazar adı. Aşağıdaki 10 konu başlangıç için birebir uygun (hepsi Sultanbeyli'ye özel, kalıcı değerde, Google'da aranan şeyler):

1. Sultanbeyli'de su kesintisinde ne yapmalı? (İSKİ takip + hazırlık rehberi)
2. Sultanbeyli'den İstanbul'a ulaşım: M5 metro, İETT hatları ve TEM rehberi
3. Sultanbeyli'de hafta sonu gezilecek yerler ve parklar (Aydos çevresi dahil)
4. Sultanbeyli Belediyesi hizmetleri: SULMEK kursları, başvurular, iletişim
5. Sultanbeyli'de kentsel dönüşüm ve imar: vatandaşın bilmesi gerekenler
6. Sultanbeyli mahalleleri ve konut rehberi (Sulkent, kira/satılık durumu)
7. Sultanbeyli acil rehberi: nöbetçi eczane, hastane, sağlık ocağı, acil numaralar
8. Sultanbeyli okulları, kayıt ve servis rehberi; kar tatili nasıl öğrenilir
9. Sultanbeyli semt pazarları: hangi gün, nerede kurulur?
10. Sultanbeyli Belediyespor ve ilçedeki spor/etkinlik takvimi

Her birini AI'ya taslaklatıp 15-20 dakikada kendi bilgilerinle zenginleştirip yayınlayabilirsin.

## Önemli — AI'yı yardımcı olarak kullan, otomatik fabrika olarak değil

Google'ın Mart 2026 güncellemesi, AI ile toptan yeniden yazılmış haber toplayıcılarını ağır cezalandırdı (büyük trafik kayıpları). Güvenli yol: AI taslak yazsın, **sen düzenleyip** insan eliyle, az sayıda, gerçekten yerel ve faydalı yazı yayınla. Toptan oto-üretim yapma.

## Maliyet
- Hosting (Cloudflare Pages + KV): **0 TL**
- Otomatik haber API'si (Google Haberler RSS): **0 TL**
- AI taslak: opsiyonel, kullandıkça çok düşük (Haiku modeli) — istemezsen 0.
- Tek zorunlu masraf: alan adı, ~500 TL/yıl.
