'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const batchSchema = z.object({
  product_id: z.string().uuid('Ürün seçiniz'),
  planned_quantity: z.coerce.number().int().min(1, 'Adet en az 1'),
  production_cost: z.coerce.number().min(0).default(0),
  notes: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
});

export type BatchInput = z.infer<typeof batchSchema>;

export async function listBatches() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('production_batches')
    .select('*, products(product_code, name)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function createBatch(input: BatchInput) {
  const parsed = batchSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { count } = await supabase.from('production_batches').select('*', { count: 'exact', head: true });
  const batchNumber = `URT-${new Date().getFullYear()}-${String((count ?? 0) + 1).padStart(5, '0')}`;

  const { error } = await supabase.from('production_batches').insert({
    batch_number: batchNumber,
    product_id: parsed.product_id,
    planned_quantity: parsed.planned_quantity,
    production_cost: parsed.production_cost,
    notes: parsed.notes || null,
    started_at: parsed.started_at || null,
    status: 'queued',
    created_by: user?.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath('/production');
}

export async function startProduction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: batch, error: selErr } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id, planned_quantity, status')
    .eq('id', id)
    .single();
  if (selErr) throw new Error(selErr.message);
  if (batch.status !== 'queued') throw new Error('Sadece kuyruktaki emirler başlatılabilir');

  const { error } = await supabase
    .from('production_batches')
    .update({ status: 'in_production', started_at: new Date().toISOString().slice(0, 10) })
    .eq('id', id)
    .eq('status', 'queued');
  if (error) throw new Error(error.message);

  // WIP girişi: ürün "üretimde" stoğuna eklenir (trigger production_stock'u artırır)
  const { error: movErr } = await supabase.from('stock_movements').insert({
    product_id: batch.product_id,
    movement_type: 'production',
    quantity: Math.abs(batch.planned_quantity),
    reference_type: 'production',
    reference_id: id,
    notes: `Üretim başladı: ${batch.batch_number}`,
    created_by: user?.id,
  });
  if (movErr) throw new Error(movErr.message);

  revalidatePath('/production');
  revalidatePath('/inventory');
  revalidatePath('/products');
}

export async function completeProduction(id: string, completedQuantity: number) {
  if (!completedQuantity || completedQuantity < 1) throw new Error('Tamamlanan adet en az 1 olmalı');
  const supabase = await createClient();
  const { error } = await supabase
    .from('production_batches')
    .update({
      status: 'completed',
      completed_quantity: completedQuantity,
      completed_at: new Date().toISOString().slice(0, 10),
    })
    .eq('id', id)
    .eq('status', 'in_production');
  if (error) throw new Error(error.message);
  revalidatePath('/production');
}

/** Var olan WIP (üretimde) girişini sıfırlar — start hareketi yoksa dokunmaz. */
async function clearWipMovement(
  supabase: Awaited<ReturnType<typeof createClient>>,
  batch: { id: string; batch_number: string; product_id: string; planned_quantity: number },
  note: string,
  userId?: string
) {
  const { data: startMov } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('reference_type', 'production')
    .eq('reference_id', batch.id)
    .eq('movement_type', 'production')
    .gt('quantity', 0)
    .limit(1)
    .maybeSingle();
  if (!startMov) return; // eski kayıt, WIP girişi hiç yapılmamış

  const { error } = await supabase.from('stock_movements').insert({
    product_id: batch.product_id,
    movement_type: 'production',
    quantity: -Math.abs(batch.planned_quantity),
    reference_type: 'production',
    reference_id: batch.id,
    notes: `${note}: ${batch.batch_number}`,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function transferBatchToStock(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: batch, error: selErr } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id, planned_quantity, completed_quantity, production_cost, status')
    .eq('id', id)
    .single();
  if (selErr) throw new Error(selErr.message);
  if (batch.status !== 'completed') throw new Error('Sadece tamamlanmış üretimler stoğa aktarılabilir');
  if (!batch.completed_quantity || batch.completed_quantity < 1) throw new Error('Tamamlanan adet bulunamadı');

  // 1) "Üretimde" stoğunu düş
  await clearWipMovement(supabase, batch, 'Üretim tamamlandı, WIP kapatıldı', user?.id);

  // 2) Tamamlanan adedi satılabilir stoğa ekle (birim maliyetle)
  const unitCost = batch.completed_quantity > 0
    ? Number(batch.production_cost ?? 0) / batch.completed_quantity
    : null;

  const { error: movErr } = await supabase.from('stock_movements').insert({
    product_id: batch.product_id,
    movement_type: 'transfer',
    quantity: Math.abs(batch.completed_quantity),
    unit_cost: unitCost,
    reference_type: 'production',
    reference_id: id,
    notes: `Üretim stoğa aktarıldı: ${batch.batch_number}`,
    created_by: user?.id,
  });
  if (movErr) throw new Error(movErr.message);

  const { error: updErr } = await supabase
    .from('production_batches')
    .update({ status: 'transferred', transferred_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'completed');
  if (updErr) throw new Error(updErr.message);

  revalidatePath('/production');
  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/dashboard');
}

export async function cancelBatch(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: batch, error: selErr } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id, planned_quantity, status')
    .eq('id', id)
    .single();
  if (selErr) throw new Error(selErr.message);
  if (!['queued', 'in_production'].includes(batch.status)) throw new Error('Bu emir iptal edilemez');

  if (batch.status === 'in_production') {
    await clearWipMovement(supabase, batch, 'Üretim iptal edildi, WIP geri alındı', user?.id);
  }

  const { error } = await supabase
    .from('production_batches')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .in('status', ['queued', 'in_production']);
  if (error) throw new Error(error.message);

  revalidatePath('/production');
  revalidatePath('/inventory');
  revalidatePath('/products');
}

export type BatchImportRow = {
  product_code: string;
  planned_quantity: number;
  production_cost?: number;
  notes?: string;
};

export async function bulkImportBatches(rows: BatchImportRow[]) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: products } = await supabase.from('products').select('id, product_code').is('deleted_at', null);
  const productByCode = new Map((products ?? []).map((p) => [String(p.product_code).trim(), p.id]));

  const { count } = await supabase.from('production_batches').select('*', { count: 'exact', head: true });
  let seq = (count ?? 0) + 1;
  const year = new Date().getFullYear();

  let imported = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const code = String(row.product_code ?? '').trim();
    const productId = productByCode.get(code);
    if (!productId) { errors.push(`Ürün kodu bulunamadı: "${code}"`); continue; }
    const qty = Math.max(1, Math.round(Number(row.planned_quantity) || 0));
    if (!qty) { errors.push(`${code}: geçersiz adet`); continue; }

    const { error } = await supabase.from('production_batches').insert({
      batch_number: `URT-${year}-${String(seq).padStart(5, '0')}`,
      product_id: productId,
      planned_quantity: qty,
      production_cost: Number(row.production_cost) || 0,
      notes: row.notes || null,
      status: 'queued',
      created_by: user?.id,
    });
    if (error) { errors.push(`${code}: ${error.message}`); continue; }
    seq++;
    imported++;
  }

  revalidatePath('/production');
  return { imported, errors };
}
