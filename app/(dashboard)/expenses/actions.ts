'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const expenseSchema = z.object({
  expense_date: z.string().min(1, 'Tarih zorunlu'),
  category_id: z.string().uuid('Kategori seçiniz'),
  description: z.string().optional().nullable(),
  amount: z.coerce.number().min(0.01, 'Tutar 0 olamaz'),
  // Aylık gider: raporlarda ayın günlerine eşit bölünür (reklam, ajans vb.)
  is_monthly: z.coerce.boolean().default(false),
  period_month: z.string().optional().nullable(),
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

  const rows = data ?? [];

  // Siparişten doğan otomatik giderler (kargo, komisyon) için sipariş numarasını çöz
  const orderIds = Array.from(
    new Set(rows.filter((r) => r.reference_type === 'order' && r.reference_id).map((r) => r.reference_id as string))
  );
  const orderMap = new Map<string, string>();
  if (orderIds.length) {
    const { data: orders } = await supabase.from('orders').select('id, order_number').in('id', orderIds);
    for (const o of orders ?? []) orderMap.set(o.id, o.order_number);
  }

  return rows.map((r) => {
    const orderNumber = r.reference_type === 'order' && r.reference_id ? orderMap.get(r.reference_id) ?? null : null;
    return {
      ...r,
      order_number: orderNumber,
      order_href: orderNumber ? `/orders?q=${encodeURIComponent(orderNumber)}` : null,
      is_auto: !!orderNumber,
    };
  });
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
  const periodMonth = parsed.is_monthly
    ? (parsed.period_month || parsed.expense_date).slice(0, 7) + '-01'
    : null;
  const { error } = await supabase.from('expenses').insert({
    expense_date: parsed.expense_date,
    category_id: parsed.category_id,
    description: parsed.description,
    amount: parsed.amount,
    is_monthly: parsed.is_monthly,
    period_month: periodMonth,
    created_by: user?.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

export async function updateExpense(id: string, input: ExpenseInput) {
  const parsed = expenseSchema.parse(input);
  const supabase = await createClient();
  const periodMonth = parsed.is_monthly
    ? (parsed.period_month || parsed.expense_date).slice(0, 7) + '-01'
    : null;
  const { error } = await supabase.from('expenses').update({
    expense_date: parsed.expense_date,
    category_id: parsed.category_id,
    description: parsed.description,
    amount: parsed.amount,
    is_monthly: parsed.is_monthly,
    period_month: periodMonth,
  }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
  revalidatePath('/reports');
}

export async function deleteExpenses(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.from('expenses').delete().in('id', ids);
  if (error) throw new Error(error.message);
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export type ExpenseImportRow = {
  expense_date: string;
  category_name?: string;
  description?: string;
  amount: number;
};

/** Excel'den toplu gider aktarımı. Bulunmayan kategoriler otomatik oluşturulur. */
export async function bulkImportExpenses(rows: ExpenseImportRow[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: cats } = await supabase.from('expense_categories').select('id, name');
  const catByName = new Map((cats ?? []).map((c) => [String(c.name).trim().toLocaleLowerCase('tr'), c.id]));

  const inserts: Record<string, unknown>[] = [];
  const errors: string[] = [];

  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (amount <= 0) { errors.push(`Geçersiz tutar: ${row.description ?? ''}`); continue; }

    let categoryId: string | null = null;
    const catName = String(row.category_name ?? '').trim();
    if (catName) {
      const key = catName.toLocaleLowerCase('tr');
      categoryId = catByName.get(key) ?? null;
      if (!categoryId) {
        const { data: created, error } = await supabase
          .from('expense_categories').insert({ name: catName }).select('id').single();
        if (error) { errors.push(`Kategori oluşturulamadı "${catName}": ${error.message}`); continue; }
        categoryId = created.id;
        catByName.set(key, created.id);
      }
    }

    inserts.push({
      expense_date: String(row.expense_date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
      category_id: categoryId,
      description: row.description || null,
      amount,
      created_by: user?.id,
    });
  }

  if (inserts.length) {
    const { error } = await supabase.from('expenses').insert(inserts);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/expenses');
  revalidatePath('/reports');
  return { imported: inserts.length, errors };
}
