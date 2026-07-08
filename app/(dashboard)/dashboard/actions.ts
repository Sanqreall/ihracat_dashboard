'use server';

import { createClient } from '@/lib/supabase/server';

export async function getDashboardKpis() {
  const supabase = await createClient();

  const [{ count: productCount }, { count: orderCount }, { data: products }, { data: orders }] = await Promise.all([
    supabase.from('products').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('orders').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('products').select('current_stock, cost_price, critical_stock').is('deleted_at', null),
    supabase.from('orders').select('total, net_total, order_date').is('deleted_at', null).order('order_date', { ascending: false }).limit(500),
  ]);

  const inventoryValue = (products ?? []).reduce((sum, p) => sum + (p.current_stock ?? 0) * (p.cost_price ?? 0), 0);
  const criticalStockCount = (products ?? []).filter((p) => (p.current_stock ?? 0) <= (p.critical_stock ?? 0)).length;
  const grossSales = (orders ?? []).reduce((sum, o) => sum + (o.total ?? 0), 0);
  const netSales = (orders ?? []).reduce((sum, o) => sum + (o.net_total ?? 0), 0);
  const avgOrderValue = orders?.length ? grossSales / orders.length : 0;

  const monthly: Record<string, number> = {};
  (orders ?? []).forEach((o) => {
    const month = (o.order_date as string)?.slice(0, 7);
    if (!month) return;
    monthly[month] = (monthly[month] ?? 0) + (o.net_total ?? 0);
  });
  const salesByMonth = Object.entries(monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, total]) => ({ month, total }));

  return {
    productCount: productCount ?? 0,
    orderCount: orderCount ?? 0,
    inventoryValue,
    criticalStockCount,
    grossSales,
    netSales,
    avgOrderValue,
    salesByMonth,
  };
}
