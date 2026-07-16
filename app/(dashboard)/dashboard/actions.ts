'use server';

import { createClient } from '@/lib/supabase/server';
import { round2 as round, orderNetSales, itemGross, monthKey } from '@/lib/reporting';

/**
 * Panel KPI'ları Raporlar sayfasıyla AYNI tanımları kullanır (lib/reporting.ts):
 *   Brüt = indirimsiz, Net = Brüt − İndirim (ikisi de KDV dahil).
 *   Kargo satış değildir; sadece Giderler tarafında izlenir.
 * İptal ve taslak siparişler her iki ekranda da hesaba katılmaz.
 */
export async function getDashboardKpis() {
  const supabase = await createClient();

  const [{ count: productCount }, { data: products }, { data: orders }, { data: items }] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('products').select('current_stock, cost_price, critical_stock').is('deleted_at', null),
    supabase
      .from('orders')
      .select('id, order_date, total')
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .neq('status', 'draft')
      .order('order_date', { ascending: false })
      .limit(5000),
    supabase
      .from('order_items')
      .select('quantity, unit_price, orders!inner(order_date, deleted_at, status)')
      .is('orders.deleted_at', null)
      .neq('orders.status', 'cancelled')
      .neq('orders.status', 'draft')
      .limit(20000),
  ]);

  const inventoryValue = (products ?? []).reduce((sum, p) => sum + (p.current_stock ?? 0) * Number(p.cost_price ?? 0), 0);
  const criticalStockCount = (products ?? []).filter((p) => (p.current_stock ?? 0) <= (p.critical_stock ?? 0)).length;

  const orderList = orders ?? [];
  const netSales = round(orderList.reduce((sum, o) => sum + orderNetSales(o), 0));
  const grossSales = round((items ?? []).reduce((sum, it) => sum + itemGross(it), 0));
  const discountTotal = round(Math.max(0, grossSales - netSales));
  const avgOrderValue = orderList.length ? round(netSales / orderList.length) : 0;

  const monthly: Record<string, number> = {};
  for (const o of orderList) {
    const m = monthKey(o.order_date);
    if (!m) continue;
    monthly[m] = (monthly[m] ?? 0) + orderNetSales(o);
  }
  const salesByMonth = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, total]) => ({ month, total: round(total) }));

  return {
    productCount: productCount ?? 0,
    orderCount: orderList.length,
    inventoryValue,
    criticalStockCount,
    grossSales,
    netSales,
    discountTotal,
    avgOrderValue,
    salesByMonth,
  };
}
