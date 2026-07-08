'use server';

import { createClient } from '@/lib/supabase/server';

export type ReportData = {
  salesByMonth: { month: string; grossSales: number; netSales: number; orders: number }[];
  salesByPlatform: { platform: string; netSales: number; orders: number }[];
  topProducts: { product: string; quantity: number; revenue: number }[];
  expensesByMonth: { month: string; total: number }[];
  profitByMonth: { month: string; revenue: number; cogs: number; expense: number; profit: number }[];
  returnsByReason: { reason: string; count: number; refund: number }[];
  forecast: {
    product: string;
    sold90: number;
    monthlyVelocity: number;
    available: number;
    need1: number;
    need3: number;
    need6: number;
    need12: number;
    stockoutDays: number | null;
  }[];
  totals: {
    grossSales: number;
    netSales: number;
    orderCount: number;
    returnCount: number;
    returnRate: number;
    refundTotal: number;
    expenseTotal: number;
    cogsTotal: number;
    netProfit: number;
  };
};

export async function getReportData(): Promise<ReportData> {
  const supabase = await createClient();

  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10);

  const [ordersRes, itemsRes, expensesRes, returnsRes, productsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_date, total, net_total, platform_id, platforms(name), status')
      .is('deleted_at', null)
      .neq('status', 'cancelled')
      .neq('status', 'draft')
      .limit(2000),
    supabase
      .from('order_items')
      .select('quantity, line_total, product_id, products(product_code, name, cost_price), orders!inner(order_date, deleted_at, status)')
      .is('orders.deleted_at', null)
      .neq('orders.status', 'cancelled')
      .neq('orders.status', 'draft')
      .limit(5000),
    supabase.from('expenses').select('expense_date, amount').limit(2000),
    supabase.from('returns').select('id, reason, refund_amount').limit(2000),
    supabase
      .from('products')
      .select('product_code, name, current_stock, production_stock, reserved_stock')
      .is('deleted_at', null)
      .eq('status', 'active'),
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (expensesRes.error) throw new Error(expensesRes.error.message);
  if (returnsRes.error) throw new Error(returnsRes.error.message);
  if (productsRes.error) throw new Error(productsRes.error.message);

  const orders = ordersRes.data ?? [];
  const items = itemsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const returns = returnsRes.data ?? [];
  const activeProducts = productsRes.data ?? [];

  const round = (n: number) => Math.round(n * 100) / 100;

  // Sales by month
  const byMonth = new Map<string, { gross: number; net: number; orders: number }>();
  for (const o of orders) {
    const m = String(o.order_date).slice(0, 7);
    const cur = byMonth.get(m) ?? { gross: 0, net: 0, orders: 0 };
    cur.gross += Number(o.total ?? 0);
    cur.net += Number(o.net_total ?? 0);
    cur.orders += 1;
    byMonth.set(m, cur);
  }
  const salesByMonth = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, v]) => ({ month, grossSales: round(v.gross), netSales: round(v.net), orders: v.orders }));

  // Sales by platform
  const byPlatform = new Map<string, { net: number; orders: number }>();
  for (const o of orders) {
    const name = (o.platforms as { name?: string } | null)?.name ?? 'Bilinmiyor';
    const cur = byPlatform.get(name) ?? { net: 0, orders: 0 };
    cur.net += Number(o.net_total ?? 0);
    cur.orders += 1;
    byPlatform.set(name, cur);
  }
  const salesByPlatform = Array.from(byPlatform.entries())
    .map(([platform, v]) => ({ platform, netSales: round(v.net), orders: v.orders }))
    .sort((a, b) => b.netSales - a.netSales);

  // Top products + COGS per month + 90-day sales per product
  const byProduct = new Map<string, { quantity: number; revenue: number }>();
  const cogsByMonth = new Map<string, number>();
  const sold90ByCode = new Map<string, number>();
  for (const it of items) {
    const p = it.products as { product_code?: string; name?: string; cost_price?: number } | null;
    const o = it.orders as { order_date?: string } | null;
    const name = p ? `${p.product_code ?? ''} — ${p.name ?? ''}` : 'Bilinmiyor';
    const cur = byProduct.get(name) ?? { quantity: 0, revenue: 0 };
    cur.quantity += Number(it.quantity ?? 0);
    cur.revenue += Number(it.line_total ?? 0);
    byProduct.set(name, cur);

    const month = String(o?.order_date ?? '').slice(0, 7);
    if (month) {
      const lineCogs = Number(it.quantity ?? 0) * Number(p?.cost_price ?? 0);
      cogsByMonth.set(month, (cogsByMonth.get(month) ?? 0) + lineCogs);
    }

    if (String(o?.order_date ?? '') >= ninetyDaysAgo && p?.product_code) {
      const code = String(p.product_code).trim();
      sold90ByCode.set(code, (sold90ByCode.get(code) ?? 0) + Number(it.quantity ?? 0));
    }
  }
  const topProducts = Array.from(byProduct.entries())
    .map(([product, v]) => ({ product, quantity: v.quantity, revenue: round(v.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Expenses by month
  const expByMonth = new Map<string, number>();
  for (const e of expenses) {
    const m = String(e.expense_date).slice(0, 7);
    expByMonth.set(m, (expByMonth.get(m) ?? 0) + Number(e.amount ?? 0));
  }
  const expensesByMonth = Array.from(expByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, total]) => ({ month, total: round(total) }));

  // Net profit by month = net sales − COGS − expenses
  const allMonths = Array.from(new Set([...byMonth.keys(), ...expByMonth.keys(), ...cogsByMonth.keys()])).sort().slice(-12);
  const profitByMonth = allMonths.map((month) => {
    const revenue = round(byMonth.get(month)?.net ?? 0);
    const cogs = round(cogsByMonth.get(month) ?? 0);
    const expense = round(expByMonth.get(month) ?? 0);
    return { month, revenue, cogs, expense, profit: round(revenue - cogs - expense) };
  });

  // Demand forecast: 90-day sales velocity per active product
  const forecast = activeProducts.map((p) => {
    const code = String(p.product_code).trim();
    const sold90 = sold90ByCode.get(code) ?? 0;
    const monthlyVelocity = sold90 / 3; // 90 gün ≈ 3 ay
    const available = (p.current_stock ?? 0) + (p.production_stock ?? 0) - (p.reserved_stock ?? 0);
    const need = (months: number) => Math.max(0, Math.ceil(monthlyVelocity * months - available));
    const dailyVelocity = sold90 / 90;
    const stockoutDays = dailyVelocity > 0 ? Math.floor(Math.max(0, available) / dailyVelocity) : null;
    return {
      product: `${p.product_code} — ${p.name}`,
      sold90,
      monthlyVelocity: round(monthlyVelocity),
      available,
      need1: need(1),
      need3: need(3),
      need6: need(6),
      need12: need(12),
      stockoutDays,
    };
  }).sort((a, b) => b.monthlyVelocity - a.monthlyVelocity);

  // Returns by reason
  const byReason = new Map<string, { count: number; refund: number }>();
  for (const r of returns) {
    const reason = r.reason ?? 'Belirtilmemiş';
    const cur = byReason.get(reason) ?? { count: 0, refund: 0 };
    cur.count += 1;
    cur.refund += Number(r.refund_amount ?? 0);
    byReason.set(reason, cur);
  }
  const returnsByReason = Array.from(byReason.entries())
    .map(([reason, v]) => ({ reason, count: v.count, refund: round(v.refund) }))
    .sort((a, b) => b.count - a.count);

  const grossSales = round(orders.reduce((s, o) => s + Number(o.total ?? 0), 0));
  const netSales = round(orders.reduce((s, o) => s + Number(o.net_total ?? 0), 0));
  const refundTotal = round(returns.reduce((s, r) => s + Number(r.refund_amount ?? 0), 0));
  const expenseTotal = round(expenses.reduce((s, e) => s + Number(e.amount ?? 0), 0));
  const cogsTotal = round(Array.from(cogsByMonth.values()).reduce((s, v) => s + v, 0));

  return {
    salesByMonth,
    salesByPlatform,
    topProducts,
    expensesByMonth,
    profitByMonth,
    returnsByReason,
    forecast,
    totals: {
      grossSales,
      netSales,
      orderCount: orders.length,
      returnCount: returns.length,
      returnRate: orders.length ? round((returns.length / orders.length) * 100) : 0,
      refundTotal,
      expenseTotal,
      cogsTotal,
      netProfit: round(netSales - cogsTotal - expenseTotal),
    },
  };
}
