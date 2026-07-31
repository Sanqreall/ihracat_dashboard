# İhracat ERP

İhracat operasyonları için ERP — **Next.js 15 + Supabase (SSR) + shadcn/ui** üzerine,
Yonga ERP'nin mimarisiyle aynı düzende kuruldu. Bu sürüm: **Faz 1–4** — iskelet + şema, Müşteriler & Ürünler, Siparişler, Tahsilat & Nakit Akışı.

## Ne var (Faz 1)
- Next.js 15 App Router, Supabase SSR kimlik doğrulama, RLS, yetki (admin/manager/employee).
- shadcn/ui bileşen kütüphanesi, tema (açık/koyu + renk temaları).
- Veri şeması: müşteri, ürün, sipariş (+kalem, sevkiyat, ek maliyet, ödeme planı), ödeme, döviz kuru, banka hesabı — uuid PK + enum + soft-delete + audit + RLS.
- Giriş, panel kabuğu, sol menü.

## Sıradaki fazlar
2. ✓ Müşteriler + Ürünler (CRUD) — tamam · (Kurlar/Banka + Excel/PDF sıradaki)
3. ✓ Siparişler (kalem + ek maliyet + ödeme planı, müşteri varsayılanından plan) — tamam · (çoklu sevkiyat düzenlemesi sonraki pasta)
4. ✓ Tahsilat (plandan üretim, gecikme takibi, tahsil işaretleme) + Nakit Akışı (vade bucket'ları) — tamam
5. Raporlar + Dashboard KPI + PDF/Excel çıktılar
6. Mevcut verinin taşınması (legacy_id eşlemeli)

## Kurulum

### 1) Repo + Vercel
- Bu klasörü yeni bir GitHub reposuna yükle.
- Vercel'de "Import Project" → bu repo.

### 2) Supabase
- Yeni bir Supabase projesi aç.
- SQL Editor → New query → `supabase/migrations/0001_init.sql` içeriğini yapıştır → **Run**.
- Authentication → Users → **Add user** ile kendine bir kullanıcı ekle.
  - "Raw User Meta Data" alanına: `{"role":"admin"}` (yönetici yetkisi için)

### 3) Ortam değişkenleri (Vercel → Settings → Environment Variables)
`.env.example` dosyasındaki değişkenleri Supabase → Project Settings → API'den doldur:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4) Deploy
- Vercel otomatik build alır. `/login` → giriş → `/dashboard`.

## Yapı (Yonga konvansiyonu)
- Her modül: `app/(dashboard)/<modul>/` → `page.tsx` + `actions.ts` + `*-table.tsx` + `*-form.tsx` + `error.tsx` + `loading.tsx`.
- Yazma işlemleri `lib/auth/permissions.ts` → `requireEdit()` ile korunur.
- Veri erişimi server action'lar (`'use server'`) + `lib/supabase/server.ts`.
- Form doğrulama `zod` (`lib/validations/*` — modüllerle birlikte eklenecek).
