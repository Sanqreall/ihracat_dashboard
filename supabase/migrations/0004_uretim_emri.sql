-- ============================================================================
-- YONGA ERP — 0004: Çok ürünlü üretim emirleri
-- Bir üretim emri numarası altında birden fazla ürün satırı gruplanır.
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- ============================================================================

alter table public.production_batches
  add column if not exists production_order_number text;

create index if not exists idx_production_order_number
  on public.production_batches(production_order_number);

-- Mevcut tek satırlık kayıtlar: emir numarası = kendi batch numarası
update public.production_batches
  set production_order_number = batch_number
  where production_order_number is null;
