'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireEdit } from '@/lib/auth/permissions';
import { productSchema, type ProductInput } from '@/lib/validations/product';

export async function listProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listProductsLite() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('products')
    .select('id, product_code, manufacturing_code, name_tr, name_en, unit, default_price, default_currency')
    .is('deleted_at', null)
    .order('name_tr');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createProduct(input: ProductInput) {
  await requireEdit();
  const parsed = productSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.from('products').insert(parsed).select('id').single();
  if (error) throw new Error(error.message);
  revalidatePath('/products');
  return data;
}

export async function updateProduct(id: string, input: ProductInput) {
  await requireEdit();
  const parsed = productSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('products').update(parsed).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/products');
}

export async function softDeleteProducts(ids: string[]) {
  await requireEdit();
  const supabase = await createClient();
  const { error } = await supabase
    .from('products')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids);
  if (error) throw new Error(error.message);
  revalidatePath('/products');
}
