'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const settingsSchema = z.object({
  company_name: z.string().min(1, 'Firma adı zorunlu'),
  default_currency: z.string().min(1),
  default_tax_rate: z.coerce.number().min(0).max(100),
  shipping_price_per_desi: z.coerce.number().min(0),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export async function getSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateSettings(input: SettingsInput) {
  const parsed = settingsSchema.parse(input);
  const supabase = await createClient();
  const existing = await getSettings();
  if (existing) {
    const { error } = await supabase.from('company_settings').update(parsed).eq('id', existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('company_settings').insert(parsed);
    if (error) throw new Error(error.message);
  }
  revalidatePath('/settings');
}

// ---- Categories ----
export async function listCategories() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('categories').select('*').is('deleted_at', null).order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createCategory(name: string) {
  if (!name?.trim()) throw new Error('Kategori adı zorunlu');
  const supabase = await createClient();
  const { error } = await supabase.from('categories').insert({ name: name.trim() });
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
  revalidatePath('/products');
}

export async function deleteCategory(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('categories').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
  revalidatePath('/products');
}

// ---- Series ----
export async function listSeries() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('series').select('*').is('deleted_at', null).order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createSeries(name: string) {
  if (!name?.trim()) throw new Error('Seri adı zorunlu');
  const supabase = await createClient();
  const { error } = await supabase.from('series').insert({ name: name.trim() });
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
  revalidatePath('/products');
}

export async function deleteSeries(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('series').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
  revalidatePath('/products');
}

// ---- Users ----
export async function listProfiles() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('profiles').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateProfileRole(id: string, role: 'admin' | 'manager' | 'employee') {
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}
