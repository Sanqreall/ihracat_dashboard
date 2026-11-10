# İhracat Yönetimi v4

Next.js 15 + Supabase. Eski sistemin (v3) yerine geçer. Eski sistem kurulum boyunca olduğu gibi çalışmaya devam eder.

## Neler değişti

| Eski sistem | Yeni sistem |
|---|---|
| Plan değişince ödemelerde yeni "bekleyen" kayıt açılıyordu, tahsil edilmiş ön ödeme yetim kalıyor ve çift ön ödeme oluşuyordu | Ödemeler listesinde sadece **gerçekten gelen para** var. Bekleyen tutar = plan − tahsilat, kayıt olarak tutulmuyor. Plan değişse bile tahsilat kaybolmuyor, en eski vadeden başlayarak yeniden dağıtılıyor |
| Giriş yapmadan tüm veri okunabiliyordu | Giriş yapmayan hiçbir şey göremez |
| Roller sadece ekranda geçerliydi | Roller veritabanında zorunlu: görüntüleyici hiçbir şeyi değiştiremez |
| Tüm veri tarayıcıya kopyalanıyor, 3 dakikada bir tam yedek alınıyordu | Veri sadece veritabanında duruyor. Her değişiklik kayıt geçmişine (audit_log) yazılıyor |
| 1000 satırdan sonrası görünmüyordu | Sınır yok |
| İptal edilen siparişler ciroda ve alacakta sayılıyordu | İptaller ciroya ve alacağa girmiyor |
| Sevkiyat bazlı plan iskontoyu ve ek maliyeti atlıyordu | Plan toplamı kuruşu kuruşuna sipariş toplamına eşit |
| İki kişi aynı siparişi düzenlerse biri diğerini eziyordu | Başkası değiştirdiyse kaydetmeden önce uyarıyor |
| "Bugün" UTC'ye göreydi (gece 00:00–03:00 arası dün sayılıyordu) | Türkiye saati |

## Kurulum (sadece tarayıcı)

### 1. Supabase — yeni proje
1. supabase.com → **New project** (bölge: Frankfurt). Eski projeye dokunma.
2. **SQL Editor → New query** → `supabase/kurulum.sql` dosyasının tamamını yapıştır → **Run**. Sonuç "Success. No rows returned" olmalı.
3. **Authentication → Sign In / Providers → Email** altında **"Allow new users to sign up"** seçeneğini kapat. Böylece dışarıdan kimse hesap açamaz.
4. **Authentication → Users → Add user → Create new user**: kendi e-postan ve şifren, **Auto Confirm User** işaretli. **İlk eklenen kullanıcı otomatik yönetici olur.**
5. **Project Settings → API**: **Project URL** ve **anon public** anahtarını kopyala. Yeni panelde bu anahtar **Publishable key** olarak geçiyor; ikisi de çalışır.

### 2. GitHub — yeni repo
1. github.com → **New repository** (Private) → oluştur.
2. **uploading an existing file** bağlantısına tıkla. Zip'i bilgisayarında aç ve `ihracat-yeni` klasörünün **içindekileri** (klasörün kendisini değil) sürükleyip bırak → **Commit changes**.

### 3. Vercel — deploy
1. vercel.com → **Add New → Project** → yeni repoyu seç.
2. **Environment Variables** bölümüne ekle:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon (publishable) key
3. **Deploy**. Bitince siteyi aç ve kendi kullanıcınla giriş yap.

### 4. Eski verileri aktar (Yönetim → Veri Aktarımı)
1. Eski Vercel projesi → **Settings → Environment Variables**: `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` değerlerini kopyala.
2. Yeni sistemde **Veri Aktarımı** ekranına bu iki değeri yapıştır → **Bağlan ve oku**. Eski sistemde hiçbir şey değişmez, sadece okunur.
3. Önizlemeyi ve uyarıları oku → **Yeni sisteme aktar**.
4. **Karşılaştırma** tablosuna bak:
   - **Ciro** ve **Tahsilat** sütunları eskisiyle birebir aynı olmalı.
   - **Bekleyen** sütununda fark olabilir. Eski sistemdeki çift ya da yetim bekleyen kayıtlar yenisinde yok. Farklı çıkan siparişleri tek tek açıp kontrol et.
5. Sorun görürsen eski sistemde düzelt, yeni sistemde **Yeni sistemi sıfırla** → tekrar aktar. Bunu istediğin kadar tekrarlayabilirsin.
6. Rakamlar tamamsa **Aktarımı kilitle**. Kilitlendikten sonra sıfırlama yapılamaz.

> Geçiş günü: önce eski sistemde değişiklik yapmayı bırak, son bir kez sıfırla + aktar, karşılaştır, kilitle. Sonra sadece yeni sistemi kullan.
> Geçişten sonra eski Supabase projesini **Pause** et. Eski projede veriler giriş yapmadan okunabiliyor.

### 5. Kullanıcı ekleme
Supabase → Authentication → Users → **Add user**. Yeni kullanıcı **Onay bekliyor** durumunda başlar ve hiçbir şey göremez. Yeni sistemde **Kullanıcılar** ekranından rolünü ver (Görüntüleyici / Editör / Yönetici).

## Ödeme mantığı (kısa)
- **Ödeme planı:** ne zaman ne kadar beklendiği (ön ödeme, sevk öncesi, vadeli, KDV, ek maliyet).
- **Tahsilat:** gelen para. Tutarı sipariş dövizi cinsindendir. Farklı dövizle ödendiyse hesaba giren döviz ve tutar ayrıca yazılır.
- Tahsilatlar plan kalemlerine **vadesi en eski olandan başlayarak** otomatik sayılır. İstersen tahsilatı belirli bir kaleme sabitleyebilirsin.
- Plan kalemi silinir ya da değişirse ona sayılmış tahsilat kaybolmaz, kalan kalemlere kayar. Plana sığmayan fazla ödeme sipariş sayfasında "avans" olarak uyarı verir.
- Tahsilatı olan sipariş silinemez. Önce tahsilatı sil ya da başka siparişe taşı.
- Fiili sevk tarihi girilince o günün kuru kilitlenir. Tahsilatlar da kendi günündeki kurla USD'ye çevrilir.

## Dosyalar
- `supabase/kurulum.sql`: tüm veritabanı (tablolar, hesap view'ları, yetkiler, aktarım fonksiyonları)
- `lib/migrate.ts`: eski sistemden yeni sisteme dönüşüm kuralları
- `lib/plan.ts`: ödeme planı üretimi
- `app/(app)/…`: ekranlar
