-- ============================================================================
-- YONGA ERP — 0007: Gider-sipariş bağlantısı, üretim tarihi, rezerve kaldırma
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- ============================================================================

-- 1) Giderler artık hangi siparişten doğduğunu bilir (kargo / platform komisyonu)
alter table public.expenses
  add column if not exists reference_type text,
  add column if not exists reference_id uuid;

create index if not exists idx_expenses_reference
  on public.expenses(reference_type, reference_id);

-- Kargo giderleri için kategori
insert into public.expense_categories (name)
values ('Kargo Gideri')
on conflict (name) do nothing;

-- 2) Üretim emrine tarih
alter table public.production_batches
  add column if not exists production_date date default current_date;

update public.production_batches
  set production_date = coalesce(production_date, created_at::date)
  where production_date is null;

-- 3) Rezerve stok artık kullanılmıyor: sıfırla.
--    (Kolon eski veriyi bozmamak için duruyor, uygulama onu okumuyor.)
update public.products set reserved_stock = 0 where reserved_stock <> 0;
