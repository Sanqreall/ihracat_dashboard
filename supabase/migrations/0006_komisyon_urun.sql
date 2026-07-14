-- ============================================================================
-- YONGA ERP — 0006: Platform komisyonu + ürün sadeleştirme
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- ============================================================================

-- Siparişe uygulanan platform komisyon oranı ve tutarı kilitlenir
-- (platform komisyonu sonradan değişse bile sipariş kendi oranını korur).
alter table public.orders
  add column if not exists commission_rate numeric(5,2) not null default 0,
  add column if not exists commission_amount numeric(14,2) not null default 0;

-- Platform komisyonları gider olarak izlenebilsin diye özel bir gider
-- kategorisi (varsa dokunmaz).
insert into public.expense_categories (name)
values ('Platform Komisyonu')
on conflict (name) do nothing;

-- NOT: barcode ve category_id kolonları veritabanında KALIR (eski veriler
-- bozulmasın diye). Uygulama arayüzü artık bunları göstermez/kullanmaz.
-- Kategori tablosu da durur ancak ürün formu ve ayarlar ekranında gizlenir.
