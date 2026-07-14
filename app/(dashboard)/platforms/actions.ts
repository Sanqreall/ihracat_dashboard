'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { platformSchema, type PlatformInput } from '@/lib/validations/platform';

export async function listPlatforms() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('platforms').select('*').is('deleted_at', null).order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function listPlatformsLite() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('platforms').select('id, name, commission_rate').eq('is_active', true).is('deleted_at', null).order('name');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPlatform(input: PlatformInput) {
  const parsed = platformSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('platforms').insert(parsed);
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}

export async function updatePlatform(id: string, input: PlatformInput) {
  const parsed = platformSchema.parse(input);
  const supabase = await createClient();
  const { error } = await supabase.from('platforms').update(parsed).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}

export async function togglePlatformActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from('platforms').update({ is_active: isActive }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}

export async function softDeletePlatform(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('platforms').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/platforms');
}
