'use server';

import { createClient } from '@/lib/supabase/server';
import { calculateOrderTotals } from '@/lib/validations/order';

const SHIPPED = new Set(['shipped', 'delivered', 'completed']);
const PIPELINE = new Set(['draft', 'confirmed', 'production']);

export interface CustomerRevenueRow {
  customer_id: string;
  code: string | null;
  name: string;
  shippedUSD: number;
  readyUSD: number;
  pipelineUSD: number;
  totalUSD: number;
  sharePct: number;
}

/**
 * Müşteri bazlı, durum bazlı ciro raporu (USD).
 * Her siparişin toplamı kendi para biriminde hesaplanır, exchange_rates ile
 * USD'ye çevrilir (rate_to_usd; USD=1, kur yoksa 1 varsayılır).
 */
export async function getCustomerRevenueReport(): Promise<{
  rows: CustomerRevenueRow[];
  grandTotalUSD: number;
  shippedTotalUSD: number;
  readyTotalUSD: number;
  pipelineTotalUSD: number;
}> {
  const supabase = await createClient();

  const [{ data: orders, error: oErr }, { data: rates }] = await Promise.all([
    supabase
      .from('orders')
      .select('customer_id, status, currency, vat_rate, discount_type, discount_value, customers(code, name), order_items(quantity, unit_price, discount), order_additional_costs(amount)')
      .is('deleted_at', null),
    supabase.from('exchange_rates').select('currency, rate_to_usd'),
  ]);
  if (oErr) throw new Error(oErr.message);

  const rateMap = new Map<string, number>([['USD', 1]]);
  for (const r of rates ?? []) rateMap.set(r.currency, Number(r.rate_to_usd) || 1);

  const byCustomer = new Map<string, CustomerRevenueRow>();

  for (const o of orders ?? []) {
    if (o.status === 'cancelled') continue;
    const total = calculateOrderTotals({
      items: o.order_items ?? [],
      discount_type: o.discount_type,
      discount_value: o.discount_value,
      vat_rate: o.vat_rate,
      additional_costs: o.order_additional_costs ?? [],
    }).total;
    const usd = Math.round(total * (rateMap.get(o.currency) ?? 1) * 100) / 100;

    const key = o.customer_id ?? 'unknown';
    const cust: any = o.customers;
    let row = byCustomer.get(key);
    if (!row) {
      row = {
        customer_id: key, code: cust?.code ?? null, name: cust?.name ?? 'Bilinmiyor',
        shippedUSD: 0, readyUSD: 0, pipelineUSD: 0, totalUSD: 0, sharePct: 0,
      };
      byCustomer.set(key, row);
    }
    if (SHIPPED.has(o.status)) row.shippedUSD += usd;
    else if (o.status === 'ready') row.readyUSD += usd;
    else if (PIPELINE.has(o.status)) row.pipelineUSD += usd;
    row.totalUSD += usd;
  }

  const rows = Array.from(byCustomer.values());
  const grandTotalUSD = Math.round(rows.reduce((s, r) => s + r.totalUSD, 0) * 100) / 100;
  for (const r of rows) {
    r.shippedUSD = Math.round(r.shippedUSD * 100) / 100;
    r.readyUSD = Math.round(r.readyUSD * 100) / 100;
    r.pipelineUSD = Math.round(r.pipelineUSD * 100) / 100;
    r.totalUSD = Math.round(r.totalUSD * 100) / 100;
    r.sharePct = grandTotalUSD > 0 ? Math.round((r.totalUSD / grandTotalUSD) * 1000) / 10 : 0;
  }
  rows.sort((a, b) => b.totalUSD - a.totalUSD);

  return {
    rows,
    grandTotalUSD,
    shippedTotalUSD: Math.round(rows.reduce((s, r) => s + r.shippedUSD, 0) * 100) / 100,
    readyTotalUSD: Math.round(rows.reduce((s, r) => s + r.readyUSD, 0) * 100) / 100,
    pipelineTotalUSD: Math.round(rows.reduce((s, r) => s + r.pipelineUSD, 0) * 100) / 100,
  };
}
