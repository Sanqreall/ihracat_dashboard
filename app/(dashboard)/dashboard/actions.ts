'use server';

import { createClient } from '@/lib/supabase/server';
import { calculateOrderTotals, ORDER_STATUSES } from '@/lib/validations/order';
import type { ExportOrderStatus } from '@/lib/types';

const REALIZED = new Set(['shipped', 'delivered', 'completed']);

export interface DashboardKpis {
  realizedRevenueUSD: number;
  openReceivablesUSD: number;
  overdueUSD: number;
  next30USD: number;
  orderCounts: { status: ExportOrderStatus; label: string; count: number }[];
  openOrderCount: number;
  customerCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak', confirmed: 'Onaylı', production: 'Üretim', ready: 'Hazır',
  shipped: 'Sevk', delivered: 'Teslim', completed: 'Tamam', cancelled: 'İptal',
};

export async function getDashboardKpis(): Promise<DashboardKpis> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const in30 = (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10); })();

  const [{ data: orders }, { data: payments }, { data: rates }, { count: customerCount }] = await Promise.all([
    supabase.from('orders')
      .select('status, currency, vat_rate, discount_type, discount_value, order_items(quantity, unit_price, discount), order_additional_costs(amount)')
      .is('deleted_at', null),
    supabase.from('payments').select('amount, currency, status, due_date'),
    supabase.from('exchange_rates').select('currency, rate_to_usd'),
    supabase.from('customers').select('id', { count: 'exact', head: true }).is('deleted_at', null),
  ]);

  const rate = new Map<string, number>([['USD', 1]]);
  for (const r of rates ?? []) rate.set(r.currency, Number(r.rate_to_usd) || 1);
  const toUSD = (amt: number, cur: string) => (Number(amt) || 0) * (rate.get(cur) ?? 1);

  // Ciro (gerçekleşen) + durum sayıları
  const counts = new Map<string, number>();
  let realizedRevenueUSD = 0;
  let openOrderCount = 0;
  for (const o of orders ?? []) {
    counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    if (o.status !== 'cancelled' && o.status !== 'completed') openOrderCount++;
    if (REALIZED.has(o.status)) {
      const total = calculateOrderTotals({
        items: o.order_items ?? [], discount_type: o.discount_type,
        discount_value: o.discount_value, vat_rate: o.vat_rate,
        additional_costs: o.order_additional_costs ?? [],
      }).total;
      realizedRevenueUSD += toUSD(total, o.currency);
    }
  }

  // Tahsilat (bekleyen) USD
  let openReceivablesUSD = 0, overdueUSD = 0, next30USD = 0;
  for (const p of payments ?? []) {
    if (p.status !== 'pending') continue;
    const usd = toUSD(p.amount, p.currency);
    openReceivablesUSD += usd;
    if (p.due_date && p.due_date < today) overdueUSD += usd;
    else if (p.due_date && p.due_date <= in30) next30USD += usd;
  }

  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    realizedRevenueUSD: round(realizedRevenueUSD),
    openReceivablesUSD: round(openReceivablesUSD),
    overdueUSD: round(overdueUSD),
    next30USD: round(next30USD),
    orderCounts: ORDER_STATUSES.map((s) => ({ status: s, label: STATUS_LABELS[s], count: counts.get(s) ?? 0 })),
    openOrderCount,
    customerCount: customerCount ?? 0,
  };
}
