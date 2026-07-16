-- ============================================================================
-- YONGA ERP — 0010: Tutar bazlı indirim girdileri
--
-- Yüzde indirimlerin yanında, kullanıcının elle girdiği TUTAR indirimlerini
-- saklar. Böylece düzenlemede alanlar aynen geri yüklenir.
--   order_items.line_discount_amount_input : satır tutar indirimi (girdi)
--   orders.order_discount_amount_input      : sipariş tutar indirimi (girdi)
--
-- NOT: Zaten var olan line_discount_amount / order_discount_amount kolonları
-- HESAPLANMIŞ toplam indirimi (yüzde + tutar) tutmaya devam eder; bunlar
-- rapor ve gösterim içindir. _input kolonları yalnızca formu geri doldurmak
-- içindir.
-- ============================================================================

alter table public.order_items
  add column if not exists line_discount_amount_input numeric(12,2) not null default 0;

alter table public.orders
  add column if not exists order_discount_amount_input numeric(12,2) not null default 0;
