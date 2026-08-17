'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireEdit } from '@/lib/auth/permissions';
import { bankSchema, type BankInput } from '@/lib/validations/bank';

export async function listBanks() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('bank_accounts').select('*').is('deleted_at', null).order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}
export async function createBank(input: BankInput) {
  await requireEdit();
  const parsed = bankSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('bank_accounts').insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath('/bank-accounts');
}
export async function updateBank(id: string, input: BankInput) {
  await requireEdit();
  const parsed = bankSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('bank_accounts').update(parsed).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/bank-accounts');
}
export async function softDeleteBank(id: string) {
  await requireEdit();
  const supabase = await createClient();
  const { error } = await supabase.from('bank_accounts').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/bank-accounts');
}
