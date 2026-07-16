'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { orderSchema, calculateOrderTotals, type OrderInput } from '@/lib/validations/order';
import { normalizeProvince } from '@/lib/provinces';
import { getTcmbUsdRate } from '@/lib/tcmb';

/** Platform komisyon oranını çeker (kilitlemek için). */
async function getPlatformCommissionRate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  platformId: string
): Promise<number> {
  const { data } = await supabase.from('platforms').select('commission_rate').eq('id', platformId).maybeSingle();
  return Number(data?.commission_rate ?? 0);
}

async function getCategoryId(supabase: Awaited<ReturnType<typeof createClient>>, name: string) {
  const { data } = await supabase.from('expense_categories').select('id').eq('name', name).maybeSingle();
  return data?.id ?? null;
}

/**
 * Siparişten doğan otomatik giderleri (platform komisyonu, kargo) yazar/günceller.
 * Gider satırı reference_type='order' + reference_id ile siparişe bağlanır,
 * böylece Giderler sayfasından siparişe tıklanabilir.
 * Tutar 0 ise ilgili gider silinir.
 */
async function syncOrderExpense(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: {
    orderId: string;
    orderNumber: string;
    orderDate: string;
    amount: number;
    categoryName: 'Platform Komisyonu' | 'Kargo Gideri';
    describe: (orderNumber: string) => string;
    userId?: string;
  }
) {
  const { orderId, orderNumber, orderDate, amount, categoryName, describe, userId } = opts;
  const categoryId = await getCategoryId(supabase, categoryName);

  const { data: existing } = await supabase
    .from('expenses')
    .select('id')
    .eq('reference_type', 'order')
    .eq('reference_id', orderId)
    .eq('category_id', categoryId)
    .maybeSingle();

  if (amount <= 0) {
    if (existing) await supabase.from('expenses').delete().eq('id', existing.id);
    return;
  }

  const payload = {
    expense_date: orderDate, // sipariş tarihi ile
    category_id: categoryId,
    description: describe(orderNumber),
    amount,
    reference_type: 'order',
    reference_id: orderId,
    created_by: userId,
  };

  if (existing) {
    await supabase.from('expenses').update(payload).eq('id', existing.id);
  } else {
    await supabase.from('expenses').insert(payload);
  }
}

/** Siparişe bağlı tüm otomatik giderleri (komisyon + kargo) tek seferde senkronlar. */
async function syncAllOrderExpenses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: {
    orderId: string;
    orderNumber: string;
    orderDate: string;
    commissionAmount: number;
    shippingCost: number;
    userId?: string;
  }
) {
  await syncOrderExpense(supabase, {
    orderId: args.orderId,
    orderNumber: args.orderNumber,
    orderDate: args.orderDate,
    amount: args.commissionAmount,
    categoryName: 'Platform Komisyonu',
    describe: (n) => `Platform komisyonu — ${n}`,
    userId: args.userId,
  });
  await syncOrderExpense(supabase, {
    orderId: args.orderId,
    orderNumber: args.orderNumber,
    orderDate: args.orderDate,
    amount: args.shippingCost,
    categoryName: 'Kargo Gideri',
    describe: (n) => `Nakliye gideri — ${n}`,
    userId: args.userId,
  });
}

/** Sipariş iptal/silindiğinde otomatik giderlerini temizler. */
async function removeOrderExpenses(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string
) {
  await supabase.from('expenses').delete().eq('reference_type', 'order').eq('reference_id', orderId);
}

export async function listOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, platforms(name), customers(name, phone), order_items(id, quantity, unit_price, line_total, line_discount_percent, line_discount_amount_input, products(product_code, name, cost_price))')  // delivery_province, order_discount_amount_input orders.* içinde
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
    .select('*, customers(name, phone, shipping_address), order_items(*, products(product_code, name))')    .eq('id', id)
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
  delivery_province?: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  line_discount_percent?: number;
  line_discount_amount_input?: number;
  order_discount_percent?: number;
  order_discount_amount_input?: number;
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
    supabase.from('platforms').select('id, name, commission_rate').is('deleted_at', null),
    supabase.from('products').select('id, product_code, tax_rate').is('deleted_at', null),
  ]);
  const platformByName = new Map((platforms ?? []).map((p) => [p.name.toLocaleLowerCase('tr'), p.id]));
  const commissionByPlatform = new Map((platforms ?? []).map((p) => [p.id, Number((p as { commission_rate?: number }).commission_rate ?? 0)]));
  const productByCode = new Map((products ?? []).map((p) => [String(p.product_code).trim(), { id: p.id, tax_rate: Number(p.tax_rate ?? 10) }]));

  // USD kurunu bir kez çek, tüm içe aktarılan siparişlere uygula
  const usd = await getTcmbUsdRate();
  const importUsdRate = usd?.rate ?? null;

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
  const { data: existing } = await supabase.from('orders').select('order_number').in('order_number', numbers).is('deleted_at', null);
  const existingSet = new Set((existing ?? []).map((o) => o.order_number));

  // --- Müşterileri TOPLU çöz (satır satır sorgu yerine) ---
  // İçe aktarmadaki tüm benzersiz müşteri adlarını tek seferde çekip,
  // eksik olanları tek insert ile oluşturuyoruz. Bu, N sipariş için
  // 2N sorgu yerine 2 sorguya indirir.
  const customerNames = new Map<string, { name: string; phone?: string; address?: string }>();
  for (const [num, groupRows] of groups) {
    if (existingSet.has(num)) continue;
    const f = groupRows[0];
    const nm = f.customer_name?.trim();
    if (!nm) continue;
    const key = nm.toLocaleLowerCase('tr');
    if (!customerNames.has(key)) {
      customerNames.set(key, { name: nm, phone: f.customer_phone?.trim(), address: f.customer_address?.trim() });
    }
  }

  const customerIdByName = new Map<string, string>();
  if (customerNames.size) {
    const names = Array.from(customerNames.values()).map((c) => c.name);
    const { data: found } = await supabase
      .from('customers')
      .select('id, name')
      .in('name', names)
      .is('deleted_at', null);
    for (const c of found ?? []) customerIdByName.set(c.name.toLocaleLowerCase('tr'), c.id);

    // Eksik müşterileri toplu oluştur
    const missing = Array.from(customerNames.entries()).filter(([key]) => !customerIdByName.has(key));
    if (missing.length) {
      const { data: created } = await supabase
        .from('customers')
        .insert(missing.map(([, c]) => ({ name: c.name, phone: c.phone || null, shipping_address: c.address || null })))
        .select('id, name');
      for (const c of created ?? []) customerIdByName.set(c.name.toLocaleLowerCase('tr'), c.id);
    }
  }

  let imported = 0;
  const skipped: string[] = [];
  const errors: string[] = [];

  // İçe aktarmada otomatik giderleri (komisyon + kargo) biriktir, döngü
  // sonunda tek insert ile yaz. Kategori id'lerini bir kez çek.
  const { data: cats } = await supabase.from('expense_categories').select('id, name');
  const catId = new Map((cats ?? []).map((c) => [c.name, c.id as string]));
  const pendingExpenses: Record<string, unknown>[] = [];

  for (const [orderNumber, groupRows] of groups) {
    if (existingSet.has(orderNumber)) { skipped.push(orderNumber); continue; }
    const first = groupRows[0];
    const platformId = platformByName.get(String(first.platform_name ?? '').trim().toLocaleLowerCase('tr'));
    if (!platformId) { errors.push(`${orderNumber}: platform bulunamadı ("${first.platform_name}")`); continue; }

    const items: { product_id: string; quantity: number; unit_price: number; line_discount_percent: number; line_discount_amount_input: number; tax_rate: number }[] = [];
    let badProduct: string | null = null;
    for (const r of groupRows) {
      const prod = productByCode.get(String(r.product_code ?? '').trim());
      if (!prod) { badProduct = String(r.product_code); break; }
      items.push({
        product_id: prod.id,
        quantity: Math.max(1, Math.round(Number(r.quantity) || 1)),
        unit_price: Number(r.unit_price) || 0,
        line_discount_percent: Number(r.line_discount_percent) || 0,
        line_discount_amount_input: Number(r.line_discount_amount_input) || 0,
        tax_rate: prod.tax_rate,
      });
    }
    if (badProduct) { errors.push(`${orderNumber}: ürün kodu bulunamadı ("${badProduct}")`); continue; }

    const status = IMPORT_STATUS_MAP[String(first.status ?? '').trim().toLocaleLowerCase('tr')] ?? 'confirmed';
    const totals = calculateOrderTotals({
      items,
      order_discount_percent: Number(first.order_discount_percent) || 0,
      order_discount_amount_input: Number(first.order_discount_amount_input) || 0,
      shipping_cost: Number(first.shipping_cost) || 0,
    });
    const customerId = first.customer_name?.trim()
      ? customerIdByName.get(first.customer_name.trim().toLocaleLowerCase('tr')) ?? null
      : null;
    const commissionRate = commissionByPlatform.get(platformId) ?? 0;
    const commissionAmount = Math.round((totals.net_total * commissionRate / 100) * 100) / 100;
    const orderDate = String(first.order_date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);

    const { data: order, error: ordErr } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        order_date: orderDate,
        platform_id: platformId,
        customer_id: customerId,
        shipping_address: first.customer_address?.trim() || null,
        delivery_province: normalizeProvince(first.delivery_province),
        order_discount_percent: Number(first.order_discount_percent) || 0,
        order_discount_amount: totals.order_discount_amount,
        order_discount_amount_input: Number(first.order_discount_amount_input) || 0,
        shipping_cost: totals.shipping_cost,
        tax_amount: totals.tax_amount,
        subtotal: totals.subtotal,
        total: totals.total,
        net_total: totals.net_total,
        usd_rate: importUsdRate,
        total_usd: importUsdRate ? Math.round((totals.total / importUsdRate) * 100) / 100 : null,
        net_total_usd: importUsdRate ? Math.round((totals.net_total / importUsdRate) * 100) / 100 : null,
        commission_rate: commissionRate,
        commission_amount: commissionAmount,
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
        line_discount_amount_input: it.line_discount_amount_input ?? 0,
        tax_rate: it.tax_rate,
        line_total: totals.lines[i].line_total,
      }))
    );
    if (itemsErr) {
      await supabase.from('orders').delete().eq('id', order.id);
      errors.push(`${orderNumber}: ${itemsErr.message}`);
      continue;
    }

    // Stok hareketi ekle (toplu insert zaten)
    if (isStockConsuming(status)) {
      await createOrderStockMovements(supabase, order.id, items, user?.id);
    }
    // Otomatik giderleri biriktir (döngü sonunda toplu yazılır)
    if (status !== 'cancelled' && (status as string) !== 'draft') {
      if (commissionAmount > 0 && catId.get('Platform Komisyonu')) {
        pendingExpenses.push({
          expense_date: orderDate,
          category_id: catId.get('Platform Komisyonu'),
          description: `Platform komisyonu — ${orderNumber}`,
          amount: commissionAmount,
          reference_type: 'order',
          reference_id: order.id,
          created_by: user?.id,
        });
      }
      if (totals.shipping_cost > 0 && catId.get('Kargo Gideri')) {
        pendingExpenses.push({
          expense_date: orderDate,
          category_id: catId.get('Kargo Gideri'),
          description: `Nakliye gideri — ${orderNumber}`,
          amount: totals.shipping_cost,
          reference_type: 'order',
          reference_id: order.id,
          created_by: user?.id,
        });
      }
    }
    imported++;
  }

  // Biriken otomatik giderleri tek seferde yaz
  if (pendingExpenses.length) {
    await supabase.from('expenses').insert(pendingExpenses);
  }

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/inventory');
  revalidatePath('/expenses');
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
/**
 * Stok tüketen durumlar: İPTAL DIŞINDAKİ HER DURUM.
 * Taslak bir sipariş de stoğu düşer; yalnızca 'cancelled' stoğu geri verir.
 */
function isStockConsuming(status: string) {
  return status !== 'cancelled';
}

/** Sipariş kalemleri (ürün + adet) gerçekten değişti mi? Sıra farkı önemsizdir. */
function haveItemsChanged(
  prev: { product_id: string; quantity: number }[],
  next: { product_id: string; quantity: number }[]
) {
  const toMap = (list: { product_id: string; quantity: number }[]) => {
    const m = new Map<string, number>();
    for (const it of list) {
      m.set(it.product_id, (m.get(it.product_id) ?? 0) + Number(it.quantity ?? 0));
    }
    return m;
  };
  const a = toMap(prev);
  const b = toMap(next);
  if (a.size !== b.size) return true;
  for (const [productId, qty] of a) {
    if (b.get(productId) !== qty) return true;
  }
  return false;
}

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

  // Bağımsız işleri paralel çalıştır: müşteri çözümü, TCMB kuru, komisyon oranı
  const [customerId, usd, commissionRate] = await Promise.all([
    resolveCustomer(supabase, parsed.customer_name, parsed.customer_phone, parsed.customer_address),
    getTcmbUsdRate(),
    getPlatformCommissionRate(supabase, parsed.platform_id),
  ]);

  const usdRate = usd?.rate ?? null;
  const totalUsd = usdRate ? Math.round((totals.total / usdRate) * 100) / 100 : null;
  const netTotalUsd = usdRate ? Math.round((totals.net_total / usdRate) * 100) / 100 : null;
  const commissionAmount = Math.round((totals.net_total * commissionRate / 100) * 100) / 100;

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      order_number: parsed.order_number,
      order_date: parsed.order_date,
      platform_id: parsed.platform_id,
      customer_id: customerId,
      shipping_address: parsed.customer_address?.trim() || null,
      delivery_province: normalizeProvince(parsed.delivery_province),
      order_discount_percent: parsed.order_discount_percent,
      order_discount_amount: totals.order_discount_amount,
      order_discount_amount_input: parsed.order_discount_amount_input ?? 0,
      shipping_cost: totals.shipping_cost,
      tax_amount: totals.tax_amount,
      subtotal: totals.subtotal,
      total: totals.total,
      net_total: totals.net_total,
      usd_rate: usdRate,
      total_usd: totalUsd,
      net_total_usd: netTotalUsd,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
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
  if (error) {
    if (error.code === '23505' || /duplicate key|order_number_key/i.test(error.message)) {
      throw new Error(`"${parsed.order_number}" numarası zaten kullanılıyor. Farklı bir numara girin.`);
    }
    throw new Error(error.message);
  }

  const { error: itemsErr } = await supabase.from('order_items').insert(
    parsed.items.map((it, i) => ({
      order_id: order.id,
      product_id: it.product_id,
      quantity: it.quantity,
      unit_price: it.unit_price,
      line_discount_percent: it.line_discount_percent,
      line_discount_amount: totals.lines[i].line_discount_amount,
      line_discount_amount_input: it.line_discount_amount_input ?? 0,
      tax_rate: it.tax_rate,
      line_total: totals.lines[i].line_total,
    }))
  );
  if (itemsErr) {
    // Roll back the order header so we don't leave an orphan
    await supabase.from('orders').delete().eq('id', order.id);
    throw new Error(itemsErr.message);
  }

  // Stok hareketi ve gider senkronu bağımsız → paralel
  await Promise.all([
    isStockConsuming(parsed.status)
      ? createOrderStockMovements(supabase, order.id, parsed.items, user?.id)
      : Promise.resolve(),
    parsed.status !== 'cancelled' && parsed.status !== 'draft'
      ? syncAllOrderExpenses(supabase, {
          orderId: order.id, orderNumber: parsed.order_number, orderDate: parsed.order_date,
          commissionAmount, shippingCost: totals.shipping_cost, userId: user?.id,
        })
      : Promise.resolve(),
  ]);

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
  return { id: order.id };
}

export async function updateOrder(id: string, input: OrderInput) {
  const parsed = orderSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const totals = calculateOrderTotals(parsed);
  const customerId = await resolveCustomer(supabase, parsed.customer_name, parsed.customer_phone, parsed.customer_address);

  // Kilitli USD kuru KORUNUR; sadece tutar yeni toplama göre yeniden hesaplanır.
  // Kuru olmayan eski sipariş düzenlenirse bir kez çekip kilitler.
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('usd_rate, status, order_items(product_id, quantity)')
    .eq('id', id)
    .maybeSingle();

  const prevStatus = existingOrder?.status as string | undefined;
  const prevItems = ((existingOrder?.order_items ?? []) as { product_id: string; quantity: number }[]);

  let usdRate = existingOrder?.usd_rate ? Number(existingOrder.usd_rate) : null;
  if (!usdRate) {
    const usd = await getTcmbUsdRate();
    usdRate = usd?.rate ?? null;
  }
  const totalUsd = usdRate ? Math.round((totals.total / usdRate) * 100) / 100 : null;
  const netTotalUsd = usdRate ? Math.round((totals.net_total / usdRate) * 100) / 100 : null;

  const commissionRate = await getPlatformCommissionRate(supabase, parsed.platform_id);
  const commissionAmount = Math.round((totals.net_total * commissionRate / 100) * 100) / 100;

  const { error } = await supabase
    .from('orders')
    .update({
      order_number: parsed.order_number,
      order_date: parsed.order_date,
      platform_id: parsed.platform_id,
      customer_id: customerId,
      shipping_address: parsed.customer_address?.trim() || null,
      delivery_province: normalizeProvince(parsed.delivery_province),
      order_discount_percent: parsed.order_discount_percent,
      order_discount_amount: totals.order_discount_amount,
      order_discount_amount_input: parsed.order_discount_amount_input ?? 0,
      shipping_cost: totals.shipping_cost,
      tax_amount: totals.tax_amount,
      subtotal: totals.subtotal,
      total: totals.total,
      net_total: totals.net_total,
      usd_rate: usdRate,
      total_usd: totalUsd,
      net_total_usd: netTotalUsd,
      commission_rate: commissionRate,
      commission_amount: commissionAmount,
      status: parsed.status,
      payment_status: parsed.payment_status,
      shipment_status: parsed.shipment_status,
      invoice_number: parsed.invoice_number || null,
      tracking_number: parsed.tracking_number || null,
      notes: parsed.notes || null,
      updated_by: user?.id,
    })
    .eq('id', id);
  if (error) {
    // Benzersizlik ihlali: aynı sipariş numarası başka bir kayıtta var
    if (error.code === '23505' || /duplicate key|order_number_key/i.test(error.message)) {
      throw new Error(`"${parsed.order_number}" numarası başka bir siparişte zaten kullanılıyor. Farklı bir numara girin.`);
    }
    throw new Error(error.message);
  }

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
      line_discount_amount_input: it.line_discount_amount_input ?? 0,
      tax_rate: it.tax_rate,
      line_total: totals.lines[i].line_total,
    }))
  );
  if (itemsErr) throw new Error(itemsErr.message);

  // ---------------------------------------------------------------------------
  // STOK: gereksiz hareket yazılmaz.
  // Sipariş oluşturulurken bir kez satış hareketi işlenir. Sonrasında:
  //   • İptale çekilirse → hareketler telafi kaydıyla geri alınır
  //   • İptalden çıkarılırsa → hareketler yeniden işlenir
  //   • Sadece durum değişiyorsa (onaylandı → kargolandı vb.) → HİÇBİR ŞEY yazılmaz
  //   • Kalemler (ürün/adet) değiştiyse → fark yansıtılmak zorunda, yeniden senkronlanır
  // ---------------------------------------------------------------------------
  const wasConsuming = prevStatus ? isStockConsuming(prevStatus) : false;
  const nowConsuming = isStockConsuming(parsed.status);
  const itemsChanged = haveItemsChanged(prevItems, parsed.items);

  if (wasConsuming && !nowConsuming) {
    // İptal edildi → stok geri verilir
    await removeOrderStockMovements(supabase, id);
  } else if (!wasConsuming && nowConsuming) {
    // İptalden çıkarıldı → stok yeniden düşülür
    await createOrderStockMovements(supabase, id, parsed.items, user?.id);
  } else if (nowConsuming && itemsChanged) {
    // Ürün veya adet değişti → defterin ürünle tutarlı kalması için yeniden senkron
    await removeOrderStockMovements(supabase, id);
    await createOrderStockMovements(supabase, id, parsed.items, user?.id);
  }
  // Aksi halde: durum değişikliği stok hareketi doğurmaz.

  // Komisyon giderini güncelle (iptal/taslak ise sil)
  if (parsed.status === 'cancelled' || parsed.status === 'draft') {
    await removeOrderExpenses(supabase, id);
  } else {
    await syncAllOrderExpenses(supabase, {
      orderId: id, orderNumber: parsed.order_number, orderDate: parsed.order_date,
      commissionAmount, shippingCost: totals.shipping_cost, userId: user?.id,
    });
  }

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

/**
 * Toplu sipariş güncelleme (kalemler hariç).
 *
 * Her satır yalnızca DEĞİŞEN alanları gönderir; gönderilmeyen alanlara
 * dokunulmaz. Durum değişikliklerinde stok ve gider senkronu doğru yönetilir:
 *   • İptale çekilen sipariş → stok geri verilir, otomatik giderleri silinir
 *   • İptalden çıkarılan sipariş → stok yeniden düşülür, giderleri yeniden yazılır
 *   • Sadece diğer alanlar (il, ödeme durumu, takip no…) değişmişse stok/gidere dokunulmaz
 *
 * Müşteri adı/telefon/adres değişiklikleri ilgili müşteri kaydına yazılır.
 */
export type BulkOrderPatch = {
  id: string;
  order_date?: string;
  platform_id?: string;
  delivery_province?: string | null;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  status?: OrderInput['status'];
  payment_status?: string;
  shipment_status?: string;
  invoice_number?: string;
  tracking_number?: string;
  notes?: string;
};

export async function bulkUpdateOrders(patches: BulkOrderPatch[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!patches.length) return { updated: 0, errors: [] as string[] };

  // Etkilenen siparişlerin mevcut durumlarını ve kalemlerini önden çek
  const ids = patches.map((p) => p.id);
  const { data: currentOrders, error: fetchErr } = await supabase
    .from('orders')
    .select('id, order_number, order_date, status, customer_id, platform_id, shipping_cost, commission_rate, net_total, order_items(product_id, quantity)')
    .in('id', ids);
  if (fetchErr) throw new Error(fetchErr.message);

  const currentById = new Map((currentOrders ?? []).map((o) => [o.id, o]));
  const errors: string[] = [];
  let updated = 0;

  for (const patch of patches) {
    const current = currentById.get(patch.id);
    if (!current) { errors.push(`${patch.id}: sipariş bulunamadı`); continue; }

    try {
      // 1) Müşteri bilgisi değiştiyse müşteri kaydını güncelle
      if (
        (patch.customer_name !== undefined || patch.customer_phone !== undefined || patch.customer_address !== undefined) &&
        current.customer_id
      ) {
        const cpatch: Record<string, string | null> = {};
        if (patch.customer_name !== undefined) cpatch.name = patch.customer_name.trim();
        if (patch.customer_phone !== undefined) cpatch.phone = patch.customer_phone.trim() || null;
        if (patch.customer_address !== undefined) cpatch.shipping_address = patch.customer_address.trim() || null;
        if (Object.keys(cpatch).length) {
          await supabase.from('customers').update(cpatch).eq('id', current.customer_id);
        }
      }

      // 2) Sipariş başlık alanlarını güncelle (yalnızca gönderilenler)
      const upd: Record<string, unknown> = { updated_by: user?.id };
      if (patch.order_date !== undefined) upd.order_date = patch.order_date;
      if (patch.platform_id !== undefined) upd.platform_id = patch.platform_id;
      if (patch.delivery_province !== undefined) upd.delivery_province = normalizeProvince(patch.delivery_province);
      if (patch.status !== undefined) upd.status = patch.status;
      if (patch.payment_status !== undefined) upd.payment_status = patch.payment_status;
      if (patch.shipment_status !== undefined) upd.shipment_status = patch.shipment_status;
      if (patch.invoice_number !== undefined) upd.invoice_number = patch.invoice_number.trim() || null;
      if (patch.tracking_number !== undefined) upd.tracking_number = patch.tracking_number.trim() || null;
      if (patch.notes !== undefined) upd.notes = patch.notes.trim() || null;
      if (patch.customer_address !== undefined) upd.shipping_address = patch.customer_address.trim() || null;

      // Platform değiştiyse komisyon oranını yeniden kilitle
      if (patch.platform_id !== undefined && patch.platform_id !== current.platform_id) {
        const rate = await getPlatformCommissionRate(supabase, patch.platform_id);
        upd.commission_rate = rate;
        upd.commission_amount = Math.round((Number(current.net_total ?? 0) * rate / 100) * 100) / 100;
      }

      const { error: updErr } = await supabase.from('orders').update(upd).eq('id', patch.id);
      if (updErr) { errors.push(`${current.order_number}: ${updErr.message}`); continue; }

      // 3) Durum değişimi → stok ve gider senkronu
      if (patch.status !== undefined && patch.status !== current.status) {
        const wasConsuming = isStockConsuming(current.status);
        const nowConsuming = isStockConsuming(patch.status);
        const items = ((current.order_items ?? []) as { product_id: string; quantity: number }[])
          .map((it) => ({ product_id: it.product_id, quantity: Number(it.quantity) }));

        if (wasConsuming && !nowConsuming) {
          await removeOrderStockMovements(supabase, patch.id);
          await removeOrderExpenses(supabase, patch.id);
        } else if (!wasConsuming && nowConsuming) {
          await createOrderStockMovements(supabase, patch.id, items, user?.id);
          const commissionAmount = Math.round((Number(current.net_total ?? 0) * Number(current.commission_rate ?? 0) / 100) * 100) / 100;
          await syncAllOrderExpenses(supabase, {
            orderId: patch.id,
            orderNumber: current.order_number,
            orderDate: patch.order_date ?? current.order_date,
            commissionAmount,
            shippingCost: Number(current.shipping_cost ?? 0),
            userId: user?.id,
          });
        }
      }

      updated++;
    } catch (e) {
      errors.push(`${current.order_number}: ${e instanceof Error ? e.message : 'güncellenemedi'}`);
    }
  }

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/inventory');
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
  return { updated, errors };
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
  await removeOrderExpenses(supabase, id);

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function softDeleteOrders(ids: string[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Restore stock + remove commission expense for each order before hiding it
  for (const id of ids) {
    await removeOrderStockMovements(supabase, id);
    await removeOrderExpenses(supabase, id);
  }

  const { error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(error.message);

  revalidatePath('/orders');
  revalidatePath('/products');
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function generateOrderNumber() {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const prefix = `SIP-${year}-`;

  // Sayıya göre değil, EN YÜKSEK mevcut numaraya göre üret.
  // Sayıya göre üretmek, silinen/iptal edilen siparişler yüzünden çakışmaya
  // yol açar (orders_order_number_key benzersizlik ihlali). Soft-delete edilmiş
  // kayıtların numaraları da tabloda kaldığı için onları da hesaba katmalıyız.
  const { data } = await supabase
    .from('orders')
    .select('order_number')
    .ilike('order_number', `${prefix}%`)
    .is('deleted_at', null)
    .order('order_number', { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (data && data.length) {
    const last = data[0].order_number as string;
    const lastSeq = parseInt(last.slice(prefix.length), 10);
    if (Number.isFinite(lastSeq)) nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}
