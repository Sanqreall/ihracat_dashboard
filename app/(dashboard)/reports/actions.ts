'use server';

import { createClient } from '@/lib/supabase/server';
import { round2 as round, orderNetSales, orderNetSalesUsd, itemGross, itemCogs } from '@/lib/reporting';

export type ReportFilter = {
  from?: string;
  to?: string;
  preset?: string;
  province?: string;
  minDiscount?: number; // sipariş indirim % alt sınırı
  maxDiscount?: number; // sipariş indirim % üst sınırı
};

/**
 * Rapor verisi GÜNLÜK seri olarak döner. Gün / hafta / ay kırılımını istemci
 * tarafı yapar (lib/reporting.ts → bucketKey), böylece kırılımı değiştirmek
 * sunucuya yeni istek atmadan anında çalışır.
 */
export type ReportData = {
  dailySales: {
    date: string;
    grossSales: number;
    discount: number;
    netSales: number;
    netSalesUsd: number;
    cogs: number;
    orders: number;
  }[];
  /** Gider satırları gün + kategori kırılımında */
  dailyExpenses: { date: string; category: string; amount: number }[];
  expenseCategories: string[];
  dailyReturns: { date: string; count: number; units: number; refund: number }[];

  salesByPlatform: { platform: string; netSales: number; orders: number }[];
  salesByProvince: { province: string; netSales: number; orders: number; units: number }[];
  provinceOptions: string[];
  topProducts: { product: string; quantity: number; revenue: number }[];
  returnsByReason: { reason: string; count: number; refund: number }[];
  expenseTotalsByCategory: { category: string; total: number }[];
  /** Sipariş indirim oranı kovaları: %0, %0-10, %10-20 … */
  salesByDiscountBand: { band: string; orders: number; units: number; netSales: number }[];
  /** Kalem (satır) indirim oranı kovaları */
  itemsByDiscountBand: { band: string; lines: number; units: number; revenue: number }[];

  totals: {
    grossSales: number;
    discountTotal: number;
    discountRate: number;
    netSales: number;
    netSalesUsd: number;
    orderCount: number;
    returnCount: number;
    soldUnits: number;
    returnedUnits: number;
    returnRate: number;
    refundTotal: number;
    expenseTotal: number;
    expenseTotalUsd: number;
    cogsTotal: number;
    cogsTotalUsd: number;
    netProfit: number;
    netProfitUsd: number;
    commissionTotal: number;
    shippingExpenseTotal: number;
    avgUsdRate: number;
  };
  filter: ReportFilter;
};

const UNCATEGORIZED = 'Kategorisiz';

export async function getReportData(filter: ReportFilter = {}): Promise<ReportData> {
  const supabase = await createClient();
  const { from, to } = filter;

  let ordersQuery = supabase
    .from('orders')
    .select('id, order_date, total, total_usd, usd_rate, commission_amount, order_discount_percent, delivery_province, platform_id, platforms(name), status')
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .neq('status', 'draft')
    .limit(10000);
  if (from) ordersQuery = ordersQuery.gte('order_date', from);
  if (to) ordersQuery = ordersQuery.lte('order_date', to);
  if (filter.province) ordersQuery = ordersQuery.eq('delivery_province', filter.province);

  let itemsQuery = supabase
    .from('order_items')
    .select('quantity, unit_price, line_total, line_discount_percent, products(product_code, name, cost_price), orders!inner(order_date, deleted_at, status, delivery_province, order_discount_percent)')
    .is('orders.deleted_at', null)
    .neq('orders.status', 'cancelled')
    .neq('orders.status', 'draft')
    .limit(30000);
  if (from) itemsQuery = itemsQuery.gte('orders.order_date', from);
  if (to) itemsQuery = itemsQuery.lte('orders.order_date', to);
  if (filter.province) itemsQuery = itemsQuery.eq('orders.delivery_province', filter.province);

  // Giderler: aylık giderlerin güne bölünmesi kod tarafında yapıldığı için,
  // tarih filtresini SQL'de uygulamıyoruz (aksi halde ait olduğu ayın kaydı
  // aralık dışında kalıp hiç gelmezdi). Bunun yerine kodda kırpıyoruz.
  const expensesQuery = supabase
    .from('expenses')
    .select('expense_date, amount, is_monthly, period_month, expense_categories(name)')
    .limit(10000);

  let returnsQuery = supabase
    .from('returns')
    .select('id, return_date, reason, refund_amount, return_shipping_cost, return_items(quantity)')
    .limit(10000);
  if (from) returnsQuery = returnsQuery.gte('return_date', from);
  if (to) returnsQuery = returnsQuery.lte('return_date', to);

  const [ordersRes, itemsRes, expensesRes, returnsRes] = await Promise.all([
    ordersQuery, itemsQuery, expensesQuery, returnsQuery,
  ]);

  if (ordersRes.error) throw new Error(ordersRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  if (expensesRes.error) throw new Error(expensesRes.error.message);
  if (returnsRes.error) throw new Error(returnsRes.error.message);

  const orders = ordersRes.data ?? [];
  const items = itemsRes.data ?? [];
  const expenses = expensesRes.data ?? [];
  const returns = returnsRes.data ?? [];

  const day = (d: unknown) => String(d ?? '').slice(0, 10);

  // ---- Günlük satış: net (orders) + brüt/maliyet (order_items)
  type SalesBucket = { net: number; netUsd: number; orders: number; gross: number; cogs: number };
  const salesByDay = new Map<string, SalesBucket>();
  const touch = (d: string): SalesBucket => {
    let b = salesByDay.get(d);
    if (!b) { b = { net: 0, netUsd: 0, orders: 0, gross: 0, cogs: 0 }; salesByDay.set(d, b); }
    return b;
  };

  let netSales = 0;
  let netSalesUsd = 0;
  for (const o of orders) {
    const d = day(o.order_date);
    if (!d) continue;
    const net = orderNetSales(o);
    const netUsd = orderNetSalesUsd(o);
    netSales += net;
    netSalesUsd += netUsd;
    const b = touch(d);
    b.net += net;
    b.netUsd += netUsd;
    b.orders += 1;
  }

  const byProduct = new Map<string, { quantity: number; revenue: number }>();
  let grossSales = 0;
  let soldUnits = 0;
  let cogsTotal = 0;

  for (const it of items) {
    const o = it.orders as { order_date?: string } | null;
    const d = day(o?.order_date);
    const qty = Number(it.quantity ?? 0);
    const gross = itemGross(it);
    const cogs = itemCogs(it as unknown as Parameters<typeof itemCogs>[0]);

    grossSales += gross;
    soldUnits += qty;
    cogsTotal += cogs;

    if (d) {
      const b = touch(d);
      b.gross += gross;
      b.cogs += cogs;
    }

    const p = it.products as { product_code?: string; name?: string } | null;
    const name = p ? `${p.product_code ?? ''} — ${p.name ?? ''}` : 'Bilinmiyor';
    const cur = byProduct.get(name) ?? { quantity: 0, revenue: 0 };
    cur.quantity += qty;
    cur.revenue += Number(it.line_total ?? 0);
    byProduct.set(name, cur);
  }

  const dailySales = Array.from(salesByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      grossSales: round(v.gross),
      discount: round(Math.max(0, v.gross - v.net)),
      netSales: round(v.net),
      netSalesUsd: round(v.netUsd),
      cogs: round(v.cogs),
      orders: v.orders,
    }));

  // ---- Günlük giderler (kategori kırılımlı)
  // Aylık giderler (reklam/ajans) ait olduğu ayın HER gününe eşit bölünür.
  // Bölme, tarih aralığıyla kesişen günlerle sınırlanır; böylece "son 7 gün"
  // seçilince o 7 güne düşen pay gösterilir.
  const expenseKeys = new Map<string, number>(); // `${date}|${category}` → amount
  const categoryTotals = new Map<string, number>();
  let expenseTotal = 0;

  const addExpense = (d: string, category: string, amount: number) => {
    if (!d || amount === 0) return;
    expenseTotal += amount;
    const key = `${d}|${category}`;
    expenseKeys.set(key, (expenseKeys.get(key) ?? 0) + amount);
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + amount);
  };

  const daysInMonth = (year: number, month1: number) => new Date(year, month1, 0).getDate();
  const pad2 = (n: number) => String(n).padStart(2, '0');

  for (const e of expenses) {
    const category = (e.expense_categories as { name?: string } | null)?.name ?? UNCATEGORIZED;
    const amount = Number(e.amount ?? 0);
    if (amount === 0) continue;

    if (e.is_monthly) {
      // Ait olduğu ay: period_month varsa onu, yoksa expense_date ayını kullan
      const monthStr = String(e.period_month ?? e.expense_date).slice(0, 7);
      const [y, m] = monthStr.split('-').map(Number);
      if (!y || !m) continue;
      const totalDays = daysInMonth(y, m);
      const perDay = amount / totalDays;
      for (let dnum = 1; dnum <= totalDays; dnum++) {
        const ds = `${y}-${pad2(m)}-${pad2(dnum)}`;
        // Tarih aralığı filtresi dışındaki günleri atla
        if (from && ds < from) continue;
        if (to && ds > to) continue;
        addExpense(ds, category, perDay);
      }
    } else {
      const d = day(e.expense_date);
      if (from && d < from) continue;
      if (to && d > to) continue;
      addExpense(d, category, amount);
    }
  }

  const dailyExpenses = Array.from(expenseKeys.entries())
    .map(([key, amount]) => {
      const [date, category] = key.split('|');
      return { date, category, amount: round(amount) };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const expenseTotalsByCategory = Array.from(categoryTotals.entries())
    .map(([category, total]) => ({ category, total: round(total) }))
    .sort((a, b) => b.total - a.total);

  const expenseCategories = expenseTotalsByCategory.map((c) => c.category);

  // ---- Günlük iadeler
  const retByDay = new Map<string, { count: number; units: number; refund: number }>();
  let returnedUnits = 0;
  let refundTotal = 0;
  for (const r of returns) {
    const d = day(r.return_date);
    const units = ((r.return_items as { quantity: number }[] | null) ?? []).reduce((a, it) => a + Number(it.quantity ?? 0), 0);
    const refund = Number(r.refund_amount ?? 0) + Number(r.return_shipping_cost ?? 0);
    returnedUnits += units;
    refundTotal += refund;
    if (!d) continue;
    const cur = retByDay.get(d) ?? { count: 0, units: 0, refund: 0 };
    cur.count += 1;
    cur.units += units;
    cur.refund += refund;
    retByDay.set(d, cur);
  }
  const dailyReturns = Array.from(retByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, count: v.count, units: v.units, refund: round(v.refund) }));

  const byReason = new Map<string, { count: number; refund: number }>();
  for (const r of returns) {
    const reason = r.reason ?? 'Belirtilmemiş';
    const cur = byReason.get(reason) ?? { count: 0, refund: 0 };
    cur.count += 1;
    cur.refund += Number(r.refund_amount ?? 0) + Number(r.return_shipping_cost ?? 0);
    byReason.set(reason, cur);
  }
  const returnsByReason = Array.from(byReason.entries())
    .map(([reason, v]) => ({ reason, count: v.count, refund: round(v.refund) }))
    .sort((a, b) => b.count - a.count);

  // ---- Platform ve ürün kırılımı
  const byPlatform = new Map<string, { net: number; orders: number }>();
  for (const o of orders) {
    const name = (o.platforms as { name?: string } | null)?.name ?? 'Bilinmiyor';
    const cur = byPlatform.get(name) ?? { net: 0, orders: 0 };
    cur.net += orderNetSales(o);
    cur.orders += 1;
    byPlatform.set(name, cur);
  }
  const salesByPlatform = Array.from(byPlatform.entries())
    .map(([platform, v]) => ({ platform, netSales: round(v.net), orders: v.orders }))
    .sort((a, b) => b.netSales - a.netSales);

  // ---- İl bazlı satış
  const provinceUnits = new Map<string, number>();
  for (const it of items) {
    const o = it.orders as { delivery_province?: string } | null;
    const prov = o?.delivery_province || 'Belirtilmemiş';
    provinceUnits.set(prov, (provinceUnits.get(prov) ?? 0) + Number(it.quantity ?? 0));
  }
  const byProvince = new Map<string, { net: number; orders: number }>();
  for (const o of orders) {
    const prov = (o as { delivery_province?: string }).delivery_province || 'Belirtilmemiş';
    const cur = byProvince.get(prov) ?? { net: 0, orders: 0 };
    cur.net += orderNetSales(o);
    cur.orders += 1;
    byProvince.set(prov, cur);
  }
  const salesByProvince = Array.from(byProvince.entries())
    .map(([province, v]) => ({
      province,
      netSales: round(v.net),
      orders: v.orders,
      units: provinceUnits.get(province) ?? 0,
    }))
    .sort((a, b) => b.netSales - a.netSales);

  // İl seçenekleri (filtre için) — verilerde geçen gerçek iller
  const provinceOptions = salesByProvince
    .map((p) => p.province)
    .filter((p) => p !== 'Belirtilmemiş');

  // ---- İndirim bandı analizi (sipariş indirimi %)
  const DISCOUNT_BANDS: { band: string; min: number; max: number }[] = [
    { band: 'İndirimsiz', min: 0, max: 0.0001 },
    { band: '%0-10', min: 0.0001, max: 10 },
    { band: '%10-20', min: 10, max: 20 },
    { band: '%20-30', min: 20, max: 30 },
    { band: '%30-50', min: 30, max: 50 },
    { band: '%50+', min: 50, max: Infinity },
  ];
  const bandOf = (pct: number) =>
    DISCOUNT_BANDS.find((b) => pct >= b.min && pct < b.max)?.band ?? '%50+';

  const orderBands = new Map<string, { orders: number; net: number }>();
  for (const o of orders) {
    const pct = Number((o as { order_discount_percent?: number }).order_discount_percent ?? 0);
    const band = bandOf(pct);
    const cur = orderBands.get(band) ?? { orders: 0, net: 0 };
    cur.orders += 1;
    cur.net += orderNetSales(o);
    orderBands.set(band, cur);
  }
  // sipariş bandı adetleri: kalemlerden sipariş indirimine göre
  const orderBandUnits = new Map<string, number>();
  for (const it of items) {
    const o = it.orders as { order_discount_percent?: number } | null;
    const band = bandOf(Number(o?.order_discount_percent ?? 0));
    orderBandUnits.set(band, (orderBandUnits.get(band) ?? 0) + Number(it.quantity ?? 0));
  }
  const salesByDiscountBand = DISCOUNT_BANDS.map((b) => ({
    band: b.band,
    orders: orderBands.get(b.band)?.orders ?? 0,
    units: orderBandUnits.get(b.band) ?? 0,
    netSales: round(orderBands.get(b.band)?.net ?? 0),
  })).filter((b) => b.orders > 0 || b.units > 0);

  // ---- Kalem (satır) indirim bandı analizi
  const itemBands = new Map<string, { lines: number; units: number; revenue: number }>();
  for (const it of items) {
    const pct = Number((it as { line_discount_percent?: number }).line_discount_percent ?? 0);
    const band = bandOf(pct);
    const cur = itemBands.get(band) ?? { lines: 0, units: 0, revenue: 0 };
    cur.lines += 1;
    cur.units += Number(it.quantity ?? 0);
    cur.revenue += Number(it.line_total ?? 0);
    itemBands.set(band, cur);
  }
  const itemsByDiscountBand = DISCOUNT_BANDS.map((b) => ({
    band: b.band,
    lines: itemBands.get(b.band)?.lines ?? 0,
    units: itemBands.get(b.band)?.units ?? 0,
    revenue: round(itemBands.get(b.band)?.revenue ?? 0),
  })).filter((b) => b.lines > 0);

  const topProducts = Array.from(byProduct.entries())
    .map(([product, v]) => ({ product, quantity: v.quantity, revenue: round(v.revenue) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // ---- Toplamlar
  grossSales = round(grossSales);
  netSales = round(netSales);
  netSalesUsd = round(netSalesUsd);
  cogsTotal = round(cogsTotal);
  expenseTotal = round(expenseTotal);
  refundTotal = round(refundTotal);
  const discountTotal = round(Math.max(0, grossSales - netSales));

  const commissionTotal = round(orders.reduce((s, o) => s + Number(o.commission_amount ?? 0), 0));
  const shippingExpenseTotal = round(categoryTotals.get('Kargo Gideri') ?? 0);

  const avgUsdRate = netSalesUsd > 0 ? round(netSales / netSalesUsd) : 0;
  const toUsd = (tl: number) => (avgUsdRate > 0 ? round(tl / avgUsdRate) : 0);

  return {
    dailySales,
    dailyExpenses,
    expenseCategories,
    dailyReturns,
    salesByPlatform,
    salesByProvince,
    provinceOptions,
    topProducts,
    returnsByReason,
    expenseTotalsByCategory,
    salesByDiscountBand,
    itemsByDiscountBand,
    totals: {
      grossSales,
      discountTotal,
      discountRate: grossSales > 0 ? round((discountTotal / grossSales) * 100) : 0,
      netSales,
      netSalesUsd,
      orderCount: orders.length,
      returnCount: returns.length,
      soldUnits,
      returnedUnits,
      returnRate: soldUnits > 0 ? round((returnedUnits / soldUnits) * 100) : 0,
      refundTotal,
      expenseTotal,
      expenseTotalUsd: toUsd(expenseTotal),
      cogsTotal,
      cogsTotalUsd: toUsd(cogsTotal),
      netProfit: round(netSales - cogsTotal - expenseTotal),
      netProfitUsd: round(netSalesUsd - toUsd(cogsTotal) - toUsd(expenseTotal)),
      commissionTotal,
      shippingExpenseTotal,
      avgUsdRate,
    },
    filter,
  };
}
