'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { productSchema, type ProductInput } from '@/lib/validations/product';

export async function listProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(name), series(name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function listProductsLite() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, product_code, name, sales_price, tax_rate, current_stock')
    .is('deleted_at', null)
    .eq('status', 'active')
    .order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCategoriesAndSeries() {
  const supabase = await createClient();
  const [{ data: categories }, { data: series }] = await Promise.all([
    supabase.from('categories').select('id, name').is('deleted_at', null),
    supabase.from('series').select('id, name').is('deleted_at', null),
  ]);
  return { categories: categories ?? [], series: series ?? [] };
}

export async function createProduct(input: ProductInput) {
  const parsed = productSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('products').insert({
    ...parsed,
    created_by: user?.id,
    updated_by: user?.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/products');
}

export async function updateProduct(id: string, input: ProductInput) {
  const parsed = productSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase.from('products').update({
    ...parsed,
    updated_by: user?.id,
  }).eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/products');
}

export async function softDeleteProducts(ids: string[]) {
  const supabase = await createClient();
  const { error } = await supabase.from('products').update({ deleted_at: new Date().toISOString() }).in('id', ids);
  if (error) throw new Error(error.message);
  revalidatePath('/products');
}

export async function adjustStock(productId: string, quantity: number, notes?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('stock_movements').insert({
    product_id: productId,
    movement_type: 'adjustment',
    quantity,
    notes,
    created_by: user?.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/products');
}

export async function bulkImportProducts(rows: ProductInput[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const parsedRows = rows.map((r) => ({
    ...productSchema.parse(r),
    created_by: user?.id,
    updated_by: user?.id,
  }));

  const { error } = await supabase
    .from('products')
    .upsert(parsedRows, { onConflict: 'product_code' });
  if (error) throw new Error(error.message);

  revalidatePath('/products');
  return { imported: parsedRows.length };
}
