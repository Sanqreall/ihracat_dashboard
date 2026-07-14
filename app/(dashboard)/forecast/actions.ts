'use server';

import { createClient } from '@/lib/supabase/server';

export type ForecastRow = {
  product: string;
  sold90: number;
  monthlyVelocity: number;
  available: number;
  current_stock: number;
  production_stock: number;
  need1: number;
  need3: number;
  need6: number;
  need12: number;
  stockoutDays: number | null;
};

export async function getForecastData(): Promise<ForecastRow[]> {
  const supabase = await createClient();
  const round = (n: number) => Math.round(n * 100) / 100;
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000).toISOString().slice(0, 10);

  const [productsRes, itemsRes] = await Promise.all([
    supabase
      .from('products')
      .select('product_code, name, current_stock, production_stock')
      .is('deleted_at', null)
      .eq('status', 'active'),
    supabase
      .from('order_items')
      .select('quantity, products(product_code), orders!inner(order_date, deleted_at, status)')
      .is('orders.deleted_at', null)
      .neq('orders.status', 'cancelled')
      .neq('orders.status', 'draft')
      .gte('orders.order_date', ninetyDaysAgo)
      .limit(5000),
  ]);
  if (productsRes.error) throw new Error(productsRes.error.message);
  if (itemsRes.error) throw new Error(itemsRes.error.message);

  const sold90ByCode = new Map<string, number>();
  for (const it of itemsRes.data ?? []) {
    const code = String((it.products as { product_code?: string } | null)?.product_code ?? '').trim();
    if (!code) continue;
    sold90ByCode.set(code, (sold90ByCode.get(code) ?? 0) + Number(it.quantity ?? 0));
  }

  return (productsRes.data ?? [])
    .map((p) => {
      const code = String(p.product_code).trim();
      const sold90 = sold90ByCode.get(code) ?? 0;
      const monthlyVelocity = sold90 / 3;
      const available = (p.current_stock ?? 0) + (p.production_stock ?? 0);
      const need = (months: number) => Math.max(0, Math.ceil(monthlyVelocity * months - available));
      const dailyVelocity = sold90 / 90;
      const stockoutDays = dailyVelocity > 0 ? Math.floor(Math.max(0, available) / dailyVelocity) : null;
      return {
        product: `${p.product_code} — ${p.name}`,
        sold90,
        monthlyVelocity: round(monthlyVelocity),
        available,
        current_stock: p.current_stock ?? 0,
        production_stock: p.production_stock ?? 0,
        need1: need(1),
        need3: need(3),
        need6: need(6),
        need12: need(12),
        stockoutDays,
      };
    })
    .sort((a, b) => b.monthlyVelocity - a.monthlyVelocity);
}
