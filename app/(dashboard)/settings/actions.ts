'use server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireEdit } from '@/lib/auth/permissions';

export interface CompanySettings {
  company_name?: string;
  address?: string;
  tax_number?: string;
  email?: string;
  phone?: string;
  default_currency?: string;
  default_incoterm?: string;
}

export async function getSettings(): Promise<CompanySettings> {
  const supabase = await createClient();
  const { data } = await supabase.from('app_settings').select('value').eq('key', 'company').maybeSingle();
  return (data?.value as CompanySettings) ?? {};
}

export async function saveSettings(value: CompanySettings) {
  await requireEdit();
  const supabase = await createClient();
  const { error } = await supabase.from('app_settings').upsert({ key: 'company', value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath('/settings');
}
