'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireEdit } from '@/lib/auth/permissions';

export async function listRates() {
  const supabase = await createClient();
  const { data, error } = await supabase.from('exchange_rates').select('*').order('currency');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function upsertRate(currency: string, rate_to_usd: number, source?: string) {
  await requireEdit();
  const cur = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(cur)) throw new Error('Para birimi 3 harfli olmalı (örn. USD)');
  if (!(rate_to_usd > 0)) throw new Error('Kur 0’dan büyük olmalı');
  const supabase = await createClient();
  const { error } = await supabase.from('exchange_rates').upsert({
    currency: cur, rate_to_usd, source: source || 'manuel', last_update: new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  revalidatePath('/exchange-rates');
}

export async function deleteRate(currency: string) {
  await requireEdit();
  if (currency === 'USD') throw new Error('USD taban para birimi, silinemez');
  const supabase = await createClient();
  const { error } = await supabase.from('exchange_rates').delete().eq('currency', currency);
  if (error) throw new Error(error.message);
  revalidatePath('/exchange-rates');
}
