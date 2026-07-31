'use server';

import { createClient } from '@/lib/supabase/server';

export async function listCashflow() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('payments')
    .select('id, amount, currency, due_date, status, method, orders(order_number, customers(name, code))')
    .eq('status', 'pending')
    .order('due_date', { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
