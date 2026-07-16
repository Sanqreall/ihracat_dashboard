'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

type SB = Awaited<ReturnType<typeof createClient>>;

const lineSchema = z.object({
  id: z.string().uuid().optional().nullable(), // varsa mevcut satır güncellenir
  product_id: z.string().uuid('Ürün seçiniz'),
  planned_quantity: z.coerce.number().int().min(1, 'Adet en az 1'),
  // NOT: production_cost artık kullanıcıdan alınmaz.
  // Sunucuda ürünün maliyet fiyatı × planlanan adet olarak hesaplanır.
});

const productionOrderSchema = z.object({
  production_order_number: z.string().min(1),
  production_date: z.string().min(1, 'Tarih zorunlu'),
  related_order_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(lineSchema).min(1, 'En az bir ürün ekleyin'),
});

export type ProductionOrderInput = z.infer<typeof productionOrderSchema>;

/** Verilen ürünlerin maliyet fiyatlarını çeker: { product_id → cost_price } */
async function getCostPrices(supabase: SB, productIds: string[]) {
  const unique = Array.from(new Set(productIds));
  if (!unique.length) return new Map<string, number>();
  const { data, error } = await supabase.from('products').select('id, cost_price').in('id', unique);
  if (error) throw new Error(error.message);
  return new Map((data ?? []).map((p) => [p.id, Number(p.cost_price ?? 0)]));
}

/** Satırın üretim maliyeti = planlanan adet × ürün maliyet fiyatı */
function lineCost(quantity: number, costPrice: number) {
  return Math.round(quantity * costPrice * 100) / 100;
}

function revalidateAll() {
  revalidatePath('/production');
  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/dashboard');
}

export async function listProductionLines() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('production_batches')
    .select('*, products(product_code, name, cost_price)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function generateProductionOrderNumber() {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const prefix = `URT-${year}-`;

  // Sayıya göre değil, en yüksek mevcut emir numarasına göre üret (çakışmayı önler)
  const { data } = await supabase
    .from('production_batches')
    .select('production_order_number')
    .ilike('production_order_number', `${prefix}%`)
    .order('production_order_number', { ascending: false })
    .limit(1);

  let nextSeq = 1;
  if (data && data.length && data[0].production_order_number) {
    const lastSeq = parseInt(String(data[0].production_order_number).slice(prefix.length), 10);
    if (Number.isFinite(lastSeq)) nextSeq = lastSeq + 1;
  }
  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

export async function createProductionOrder(input: ProductionOrderInput) {
  const parsed = productionOrderSchema.parse(input);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Aynı emir numarası daha önce kullanılmış mı?
  const { data: existing } = await supabase
    .from('production_batches')
    .select('id')
    .eq('production_order_number', parsed.production_order_number)
    .limit(1);
  if (existing?.length) throw new Error(`"${parsed.production_order_number}" emir numarası zaten kullanılmış`);

  // Maliyet ürün kartından türetilir (elle girilmez)
  const costs = await getCostPrices(supabase, parsed.items.map((it) => it.product_id));

  // Lot numarası = üretim emri numarası. DB'de batch_number benzersiz olduğu için
  // satır ayrımı /1, /2 ile yapılır; kullanıcıya her zaman emir numarası gösterilir.
  const rows = parsed.items.map((it, i) => ({
    batch_number: `${parsed.production_order_number}/${i + 1}`,
    production_order_number: parsed.production_order_number,
    production_date: parsed.production_date,
    related_order_number: parsed.related_order_number?.trim() || null,
    product_id: it.product_id,
    planned_quantity: it.planned_quantity,
    production_cost: lineCost(it.planned_quantity, costs.get(it.product_id) ?? 0),
    notes: parsed.notes?.trim() || null,
    status: 'queued' as const,
    created_by: user?.id,
  }));

  const { error } = await supabase.from('production_batches').insert(rows);
  if (error) throw new Error(error.message);

  revalidatePath('/production');
  return { production_order_number: parsed.production_order_number };
}

/**
 * Emir düzenleme kuralları:
 * - Emir düzeyi alanlar (ilgili sipariş no, notlar) tüm satırlara yazılır.
 * - Sadece 'queued' satırlar değiştirilebilir/silinebilir; yeni satır eklenebilir.
 * - Başlamış/tamamlanmış/aktarılmış satırlara dokunulmaz.
 */
export async function updateProductionOrder(
  orderNumber: string,
  input: {
    production_date?: string | null;
    related_order_number?: string | null;
    notes?: string | null;
    items: z.infer<typeof lineSchema>[];
    deleteLineIds: string[];
  }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: lines, error: selErr } = await supabase
    .from('production_batches')
    .select('id, status, batch_number')
    .eq('production_order_number', orderNumber);
  if (selErr) throw new Error(selErr.message);
  const byId = new Map((lines ?? []).map((l) => [l.id, l]));

  // Silinecekler: sadece queued
  const deletable = input.deleteLineIds.filter((id) => byId.get(id)?.status === 'queued');
  if (deletable.length) {
    const { error } = await supabase.from('production_batches').delete().in('id', deletable);
    if (error) throw new Error(error.message);
  }

  // Emir düzeyi alanlar tüm satırlara
  const { error: metaErr } = await supabase
    .from('production_batches')
    .update({
      production_date: input.production_date || undefined,
      related_order_number: input.related_order_number?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .eq('production_order_number', orderNumber);
  if (metaErr) throw new Error(metaErr.message);

  // Satırlar: id'si olan queued satırlar güncellenir, id'siz satırlar eklenir
  let maxSuffix = 0;
  for (const l of lines ?? []) {
    const m = String(l.batch_number).match(/\/(\d+)$/);
    if (m) maxSuffix = Math.max(maxSuffix, Number(m[1]));
  }

  const updateCosts = await getCostPrices(supabase, input.items.map((it) => it.product_id));

  for (const it of input.items) {
    const parsedLine = lineSchema.parse(it);
    const cost = lineCost(parsedLine.planned_quantity, updateCosts.get(parsedLine.product_id) ?? 0);
    if (parsedLine.id) {
      const existing = byId.get(parsedLine.id);
      if (!existing || existing.status !== 'queued') continue; // kilitli satır, atla
      const { error } = await supabase
        .from('production_batches')
        .update({
          product_id: parsedLine.product_id,
          planned_quantity: parsedLine.planned_quantity,
          production_cost: cost,
        })
        .eq('id', parsedLine.id)
        .eq('status', 'queued');
      if (error) throw new Error(error.message);
    } else {
      maxSuffix += 1;
      const { error } = await supabase.from('production_batches').insert({
        batch_number: `${orderNumber}/${maxSuffix}`,
        production_order_number: orderNumber,
        production_date: input.production_date || new Date().toISOString().slice(0, 10),
        related_order_number: input.related_order_number?.trim() || null,
        product_id: parsedLine.product_id,
        planned_quantity: parsedLine.planned_quantity,
        production_cost: cost,
        notes: input.notes?.trim() || null,
        status: 'queued',
        created_by: user?.id,
      });
      if (error) throw new Error(error.message);
    }
  }

  revalidatePath('/production');
}

// ---------------------------------------------------------------------------
// Satır düzeyi durum akışı (WIP ledger hareketleriyle)
// ---------------------------------------------------------------------------

async function startLine(supabase: SB, userId: string | undefined, line: { id: string; batch_number: string; product_id: string; planned_quantity: number; status: string }) {
  if (line.status !== 'queued') return false;
  const { error } = await supabase
    .from('production_batches')
    .update({ status: 'in_production', started_at: new Date().toISOString().slice(0, 10) })
    .eq('id', line.id)
    .eq('status', 'queued');
  if (error) throw new Error(error.message);

  const { error: movErr } = await supabase.from('stock_movements').insert({
    product_id: line.product_id,
    movement_type: 'production',
    quantity: Math.abs(line.planned_quantity),
    reference_type: 'production',
    reference_id: line.id,
    notes: `Üretim başladı: ${line.batch_number}`,
    created_by: userId,
  });
  if (movErr) throw new Error(movErr.message);
  return true;
}

async function clearWipMovement(supabase: SB, line: { id: string; batch_number: string; product_id: string; planned_quantity: number }, note: string, userId?: string) {
  const { data: startMov } = await supabase
    .from('stock_movements')
    .select('id')
    .eq('reference_type', 'production')
    .eq('reference_id', line.id)
    .eq('movement_type', 'production')
    .gt('quantity', 0)
    .limit(1)
    .maybeSingle();
  if (!startMov) return;

  const { error } = await supabase.from('stock_movements').insert({
    product_id: line.product_id,
    movement_type: 'production',
    quantity: -Math.abs(line.planned_quantity),
    reference_type: 'production',
    reference_id: line.id,
    notes: `${note}: ${line.batch_number}`,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
}

async function transferLine(supabase: SB, userId: string | undefined, line: { id: string; batch_number: string; product_id: string; planned_quantity: number; completed_quantity: number | null; production_cost: number | null; status: string }) {
  if (line.status !== 'completed') return false;
  const qty = line.completed_quantity ?? 0;
  if (qty < 1) throw new Error(`${line.batch_number}: tamamlanan adet bulunamadı`);

  await clearWipMovement(supabase, line, 'Üretim tamamlandı, WIP kapatıldı', userId);

  const unitCost = qty > 0 ? Number(line.production_cost ?? 0) / qty : null;
  const { error: movErr } = await supabase.from('stock_movements').insert({
    product_id: line.product_id,
    movement_type: 'transfer',
    quantity: Math.abs(qty),
    unit_cost: unitCost,
    reference_type: 'production',
    reference_id: line.id,
    notes: `Üretim stoğa aktarıldı: ${line.batch_number}`,
    created_by: userId,
  });
  if (movErr) throw new Error(movErr.message);

  const { error: updErr } = await supabase
    .from('production_batches')
    .update({ status: 'transferred', transferred_at: new Date().toISOString() })
    .eq('id', line.id)
    .eq('status', 'completed');
  if (updErr) throw new Error(updErr.message);
  return true;
}

export async function startProduction(lineId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: line, error } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id, planned_quantity, status')
    .eq('id', lineId)
    .single();
  if (error) throw new Error(error.message);
  if (line.status !== 'queued') throw new Error('Sadece kuyruktaki satırlar başlatılabilir');
  await startLine(supabase, user?.id, line);
  revalidateAll();
}

export async function completeProduction(lineId: string, completedQuantity: number) {
  if (!completedQuantity || completedQuantity < 1) throw new Error('Tamamlanan adet en az 1 olmalı');
  const supabase = await createClient();
  const { error } = await supabase
    .from('production_batches')
    .update({
      status: 'completed',
      completed_quantity: completedQuantity,
      completed_at: new Date().toISOString().slice(0, 10),
    })
    .eq('id', lineId)
    .eq('status', 'in_production');
  if (error) throw new Error(error.message);
  revalidatePath('/production');
}

export async function transferBatchToStock(lineId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: line, error } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id, planned_quantity, completed_quantity, production_cost, status')
    .eq('id', lineId)
    .single();
  if (error) throw new Error(error.message);
  if (line.status !== 'completed') throw new Error('Sadece tamamlanmış satırlar stoğa aktarılabilir');
  await transferLine(supabase, user?.id, line);
  revalidateAll();
}

export async function cancelBatch(lineId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: line, error } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id, planned_quantity, status')
    .eq('id', lineId)
    .single();
  if (error) throw new Error(error.message);
  if (!['queued', 'in_production'].includes(line.status)) throw new Error('Bu satır iptal edilemez');

  if (line.status === 'in_production') {
    await clearWipMovement(supabase, line, 'Üretim iptal edildi, WIP geri alındı', user?.id);
  }
  const { error: updErr } = await supabase
    .from('production_batches')
    .update({ status: 'cancelled' })
    .eq('id', lineId)
    .in('status', ['queued', 'in_production']);
  if (updErr) throw new Error(updErr.message);
  revalidateAll();
}

// ---------------------------------------------------------------------------
// Emir düzeyi toplu komutlar
// ---------------------------------------------------------------------------

export async function startAllInOrder(orderNumber: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: lines, error } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id, planned_quantity, status')
    .eq('production_order_number', orderNumber)
    .eq('status', 'queued');
  if (error) throw new Error(error.message);

  let count = 0;
  for (const line of lines ?? []) {
    if (await startLine(supabase, user?.id, line)) count++;
  }
  revalidateAll();
  return { started: count };
}

/**
 * Emirdeki tüm satırları stoğa aktarır:
 * - 'completed' satırlar doğrudan aktarılır.
 * - 'in_production' satırlar planlanan adetle tamamlanmış sayılıp aktarılır.
 * - 'queued' satırlar önce başlatılır, planlananla tamamlanır, aktarılır.
 */
export async function transferAllInOrder(orderNumber: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: lines, error } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id, planned_quantity, completed_quantity, production_cost, status')
    .eq('production_order_number', orderNumber)
    .in('status', ['queued', 'in_production', 'completed']);
  if (error) throw new Error(error.message);

  let count = 0;
  for (const line of lines ?? []) {
    let current = { ...line };
    if (current.status === 'queued') {
      await startLine(supabase, user?.id, current);
      current.status = 'in_production';
    }
    if (current.status === 'in_production') {
      const qty = current.planned_quantity;
      const { error: cErr } = await supabase
        .from('production_batches')
        .update({ status: 'completed', completed_quantity: qty, completed_at: new Date().toISOString().slice(0, 10) })
        .eq('id', current.id)
        .eq('status', 'in_production');
      if (cErr) throw new Error(cErr.message);
      current.status = 'completed';
      current.completed_quantity = qty;
    }
    if (await transferLine(supabase, user?.id, current)) count++;
  }
  revalidateAll();
  return { transferred: count };
}

/**
 * Bir üretim satırının stok defterindeki NET etkisini okur ve tersini yazar.
 *
 * Defter append-only olduğu için hiçbir hareket silinmez; bunun yerine
 * telafi (compensating) hareketleri eklenir. Satırın hangi aşamada olduğuna
 * bakmaya gerek yok — ne yazılmışsa net etkisi kadar geri alınır:
 *   • production tipi hareketler → production_stock (üretimde)
 *   • diğer tipler (transfer vb.) → current_stock (satılabilir stok)
 */
async function reverseLineStockEffect(
  supabase: SB,
  line: { id: string; batch_number: string; product_id: string },
  reason: string,
  userId?: string
) {
  const { data: movements, error } = await supabase
    .from('stock_movements')
    .select('movement_type, quantity')
    .eq('reference_type', 'production')
    .eq('reference_id', line.id);
  if (error) throw new Error(error.message);

  let wipNet = 0;      // production_stock'a giden net
  let sellableNet = 0; // current_stock'a giden net
  for (const m of movements ?? []) {
    const qty = Number(m.quantity ?? 0);
    if (m.movement_type === 'production') wipNet += qty;
    else sellableNet += qty;
  }

  const inserts: Record<string, unknown>[] = [];
  if (wipNet !== 0) {
    inserts.push({
      product_id: line.product_id,
      movement_type: 'production',
      quantity: -wipNet,
      reference_type: 'production',
      reference_id: line.id,
      notes: `${reason}: ${line.batch_number} (üretimde stok geri alındı)`,
      created_by: userId,
    });
  }
  if (sellableNet !== 0) {
    inserts.push({
      product_id: line.product_id,
      movement_type: 'cancellation',
      quantity: -sellableNet,
      reference_type: 'production',
      reference_id: line.id,
      notes: `${reason}: ${line.batch_number} (stoktan geri alındı)`,
      created_by: userId,
    });
  }

  if (inserts.length) {
    const { error: insErr } = await supabase.from('stock_movements').insert(inserts);
    if (insErr) throw new Error(insErr.message);
  }

  return { wipNet, sellableNet };
}

/** Tek bir üretim satırını siler; stok etkisi telafi hareketleriyle geri alınır. */
export async function deleteProductionLine(lineId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: line, error } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id, production_order_number')
    .eq('id', lineId)
    .single();
  if (error) throw new Error(error.message);

  await reverseLineStockEffect(supabase, line, 'Üretim satırı silindi', user?.id);

  const { error: delErr } = await supabase.from('production_batches').delete().eq('id', lineId);
  if (delErr) throw new Error(delErr.message);

  revalidateAll();
}

/**
 * Tüm üretim emrini (altındaki bütün satırlarla) siler.
 * Her satırın stok etkisi tek tek geri alınır.
 *
 * UYARI: stoğa aktarılmış bir emir silinirse, o adetler stoktan geri düşer.
 * Ürünler o stoktan satılmışsa stok eksiye düşebilir — bu yüzden arayüzde
 * kullanıcı açıkça uyarılır.
 */
export async function deleteProductionOrder(orderNumber: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: lines, error } = await supabase
    .from('production_batches')
    .select('id, batch_number, product_id')
    .eq('production_order_number', orderNumber);
  if (error) throw new Error(error.message);
  if (!lines?.length) throw new Error('Üretim emri bulunamadı');

  for (const line of lines) {
    await reverseLineStockEffect(supabase, line, `Üretim emri silindi (${orderNumber})`, user?.id);
  }

  const { error: delErr } = await supabase
    .from('production_batches')
    .delete()
    .eq('production_order_number', orderNumber);
  if (delErr) throw new Error(delErr.message);

  revalidateAll();
  return { deleted: lines.length };
}

/** Emrin stoğa aktarılmış satır sayısı — silme onayında uyarı göstermek için. */
export async function getOrderDeletionImpact(orderNumber: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('production_batches')
    .select('status, completed_quantity, planned_quantity')
    .eq('production_order_number', orderNumber);

  const lines = data ?? [];
  const transferred = lines.filter((l) => l.status === 'transferred');
  const inProduction = lines.filter((l) => ['in_production', 'completed'].includes(l.status));
  return {
    lineCount: lines.length,
    transferredCount: transferred.length,
    transferredUnits: transferred.reduce((s, l) => s + Number(l.completed_quantity ?? 0), 0),
    wipCount: inProduction.length,
    wipUnits: inProduction.reduce((s, l) => s + Number(l.planned_quantity ?? 0), 0),
  };
}

// ---------------------------------------------------------------------------
// Excel içe aktarma: tüm satırlar TEK üretim emri altında toplanır
// ---------------------------------------------------------------------------

export type BatchImportRow = {
  production_order_number?: string;
  production_date?: string;
  product_code: string;
  planned_quantity: number;
  related_order_number?: string;
  notes?: string;
};

/**
 * Excel'den üretim emri içe aktarma.
 *
 * Satırlar "Emir No (Lot)" kolonuna göre gruplanır; böylece kendi dışa
 * aktarımımız (birden fazla emir içerebilir) doğru şekilde geri yüklenir.
 * Kolon yoksa tüm satırlar tek yeni emir altında toplanır.
 * Zaten var olan emir numaraları atlanır.
 */
export async function bulkImportBatches(rows: BatchImportRow[]) {
  const supabase = await createClient();

  const { data: products } = await supabase.from('products').select('id, product_code').is('deleted_at', null);
  const productByCode = new Map((products ?? []).map((p) => [String(p.product_code).trim().toLocaleUpperCase('tr'), p.id]));

  const errors: string[] = [];
  const skipped: string[] = [];

  // Emir numarasına göre grupla (yoksa tek grup)
  const groups = new Map<string, BatchImportRow[]>();
  const FALLBACK = '__new__';
  for (const row of rows) {
    const key = String(row.production_order_number ?? '').trim() || FALLBACK;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // Mevcut emir numaralarını bir kerede çek
  const namedKeys = Array.from(groups.keys()).filter((k) => k !== FALLBACK);
  const existing = new Set<string>();
  if (namedKeys.length) {
    const { data } = await supabase
      .from('production_batches')
      .select('production_order_number')
      .in('production_order_number', namedKeys);
    for (const r of data ?? []) if (r.production_order_number) existing.add(r.production_order_number);
  }

  let importedLines = 0;
  const createdOrders: string[] = [];

  for (const [key, groupRows] of groups) {
    if (key !== FALLBACK && existing.has(key)) { skipped.push(key); continue; }

    const items: { product_id: string; planned_quantity: number }[] = [];
    for (const row of groupRows) {
      const code = String(row.product_code ?? '').trim();
      const productId = productByCode.get(code.toLocaleUpperCase('tr'));
      if (!productId) { errors.push(`Ürün kodu bulunamadı: "${code}"`); continue; }
      const qty = Math.max(1, Math.round(Number(row.planned_quantity) || 0));
      items.push({ product_id: productId, planned_quantity: qty });
    }
    if (!items.length) continue;

    const first = groupRows[0];
    const orderNumber = key !== FALLBACK ? key : await generateProductionOrderNumber();

    try {
      await createProductionOrder({
        production_order_number: orderNumber,
        production_date: String(first.production_date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10),
        related_order_number: first.related_order_number?.trim() || null,
        notes: first.notes ?? null,
        items,
      });
      createdOrders.push(orderNumber);
      importedLines += items.length;
    } catch (e) {
      errors.push(`${orderNumber}: ${e instanceof Error ? e.message : 'oluşturulamadı'}`);
    }
  }

  return {
    imported: importedLines,
    orders: createdOrders,
    order_number: createdOrders[0] ?? null,
    skipped,
    errors,
  };
}
