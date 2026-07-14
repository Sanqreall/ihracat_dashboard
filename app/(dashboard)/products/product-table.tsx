'use client';

import { useMemo, useRef, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { readImportRows, getText, getNumber } from '@/lib/excel';
import { toast } from 'sonner';
import {
  Plus, Search, Download, Upload, Trash2, Pencil, ChevronLeft, ChevronRight, ArrowUpDown, Columns3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TablePagination } from '@/components/layout/table-pagination';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { ProductForm } from './product-form';
import { softDeleteProducts, bulkImportProducts } from './actions';
import type { ProductInput } from '@/lib/validations/product';

type Row = Record<string, any>;
type Option = { id: string; name: string };

const STATUS_LABEL: Record<string, string> = { active: 'Aktif', passive: 'Pasif', discontinued: 'Durduruldu' };
const STATUS_TONE: Record<string, 'success' | 'secondary' | 'destructive'> = { active: 'success', passive: 'secondary', discontinued: 'destructive' };

export function ProductTable({ data, series }: { data: Row[]; series: Option[] }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        />
      ),
      cell: ({ row }) => (
        <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'product_code',
      header: 'Kod',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.product_code}</span>,
    },
    { accessorKey: 'name', header: 'Ürün Adı' },
    { id: 'series', header: 'Seri', accessorFn: (r) => r.series?.name ?? '—' },
    {
      accessorKey: 'sales_price',
      header: 'Satış Fiyatı',
      cell: ({ getValue }) => formatCurrency(getValue<number>()),
    },
    {
      accessorKey: 'current_stock',
      header: 'Stok',
      cell: ({ row }) => {
        const stock = row.original.current_stock ?? 0;
        const critical = row.original.critical_stock ?? 0;
        return (
          <span className={stock <= critical ? 'font-semibold text-destructive' : ''}>
            {formatNumber(stock)}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Durum',
      cell: ({ getValue }) => {
        const v = getValue<string>();
        return <Badge variant={STATUS_TONE[v] ?? 'secondary'}>{STATUS_LABEL[v] ?? v}</Badge>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button variant="ghost" size="icon" onClick={() => { setEditing(row.original); setFormOpen(true); }}>
          <Pencil className="h-4 w-4" />
        </Button>
      ),
      enableSorting: false,
    },
  ], []);

  const table = useReactTable({
    data,
    columns,
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
    if (!confirm(`${selectedIds.length} ürünü silmek istediğinize emin misiniz?`)) return;
    await softDeleteProducts(selectedIds);
    setRowSelection({});
    toast.success('Seçili ürünler silindi');
  };

  const handleExport = () => {
    // Dışa aktarım kolonları şablonla birebir aynı => çıktı doğrudan geri yüklenebilir
    const rows = table.getFilteredRowModel().rows.map((r) => ({
      'Ürün Kodu': r.original.product_code,
      'Ürün Adı': r.original.name,
      'Marka': r.original.brand ?? '',
      'Satış Fiyatı': Number(r.original.sales_price ?? 0),
      'Maliyet Fiyatı': Number(r.original.cost_price ?? 0),
      'KDV': Number(r.original.tax_rate ?? 10),
      'Ağırlık (kg)': Number(r.original.weight_kg ?? 0),
      'Desi': Number(r.original.desi ?? 0),
      'Mevcut Stok': Number(r.original.current_stock ?? 0),
      'Kritik Stok': Number(r.original.critical_stock ?? 0),
      'Durum': r.original.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ürünler');
    XLSX.writeFile(wb, `urunler_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { 'Ürün Kodu': 'YNG-001', 'Ürün Adı': 'Örnek Koltuk', 'Marka': 'Yonga', 'Satış Fiyatı': 1000, 'Maliyet Fiyatı': 600, 'KDV': 10, 'Ağırlık (kg)': 12, 'Desi': 5, 'Mevcut Stok': 10, 'Kritik Stok': 2, 'Durum': 'active' },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'urun_import_sablonu.xlsx');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      // Kendi dışa aktarımımız/şablonumuz uyumlu sayfayı otomatik seçer
      const json = await readImportRows(file, ['Ürün Kodu', 'Ürün Adı']);
      const rows: ProductInput[] = json.map((r) => ({
        product_code: getText(r, 'Ürün Kodu', 'Kod', 'Stok Kodu') ?? '',
        name: getText(r, 'Ürün Adı', 'Ad', 'İsim') ?? '',
        brand: getText(r, 'Marka') ?? null,
        sales_price: getNumber(r, ['Satış Fiyatı', 'Fiyat'], 0),
        cost_price: getNumber(r, ['Maliyet Fiyatı', 'Maliyet'], 0),
        tax_rate: getNumber(r, ['KDV', 'KDV Oranı'], 10),
        weight_kg: getNumber(r, ['Ağırlık (kg)', 'Ağırlık', 'Kg'], 0),
        desi: getNumber(r, ['Desi'], 0),
        current_stock: getNumber(r, ['Mevcut Stok', 'Stok'], 0),
        critical_stock: getNumber(r, ['Kritik Stok', 'Kritik Eşik'], 0),
        status: ((getText(r, 'Durum') as ProductInput['status']) ?? 'active'),
      }));
      const result = await bulkImportProducts(rows);
      toast.success(`${result.imported} ürün içe aktarıldı`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İçe aktarma başarısız');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Ürün ara…"
            className="pl-8"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Sil ({selectedIds.length})
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm"><Columns3 className="mr-1.5 h-4 w-4" />Sütunlar</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().filter((c) => c.id !== 'select' && c.id !== 'actions').map((column) => (
                <DropdownMenuItem key={column.id} onClick={() => column.toggleVisibility(!column.getIsVisible())}>
                  <Checkbox checked={column.getIsVisible()} className="mr-2" /> {String(column.columnDef.header)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>Şablon indir</Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> İçe Aktar
          </Button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />

          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" /> Dışa Aktar
          </Button>

          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Ürün
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
                    <button
                      className="flex items-center gap-1 disabled:cursor-default"
                      disabled={!header.column.getCanSort()}
                      onClick={header.column.getToggleSortingHandler()}
                    >
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
                Ürün bulunamadı. Yeni bir ürün ekleyin ya da Excel ile içe aktarın.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <TablePagination table={table} label="ürün" />

      <ProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing as any}
        series={series}
      />
    </div>
  );
}
