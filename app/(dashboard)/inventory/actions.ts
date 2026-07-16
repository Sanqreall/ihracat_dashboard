'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const adjustmentSchema = z.object({
  product_id: z.string().uuid('Ürün seçiniz'),
  quantity: z.coerce.number().int().refine((n) => n !== 0, 'Miktar 0 olamaz'),
  notes: z.string().optional().nullable(),
});

/**
 * Bir ürünün stoğunun nasıl oluştuğunu kaynak bazında döker.
 *
 * Satılabilir stok (current_stock) ve üretimdeki stok (production_stock)
 * ayrı ayrı; her birinin hangi kaynaktan (üretim emri, sipariş, iade,
 * düzeltme) ne kadar geldiği hareket defterinden hesaplanır.
 *
 * Trigger kuralı:
 *   movement_type='production' → production_stock (üretime giriş/çıkış)
 *   diğer tipler               → current_stock (satılabilir)
 * Böylece "transfer" hareketi hem production_stock'tan düşer (negatif production)
 * hem current_stock'a ekler (pozitif transfer) — ikisi de aynı üretim referansını taşır.
 */
export async function getStockComposition(productId: string) {
  const supabase = await createClient();

  const { data: product, error: pErr } = await supabase
    .from('products')
    .select('id, product_code, name, current_stock, production_stock, cost_price')
    .eq('id', productId)
    .single();
  if (pErr) throw new Error(pErr.message);

  const { data: movements, error: mErr } = await supabase
    .from('stock_movements')
    .select('movement_type, quantity, reference_type, reference_id, notes, created_at')
    .eq('product_id', productId)
    .order('created_at', { ascending: true });
  if (mErr) throw new Error(mErr.message);

  const rows = movements ?? [];

  // Üretim referanslarının emir numaralarını çöz
  const prodIds = Array.from(
    new Set(rows.filter((m) => m.reference_type === 'production' && m.reference_id).map((m) => m.reference_id as string))
  );
  const orderIds = Array.from(
    new Set(rows.filter((m) => m.reference_type === 'order' && m.reference_id).map((m) => m.reference_id as string))
  );

  const batchLabel = new Map<string, string>();
  if (prodIds.length) {
    const { data } = await supabase
      .from('production_batches')
      .select('id, production_order_number')
      .in('id', prodIds);
    for (const b of data ?? []) batchLabel.set(b.id, b.production_order_number ?? b.id);
  }
  const orderLabel = new Map<string, string>();
  if (orderIds.length) {
    const { data } = await supabase.from('orders').select('id, order_number').in('id', orderIds);
    for (const o of data ?? []) orderLabel.set(o.id, o.order_number);
  }

  // Kaynak etiketi üret
  const labelFor = (m: { reference_type: string | null; reference_id: string | null; movement_type: string; notes: string | null }) => {
    if (m.reference_type === 'production' && m.reference_id) {
      return batchLabel.get(m.reference_id) ?? extractLotFromNotes(m.notes) ?? 'Üretim (silinmiş)';
    }
    if (m.reference_type === 'order' && m.reference_id) {
      return orderLabel.get(m.reference_id) ?? 'Sipariş';
    }
    if (m.reference_type === 'return') return 'İade girişi';
    if (m.movement_type === 'adjustment') return 'Manuel düzeltme';
    if (m.movement_type === 'purchase') return 'Satın alma';
    return m.notes || 'Diğer';
  };

  // İki kova: üretimdeki (production tipi) ve satılabilir (diğer tipler)
  const wip = new Map<string, number>();       // production_stock kaynakları
  const sellable = new Map<string, number>();   // current_stock kaynakları

  for (const m of rows) {
    const qty = Number(m.quantity ?? 0);
    const label = labelFor(m);
    if (m.movement_type === 'production') {
      wip.set(label, (wip.get(label) ?? 0) + qty);
    } else {
      sellable.set(label, (sellable.get(label) ?? 0) + qty);
    }
  }

  const toSorted = (map: Map<string, number>) =>
    Array.from(map.entries())
      .filter(([, qty]) => Math.abs(qty) > 0.0001)
      .map(([source, quantity]) => ({ source, quantity: Math.round(quantity * 100) / 100 }))
      .sort((a, b) => b.quantity - a.quantity);

  return {
    product: {
      id: product.id,
      product_code: product.product_code,
      name: product.name,
      current_stock: Number(product.current_stock ?? 0),
      production_stock: Number(product.production_stock ?? 0),
      cost_price: Number(product.cost_price ?? 0),
    },
    sellableSources: toSorted(sellable),
    productionSources: toSorted(wip),
    movementCount: rows.length,
  };
}

/** Hareket notundan lot numarasını çıkarır (üretim emri silinmişse). */
function extractLotFromNotes(notes: string | null): string | null {
  const m = String(notes ?? '').match(/([A-ZÇĞİÖŞÜ]+-\d{4}-\d+(?:\/\d+)?)/);
  return m ? `${m[1]} (silinmiş)` : null;
}

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
      ? supabase.from('production_batches').select('id, batch_number, production_order_number').in('id', Array.from(productionIds))
      : Promise.resolve({ data: [] as { id: string; batch_number: string; production_order_number: string | null }[] }),
  ]);

  const orderMap = new Map((ordersRes.data ?? []).map((o) => [o.id, o.order_number]));
  const returnMap = new Map((returnsRes.data ?? []).map((r) => [r.id, r.return_number]));
  const batchMap = new Map(
    (batchesRes.data ?? []).map((b) => [b.id, (b as { production_order_number?: string | null }).production_order_number ?? b.batch_number])
  );

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
        if (num) {
          reference_label = num;
          reference_href = `/production?q=${encodeURIComponent(num)}`;
        } else {
          // Üretim emri silinmiş olabilir: hareket notundaki lot numarasını göster.
          // Notlar "… : URT-2026-00001/2" biçiminde yazılıyor.
          const match = String(m.notes ?? '').match(/([A-ZÇĞİÖŞÜ]+-\d{4}-\d+(?:\/\d+)?)/);
          if (match) reference_label = `${match[1]} (silinmiş)`;
        }
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
    .select('id, product_code, name, current_stock, production_stock, critical_stock, cost_price, sales_price')
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    ...p,
    available_stock: (p.current_stock ?? 0) + (p.production_stock ?? 0),
    inventory_value_cost: (p.current_stock ?? 0) * Number(p.cost_price ?? 0),
    inventory_value_sales: (p.current_stock ?? 0) * Number(p.sales_price ?? 0),
    // Üretimdeki (WIP) adetlerin maliyet değeri
    production_value_cost: (p.production_stock ?? 0) * Number(p.cost_price ?? 0),
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

/**
 * Toplu stok düzeltmesi: tek işlemde birden fazla ürün, her satır için
 * ayrı miktar ve açıklama. Hareketler append-only deftere toplu yazılır.
 */
export async function createBulkAdjustment(
  rows: { product_id: string; quantity: number; notes?: string | null }[]
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Geçerli satırları doğrula (ürün seçili + miktar 0 değil)
  const valid = rows
    .map((r) => ({ product_id: r.product_id, quantity: Number(r.quantity), notes: r.notes }))
    .filter((r) => r.product_id && Number.isFinite(r.quantity) && r.quantity !== 0);

  if (!valid.length) throw new Error('Geçerli düzeltme satırı yok (ürün seçili ve miktar 0 olmamalı).');

  const { error } = await supabase.from('stock_movements').insert(
    valid.map((r) => ({
      product_id: r.product_id,
      movement_type: 'adjustment' as const,
      quantity: r.quantity,
      notes: r.notes?.trim() || null,
      created_by: user?.id,
    }))
  );
  if (error) throw new Error(error.message);

  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/dashboard');
  return { count: valid.length };
}
