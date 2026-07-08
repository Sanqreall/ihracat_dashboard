'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { customerSchema, type CustomerInput } from '@/lib/validations/customer';

export async function listCustomers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listCustomersLite() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, company')
    .is('deleted_at', null)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCustomer(input: CustomerInput) {
  const parsed = customerSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.from('customers').insert(parsed).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/customers');
  return data;
}

export async function updateCustomer(id: string, input: CustomerInput) {
  const parsed = customerSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('customers').update(parsed).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/customers');
}

export async function softDeleteCustomers(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).in('id', ids);
  if (error) throw new Error(error.message);
  revalidatePath('/customers');
}
