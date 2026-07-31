'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireEdit } from '@/lib/auth/permissions';
import { paymentSchema, type PaymentInput } from '@/lib/validations/payment';

export async function listPayments() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payments')
    .select('*, orders(order_number, currency, customers(name, code)), bank_accounts(name)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listOrdersForPayment() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('orders')
    .select('id, order_number, currency, customers(name, code)')
    .is('deleted_at', null)
    .order('order_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((o: any) => ({
    id: o.id, order_number: o.order_number, currency: o.currency,
    customer_name: o.customers?.name ?? '', customer_code: o.customers?.code ?? '',
  }));
}

export async function listBankAccountsLite() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id, name, bank_name, currency')
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

function payload(parsed: PaymentInput) {
  return {
    order_id: parsed.order_id,
    plan_item_id: parsed.plan_item_id || null,
    type: parsed.type || null,
    amount: parsed.amount,
    currency: parsed.currency,
    method: parsed.method,
    status: parsed.status,
    due_date: parsed.due_date || null,
    paid_date: parsed.paid_date || null,
    bank_account_id: parsed.bank_account_id || null,
    reference_number: parsed.reference_number || null,
    shipment_no: parsed.shipment_no ?? null,
    notes: parsed.notes || null,
  };
}

export async function createPayment(input: PaymentInput) {
  await requireEdit();
  const parsed = paymentSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('payments').insert(payload(parsed));
  if (error) throw new Error(error.message);
  revalidatePath('/payments');
  revalidatePath('/cashflow');
}

export async function updatePayment(id: string, input: PaymentInput) {
  await requireEdit();
  const parsed = paymentSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('payments').update(payload(parsed)).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/payments');
  revalidatePath('/cashflow');
}

export async function deletePayments(ids: string[]) {
  await requireEdit();
  const supabase = await createClient();
  const { error } = await supabase.from('payments').delete().in('id', ids);
  if (error) throw new Error(error.message);
  revalidatePath('/payments');
  revalidatePath('/cashflow');
}

/** Bir ödemeyi hızlıca "tahsil edildi" yapar. */
export async function markPaid(id: string, paidDate?: string, bankAccountId?: string) {
  await requireEdit();
  const supabase = await createClient();
  const { error } = await supabase
    .from('payments')
    .update({
      status: 'paid',
      paid_date: paidDate || new Date().toISOString().slice(0, 10),
      ...(bankAccountId ? { bank_account_id: bankAccountId } : {}),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/payments');
  revalidatePath('/cashflow');
}

/**
 * Bir siparişin ödeme planından (payment_plan_items) bekleyen ödemeler üretir.
 * Zaten o plan kalemine bağlı ödeme varsa atlanır (tekrar üretimi önler).
 */
export async function generatePaymentsFromPlan(orderId: string) {
  await requireEdit();
  const supabase = await createClient();

  const { data: order, error: ordErr } = await supabase
    .from('orders').select('currency').eq('id', orderId).single();
  if (ordErr) throw new Error(ordErr.message);

  const { data: plan, error: planErr } = await supabase
    .from('payment_plan_items').select('*').eq('order_id', orderId).order('sort_order');
  if (planErr) throw new Error(planErr.message);
  if (!plan?.length) return { created: 0, skipped: 0 };

  const { data: existing } = await supabase
    .from('payments').select('plan_item_id').eq('order_id', orderId).not('plan_item_id', 'is', null);
  const done = new Set((existing ?? []).map((p) => p.plan_item_id));

  const toCreate = plan.filter((p) => !done.has(p.id)).map((p) => ({
    order_id: orderId,
    plan_item_id: p.id,
    type: p.type,
    amount: p.amount,
    currency: order.currency,
    method: p.method || 'bank_transfer',
    status: 'pending' as const,
    due_date: p.due_date || null,
    shipment_no: p.shipment_no ?? null,
    notes: p.notes || null,
  }));

  if (toCreate.length) {
    const { error } = await supabase.from('payments').insert(toCreate);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/payments');
  revalidatePath('/cashflow');
  return { created: toCreate.length, skipped: plan.length - toCreate.length };
}
