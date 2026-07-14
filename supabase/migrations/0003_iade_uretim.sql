-- ============================================================================
-- YONGA ERP — 0003: İade masrafı + üretim emrine sipariş numarası
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- ============================================================================

-- İadelerde ürün iade tutarından ayrı, desiye göre hesaplanan (değiştirilebilir)
-- nakliye/iade masrafı. Toplam iade = refund_amount + return_shipping_cost.
alter table public.returns
  add column if not exists return_shipping_cost numeric(12,2) not null default 0;

-- Üretim emrine ilişkilendirilecek (serbest metin) sipariş numarası.
alter table public.production_batches
  add column if not exists related_order_number text;
