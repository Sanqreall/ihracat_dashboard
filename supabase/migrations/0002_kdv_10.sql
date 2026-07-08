-- ============================================================================
-- YONGA ERP — 0002: Varsayılan KDV %10
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- ============================================================================

alter table public.products alter column tax_rate set default 10.00;
alter table public.company_settings alter column default_tax_rate set default 10.00;
alter table public.order_items alter column tax_rate set default 10.00;

update public.company_settings set default_tax_rate = 10.00 where default_tax_rate = 20.00;

-- Mevcut ürünlerin KDV'sini de %10 yapmak isterseniz (opsiyonel, yorumdan çıkarın):
-- update public.products set tax_rate = 10.00 where tax_rate = 20.00;
