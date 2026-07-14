-- ============================================================================
-- YONGA ERP — 0009: Teslimat ili + aylık (güne bölünen) gider desteği
-- Supabase SQL Editor'de çalıştırın. Tekrar çalıştırılabilir.
-- ============================================================================

-- 1) Siparişe teslimat ili (Türkiye illerinden biri)
alter table public.orders
  add column if not exists delivery_province text;

create index if not exists idx_orders_delivery_province
  on public.orders(delivery_province);

-- 2) Aylık giderler: bir gider "aylık" işaretlenirse rapor tarafında ayın
--    tüm günlerine eşit bölünür. is_monthly + period_month (YYYY-MM-01).
alter table public.expenses
  add column if not exists is_monthly boolean not null default false,
  add column if not exists period_month date;

-- Aylık işaretli ama ayı belirtilmemiş kayıtlar için gider tarihinin ayını kullan
update public.expenses
  set period_month = date_trunc('month', expense_date)::date
  where is_monthly = true and period_month is null;

-- 3) Rapor ve liste sorgularını hızlandıran indeksler
create index if not exists idx_orders_order_date on public.orders(order_date);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_expenses_expense_date on public.expenses(expense_date);
create index if not exists idx_expenses_period_month on public.expenses(period_month);
create index if not exists idx_order_items_order_id on public.order_items(order_id);
create index if not exists idx_stock_movements_product on public.stock_movements(product_id);
create index if not exists idx_stock_movements_reference on public.stock_movements(reference_type, reference_id);
create index if not exists idx_production_batches_order on public.production_batches(production_order_number);
