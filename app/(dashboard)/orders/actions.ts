'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { orderSchema, calculateOrderTotals, type OrderInput } from '@/lib/validations/order';

export async function listOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, platforms(name), customers(name), order_items(id, quantity)')
    .is('deleted_at', null)
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getOrder(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(name, phone, shipping_address), order_items(*, products(product_code, name))')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

const IMPORT_STATUS_MAP: Record<string, OrderInput['status']> = {
  'taslak': 'draft', 'draft': 'draft',
  'onaylandı': 'confirmed', 'onaylandi': 'confirmed', 'confirmed': 'confirmed',
  'hazırlanıyor': 'processing', 'hazirlaniyor': 'processing', 'processing': 'processing',
  'kargolandı': 'shipped', 'kargolandi': 'shipped', 'shipped': 'shipped',
  'teslim edildi': 'delivered', 'delivered': 'delivered',
};

export type OrderImportRow = {
  order_number: string;
  order_date: string;
  platform_name: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  line_discount_percent?: number;
  order_discount_percent?: number;
  shipping_cost?: number;
  status?: string;
};

/**
 * Bulk import orders from Excel. One row per order LINE; rows sharing the same
 * order number are grouped into one order. Existing order numbers are skipped.
 * Prices are VAT-inclusive (matching the rest of the app).
 */
export async function bulkImportOrders(rows: OrderImportRow[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Lookups
  const [{ data: platforms }, { data: products }] = await Promise.all([
    supabase.from('platforms').select('id, name').is('deleted_at', null),
    supabase.from('products').select('id, product_code, tax_rate').is('deleted_at', null),
  ]);
  const platformByName = new Map((platforms ?? []).map((p) => [p.name.toLocaleLowerCase('tr'), p.id]));
  const productByCode = new Map((products ?? []).map((p) => [String(p.product_code).trim(), { id: p.id, tax_rate: Number(p.tax_rate ?? 10) }]));

  // Group rows by order number
  const groups = new Map<string, OrderImportRow[]>();
  for (const row of rows) {
    const num = String(row.order_number ?? '').trim();
    if (!num) continue;
    if (!groups.has(num)) groups.set(num, []);
    groups.get(num)!.push(row);
  }

  // Skip already-existing order numbers
  const numbers = Array.from(groups.keys());
  const { data: existing } = await supabase.from('orders').select('order_number').in('order_number', numbers);
  const existingSet = new Set((existing ?? []).map((o) => o.order_number));

  let imported = 0;
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const [orderNumber, groupRows] of groups) {
    if (existingSet.has(orderNumber)) { skipped.push(orderNumber); continue; }

    const first = groupRows[0];
    const platformId = platformByName.get(String(first.platform_name ?? '').trim().toLocaleLowerCase('tr'));
    if (!platformId) { errors.push(`${orderNumber}: platform bulunamadı ("${first.platform_name}")`); continue; }

    const items: { product_id: string; quantity: number; unit_price: number; line_discount_percent: number; tax_rate: number }[] = [];
    let badProduct: string | null = null;
    for (const r of groupRows) {
      const prod = productByCode.get(String(r.product_code ?? '').trim());
      if (!prod) { badProduct = String(r.product_code); break; }
      items.push({
        product_id: prod.id,
        quantity: Math.max(1, Math.round(Number(r.quantity) || 1)),
        unit_price: Number(r.unit_price) || 0,
        line_discount_percent: Number(r.line_discount_percent) || 0,
        tax_rate: prod.tax_rate,
      });
    }
    if (badProduct) { errors.push(`${orderNumber}: ürün kodu bulunamadı ("${badProduct}")`); continue; }

    const status = IMPORT_STATUS_MAP[String(first.status ?? '').trim().toLocaleLowerCase('tr')] ?? 'confirmed';
    const totals = calculateOrderTotals({
      items,
      order_discount_percent: Number(first.order_discount_percent) || 0,
      shipping_cost: Number(first.shipping_cost) || 0,
    });
    const customerId = await resolveCustomer(supabase, first.customer_name, first.customer_phone, first.customer_address);

    const { data: order, error: ordErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        order_date: String(first.order_date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        platform_id: platformId,
        customer_id: customerId,
        shipping_address: first.customer_address?.trim() || null,
        order_discount_percent: Number(first.order_discount_percent) || 0,
        order_discount_amount: totals.order_discount_amount,
        shipping_cost: totals.shipping_cost,
        tax_amount: totals.tax_amount,
        subtotal: totals.subtotal,
        total: totals.total,
        net_total: totals.net_total,
        status,
        payment_status: 'unpaid',
        shipment_status: 'pending',
        created_by: user?.id,
        updated_by: user?.id,
      })
      .select('id')
      .single();
    if (ordErr) { errors.push(`${orderNumber}: ${ordErr.message}`); continue; }

    const { error: itemsErr } = await supabase.from('order_items').insert(
      items.map((it, i) => ({
        order_id: order.id,
        product_id: it.product_id,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_discount_percent: it.line_discount_percent,
        line_discount_amount: totals.lines[i].line_discount_amount,
        tax_rate: it.tax_rate,
        line_total: totals.lines[i].line_total,
      }))
    );
    if (itemsErr) {
      await supabase.from('orders').delete().eq('id', order.id);
      errors.push(`${orderNumber}: ${itemsErr.message}`);
      continue;
    }

    if (CONSUMING_STATUSES.includes(status)) {
      await createOrderStockMovements(supabase, order.id, items, user?.id);
    }
    imported++;
  }

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/inventory');
  revalidatePath('/dashboard');
  return { imported, skipped, errors };
}

/**
 * Stock effect rules (single source of truth):
 * - Orders in a "stock-consuming" status (anything except draft & cancelled)
 *   have one 'sale' movement per item (negative qty).
 * - Movements are keyed by reference_type='order', reference_id=order id.
 * - On update we always remove old movements and re-create if still consuming,
 *   so edits to quantities/status stay consistent with the ledger.
 * - Cancelling creates no extra rows: removing the sale movements restores stock
 *   (the delete trigger below reverses them).
 */
const CONSUMING_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'];

async function removeOrderStockMovements(supabase: Awaited<ReturnType<typeof createClient>>, orderId: string) {
  // The ledger is append-only. To "remove" an order's stock effect we compute
  // the net outstanding quantity per product across all of this order's
  // movements (sales are negative, prior cancellations positive) and insert a
  // compensating 'cancellation' row that brings each product's net to zero.
  // This keeps sum(ledger) === products.current_stock at all times and is
  // idempotent: calling it twice inserts nothing the second time.
  const { data: movements, error: selErr } = await supabase
    .from('stock_movements')
    .select('product_id, quantity')
    .eq('reference_type', 'order')
    .eq('reference_id', orderId);
  if (selErr) throw new Error(selErr.message);
  if (!movements?.length) return;

  const netByProduct = new Map<string, number>();
  for (const m of movements) {
    netByProduct.set(m.product_id, (netByProduct.get(m.product_id) ?? 0) + m.quantity);
  }

  const compensations = Array.from(netByProduct.entries())
    .filter(([, net]) => net !== 0)
    .map(([product_id, net]) => ({
      product_id,
      movement_type: 'cancellation' as const,
      quantity: -net, // sale nets are negative, so this returns stock
      reference_type: 'order',
      reference_id: orderId,
      notes: 'Sipariş düzenleme/iptal — stok etkisi geri alındı',
    }));
  if (!compensations.length) return;

  const { error: insErr } = await supabase.from('stock_movements').insert(compensations);
  if (insErr) throw new Error(insErr.message);
}

async function createOrderStockMovements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  items: { product_id: string; quantity: number }[],
  userId?: string
) {
  const { error } = await supabase.from('stock_movements').insert(
    items.map((it) => ({
      product_id: it.product_id,
      movement_type: 'sale' as const,
      quantity: -Math.abs(it.quantity),
      reference_type: 'order',
      reference_id: orderId,
      created_by: userId,
    }))
  );
  if (error) throw new Error(error.message);
}

/**
 * Resolve inline customer fields to a customer_id.
 * Matches an existing customer by exact name (case-insensitive); creates one
 * if not found. Updates phone/address on the match if provided.
 */
async function resolveCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name?: string | null,
  phone?: string | null,
  address?: string | null
): Promise<string | null> {
  const trimmed = name?.trim();
  if (!trimmed) return null;

  const { data: existing, error: selErr } = await supabase
    .from('customers')
    .select('id')
    .ilike('name', trimmed)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();
  if (selErr) throw new Error(selErr.message);

  if (existing) {
    const patch: Record<string, string> = {};
    if (phone?.trim()) patch.phone = phone.trim();
    if (address?.trim()) patch.shipping_address = address.trim();
    if (Object.keys(patch).length) {
      await supabase.from('customers').update(patch).eq('id', existing.id);
    }
    return existing.id;
  }

  const { data: created, error: insErr } = await supabase
    .from('customers')
    .insert({ name: trimmed, phone: phone?.trim() || null, shipping_address: address?.trim() || null })
    .select('id')
    .single();
  if (insErr) throw new Error(insErr.message);
  return created.id;
}

export async function createOrder(input: OrderInput) {
  const parsed = orderSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const totals = calculateOrderTotals(parsed);
  const customerId = await resolveCustomer(supabase, parsed.customer_name, parsed.customer_phone, parsed.customer_address);

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      order_number: parsed.order_number,
      order_date: parsed.order_date,
      platform_id: parsed.platform_id,
      customer_id: customerId,
      shipping_address: parsed.customer_address?.trim() || null,
      order_discount_percent: parsed.order_discount_percent,
      order_discount_amount: totals.order_discount_amount,
      shipping_cost: totals.shipping_cost,
      tax_amount: totals.tax_amount,
      subtotal: totals.subtotal,
      total: totals.total,
      net_total: totals.net_total,
      status: parsed.status,
      payment_status: parsed.payment_status,
      shipment_status: parsed.shipment_status,
      invoice_number: parsed.invoice_number || null,
      tracking_number: parsed.tracking_number || null,
      notes: parsed.notes || null,
      created_by: user?.id,
      updated_by: user?.id,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const { error: itemsErr } = await supabase.from('order_items').insert(
    parsed.items.map((it, i) => ({
      order_id: order.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_discount_percent: it.line_discount_percent,
      line_discount_amount: totals.lines[i].line_discount_amount,
      tax_rate: it.tax_rate,
      line_total: totals.lines[i].line_total,
    }))
  );
  if (itemsErr) {
    // Roll back the order header so we don't leave an orphan
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error(itemsErr.message);
  }

  if (CONSUMING_STATUSES.includes(parsed.status)) {
    await createOrderStockMovements(supabase, order.id, parsed.items, user?.id);
  }

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/dashboard');
  return { id: order.id };
}

export async function updateOrder(id: string, input: OrderInput) {
  const parsed = orderSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const totals = calculateOrderTotals(parsed);
  const customerId = await resolveCustomer(supabase, parsed.customer_name, parsed.customer_phone, parsed.customer_address);

  const { error } = await supabase
    .from('orders')
    .update({
      order_number: parsed.order_number,
      order_date: parsed.order_date,
      platform_id: parsed.platform_id,
      customer_id: customerId,
      shipping_address: parsed.customer_address?.trim() || null,
      order_discount_percent: parsed.order_discount_percent,
      order_discount_amount: totals.order_discount_amount,
      shipping_cost: totals.shipping_cost,
      tax_amount: totals.tax_amount,
      subtotal: totals.subtotal,
      total: totals.total,
      net_total: totals.net_total,
      status: parsed.status,
      payment_status: parsed.payment_status,
      shipment_status: parsed.shipment_status,
      invoice_number: parsed.invoice_number || null,
      tracking_number: parsed.tracking_number || null,
      notes: parsed.notes || null,
      updated_by: user?.id,
    })
    .eq('id', id);
  if (error) throw new Error(error.message);

  // Replace items wholesale
  const { error: delItemsErr } = await supabase.from('order_items').delete().eq('order_id', id);
  if (delItemsErr) throw new Error(delItemsErr.message);

  const { error: itemsErr } = await supabase.from('order_items').insert(
    parsed.items.map((it, i) => ({
      order_id: id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_discount_percent: it.line_discount_percent,
      line_discount_amount: totals.lines[i].line_discount_amount,
      tax_rate: it.tax_rate,
      line_total: totals.lines[i].line_total,
    }))
  );
  if (itemsErr) throw new Error(itemsErr.message);

  // Re-sync stock: always remove old movements, re-create if still consuming
  await removeOrderStockMovements(supabase, id);
  if (CONSUMING_STATUSES.includes(parsed.status)) {
    await createOrderStockMovements(supabase, id, parsed.items, user?.id);
  }

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/dashboard');
}

export async function cancelOrder(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('orders')
    .update({ status: 'cancelled', updated_by: user?.id })
    .eq('id', id);
  if (error) throw new Error(error.message);

  await removeOrderStockMovements(supabase, id);

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/dashboard');
}

export async function softDeleteOrders(ids: string[]) {
  const supabase = await createClient();

  // Restore stock for each order before hiding it
  for (const id of ids) {
    await removeOrderStockMovements(supabase, id);
  }

  const { error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(error.message);

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/dashboard');
}

export async function generateOrderNumber() {
  const supabase = await createClient();
  const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true });
  const seq = String((count ?? 0) + 1).padStart(5, '0');
  const year = new Date().getFullYear();
  return `SIP-${year}-${seq}`;
}
