'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const expenseSchema = z.object({
  expense_date: z.string().min(1, 'Tarih zorunlu'),
  category_id: z.string().uuid('Kategori seçiniz'),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().min(0.01, 'Tutar 0 olamaz'),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export async function listExpenses() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expenses')
    .select('*, expense_categories(name)')
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listExpenseCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expense_categories')
    .select('id, name')
    .eq('is_active', true)
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createExpense(input: ExpenseInput) {
  const parsed = expenseSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('expenses').insert({ ...parsed, created_by: user?.id });
  if (error) throw new Error(error.message);
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const parsed = expenseSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('expenses').update(parsed).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function deleteExpenses(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.from('expenses').delete().in('id', ids);
  if (error) throw new Error(error.message);
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}
