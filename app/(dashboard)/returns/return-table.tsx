'use client';

import { useMemo, useRef, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Plus, Search, Download, Upload, Trash2, PackageCheck, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatCurrency, formatNumber, excelCellToISODate } from '@/lib/utils';
import { ReturnForm } from './return-form';
import { transferReturnToInventory, deleteReturn, generateReturnNumber, bulkImportReturns } from './actions';

type Row = Record<string, any>;
type Option = { id: string; name: string };
type ProductOption = { id: string; product_code: string; name: string; sales_price: number };
type OrderLite = {
  id: string; order_number: string; customer_id: string | null; platform_id: string | null;
  customers: { name: string | null; phone: string | null } | null;
  order_items: { product_id: string; quantity: number; unit_price: number }[];
  returns: { return_items: { product_id: string; quantity: number }[] }[] | null;
};

export function ReturnTable({
  data, platforms, products, orders, initialFilter = '',
}: {
  data: Row[];
  platforms: Option[];
  products: ProductOption[];
  orders: OrderLite[];
  initialFilter?: string;
}) {
  const [globalFilter, setGlobalFilter] = useState(initialFilter);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [suggestedNumber, setSuggestedNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'İade No': 'IAD-2026-90001', 'Tarih': '2026-07-01', 'Sipariş No': 'SIP-2026-00001',
        'Ürün Kodu': 'YNG-001', 'Adet': 1, 'Birim Fiyat': 1500,
        'Neden': 'Hasarlı ürün', 'İade Tutarı': 1500,
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'iade_import_sablonu.xlsx');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]]);
      const rows = json.map((r) => ({
        return_number: String(r['İade No'] ?? '').trim(),
        return_date: excelCellToISODate(r['Tarih']),
        order_number: r['Sipariş No'] ? String(r['Sipariş No']).trim() : undefined,
        product_code: String(r['Ürün Kodu'] ?? '').trim(),
        quantity: Number(r['Adet'] ?? 1),
        unit_price: Number(r['Birim Fiyat'] ?? 0),
        reason: r['Neden'] ? String(r['Neden']) : undefined,
        refund_amount: Number(r['İade Tutarı'] ?? 0),
      }));
      const result = await bulkImportReturns(rows);
      let msg = `${result.imported} iade içe aktarıldı`;
      if (result.skipped.length) msg += `, ${result.skipped.length} mevcut iade atlandı`;
      if (result.errors.length) {
        toast.warning(`${msg}. Hatalar: ${result.errors.slice(0, 3).join('; ')}`);
      } else {
        toast.success(msg + ' — stoğa aktarmak için her iadenin yanındaki butonu kullanın');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İçe aktarma başarısız');
    } finally {
      e.target.value = '';
    }
  };

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { accessorKey: 'return_number', header: 'İade No', cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span> },
    { accessorKey: 'return_date', header: 'Tarih' },
    { id: 'order', header: 'Sipariş', accessorFn: (r) => r.orders?.order_number ?? '—' },
    { id: 'platform', header: 'Platform', accessorFn: (r) => r.platforms?.name ?? '—' },
    { id: 'customer', header: 'Müşteri', accessorFn: (r) => r.customers?.name ?? '—' },
    { accessorKey: 'reason', header: 'Neden', cell: ({ getValue }) => getValue<string>() ?? '—' },
    {
      id: 'qty', header: 'Adet',
      accessorFn: (r) => (r.return_items ?? []).reduce((s: number, i: any) => s + (i.quantity ?? 0), 0),
      cell: ({ getValue }) => formatNumber(getValue<number>()),
    },
    { accessorKey: 'refund_amount', header: 'İade Tutarı', cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(Number(getValue()))}</span> },
    {
      accessorKey: 'transferred_to_inventory', header: 'Stok',
      cell: ({ getValue }) => getValue<boolean>()
        ? <Badge variant="success">Stoğa Aktarıldı</Badge>
        : <Badge variant="warning">Bekliyor</Badge>,
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          {!row.original.transferred_to_inventory && (
            <Button variant="ghost" size="icon" title="Stoğa aktar" onClick={() => handleTransfer(row.original.id, row.original.return_number)}>
              <PackageCheck className="h-4 w-4 text-success" />
            </Button>
          )}
          <Button variant="ghost" size="icon" title="Sil" onClick={() => handleDelete(row.original.id, row.original.return_number)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  const table = useReactTable({
    data, columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const handleNew = async () => {
    try {
      const num = await generateReturnNumber();
      setSuggestedNumber(num);
      setFormOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İade numarası oluşturulamadı');
    }
  };

  const handleTransfer = async (id: string, returnNumber: string) => {
    if (!confirm(`"${returnNumber}" iadesindeki ürünleri stoğa aktarmak istediğinize emin misiniz?`)) return;
    try {
      await transferReturnToInventory(id);
      toast.success('İade stoğa aktarıldı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aktarım başarısız');
    }
  };

  const handleDelete = async (id: string, returnNumber: string) => {
    if (!confirm(`"${returnNumber}" iadesini silmek istediğinize emin misiniz?${'\n'}Stoğa aktarılmışsa stok etkisi geri alınacak.`)) return;
    try {
      await deleteReturn(id);
      toast.success('İade silindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme başarısız');
    }
  };

  const handleExport = () => {
    const rows = table.getFilteredRowModel().rows.map((r: any) => ({
      'İade No': r.original.return_number,
      'Tarih': r.original.return_date,
      'Sipariş': r.original.orders?.order_number ?? '',
      'Platform': r.original.platforms?.name ?? '',
      'Müşteri': r.original.customers?.name ?? '',
      'Neden': r.original.reason ?? '',
      'Adet': (r.original.return_items ?? []).reduce((s: number, i: any) => s + (i.quantity ?? 0), 0),
      'İade Tutarı': Number(r.original.refund_amount ?? 0),
      'Stoğa Aktarıldı': r.original.transferred_to_inventory ? 'Evet' : 'Hayır',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'İadeler');
    XLSX.writeFile(wb, `iadeler_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="İade ara…" className="pl-8" />
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
            <Plus className="mr-1.5 h-4 w-4" /> Yeni İade
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
                İade bulunamadı.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {table.getFilteredRowModel().rows.length} iade · Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <ReturnForm
        open={formOpen}
        onOpenChange={setFormOpen}
        platforms={platforms}
        products={products}
        orders={orders}
        suggestedNumber={suggestedNumber}
      />
    </div>
  );
}
