# Yonga ERP

Next.js 15 + Supabase tabanlı, Yonga iç pazar operasyonları için ERP / dashboard sistemi.

Bu **Faz 3 (tam sürüm)** teslimatıdır — tüm modüller uçtan uca çalışır durumda:

- **Panel** — KPI kartları (stok değeri, kritik stok, brüt/net satış, ortalama sipariş değeri) + aylık satış grafiği
- **Ürünler** — tam CRUD, Excel içe/dışa aktarma + şablon, toplu silme, sütun görünürlüğü
- **Stok** — ürün bazlı stok özeti (mevcut/üretimde/rezerve/kullanılabilir/stok değeri) + hareket ledger'ı
  + manuel stok düzeltmesi, Excel export
- **Üretim** — Kuyruk → Üretimde → Tamamlandı → Stoğa Aktarıldı akışı, kısmi üretim (tamamlanan adet
  planlanandan farklı olabilir), birim maliyet stok hareketine yazılır
- **Siparişler** — çoklu ürün satırı, satır + sipariş indirimi, kargo, KDV, canlı toplam; onaylanan
  sipariş stoğu düşer, düzenleme/iptal/silme stoğu geri alır
- **İadeler** — sipariş seçince ürünler otomatik dolar, iade nedeni, tek tıkla stoğa geri transfer,
  silinen aktarılmış iadenin stok etkisi geri alınır
- **Müşteriler** — tam CRUD, arama, toplu silme
- **Platformlar** — CRUD, komisyon oranı, aktif/pasif geçişi
- **Giderler** — kategori bazlı gider girişi, bu ay özeti kartları, toplu silme, Excel export
- **Raporlar** — aylık brüt/net satış, kâr/zarar (gelir − gider), platform pastası, en çok satanlar,
  iade nedenleri; tek tıkla çok sayfalı Excel raporu
- **Ayarlar** — firma bilgileri (KDV, desi başına kargo), kategori/seri yönetimi, kullanıcı rolleri

## Neden faz faz?

Bu ölçekte bir ERP'yi (~50+ ekran, onlarca tablo, tüm iş mantığı) tek seferde "bitmiş" olarak üretmek
gerçekçi değil — sonuç test edilmemiş, deploy edilemeyen bir kod yığını olurdu. Bunun yerine sağlam bir
temel (auth, tasarım sistemi, veritabanı, tam çalışan bir modül) kurduk; her sonraki modül aynı deseni
kopyalayarak hızlıca eklenebilir.

## Teknoloji

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS + elle yazılmış shadcn-tarzı bileşenler (Radix primitives)
- Supabase (PostgreSQL + Auth + RLS)
- TanStack Table, React Hook Form + Zod, Recharts, Zustand, xlsx, pdf-lib

## Kurulum (tarayıcı üzerinden, terminal gerekmez)

### 1) Supabase projesi

1. https://supabase.com üzerinde yeni proje oluşturun.
2. **SQL Editor** → New query → `supabase/migrations/0001_init.sql` dosyasının tamamını yapıştırıp **Run**.
3. Aynı şekilde `supabase/seed/0001_seed.sql` dosyasını çalıştırın (başlangıç platformları, kategoriler vb.).
4. **Authentication → Providers**'da Email/Password aktif olsun (varsayılan olarak açıktır).
5. **Authentication → Users**'dan ilk kullanıcınızı manuel ekleyin (Add user → email + password).
   Bu kullanıcı otomatik olarak `profiles` tablosuna `employee` rolüyle düşer; rolü admin yapmak isterseniz
   SQL Editor'de:
   ```sql
   update public.profiles set role = 'admin' where id = 'KULLANICI-UUID';
   ```
6. **Project Settings → API**'den `Project URL` ve `anon public key` değerlerini kopyalayın.

### 2) GitHub'a yükleme

1. GitHub'da yeni bir boş repo oluşturun (README eklemeden).
2. Bu klasördeki tüm dosyaları repo'ya yükleyin (GitHub web arayüzünde "Add file → Upload files"
   ile sürükle-bırak yapabilirsiniz; `node_modules` ve `.next` zaten `.gitignore` ile hariç tutulur,
   onları yüklemeyin).

### 3) Vercel'e deploy

1. https://vercel.com → New Project → GitHub reponuzu seçin.
2. Environment Variables kısmına ekleyin:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy'a basın.

Deploy sonrası `/login` sayfasından Supabase'te oluşturduğunuz kullanıcıyla giriş yapabilirsiniz.

## Klasör yapısı

```
app/
  (auth)/login/           giriş sayfası
  (dashboard)/            korumalı alan (sidebar + topbar layout)
    dashboard/            KPI paneli + satış grafiği
    products/             TAM ÇALIŞAN: liste, arama/filtre/sıralama/sayfalama,
                           sütun görünürlüğü, toplu silme, Excel içe/dışa aktarma
    inventory/ …           yol haritası ekranları (sonraki faz)
    orders/ production/ returns/ customers/ platforms/ expenses/ reports/ settings/
components/
  ui/                     buton, input, dialog, select, tablo vb. temel bileşenler
  layout/                 sidebar, topbar, tema sağlayıcı
  dashboard/              KPI kartı, satış grafiği
lib/
  supabase/               client / server / middleware Supabase istemcileri
  validations/            Zod şemaları
  types.ts                veritabanı tipleri (elle yazıldı — supabase gen types ile değiştirilebilir)
supabase/
  migrations/0001_init.sql   tüm tablolar, enum'lar, trigger'lar, RLS politikaları
  seed/0001_seed.sql         başlangıç verisi (platformlar, kategoriler, gider kategorileri)
```

## Veritabanı mimarisi notları

- Tüm giriş yapmış kullanıcılar aynı veriyi paylaşır (kullanıcı bazlı izolasyon yok), RLS politikaları
  buna göre "authenticated ise okuyabilir/yazabilir" şeklinde kurulmuştur.
- `stock_movements` tablosu bir **ledger**'dır (append-only); her satır eklendiğinde trigger otomatik
  olarak `products.current_stock` (veya üretimse `production_stock`) değerini günceller. Stok her zaman
  bu hareketlerden türetilir, elle stok sayısını değiştirmek yerine bir `adjustment` hareketi ekleyin
  (`adjustStock` server action'ı bunu yapıyor).
- Soft delete: `deleted_at` dolu olan kayıtlar listelerde görünmez ama veritabanından silinmez.
- `audit_logs` tablosu hazır; ileride trigger'larla otomatik doldurulabilir.

## Stok ledger mantığı (önemli)

Tüm stok değişimleri `stock_movements` tablosuna yazılır (append-only); trigger her satırda
`products.current_stock`'u (üretim hareketlerinde `production_stock`'u) günceller. Hiçbir hareket
silinmez — geri almalar `cancellation` telafi kaydıyla yapılır, böylece ledger toplamı her zaman
gerçek stoğa eşittir.

- **Sipariş**: `confirmed / processing / shipped / delivered` durumları stok düşer (`sale`, negatif).
  `draft` ve `cancelled` etkilemez. Düzenleme/iptal/silme önce net etkiyi sıfırlar.
- **İade**: "Stoğa aktar" butonu pozitif `return` hareketi ekler; aktarılmış iade silinirse etki geri alınır.
- **Üretim**: tamamlanan parti "Stoğa aktar" ile `transfer` hareketi olarak satılabilir stoğa geçer,
  birim maliyet (toplam maliyet / tamamlanan adet) harekete yazılır.
- **Manuel düzeltme**: Stok sayfasından pozitif/negatif `adjustment` girilir.

## Olası sonraki geliştirmeler

- Talep tahmini (hareketli ortalama + mevsimsellik) ve önerilen üretim adedi
- Sipariş PDF çıktısı (pdf-lib altyapısı hazır)
- Raporlarda tarih aralığı ve platform filtresi
- Ürün görselleri (Supabase Storage)
- Denetim kayıtlarının (audit_logs) trigger'larla otomatik doldurulması

Her modül `app/(dashboard)/products/` klasöründeki desen (actions.ts + *-table.tsx + *-form.tsx)
kopyalanarak hızlıca eklenebilir.
