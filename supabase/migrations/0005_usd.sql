-- ============================================================================
-- YONGA ERP — 0005: Sipariş USD tutarı (TCMB kuru ile kilitlenir)
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- ============================================================================

-- Sipariş oluşturulduğunda o günün (TCMB bir önceki iş günü) USD/TRY kuru
-- ve TL toplamın USD karşılığı kalıcı olarak kilitlenir. Kur sonradan
-- değişse de rapor ve detaylar bu kilitli değerle çalışır.
alter table public.orders
  add column if not exists usd_rate numeric(12,4),
  add column if not exists total_usd numeric(14,2),
  add column if not exists net_total_usd numeric(14,2);
