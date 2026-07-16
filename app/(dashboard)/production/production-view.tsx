'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { readImportRows, getField, getText, getNumber, IMPORT_SHEET_NAME } from '@/lib/excel';
import { toast } from 'sonner';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  Plus, Search, Download, Upload, Play, CheckCircle2, PackageCheck, Ban, Pencil,
  ChevronDown, ChevronRight, ClipboardPaste, Trash2, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ProductCombobox } from '@/components/ui/product-combobox';
import { formatCurrency, formatNumber, parsePastedProductLines, excelCellToISODate, cn } from '@/lib/utils';
import {
  createProductionOrder, updateProductionOrder, generateProductionOrderNumber,
  startProduction, completeProduction, transferBatchToStock, cancelBatch,
  startAllInOrder, transferAllInOrder, bulkImportBatches,
  deleteProductionOrder, deleteProductionLine, getOrderDeletionImpact,
} from './actions';

type Line = Record<string, any>;
type ProductOption = { id: string; product_code: string; name: string; cost_price?: number };

const STATUS_LABEL: Record<string, string> = {
  queued: 'Kuyrukta', in_production: 'Üretimde', completed: 'Tamamlandı',
  transferred: 'Stoğa Aktarıldı', cancelled: 'İptal',
};
const STATUS_TONE: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  queued: 'secondary', in_production: 'warning', completed: 'default',
  transferred: 'success', cancelled: 'destructive',
};

/**
 * Satır üretim maliyeti = planlanan adet × ürünün maliyet fiyatı.
 * Ürün kartı okunamıyorsa kayıtlı production_cost'a düşer.
 */
function lineCostOf(line: Line): number {
  const unit = Number(line.products?.cost_price ?? NaN);
  if (Number.isFinite(unit)) return Number(line.planned_quantity ?? 0) * unit;
  return Number(line.production_cost ?? 0);
}

type Group = {
  orderNo: string;
  production_date: string | null;
  related_order_number: string | null;
  notes: string | null;
  created_at: string;
  lines: Line[];
};

type FormLine = { id?: string | null; product_id: string; planned_quantity: number; locked?: boolean; lockedLabel?: string; lockedStatus?: string };

function OrderDialog({
  open, onOpenChange, products, editGroup, suggestedNumber,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  products: ProductOption[];
  editGroup?: Group | null;
  suggestedNumber: string;
}) {
  const { register, handleSubmit, setValue, watch, control, reset, formState: { isSubmitting } } = useForm<{
    production_order_number: string;
    production_date: string;
    related_order_number: string;
    notes: string;
    items: FormLine[];
  }>({
    defaultValues: {
      production_order_number: suggestedNumber,
      production_date: new Date().toISOString().slice(0, 10),
      related_order_number: '',
      notes: '',
      items: [{ product_id: '', planned_quantity: 1 }],
    },
  });

  const costByProduct = useMemo(
    () => new Map(products.map((p) => [p.id, Number(p.cost_price ?? 0)])),
    [products]
  );
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [deletedIds, setDeletedIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setDeletedIds([]);
      setPasteOpen(false);
      setPasteText('');
      if (editGroup) {
        reset({
          production_order_number: editGroup.orderNo,
          production_date: editGroup.production_date ?? new Date().toISOString().slice(0, 10),
          related_order_number: editGroup.related_order_number ?? '',
          notes: editGroup.notes ?? '',
          items: editGroup.lines
            .filter((l) => l.status !== 'cancelled')
            .map((l) => ({
              id: l.id,
              product_id: l.product_id,
              planned_quantity: Number(l.planned_quantity),
              locked: l.status !== 'queued',
              lockedLabel: `${l.products?.product_code ?? ''} — ${l.products?.name ?? ''}`,
              lockedStatus: l.status,
            })),
        });
      } else {
        reset({
          production_order_number: suggestedNumber,
          production_date: new Date().toISOString().slice(0, 10),
          related_order_number: '',
          notes: '',
          items: [{ product_id: '', planned_quantity: 1 }],
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editGroup?.orderNo]);

  const handleBulkPaste = () => {
    const parsed = parsePastedProductLines(pasteText);
    if (!parsed.length) { toast.error('Yapıştırılan metinde satır bulunamadı'); return; }
    const byCode = new Map(products.map((p) => [p.product_code.trim().toLocaleUpperCase('tr'), p]));
    const matched: FormLine[] = [];
    const unmatched: string[] = [];
    for (const row of parsed) {
      const p = byCode.get(row.code.trim().toLocaleUpperCase('tr'));
      if (!p) { unmatched.push(row.code); continue; }
      matched.push({ product_id: p.id, planned_quantity: row.quantity });
    }
    if (!matched.length) {
      toast.error(`Hiçbir ürün kodu eşleşmedi: ${unmatched.slice(0, 5).join(', ')}`);
      return;
    }
    const current = (watch('items') ?? []).filter((it) => it?.product_id || it?.locked);
    replace([...current, ...matched]);
    if (unmatched.length) {
      toast.warning(`${matched.length} satır eklendi; eşleşmeyen: ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '…' : ''}`);
    } else {
      toast.success(`${matched.length} satır eklendi`);
    }
    setPasteText('');
    setPasteOpen(false);
  };

  const handleRemoveLine = (index: number) => {
    const line = watch(`items.${index}`);
    if (line?.locked) { toast.error('Başlamış/tamamlanmış satır silinemez'); return; }
    if (line?.id) setDeletedIds((prev) => [...prev, line.id!]);
    remove(index);
  };

  // Canlı maliyet: Σ adet × ürün maliyet fiyatı
  const watchedItems = watch('items');
  const formTotalCost = (watchedItems ?? []).reduce(
    (s, it) => s + (Number(it?.planned_quantity) || 0) * (costByProduct.get(it?.product_id ?? '') ?? 0),
    0
  );

  const onSubmit = async (values: { production_order_number: string; production_date: string; related_order_number: string; notes: string; items: FormLine[] }) => {
    try {
      const activeItems = values.items.filter((it) => it.product_id);
      if (!activeItems.length) { toast.error('En az bir ürün ekleyin'); return; }
      if (editGroup) {
        await updateProductionOrder(editGroup.orderNo, {
          production_date: values.production_date,
          related_order_number: values.related_order_number,
          notes: values.notes,
          items: activeItems.filter((it) => !it.locked).map((it) => ({
            id: it.id ?? null,
            product_id: it.product_id,
            planned_quantity: Number(it.planned_quantity),
          })),
          deleteLineIds: deletedIds,
        });
        toast.success('Üretim emri güncellendi');
      } else {
        await createProductionOrder({
          production_order_number: values.production_order_number,
          production_date: values.production_date,
          related_order_number: values.related_order_number,
          notes: values.notes,
          items: activeItems.map((it) => ({
            product_id: it.product_id,
            planned_quantity: Number(it.planned_quantity),
          })),
        });
        toast.success('Üretim emri oluşturuldu');
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>{editGroup ? `Üretim Emrini Düzenle — ${editGroup.orderNo}` : 'Yeni Üretim Emri'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Emir No (Lot)</Label>
              <Input {...register('production_order_number')} disabled={!!editGroup} />
            </div>
            <div className="space-y-1.5">
              <Label>Üretim Tarihi</Label>
              <Input type="date" {...register('production_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>İlgili Sipariş No (opsiyonel)</Label>
              <Input {...register('related_order_number')} placeholder="SIP-2026-00001" />
            </div>
            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <Input {...register('notes')} />
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="col-span-6">Ürün</span>
              <span className="col-span-2">Planlanan Adet</span>
              <span className="col-span-3">Maliyet (adet × birim maliyet)</span>
              <span className="col-span-1" />
            </div>
            {fields.map((field, index) => {
              const isLocked = watch(`items.${index}.locked`);
              return (
                <div key={field.id} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-6 min-w-0">
                    {isLocked ? (
                      <div className="flex h-9 items-center gap-2 truncate rounded-md border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{watch(`items.${index}.lockedLabel`)}</span>
                        <Badge variant={STATUS_TONE[watch(`items.${index}.lockedStatus`) ?? ''] ?? 'secondary'} className="ml-auto shrink-0">
                          {STATUS_LABEL[watch(`items.${index}.lockedStatus`) ?? ''] ?? ''}
                        </Badge>
                      </div>
                    ) : (
                      <ProductCombobox
                        options={products}
                        value={watch(`items.${index}.product_id`) || undefined}
                        onChange={(v) => setValue(`items.${index}.product_id`, v)}
                      />
                    )}
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min={1} disabled={!!isLocked} {...register(`items.${index}.planned_quantity`)} />
                  </div>
                  <div className="col-span-3">
                    <div className="flex h-9 items-center justify-between rounded-md border border-border bg-muted/40 px-3 text-sm">
                      <span className="text-xs text-muted-foreground">
                        {formatCurrency(costByProduct.get(watch(`items.${index}.product_id`) ?? '') ?? 0)} × {Number(watch(`items.${index}.planned_quantity`)) || 0}
                      </span>
                      <span className="tabular-nums font-medium">
                        {formatCurrency((Number(watch(`items.${index}.planned_quantity`)) || 0) * (costByProduct.get(watch(`items.${index}.product_id`) ?? '') ?? 0))}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveLine(index)} disabled={!!isLocked || fields.length === 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
              <span className="font-medium">Toplam Üretim Maliyeti</span>
              <span className="tabular-nums text-base font-semibold">{formatCurrency(formTotalCost)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Maliyet, ürün kartındaki maliyet fiyatından otomatik hesaplanır ve raporlara ayrıca yansıtılmaz.
            </p>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => append({ product_id: '', planned_quantity: 1 })}>
                <Plus className="mr-1.5 h-4 w-4" /> Satır Ekle
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPasteOpen((v) => !v)}>
                <ClipboardPaste className="mr-1.5 h-4 w-4" /> Toplu Yapıştır
              </Button>
            </div>
            {pasteOpen && (
              <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  Her satıra bir ürün: <span className="font-mono">KOD ADET</span> veya <span className="font-mono">KOD İSİM ADET</span>
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={5}
                  placeholder={'YNG-001\t5\nYNG-002\tCeviz Sehpa\t3'}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setPasteOpen(false); setPasteText(''); }}>Vazgeç</Button>
                  <Button type="button" size="sm" onClick={handleBulkPaste}>Satırları Ekle</Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductionView({ lines, products, initialFilter = '' }: { lines: Line[]; products: ProductOption[]; initialFilter?: string }) {
  const [filter, setFilter] = useState(initialFilter);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [suggestedNumber, setSuggestedNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const l of lines) {
      const orderNo = l.production_order_number ?? l.batch_number;
      if (!map.has(orderNo)) {
        map.set(orderNo, {
          orderNo,
          production_date: l.production_date ?? null,
          related_order_number: l.related_order_number ?? null,
          notes: l.notes ?? null,
          created_at: l.created_at,
          lines: [],
        });
      }
      map.get(orderNo)!.lines.push(l);
    }
    return Array.from(map.values()).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  }, [lines]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase('tr');
    if (!q) return groups;
    return groups.filter((g) =>
      g.orderNo.toLocaleLowerCase('tr').includes(q) ||
      (g.related_order_number ?? '').toLocaleLowerCase('tr').includes(q) ||
      g.lines.some((l) =>
        String(l.batch_number).toLocaleLowerCase('tr').includes(q) ||
        String(l.products?.product_code ?? '').toLocaleLowerCase('tr').includes(q) ||
        String(l.products?.name ?? '').toLocaleLowerCase('tr').includes(q)
      )
    );
  }, [groups, filter]);

  // ?q= linki ile gelinirse ilgili emri otomatik aç
  useEffect(() => {
    if (initialFilter && filtered.length) {
      setExpanded(new Set(filtered.map((g) => g.orderNo)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpand = (orderNo: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(orderNo)) next.delete(orderNo);
      else next.add(orderNo);
      return next;
    });
  };

  const statusSummary = (g: Group) => {
    const counts = new Map<string, number>();
    for (const l of g.lines) counts.set(l.status, (counts.get(l.status) ?? 0) + 1);
    return Array.from(counts.entries());
  };

  const handleNew = async () => {
    try {
      const num = await generateProductionOrderNumber();
      setSuggestedNumber(num);
      setEditGroup(null);
      setDialogOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Emir numarası oluşturulamadı');
    }
  };

  const handleEdit = (g: Group) => {
    setEditGroup(g);
    setDialogOpen(true);
  };

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  };

  const handleDeleteOrder = async (g: Group) => {
    let impact;
    try {
      impact = await getOrderDeletionImpact(g.orderNo);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Emir bilgisi alınamadı');
      return;
    }

    const warnings: string[] = [];
    if (impact.transferredCount > 0) {
      warnings.push(
        `• ${impact.transferredCount} satır stoğa aktarılmış: ${formatNumber(impact.transferredUnits)} adet STOKTAN GERİ DÜŞÜLECEK.\n` +
        `  Bu ürünler satıldıysa stok eksiye düşebilir.`
      );
    }
    if (impact.wipCount > 0) {
      warnings.push(`• ${impact.wipCount} satır üretimde/tamamlandı: ${formatNumber(impact.wipUnits)} adet "üretimde" stoğundan düşülecek.`);
    }

    const message =
      `"${g.orderNo}" üretim emri ve altındaki ${impact.lineCount} satır KALICI olarak silinecek.\n\n` +
      (warnings.length ? warnings.join('\n') + '\n\n' : 'Stok etkisi yok (tüm satırlar kuyrukta).\n\n') +
      `Stok hareketleri silinmez; ters kayıt olarak deftere yazılır.\n\nDevam etmek istiyor musunuz?`;

    if (!confirm(message)) return;
    await run(() => deleteProductionOrder(g.orderNo), `"${g.orderNo}" silindi, stok etkisi geri alındı`);
  };

  const handleDeleteLine = async (line: Line) => {
    const label = `${line.products?.product_code ?? ''} ${line.products?.name ?? ''}`.trim();
    const extra =
      line.status === 'transferred'
        ? `\n\nUYARI: Bu satır stoğa aktarılmış. ${formatNumber(line.completed_quantity ?? 0)} adet stoktan geri düşülecek.`
        : ['in_production', 'completed'].includes(line.status)
        ? `\n\n${formatNumber(line.planned_quantity ?? 0)} adet "üretimde" stoğundan düşülecek.`
        : '';
    if (!confirm(`"${label}" satırı silinecek.${extra}\n\nDevam edilsin mi?`)) return;
    await run(() => deleteProductionLine(line.id), 'Satır silindi, stok etkisi geri alındı');
  };

  const handleCompleteLine = async (line: Line) => {
    const input = prompt(`Tamamlanan adet (planlanan: ${line.planned_quantity}):`, String(line.planned_quantity));
    if (input === null) return;
    const qty = Number(input);
    if (!qty || qty < 1) { toast.error('Geçersiz adet'); return; }
    await run(() => completeProduction(line.id, qty), 'Satır tamamlandı — stoğa aktarabilirsiniz');
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Emir No (Lot)': '', 'Üretim Tarihi': '2026-07-01', 'Ürün Kodu': 'YNG-001', 'Planlanan Adet': 10, 'Sipariş No': '', 'Notlar': '' },
      { 'Emir No (Lot)': '', 'Üretim Tarihi': '2026-07-01', 'Ürün Kodu': 'YNG-002', 'Planlanan Adet': 5, 'Sipariş No': '', 'Notlar': '' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'uretim_import_sablonu.xlsx');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Kendi dışa aktarımımız iki sayfalı: doğru (içe aktarılabilir) sayfayı seç
      const json = await readImportRows(file, ['Ürün Kodu', 'Planlanan Adet']);
      // Başlıklar toleranslı okunur: "Emir No", "Emir No (Lot)", "Lot No" hepsi çalışır
      const rows = json.map((r) => {
        const rawDate = getField(r, 'Üretim Tarihi', 'Tarih');
        return {
          production_order_number: getText(r, 'Emir No (Lot)', 'Emir No', 'Lot', 'Lot No', 'Üretim Emri No'),
          production_date: rawDate !== undefined ? excelCellToISODate(rawDate) : undefined,
          product_code: getText(r, 'Ürün Kodu', 'Kod', 'Stok Kodu') ?? '',
          planned_quantity: getNumber(r, ['Planlanan Adet', 'Adet', 'Miktar'], 0),
          related_order_number: getText(r, 'Sipariş No', 'İlgili Sipariş No', 'İlgili Sipariş'),
          notes: getText(r, 'Notlar', 'Not', 'Açıklama'),
        };
      });
      const result = await bulkImportBatches(rows);
      const parts: string[] = [`${result.imported} satır aktarıldı`];
      if (result.orders.length) parts.push(`${result.orders.length} emir: ${result.orders.slice(0, 3).join(', ')}${result.orders.length > 3 ? '…' : ''}`);
      if (result.skipped.length) parts.push(`${result.skipped.length} mevcut emir atlandı`);
      if (result.errors.length) {
        toast.warning(`${parts.join(' · ')} · hatalar: ${result.errors.slice(0, 3).join('; ')}`);
      } else {
        toast.success(parts.join(' · '));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İçe aktarma başarısız');
    } finally {
      e.target.value = '';
    }
  };

  const handleExport = () => {
    const rows = filtered.flatMap((g) =>
      g.lines.map((l) => ({
        'Emir No (Lot)': g.orderNo,
        'Üretim Tarihi': g.production_date ?? '',
        'Sipariş No': g.related_order_number ?? '',
        'Ürün Kodu': l.products?.product_code ?? '',
        'Ürün Adı': l.products?.name ?? '',
        'Planlanan Adet': l.planned_quantity,
        'Tamamlanan': l.completed_quantity ?? 0,
        'Birim Maliyet': Number(l.products?.cost_price ?? 0),
        'Satır Maliyeti': lineCostOf(l),
        'Başlangıç': l.started_at ?? '',
        'Bitiş': l.completed_at ?? '',
        'Durum': STATUS_LABEL[l.status] ?? l.status,
      }))
    );
    // 2. sayfa: şablonla birebir aynı kolonlar => doğrudan geri yüklenebilir
    const importRows = filtered.flatMap((g) =>
      g.lines.map((l) => ({
        'Emir No (Lot)': g.orderNo,
        'Üretim Tarihi': g.production_date ?? '',
        'Ürün Kodu': l.products?.product_code ?? '',
        'Planlanan Adet': l.planned_quantity,
        'Sipariş No': g.related_order_number ?? '',
        'Notlar': g.notes ?? '',
      }))
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Üretim');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(importRows), IMPORT_SHEET_NAME);
    XLSX.writeFile(wb, `uretim_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Emir, sipariş veya ürün ara…" className="pl-8" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>Şablon indir</Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> İçe Aktar
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" /> Dışa Aktar
          </Button>
          <Button size="sm" onClick={handleNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Üretim Emri
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Emir No (Lot)</TableHead>
            <TableHead>Tarih</TableHead>
            <TableHead>Sipariş No</TableHead>
            <TableHead>Ürün / Adet</TableHead>
            <TableHead>Toplam Maliyet</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length ? filtered.map((g) => {
            const isOpen = expanded.has(g.orderNo);
            const totalPlanned = g.lines.reduce((s, l) => s + (l.planned_quantity ?? 0), 0);
            const totalCost = g.lines.reduce((s, l) => s + lineCostOf(l), 0);
            const hasQueued = g.lines.some((l) => l.status === 'queued');
            const hasTransferable = g.lines.some((l) => ['queued', 'in_production', 'completed'].includes(l.status));
            return (
              <Fragment key={g.orderNo}>
                <TableRow
                  className={cn(
                    'cursor-pointer transition-colors',
                    isOpen
                      ? 'bg-primary/10 hover:bg-primary/15 shadow-[inset_3px_0_0_0_hsl(var(--primary))]'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => toggleExpand(g.orderNo)}
                >
                  <TableCell>
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  </TableCell>
                  <TableCell><span className="font-mono text-xs font-medium text-primary">{g.orderNo}</span></TableCell>
                  <TableCell className="text-sm">{g.production_date ?? '—'}</TableCell>
                  <TableCell>{g.related_order_number ? <span className="font-mono text-xs">{g.related_order_number}</span> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>{g.lines.length} ürün · {formatNumber(totalPlanned)} adet</TableCell>
                  <TableCell className="tabular-nums">{formatCurrency(totalCost)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {statusSummary(g).map(([status, count]) => (
                        <Badge key={status} variant={STATUS_TONE[status] ?? 'secondary'}>
                          {count} {STATUS_LABEL[status] ?? status}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      {hasQueued && (
                        <Button variant="ghost" size="icon" title="Tümünü başlat"
                          onClick={() => run(() => startAllInOrder(g.orderNo), 'Kuyruktaki tüm satırlar başlatıldı')}>
                          <Play className="h-4 w-4 text-primary" />
                        </Button>
                      )}
                      {hasTransferable && (
                        <Button variant="ghost" size="icon" title="Tümünü stoğa aktar"
                          onClick={() => {
                            if (!confirm(`"${g.orderNo}" emrindeki tüm satırlar planlanan adetle stoğa aktarılacak. Devam?`)) return;
                            run(() => transferAllInOrder(g.orderNo), 'Emirdeki tüm satırlar stoğa aktarıldı');
                          }}>
                          <PackageCheck className="h-4 w-4 text-success" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" title="Düzenle" onClick={() => handleEdit(g)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Emri sil" onClick={() => handleDeleteOrder(g)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/20 p-0">
                      <div className="px-6 py-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                              <th className="pb-2 pr-3 font-medium">Ürün</th>
                              <th className="pb-2 pr-3 text-right font-medium">Planlanan</th>
                              <th className="pb-2 pr-3 text-right font-medium">Tamamlanan</th>
                              <th className="pb-2 pr-3 text-right font-medium">Maliyet</th>
                              <th className="pb-2 pr-3 font-medium">Durum</th>
                              <th className="pb-2 font-medium"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {g.lines.map((l) => (
                              <tr key={l.id} className="border-t border-border/60">
                                <td className="py-2 pr-3">
                                  <span className="font-mono text-xs text-muted-foreground">{l.products?.product_code}</span>{' '}
                                  {l.products?.name}
                                </td>
                                <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(l.planned_quantity)}</td>
                                <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(l.completed_quantity ?? 0)}</td>
                                <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(lineCostOf(l))}</td>
                                <td className="py-2 pr-3">
                                  <Badge variant={STATUS_TONE[l.status] ?? 'secondary'}>{STATUS_LABEL[l.status] ?? l.status}</Badge>
                                </td>
                                <td className="py-2">
                                  <div className="flex justify-end gap-1">
                                    {l.status === 'queued' && (
                                      <Button variant="ghost" size="icon" title="Başlat" onClick={() => run(() => startProduction(l.id), 'Satır üretime alındı')}>
                                        <Play className="h-4 w-4 text-primary" />
                                      </Button>
                                    )}
                                    {l.status === 'in_production' && (
                                      <Button variant="ghost" size="icon" title="Tamamla" onClick={() => handleCompleteLine(l)}>
                                        <CheckCircle2 className="h-4 w-4 text-success" />
                                      </Button>
                                    )}
                                    {l.status === 'completed' && (
                                      <Button variant="ghost" size="icon" title="Stoğa aktar" onClick={() => run(() => transferBatchToStock(l.id), 'Satır stoğa aktarıldı')}>
                                        <PackageCheck className="h-4 w-4 text-success" />
                                      </Button>
                                    )}
                                    {(l.status === 'queued' || l.status === 'in_production') && (
                                      <Button variant="ghost" size="icon" title="İptal" onClick={() => {
                                        if (!confirm('Bu satırı iptal etmek istediğinize emin misiniz?')) return;
                                        run(() => cancelBatch(l.id), 'Satır iptal edildi');
                                      }}>
                                        <Ban className="h-4 w-4 text-destructive" />
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" title="Satırı sil" onClick={() => handleDeleteLine(l)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-border">
                              <td colSpan={3} className="py-2 pr-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Toplam Üretim Maliyeti
                              </td>
                              <td className="py-2 pr-3 text-right tabular-nums font-semibold">
                                {formatCurrency(g.lines.reduce((s, l) => s + lineCostOf(l), 0))}
                              </td>
                              <td colSpan={2} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          }) : (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                Üretim emri bulunamadı.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <OrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        products={products}
        editGroup={editGroup}
        suggestedNumber={suggestedNumber}
      />
    </div>
  );
}
