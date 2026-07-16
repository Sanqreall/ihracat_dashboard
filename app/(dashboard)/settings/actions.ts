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

// ---------------------------------------------------------------------------
// Yedekleme / Geri Yükleme / Sıfırlama
// ---------------------------------------------------------------------------

type SB = Awaited<ReturnType<typeof createClient>>;

// Ebeveyn → çocuk sırası (insert bu sırayla, delete tersiyle yapılır)
const BACKUP_TABLES = [
  'company_settings',
  'categories',
  'series',
  'platforms',
  'expense_categories',
  'customers',
  'products',
  'product_images',
  'orders',
  'order_items',
  'production_batches',
  'returns',
  'return_items',
  'expenses',
  'stock_movements',
] as const;

// Sıfırlamada silinen operasyonel tablolar (tanımlar ve ayarlar korunur)
const OPERATIONAL_TABLES = [
  'stock_movements',
  'return_items',
  'returns',
  'order_items',
  'orders',
  'production_batches',
  'expenses',
  'product_images',
  'products',
  'customers',
] as const;

async function fetchAllRows(supabase: SB, table: string) {
  const pageSize = 1000;
  let from = 0;
  const all: Record<string, unknown>[] = [];
  // Sayfalayarak tüm satırları çek
  for (;;) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...((data as Record<string, unknown>[]) ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function deleteAllRows(supabase: SB, table: string) {
  const { error } = await supabase.from(table).delete().not('id', 'is', null);
  if (error) throw new Error(`${table} silinemedi: ${error.message}`);
}

export async function getBackupData() {
  const supabase = await createClient();
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const table of BACKUP_TABLES) {
    tables[table] = await fetchAllRows(supabase, table);
  }
  return {
    app: 'yonga-erp',
    version: 1,
    exported_at: new Date().toISOString(),
    tables,
  };
}

/**
 * Tüm operasyonel veriyi siler. Tanımlar (kategori, seri, platform, gider
 * kategorileri), firma ayarları ve kullanıcılar korunur.
 */
export async function resetAllData() {
  const supabase = await createClient();
  for (const table of OPERATIONAL_TABLES) {
    await deleteAllRows(supabase, table);
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

/**
 * Yedekten geri yükleme: MEVCUT TÜM VERİYİ (tanımlar dahil) siler ve yedeği yükler.
 *
 * Stok notu: stock_movements insert edilirken trigger ürün stoklarını yeniden
 * uygular; bu yüzden en sonda ürünlerin stok kolonları yedekteki değerlere
 * geri yazılır — böylece hem hareket geçmişi hem nihai stok birebir korunur.
 */
export async function restoreBackup(payload: {
  app?: string;
  version?: number;
  tables: Record<string, Record<string, unknown>[]>;
}) {
  if (!payload || typeof payload !== 'object' || !payload.tables) {
    throw new Error('Geçersiz yedek dosyası: "tables" alanı bulunamadı');
  }
  if (payload.app && payload.app !== 'yonga-erp') {
    throw new Error('Bu dosya bir Yonga ERP yedeği değil');
  }

  const supabase = await createClient();

  // 1) Her şeyi sil (çocuklardan ebeveynlere)
  for (const table of [...BACKUP_TABLES].reverse()) {
    await deleteAllRows(supabase, table);
  }

  // 2) Sırayla yükle (kullanıcı referansları farklı projede kırılmasın diye temizlenir)
  const counts: Record<string, number> = {};
  const CHUNK = 500;
  for (const table of BACKUP_TABLES) {
    const rows = (payload.tables[table] ?? []).map((row) => {
      const clean: Record<string, unknown> = { ...row };
      delete clean.created_by;
      delete clean.updated_by;
      return clean;
    });
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase.from(table).insert(chunk);
      if (error) throw new Error(`${table} yüklenemedi (satır ${i + 1}+): ${error.message}`);
    }
    counts[table] = rows.length;
  }

  // 3) Ürün stoklarını yedekteki nihai değerlere sabitle
  //    (movement trigger'ları insert sırasında stokları değiştirdi)
  const backedUpProducts = (payload.tables['products'] ?? []) as {
    id: string; current_stock?: number; production_stock?: number;
  }[];
  for (const p of backedUpProducts) {
    const { error } = await supabase
      .from('products')
      .update({
        current_stock: p.current_stock ?? 0,
        production_stock: p.production_stock ?? 0,
      })
      .eq('id', p.id);
    if (error) throw new Error(`Ürün stoğu geri yazılamadı: ${error.message}`);
  }

  revalidatePath('/', 'layout');
  return { ok: true, counts };
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
