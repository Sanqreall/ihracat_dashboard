'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireEdit } from '@/lib/auth/permissions';
import { orderSchema, type OrderInput } from '@/lib/validations/order';

export async function listOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, customers(name, code), order_items(quantity, unit_price, discount), order_additional_costs(amount), order_shipments(shipment_no), payments(amount, status, currency)')
    .is('deleted_at', null)
    .order('order_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getOrder(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*), order_shipments(*), order_additional_costs(*), payment_plan_items(*)')
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function replaceChildren(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  parsed: OrderInput,
) {
  // Kalemler + ek maliyetler + ödeme planı: tümünü sil, yeniden ekle (basit ve tutarlı).
  await supabase.from('order_items').delete().eq('order_id', orderId);
  await supabase.from('order_shipments').delete().eq('order_id', orderId);
  await supabase.from('order_additional_costs').delete().eq('order_id', orderId);
  await supabase.from('payment_plan_items').delete().eq('order_id', orderId);

  if (parsed.items.length) {
    const { error } = await supabase.from('order_items').insert(
      parsed.items.map((it, i) => ({
        order_id: orderId,
        product_id: it.product_id || null,
        product_code: it.product_code || null,
        manufacturing_code: it.manufacturing_code || null,
        name_tr: it.name_tr || null,
        name_en: it.name_en || null,
        unit: it.unit || 'adet',
        quantity: it.quantity,
        unit_price: it.unit_price,
        discount: it.discount,
        shipment_no: it.shipment_no ?? null,
        sort_order: it.sort_order ?? i,
      })),
    );
    if (error) throw new Error(error.message);
  }

    if (parsed.shipments.length) {
    const { error } = await supabase.from('order_shipments').insert(
      parsed.shipments.map((s) => ({
        order_id: orderId,
        shipment_no: s.shipment_no,
        name: s.name || null,
        notes: s.notes || null,
        shipment_date: s.shipment_date || null,
        actual_shipment_date: s.actual_shipment_date || null,
      })),
    );
    if (error) throw new Error(error.message);
  }

if (parsed.additional_costs.length) {
    const { error } = await supabase.from('order_additional_costs').insert(
      parsed.additional_costs.map((c) => ({ order_id: orderId, description: c.description, amount: c.amount })),
    );
    if (error) throw new Error(error.message);
  }

  if (parsed.payment_plan.length) {
    const { error } = await supabase.from('payment_plan_items').insert(
      parsed.payment_plan.map((p, i) => ({
        order_id: orderId,
        type: p.type,
        amount: p.amount,
        percentage: p.percentage ?? null,
        due_date: p.due_date || null,
        method: p.method || 'bank_transfer',
        notes: p.notes || null,
        shipment_no: p.shipment_no ?? null,
        sort_order: p.sort_order ?? i,
      })),
    );
    if (error) throw new Error(error.message);
  }
}

function headerPayload(parsed: OrderInput) {
  return {
    order_number: parsed.order_number || null,
    customer_id: parsed.customer_id,
    status: parsed.status,
    currency: parsed.currency,
    vat_rate: parsed.vat_rate,
    incoterms: parsed.incoterms || null,
    order_date: parsed.order_date || null,
    shipment_date: parsed.shipment_date || null,
    actual_shipment_date: parsed.actual_shipment_date || null,
    shipping_method: parsed.shipping_method || null,
    port_of_loading: parsed.port_of_loading || null,
    port_of_discharge: parsed.port_of_discharge || null,
    bill_of_lading: parsed.bill_of_lading || null,
    invoice_number: parsed.invoice_number || null,
    notes: parsed.notes || null,
    discount_type: parsed.discount_type || null,
    discount_value: parsed.discount_value,
    payment_basis: parsed.payment_basis || 'order',
  };
}

export async function createOrder(input: OrderInput) {
  await requireEdit();
  const parsed = orderSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: order, error } = await supabase
    .from('orders')
    .insert({ ...headerPayload(parsed), created_by: user?.id, updated_by: user?.id })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') throw new Error(`"${parsed.order_number}" numarası zaten kullanılıyor.`);
    throw new Error(error.message);
  }

  try {
    await replaceChildren(supabase, order.id, parsed);
  } catch (e) {
    await supabase.from('orders').delete().eq('id', order.id);
    throw e;
  }

  revalidatePath('/orders');
  return { id: order.id };
}

export async function updateOrder(id: string, input: OrderInput) {
  await requireEdit();
  const parsed = orderSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('orders')
    .update({ ...headerPayload(parsed), updated_by: user?.id })
    .eq('id', id);
  if (error) {
    if (error.code === '23505') throw new Error(`"${parsed.order_number}" numarası başka siparişte kullanılıyor.`);
    throw new Error(error.message);
  }

  await replaceChildren(supabase, id, parsed);
  revalidatePath('/orders');
}

export async function cancelOrder(id: string) {
  await requireEdit();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('orders').update({ status: 'cancelled', updated_by: user?.id }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/orders');
}

export async function softDeleteOrders(ids: string[]) {
  await requireEdit();
  const supabase = await createClient();
  const { error } = await supabase
    .from('orders')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(error.message);
  revalidatePath('/orders');
}

export async function generateOrderNumber() {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const prefix = `EXP-${year}-`;
  const { data } = await supabase
    .from('orders')
    .select('order_number')
    .ilike('order_number', `${prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1);
  let next = 1;
  if (data && data.length) {
    const seq = parseInt(String(data[0].order_number).slice(prefix.length), 10);
    if (Number.isFinite(seq)) next = seq + 1;
  }
  return `${prefix}${String(next).padStart(4, '0')}`;
}
