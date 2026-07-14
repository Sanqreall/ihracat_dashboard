'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { returnSchema, type ReturnInput } from '@/lib/validations/return';

export async function listReturns() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('returns')
    .select('*, platforms(name), customers(name), orders(order_number), return_items(id, quantity, unit_price, product_id, products(product_code, name))')
    .order('return_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function createReturn(input: ReturnInput) {
  const parsed = returnSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ret, error } = await supabase
    .from('returns')
    .insert({
      return_number: parsed.return_number,
      return_date: parsed.return_date,
      order_id: parsed.order_id || null,
      customer_id: parsed.customer_id || null,
      platform_id: parsed.platform_id || null,
      reason: parsed.reason || null,
      refund_amount: parsed.refund_amount,
      return_shipping_cost: parsed.return_shipping_cost,
      notes: parsed.notes || null,
      created_by: user?.id,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const { error: itemsErr } = await supabase.from('return_items').insert(
    parsed.items.map((it) => ({
      return_id: ret.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
    }))
  );
  if (itemsErr) {
    await supabase.from('returns').delete().eq('id', ret.id);
    throw new Error(itemsErr.message);
  }

  revalidatePath('/returns');
  return { id: ret.id };
}

export async function getReturn(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('returns')
    .select('*, customers(name, phone), return_items(product_id, quantity, unit_price)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * İade düzenleme. Stoğa aktarılmışsa ledger yeniden senkronlanır:
 * eski kalemler 'cancellation' ile geri alınır, yeni kalemler 'return' olarak yazılır.
 */
export async function updateReturn(id: string, input: ReturnInput) {
  const parsed = returnSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: old, error: oldErr } = await supabase
    .from('returns')
    .select('transferred_to_inventory, return_number, return_items(product_id, quantity)')
    .eq('id', id)
    .single();
  if (oldErr) throw new Error(oldErr.message);

  const { error: updErr } = await supabase
    .from('returns')
    .update({
      return_number: parsed.return_number,
      return_date: parsed.return_date,
      order_id: parsed.order_id || null,
      customer_id: parsed.customer_id || null,
      platform_id: parsed.platform_id || null,
      reason: parsed.reason || null,
      refund_amount: parsed.refund_amount,
      return_shipping_cost: parsed.return_shipping_cost,
      notes: parsed.notes || null,
    })
    .eq('id', id);
  if (updErr) throw new Error(updErr.message);

  const { error: delErr } = await supabase.from('return_items').delete().eq('return_id', id);
  if (delErr) throw new Error(delErr.message);

  const { error: insErr } = await supabase.from('return_items').insert(
    parsed.items.map((it) => ({
      return_id: id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
    }))
  );
  if (insErr) throw new Error(insErr.message);

  if (old.transferred_to_inventory) {
    // Eski etki geri alınır
    if (old.return_items?.length) {
      const { error } = await supabase.from('stock_movements').insert(
        old.return_items.map((it: { product_id: string; quantity: number }) => ({
          product_id: it.product_id,
          movement_type: 'cancellation' as const,
          quantity: -Math.abs(it.quantity),
          reference_type: 'return',
          reference_id: id,
          notes: `İade düzenlendi, eski stok etkisi geri alındı: ${parsed.return_number}`,
          created_by: user?.id,
        }))
      );
      if (error) throw new Error(error.message);
    }
    // Yeni kalemler stoğa yazılır
    const { error } = await supabase.from('stock_movements').insert(
      parsed.items.map((it) => ({
        product_id: it.product_id,
        movement_type: 'return' as const,
        quantity: Math.abs(it.quantity),
        reference_type: 'return',
        reference_id: id,
        notes: `İade düzenlendi, yeni kalemler stoğa yazıldı: ${parsed.return_number}`,
        created_by: user?.id,
      }))
    );
    if (error) throw new Error(error.message);
  }

  revalidatePath('/returns');
  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/dashboard');
}

/**
 * One-click: transfer returned goods back into inventory.
 * Inserts a positive 'return' movement per item (trigger raises current_stock)
 * and marks the return as transferred. Guarded against double transfer.
 */
export async function transferReturnToInventory(returnId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: ret, error: retErr } = await supabase
    .from('returns')
    .select('id, return_number, transferred_to_inventory, return_items(product_id, quantity)')
    .eq('id', returnId)
    .single();
  if (retErr) throw new Error(retErr.message);
  if (ret.transferred_to_inventory) throw new Error('Bu iade zaten stoğa aktarılmış');
  if (!ret.return_items?.length) throw new Error('İadede ürün bulunamadı');

  const { error: movErr } = await supabase.from('stock_movements').insert(
    ret.return_items.map((it: { product_id: string; quantity: number }) => ({
      product_id: it.product_id,
      movement_type: 'return' as const,
      quantity: Math.abs(it.quantity),
      reference_type: 'return',
      reference_id: returnId,
      notes: `İade stoğa aktarıldı: ${ret.return_number}`,
      created_by: user?.id,
    }))
  );
  if (movErr) throw new Error(movErr.message);

  const { error: updErr } = await supabase
    .from('returns')
    .update({ transferred_to_inventory: true })
    .eq('id', returnId);
  if (updErr) throw new Error(updErr.message);

  revalidatePath('/returns');
  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/dashboard');
}

export async function deleteReturn(id: string) {
  const supabase = await createClient();

  // If already transferred, reverse the stock effect first (append-only ledger)
  const { data: ret, error: retErr } = await supabase
    .from('returns')
    .select('transferred_to_inventory, return_number, return_items(product_id, quantity)')
    .eq('id', id)
    .single();
  if (retErr) throw new Error(retErr.message);

  if (ret.transferred_to_inventory && ret.return_items?.length) {
    const { error: movErr } = await supabase.from('stock_movements').insert(
      ret.return_items.map((it: { product_id: string; quantity: number }) => ({
        product_id: it.product_id,
        movement_type: 'cancellation' as const,
        quantity: -Math.abs(it.quantity),
        reference_type: 'return',
        reference_id: id,
        notes: `İade silindi, stok etkisi geri alındı: ${ret.return_number}`,
      }))
    );
    if (movErr) throw new Error(movErr.message);
  }

  const { error } = await supabase.from('returns').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/returns');
  revalidatePath('/inventory');
  revalidatePath('/products');
}

export async function generateReturnNumber() {
  const supabase = await createClient();
  const { count } = await supabase.from('returns').select('*', { count: 'exact', head: true });
  const seq = String((count ?? 0) + 1).padStart(5, '0');
  const year = new Date().getFullYear();
  return `IAD-${year}-${seq}`;
}

/**
 * Siparişe bağlı iade numarası: sipariş numarasının başına İAD- eklenir.
 * Aynı siparişe birden fazla iade açılırsa sonuna -2, -3 … eklenir.
 */
export async function generateReturnNumberForOrder(orderNumber: string) {
  const supabase = await createClient();
  const base = `İAD-${orderNumber}`;
  const { data } = await supabase.from('returns').select('return_number').ilike('return_number', `${base}%`);
  const existing = new Set((data ?? []).map((r) => r.return_number));
  if (!existing.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

export async function listOrdersLite() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, customer_id, platform_id, customers(name, phone), order_items(product_id, quantity, unit_price, line_total), returns(id, return_items(product_id, quantity))')
    .is('deleted_at', null)
    .neq('status', 'cancelled')
    .order('order_date', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type ReturnImportRow = {
  return_number: string;
  return_date: string;
  order_number?: string;
  product_code: string;
  quantity: number;
  unit_price?: number;
  reason?: string;
  refund_amount?: number;
  return_shipping_cost?: number;
};

/**
 * Excel'den toplu iade: aynı iade numarasını paylaşan satırlar tek iadede
 * gruplanır. Mevcut iade numaraları atlanır. Stoğa aktarım yapılmaz —
 * içe aktarma sonrası her iade için "Stoğa aktar" butonunu kullanın.
 */
export async function bulkImportReturns(rows: ReturnImportRow[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: products }, { data: orders }] = await Promise.all([
    supabase.from('products').select('id, product_code').is('deleted_at', null),
    supabase.from('orders').select('id, order_number, customer_id, platform_id').is('deleted_at', null),
  ]);
  const productByCode = new Map((products ?? []).map((p) => [String(p.product_code).trim(), p.id]));
  const orderByNumber = new Map((orders ?? []).map((o) => [String(o.order_number).trim(), o]));

  const groups = new Map<string, ReturnImportRow[]>();
  for (const row of rows) {
    const num = String(row.return_number ?? '').trim();
    if (!num) continue;
    if (!groups.has(num)) groups.set(num, []);
    groups.get(num)!.push(row);
  }

  const numbers = Array.from(groups.keys());
  const { data: existing } = await supabase.from('returns').select('return_number').in('return_number', numbers);
  const existingSet = new Set((existing ?? []).map((r) => r.return_number));

  let imported = 0;
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const [returnNumber, groupRows] of groups) {
    if (existingSet.has(returnNumber)) { skipped.push(returnNumber); continue; }

    const first = groupRows[0];
    const order = first.order_number ? orderByNumber.get(String(first.order_number).trim()) : undefined;

    const items: { product_id: string; quantity: number; unit_price: number }[] = [];
    let badProduct: string | null = null;
    for (const r of groupRows) {
      const productId = productByCode.get(String(r.product_code ?? '').trim());
      if (!productId) { badProduct = String(r.product_code); break; }
      items.push({
        product_id: productId,
        quantity: Math.max(1, Math.round(Number(r.quantity) || 1)),
        unit_price: Number(r.unit_price) || 0,
      });
    }
    if (badProduct) { errors.push(`${returnNumber}: ürün kodu bulunamadı ("${badProduct}")`); continue; }

    const { data: ret, error: retErr } = await supabase
      .from('returns')
      .insert({
        return_number: returnNumber,
        return_date: String(first.return_date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        order_id: order?.id ?? null,
        customer_id: order?.customer_id ?? null,
        platform_id: order?.platform_id ?? null,
        reason: first.reason || null,
        refund_amount: Number(first.refund_amount) || 0,
        return_shipping_cost: Number(first.return_shipping_cost) || 0,
        created_by: user?.id,
      })
      .select('id')
      .single();
    if (retErr) { errors.push(`${returnNumber}: ${retErr.message}`); continue; }

    const { error: itemsErr } = await supabase.from('return_items').insert(
      items.map((it) => ({ return_id: ret.id, ...it }))
    );
    if (itemsErr) {
      await supabase.from('returns').delete().eq('id', ret.id);
      errors.push(`${returnNumber}: ${itemsErr.message}`);
      continue;
    }
    imported++;
  }

  revalidatePath('/returns');
  return { imported, skipped, errors };
}
