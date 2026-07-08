'use client';

import { useMemo, useRef, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Plus, Search, Download, Upload, Play, CheckCircle2, PackageCheck, Ban, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { createBatch, startProduction, completeProduction, transferBatchToStock, cancelBatch, bulkImportBatches } from './actions';

type Row = Record<string, any>;
type ProductOption = { id: string; product_code: string; name: string };

const STATUS_LABEL: Record<string, string> = {
  queued: 'Kuyrukta', in_production: 'Üretimde', completed: 'Tamamlandı',
  transferred: 'Stoğa Aktarıldı', cancelled: 'İptal',
};
const STATUS_TONE: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  queued: 'secondary', in_production: 'warning', completed: 'default',
  transferred: 'success', cancelled: 'destructive',
};

function BatchDialog({ open, onOpenChange, products }: { open: boolean; onOpenChange: (o: boolean) => void; products: ProductOption[] }) {
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<{
    product_id: string; planned_quantity: number; production_cost: number; notes: string;
  }>({ defaultValues: { planned_quantity: 1, production_cost: 0, notes: '' } });

  const onSubmit = async (values: { product_id: string; planned_quantity: number; production_cost: number; notes: string }) => {
    try {
      if (!values.product_id) { toast.error('Ürün seçiniz'); return; }
      await createBatch({
        product_id: values.product_id,
        planned_quantity: Number(values.planned_quantity),
        production_cost: Number(values.production_cost),
        notes: values.notes,
      });
      toast.success('Üretim emri oluşturuldu');
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Yeni Üretim Emri</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ürün</Label>
            <Select value={watch('product_id') || undefined} onValueChange={(v) => setValue('product_id', v)}>
              <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
              <SelectContent>
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.product_code} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Planlanan Adet</Label>
            <Input type="number" min={1} {...register('planned_quantity')} />
          </div>
          <div className="space-y-1.5">
            <Label>Toplam Üretim Maliyeti (opsiyonel)</Label>
            <Input type="number" step="0.01" min={0} {...register('production_cost')} />
          </div>
          <div className="space-y-1.5">
            <Label>Notlar</Label>
            <Input {...register('notes')} />
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

export function ProductionView({ batches, products, initialFilter = '' }: { batches: Row[]; products: ProductOption[]; initialFilter?: string }) {
  const [globalFilter, setGlobalFilter] = useState(initialFilter);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Ürün Kodu': 'YNG-001', 'Planlanan Adet': 10, 'Maliyet': 5000, 'Notlar': '' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'uretim_import_sablonu.xlsx');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]]);
      const rows = json.map((r) => ({
        product_code: String(r['Ürün Kodu'] ?? '').trim(),
        planned_quantity: Number(r['Planlanan Adet'] ?? 0),
        production_cost: Number(r['Maliyet'] ?? 0),
        notes: r['Notlar'] ? String(r['Notlar']) : undefined,
      }));
      const result = await bulkImportBatches(rows);
      if (result.errors.length) {
        toast.warning(`${result.imported} üretim emri aktarıldı, hatalar: ${result.errors.slice(0, 3).join('; ')}`);
      } else {
        toast.success(`${result.imported} üretim emri içe aktarıldı (kuyrukta)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İçe aktarma başarısız');
    } finally {
      e.target.value = '';
    }
  };

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: 'batch_number', header: 'Emir No', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    { id: 'product', header: 'Ürün', accessorFn: (r) => `${r.products?.product_code ?? ''} — ${r.products?.name ?? ''}` },
    { accessorKey: 'planned_quantity', header: 'Planlanan', cell: ({ getValue }) => formatNumber(getValue<number>()) },
    { accessorKey: 'completed_quantity', header: 'Tamamlanan', cell: ({ getValue }) => formatNumber(getValue<number>() ?? 0) },
    { accessorKey: 'production_cost', header: 'Maliyet', cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(Number(getValue() ?? 0))}</span> },
    { accessorKey: 'started_at', header: 'Başlangıç', cell: ({ getValue }) => getValue<string>() ?? '—' },
    { accessorKey: 'completed_at', header: 'Bitiş', cell: ({ getValue }) => getValue<string>() ?? '—' },
    {
      accessorKey: 'status', header: 'Durum',
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return <Badge variant={STATUS_TONE[v] ?? 'secondary'}>{STATUS_LABEL[v] ?? v}</Badge>;
      },
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="flex justify-end gap-1">
            {b.status === 'queued' && (
              <Button variant="ghost" size="icon" title="Üretimi başlat" onClick={() => handleStart(b.id)}>
                <Play className="h-4 w-4 text-primary" />
              </Button>
            )}
            {b.status === 'in_production' && (
              <Button variant="ghost" size="icon" title="Tamamla" onClick={() => handleComplete(b.id, b.planned_quantity)}>
                <CheckCircle2 className="h-4 w-4 text-success" />
              </Button>
            )}
            {b.status === 'completed' && (
              <Button variant="ghost" size="icon" title="Stoğa aktar" onClick={() => handleTransfer(b.id, b.batch_number)}>
                <PackageCheck className="h-4 w-4 text-success" />
              </Button>
            )}
            {(b.status === 'queued' || b.status === 'in_production') && (
              <Button variant="ghost" size="icon" title="İptal et" onClick={() => handleCancel(b.id, b.batch_number)}>
                <Ban className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const table = useReactTable({
    data: batches, columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const handleStart = async (id: string) => {
    try {
      await startProduction(id);
      toast.success('Üretim başlatıldı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  };

  const handleComplete = async (id: string, planned: number) => {
    const input = prompt(`Tamamlanan adet (planlanan: ${planned}):`, String(planned));
    if (input === null) return;
    const qty = Number(input);
    if (!qty || qty < 1) { toast.error('Geçersiz adet'); return; }
    try {
      await completeProduction(id, qty);
      toast.success('Üretim tamamlandı — şimdi stoğa aktarabilirsiniz');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    }
  };

  const handleTransfer = async (id: string, batchNumber: string) => {
    if (!confirm(`"${batchNumber}" üretimini stoğa aktarmak istediğinize emin misiniz?`)) return;
    try {
      await transferBatchToStock(id);
      toast.success('Üretim stoğa aktarıldı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aktarım başarısız');
    }
  };

  const handleCancel = async (id: string, batchNumber: string) => {
    if (!confirm(`"${batchNumber}" üretim emrini iptal etmek istediğinize emin misiniz?`)) return;
    try {
      await cancelBatch(id);
      toast.success('Üretim emri iptal edildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İptal başarısız');
    }
  };

  const handleExport = () => {
    const rows = table.getFilteredRowModel().rows.map((r: any) => ({
      'Emir No': r.original.batch_number,
      'Ürün': `${r.original.products?.product_code ?? ''} ${r.original.products?.name ?? ''}`.trim(),
      'Planlanan': r.original.planned_quantity,
      'Tamamlanan': r.original.completed_quantity ?? 0,
      'Maliyet': Number(r.original.production_cost ?? 0),
      'Başlangıç': r.original.started_at ?? '',
      'Bitiş': r.original.completed_at ?? '',
      'Durum': STATUS_LABEL[r.original.status] ?? r.original.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Üretim');
    XLSX.writeFile(wb, `uretim_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Üretim ara…" className="pl-8" />
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
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Üretim Emri
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : (
                    <button className="flex items-center gap-1 disabled:cursor-default" disabled={!header.column.getCanSort()} onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3 opacity-50" />}
                    </button>
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                Üretim emri bulunamadı.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {table.getFilteredRowModel().rows.length} emir · Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <BatchDialog open={dialogOpen} onOpenChange={setDialogOpen} products={products} />
    </div>
  );
}
