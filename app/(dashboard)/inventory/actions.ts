'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const adjustmentSchema = z.object({
  product_id: z.string().uuid('Ürün seçiniz'),
  quantity: z.coerce.number().int().refine((n) => n !== 0, 'Miktar 0 olamaz'),
  notes: z.string().optional().nullable(),
});

export async function listStockMovements(limit = 300) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*, products(product_code, name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const movements = data ?? [];

  // Referans numaralarını topluca çöz (sipariş / iade / üretim)
  const orderIds = new Set<string>();
  const returnIds = new Set<string>();
  const productionIds = new Set<string>();
  for (const m of movements) {
    if (!m.reference_id) continue;
    if (m.reference_type === 'order') orderIds.add(m.reference_id);
    else if (m.reference_type === 'return') returnIds.add(m.reference_id);
    else if (m.reference_type === 'production') productionIds.add(m.reference_id);
  }

  const [ordersRes, returnsRes, batchesRes] = await Promise.all([
    orderIds.size
      ? supabase.from('orders').select('id, order_number').in('id', Array.from(orderIds))
      : Promise.resolve({ data: [] as { id: string; order_number: string }[] }),
    returnIds.size
      ? supabase.from('returns').select('id, return_number').in('id', Array.from(returnIds))
      : Promise.resolve({ data: [] as { id: string; return_number: string }[] }),
    productionIds.size
      ? supabase.from('production_batches').select('id, batch_number').in('id', Array.from(productionIds))
      : Promise.resolve({ data: [] as { id: string; batch_number: string }[] }),
  ]);

  const orderMap = new Map((ordersRes.data ?? []).map((o) => [o.id, o.order_number]));
  const returnMap = new Map((returnsRes.data ?? []).map((r) => [r.id, r.return_number]));
  const batchMap = new Map((batchesRes.data ?? []).map((b) => [b.id, b.batch_number]));

  return movements.map((m) => {
    let reference_label: string | null = null;
    let reference_href: string | null = null;
    if (m.reference_id) {
      if (m.reference_type === 'order') {
        const num = orderMap.get(m.reference_id);
        if (num) { reference_label = num; reference_href = `/orders?q=${encodeURIComponent(num)}`; }
      } else if (m.reference_type === 'return') {
        const num = returnMap.get(m.reference_id);
        if (num) { reference_label = num; reference_href = `/returns?q=${encodeURIComponent(num)}`; }
      } else if (m.reference_type === 'production') {
        const num = batchMap.get(m.reference_id);
        if (num) { reference_label = num; reference_href = `/production?q=${encodeURIComponent(num)}`; }
      }
    }
    return { ...m, reference_label, reference_href };
  });
}

export type AdjustmentImportRow = {
  product_code: string;
  quantity: number;
  notes?: string;
};

export async function bulkImportAdjustments(rows: AdjustmentImportRow[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: products } = await supabase.from('products').select('id, product_code').is('deleted_at', null);
  const productByCode = new Map((products ?? []).map((p) => [String(p.product_code).trim(), p.id]));

  let imported = 0;
  const errors: string[] = [];

  const inserts: { product_id: string; movement_type: 'adjustment'; quantity: number; notes: string | null; created_by?: string }[] = [];
  for (const row of rows) {
    const code = String(row.product_code ?? '').trim();
    const productId = productByCode.get(code);
    if (!productId) { errors.push(`Ürün kodu bulunamadı: "${code}"`); continue; }
    const qty = Math.round(Number(row.quantity) || 0);
    if (!qty) { errors.push(`${code}: miktar 0 olamaz`); continue; }
    inserts.push({
      product_id: productId,
      movement_type: 'adjustment',
      quantity: qty,
      notes: row.notes || 'Excel içe aktarma',
      created_by: user?.id,
    });
    imported++;
  }

  if (inserts.length) {
    const { error } = await supabase.from('stock_movements').insert(inserts);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/dashboard');
  return { imported, errors };
}

export async function listStockSummary() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, product_code, name, current_stock, production_stock, reserved_stock, critical_stock, cost_price')
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    ...p,
    available_stock: (p.current_stock ?? 0) + (p.production_stock ?? 0) - (p.reserved_stock ?? 0),
    inventory_value: (p.current_stock ?? 0) * Number(p.cost_price ?? 0),
    is_critical: (p.current_stock ?? 0) <= (p.critical_stock ?? 0),
  }));
}

export async function createAdjustment(input: { product_id: string; quantity: number; notes?: string | null }) {
  const parsed = adjustmentSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('stock_movements').insert({
    product_id: parsed.product_id,
    movement_type: 'adjustment',
    quantity: parsed.quantity,
    notes: parsed.notes || null,
    created_by: user?.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/dashboard');
}
