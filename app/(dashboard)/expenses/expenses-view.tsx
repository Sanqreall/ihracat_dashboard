'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { readImportRows, getField, getText, getNumber } from '@/lib/excel';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { Plus, Search, Download, Trash2, Pencil, ChevronLeft, ChevronRight, ArrowUpDown , Upload} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TablePagination } from '@/components/layout/table-pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { excelCellToISODate, formatCurrency } from '@/lib/utils';
import { createExpense, updateExpense, deleteExpenses, type ExpenseInput , bulkImportExpenses } from './actions';

type Row = Record<string, any>;
type Option = { id: string; name: string };

function ExpenseDialog({
  open, onOpenChange, categories, expense,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; categories: Option[]; expense?: Row | null;
}) {
  const { register, handleSubmit, setValue, watch, reset, formState: { isSubmitting } } = useForm<ExpenseInput>({
    defaultValues: expense
      ? { expense_date: expense.expense_date, category_id: expense.category_id, description: expense.description ?? '', amount: Number(expense.amount), is_monthly: !!expense.is_monthly, period_month: expense.period_month ?? null }
      : { expense_date: new Date().toISOString().slice(0, 10), amount: 0, description: '', is_monthly: false, period_month: null },
  });

  const onSubmit = async (values: ExpenseInput) => {
    try {
      if (!values.category_id) { toast.error('Kategori seçiniz'); return; }
      if (expense?.id) {
        await updateExpense(expense.id, values);
        toast.success('Gider güncellendi');
      } else {
        await createExpense(values);
        toast.success('Gider kaydedildi');
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{expense ? 'Gideri Düzenle' : 'Yeni Gider'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tarih</Label>
            <Input type="date" {...register('expense_date')} />
          </div>
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Select value={watch('category_id') || undefined} onValueChange={(v) => setValue('category_id', v)}>
              <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tutar</Label>
            <Input type="number" step="0.01" min={0} {...register('amount')} />
          </div>
          <div className="space-y-1.5">
            <Label>Açıklama</Label>
            <Input {...register('description')} />
          </div>
          <div className="rounded-md border border-border p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={!!watch('is_monthly')}
                onChange={(e) => setValue('is_monthly', e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input"
              />
              <span className="space-y-0.5">
                <span className="block text-sm font-medium">Aylık gider (güne böl)</span>
                <span className="block text-xs text-muted-foreground">
                  Reklam, ajans gibi aylık giderler. Raporlarda ayın her gününe eşit bölünür.
                </span>
              </span>
            </label>
            {watch('is_monthly') && (
              <div className="mt-3 space-y-1.5">
                <Label className="text-xs">Ait Olduğu Ay</Label>
                <Input
                  type="month"
                  value={(watch('period_month') ?? watch('expense_date') ?? '').slice(0, 7)}
                  onChange={(e) => setValue('period_month', e.target.value ? `${e.target.value}-01` : null)}
                />
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

export function ExpensesView({ data, categories }: { data: Row[]; categories: Option[] }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthTotals = useMemo(() => {
    const thisMonth = data.filter((e) => String(e.expense_date).startsWith(currentMonth));
    const total = thisMonth.reduce((s, e) => s + Number(e.amount ?? 0), 0);
    const byCategory = new Map<string, number>();
    thisMonth.forEach((e) => {
      const name = e.expense_categories?.name ?? 'Diğer';
      byCategory.set(name, (byCategory.get(name) ?? 0) + Number(e.amount ?? 0));
    });
    const top = Array.from(byCategory.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { total, top };
  }, [data, currentMonth]);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} />,
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
      enableSorting: false,
    },
    { accessorKey: 'expense_date', header: 'Tarih', cell: ({ row, getValue }) => (
      <span className="flex items-center gap-1.5">
        {getValue<string>()}
        {row.original.is_monthly && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary" title="Aylık gider, raporda güne bölünür">
            Aylık
          </span>
        )}
      </span>
    ) },
    { id: 'category', header: 'Kategori', accessorFn: (r) => r.expense_categories?.name ?? '—' },
    { accessorKey: 'description', header: 'Açıklama', cell: ({ getValue }) => getValue<string>() || '—' },
    { accessorKey: 'amount', header: 'Tutar', cell: ({ getValue }) => <span className="tabular-nums font-medium">{formatCurrency(Number(getValue()))}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" onClick={() => { setEditing(row.original); setDialogOpen(true); }}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
      enableSorting: false,
    },
  ], []);

  const table = useReactTable({
    data, columns,
    state: { globalFilter, sorting, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
  });

  const selectedIds = Object.keys(rowSelection).map((idx) => data[Number(idx)]?.id).filter(Boolean);

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`${selectedIds.length} gideri silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteExpenses(selectedIds);
      setRowSelection({});
      toast.success('Seçili giderler silindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme başarısız');
    }
  };

  const handleDownloadTemplate = () => {
    // Kolonlar gider ekleme formuyla ve dışa aktarım çıktısıyla birebir aynıdır
    const ws = XLSX.utils.json_to_sheet([
      { 'Tarih': '2026-07-01', 'Kategori': 'Kira', 'Açıklama': 'Temmuz atölye kirası', 'Tutar': 15000 },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'gider_import_sablonu.xlsx');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Kendi dışa aktarımımız iki sayfalı: doğru (içe aktarılabilir) sayfayı seç
      const json = await readImportRows(file, ['Tarih', 'Tutar']);
      const rows = json.map((r) => ({
        expense_date: excelCellToISODate(getField(r, 'Tarih', 'Gider Tarihi')),
        category_name: getText(r, 'Kategori', 'Gider Kategorisi'),
        description: getText(r, 'Açıklama', 'Not'),
        amount: getNumber(r, ['Tutar', 'Gider', 'Miktar'], 0),
      }));
      const result = await bulkImportExpenses(rows);
      if (result.errors.length) {
        toast.warning(`${result.imported} gider aktarıldı; hatalar: ${result.errors.slice(0, 3).join('; ')}`);
      } else {
        toast.success(`${result.imported} gider içe aktarıldı`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İçe aktarma başarısız');
    } finally {
      e.target.value = '';
    }
  };

  const handleExport = () => {
    const rows = table.getFilteredRowModel().rows.map((r: any) => ({
      'Tarih': r.original.expense_date,
      'Kategori': r.original.expense_categories?.name ?? '',
      'Açıklama': r.original.description ?? '',
      'Sipariş': r.original.order_number ?? '',
      'Tutar': Number(r.original.amount ?? 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Giderler');
    XLSX.writeFile(wb, `giderler_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle>Bu Ay Toplam Gider</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-semibold tracking-tight">{formatCurrency(monthTotals.total)}</div></CardContent>
        </Card>
        {monthTotals.top.map(([name, amount]) => (
          <Card key={name}>
            <CardHeader className="pb-2"><CardTitle>{name}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold tracking-tight">{formatCurrency(amount)}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Gider ara…" className="pl-8" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Sil ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>Şablon indir</Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> İçe Aktar
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" /> Dışa Aktar
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setDialogOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Gider
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
              <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                Gider bulunamadı.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <TablePagination table={table} label="gider" />

      {dialogOpen && (
        <ExpenseDialog open={dialogOpen} onOpenChange={setDialogOpen} categories={categories} expense={editing} />
      )}
    </div>
  );
}
