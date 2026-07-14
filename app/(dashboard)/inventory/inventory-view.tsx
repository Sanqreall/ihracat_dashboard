'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { readImportRows, getText, getNumber } from '@/lib/excel';
import { StockDetailDialog } from './stock-detail-dialog';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Plus, Search, Download, Upload, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TablePagination } from '@/components/layout/table-pagination';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import { createAdjustment, bulkImportAdjustments } from './actions';

type Row = Record<string, any>;
type ProductOption = { id: string; product_code: string; name: string };

const MOVEMENT_LABEL: Record<string, string> = {
  purchase: 'Satın Alma', production: 'Üretim', sale: 'Satış', return: 'İade',
  adjustment: 'Düzeltme', manual: 'Manuel', transfer: 'Transfer', cancellation: 'İptal / Geri Alma',
};
const MOVEMENT_TONE: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  purchase: 'success', production: 'default', sale: 'destructive', return: 'success',
  adjustment: 'warning', manual: 'secondary', transfer: 'secondary', cancellation: 'warning',
};

function useSimpleTable(data: Row[], columns: ColumnDef<Row>[], pageSize = 50) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data, columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  return { table, globalFilter, setGlobalFilter };
}

function SimpleTableView({ table, columns, emptyText }: { table: any; columns: ColumnDef<Row>[]; emptyText: string }) {
  return (
    <>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg: any) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header: any) => (
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
            table.getRowModel().rows.map((row: any) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell: any) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">{emptyText}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <TablePagination table={table} label="kayıt" />
    </>
  );
}

function AdjustmentDialog({ open, onOpenChange, products }: { open: boolean; onOpenChange: (o: boolean) => void; products: ProductOption[] }) {
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<{ product_id: string; quantity: number; notes: string }>({
    defaultValues: { quantity: 0, notes: '' },
  });

  const onSubmit = async (values: { product_id: string; quantity: number; notes: string }) => {
    try {
      if (!values.product_id) { toast.error('Ürün seçiniz'); return; }
      if (!values.quantity || Number(values.quantity) === 0) { toast.error('Miktar 0 olamaz'); return; }
      await createAdjustment({ product_id: values.product_id, quantity: Number(values.quantity), notes: values.notes });
      toast.success('Stok düzeltmesi kaydedildi');
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Manuel Stok Düzeltmesi</DialogTitle></DialogHeader>
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
            <Label>Miktar (pozitif = giriş, negatif = çıkış)</Label>
            <Input type="number" {...register('quantity')} placeholder="Örn. 5 veya -3" />
          </div>
          <div className="space-y-1.5">
            <Label>Açıklama</Label>
            <Input {...register('notes')} placeholder="Sayım farkı, hasarlı ürün vb." />
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

export function InventoryView({ summary, movements, products }: { summary: Row[]; movements: Row[]; products: ProductOption[] }) {
  const [tab, setTab] = useState<'summary' | 'ledger'>('summary');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Ürün Kodu': 'YNG-001', 'Miktar': 5, 'Açıklama': 'Sayım farkı (pozitif giriş, negatif çıkış)' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'stok_duzeltme_sablonu.xlsx');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Kendi dışa aktarımımız iki sayfalı: doğru (içe aktarılabilir) sayfayı seç
      const json = await readImportRows(file, ['Ürün Kodu', 'Miktar']);
      const rows = json.map((r) => ({
        product_code: getText(r, 'Ürün Kodu', 'Kod', 'Stok Kodu') ?? '',
        quantity: getNumber(r, ['Miktar', 'Adet'], 0),
        notes: getText(r, 'Açıklama', 'Not'),
      }));
      const result = await bulkImportAdjustments(rows);
      if (result.errors.length) {
        toast.warning(`${result.imported} hareket aktarıldı, ${result.errors.length} satır atlandı: ${result.errors.slice(0, 3).join('; ')}`);
      } else {
        toast.success(`${result.imported} stok hareketi içe aktarıldı`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İçe aktarma başarısız');
    } finally {
      e.target.value = '';
    }
  };

  const summaryColumns = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: 'product_code', header: 'Kod', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    {
      accessorKey: 'name', header: 'Ürün',
      cell: ({ row, getValue }) => (
        <button
          type="button"
          onClick={() => setDetailProductId(row.original.id)}
          className="text-left font-medium text-primary underline-offset-2 hover:underline"
          title="Stok kaynaklarını gör"
        >
          {getValue<string>()}
        </button>
      ),
    },
    {
      accessorKey: 'current_stock', header: 'Mevcut',
      cell: ({ row }) => (
        <span className={cn('tabular-nums', row.original.is_critical && 'font-semibold text-destructive')}>
          {formatNumber(row.original.current_stock)}
        </span>
      ),
    },
    { accessorKey: 'production_stock', header: 'Üretimde', cell: ({ getValue }) => formatNumber(getValue<number>()) },
    { accessorKey: 'available_stock', header: 'Kullanılabilir', cell: ({ getValue }) => <span className="font-medium tabular-nums">{formatNumber(getValue<number>())}</span> },
    { accessorKey: 'critical_stock', header: 'Kritik Eşik', cell: ({ getValue }) => formatNumber(getValue<number>()) },
    { accessorKey: 'production_value_cost', header: 'Üretimdeki Değer', cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{formatCurrency(getValue<number>())}</span> },
    { accessorKey: 'inventory_value_cost', header: 'Stok Değeri (Maliyet)', cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue<number>())}</span> },
    { accessorKey: 'inventory_value_sales', header: 'Stok Değeri (Satış)', cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(getValue<number>())}</span> },
  ], []);

  const ledgerColumns = useMemo<ColumnDef<Row>[]>(() => [
    {
      accessorKey: 'created_at', header: 'Tarih',
      cell: ({ getValue }) => format(new Date(getValue<string>()), 'dd.MM.yyyy HH:mm'),
    },
    { id: 'product', header: 'Ürün', accessorFn: (r) => `${r.products?.product_code ?? ''} ${r.products?.name ?? ''}`.trim() || '—' },
    {
      accessorKey: 'movement_type', header: 'Hareket',
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return <Badge variant={MOVEMENT_TONE[v] ?? 'secondary'}>{MOVEMENT_LABEL[v] ?? v}</Badge>;
      },
    },
    {
      accessorKey: 'quantity', header: 'Miktar',
      cell: ({ getValue }) => {
        const q = getValue<number>();
        return <span className={cn('tabular-nums font-medium', q > 0 ? 'text-success' : 'text-destructive')}>{q > 0 ? '+' : ''}{formatNumber(q)}</span>;
      },
    },
    {
      id: 'reference', header: 'Referans',
      accessorFn: (r) => r.reference_label ?? '',
      cell: ({ row }) => {
        const label = row.original.reference_label;
        const href = row.original.reference_href;
        if (!label) return <span className="text-muted-foreground">—</span>;
        return href ? (
          <Link href={href} className="font-mono text-xs text-primary underline-offset-2 hover:underline">
            {label}
          </Link>
        ) : (
          <span className="font-mono text-xs">{label}</span>
        );
      },
    },
    { accessorKey: 'notes', header: 'Açıklama', cell: ({ getValue }) => getValue<string>() ?? '—' },
  ], []);

  const summaryTable = useSimpleTable(summary, summaryColumns);
  const ledgerTable = useSimpleTable(movements, ledgerColumns, 50);

  const active = tab === 'summary' ? summaryTable : ledgerTable;

  const handleExport = () => {
    if (tab === 'summary') {
      const rows = summaryTable.table.getFilteredRowModel().rows.map((r: any) => ({
        'Kod': r.original.product_code, 'Ürün': r.original.name,
        'Mevcut Stok': r.original.current_stock, 'Üretimde': r.original.production_stock,
        'Kullanılabilir': r.original.available_stock,
        'Kritik Eşik': r.original.critical_stock,
        'Üretimdeki Değer (Maliyet)': r.original.production_value_cost,
        'Stok Değeri (Maliyet)': r.original.inventory_value_cost,
        'Stok Değeri (Satış)': r.original.inventory_value_sales,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stok Özeti');
      XLSX.writeFile(wb, `stok_ozeti_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      const rows = ledgerTable.table.getFilteredRowModel().rows.map((r: any) => ({
        'Tarih': format(new Date(r.original.created_at), 'dd.MM.yyyy HH:mm'),
        'Ürün': `${r.original.products?.product_code ?? ''} ${r.original.products?.name ?? ''}`.trim(),
        'Hareket': MOVEMENT_LABEL[r.original.movement_type] ?? r.original.movement_type,
        'Miktar': r.original.quantity,
        'Referans': r.original.reference_label ?? '',
        'Açıklama': r.original.notes ?? '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Stok Hareketleri');
      XLSX.writeFile(wb, `stok_hareketleri_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-md border border-border p-0.5">
          <button
            className={cn('rounded px-3 py-1.5 text-sm', tab === 'summary' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => setTab('summary')}
          >
            Stok Özeti
          </button>
          <button
            className={cn('rounded px-3 py-1.5 text-sm', tab === 'ledger' ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground')}
            onClick={() => setTab('ledger')}
          >
            Hareket Geçmişi
          </button>
        </div>

        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={active.globalFilter} onChange={(e) => active.setGlobalFilter(e.target.value)} placeholder="Ara…" className="pl-8" />
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
          <Button size="sm" onClick={() => setAdjustOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Stok Düzeltmesi
          </Button>
        </div>
      </div>

      {tab === 'summary' ? (
        <>
          <InventoryTotals table={summaryTable.table} />
          <SimpleTableView table={summaryTable.table} columns={summaryColumns} emptyText="Ürün bulunamadı." />
        </>
      ) : (
        <SimpleTableView table={ledgerTable.table} columns={ledgerColumns} emptyText="Henüz stok hareketi yok." />
      )}

      <StockDetailDialog
        productId={detailProductId}
        open={detailProductId !== null}
        onOpenChange={(v) => { if (!v) setDetailProductId(null); }}
      />
      <AdjustmentDialog open={adjustOpen} onOpenChange={setAdjustOpen} products={products} />
    </div>
  );
}

// Filtreye duyarlı stok değeri toplamları (görünen/filtrelenen satırlardan)
function InventoryTotals({ table }: { table: any }) {
  const rows = table.getFilteredRowModel().rows;
  const sum = (key: string) => rows.reduce((s: number, r: any) => s + Number(r.original[key] ?? 0), 0);

  const totalUnits = sum('current_stock');
  const totalCost = sum('inventory_value_cost');
  const totalSales = sum('inventory_value_sales');
  const productionUnits = sum('production_stock');
  const productionCost = sum('production_value_cost');

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle>Toplam Stok Adedi</CardTitle></CardHeader>
        <CardContent><div className="text-2xl font-semibold">{formatNumber(totalUnits)}</div></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle>Stok Değeri (Maliyet)</CardTitle></CardHeader>
        <CardContent><div className="text-2xl font-semibold">{formatCurrency(totalCost)}</div></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle>Stok Değeri (Satış)</CardTitle></CardHeader>
        <CardContent><div className="text-2xl font-semibold">{formatCurrency(totalSales)}</div></CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle>Üretimdeki Değer (Maliyet)</CardTitle></CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{formatCurrency(productionCost)}</div>
          <p className="mt-1 text-xs text-muted-foreground">{formatNumber(productionUnits)} adet üretimde</p>
        </CardContent>
      </Card>
    </div>
  );
}
