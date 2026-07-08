'use client';

import { useMemo, useRef, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { Plus, Search, Download, Upload, Trash2, Pencil, Ban, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatCurrency, excelCellToISODate } from '@/lib/utils';
import { OrderForm } from './order-form';
import { softDeleteOrders, cancelOrder, getOrder, generateOrderNumber, bulkImportOrders } from './actions';
import type { OrderInput } from '@/lib/validations/order';

type Row = Record<string, any>;
type Option = { id: string; name: string };
type ProductOption = { id: string; product_code: string; name: string; sales_price: number; tax_rate: number; current_stock: number };

const STATUS_LABEL: Record<string, string> = {
  draft: 'Taslak', confirmed: 'Onaylandı', processing: 'Hazırlanıyor',
  shipped: 'Kargolandı', delivered: 'Teslim Edildi', cancelled: 'İptal',
};
const STATUS_TONE: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'destructive'> = {
  draft: 'secondary', confirmed: 'default', processing: 'warning',
  shipped: 'default', delivered: 'success', cancelled: 'destructive',
};
const PAYMENT_LABEL: Record<string, string> = {
  unpaid: 'Ödenmedi', partial: 'Kısmi', paid: 'Ödendi', refunded: 'İade',
};

export function OrderTable({
  data, platforms, products, initialFilter = '',
}: {
  data: Row[];
  platforms: Option[];
  products: ProductOption[];
  initialFilter?: string;
}) {
  const [globalFilter, setGlobalFilter] = useState(initialFilter);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<(OrderInput & { id: string }) | null>(null);
  const [suggestedNumber, setSuggestedNumber] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} />,
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
      enableSorting: false,
    },
    {
      accessorKey: 'order_number',
      header: 'Sipariş No',
      cell: ({ getValue }) => <span className="font-mono text-xs">{getValue<string>()}</span>,
    },
    { accessorKey: 'order_date', header: 'Tarih' },
    { id: 'platform', header: 'Platform', accessorFn: (r) => r.platforms?.name ?? '—' },
    { id: 'customer', header: 'Müşteri', accessorFn: (r) => r.customers?.name ?? '—' },
    {
      id: 'item_count',
      header: 'Ürün',
      accessorFn: (r) => (r.order_items ?? []).reduce((s: number, i: any) => s + (i.quantity ?? 0), 0),
      cell: ({ getValue }) => `${getValue<number>()} adet`,
    },
    {
      accessorKey: 'total',
      header: 'Toplam',
      cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(Number(getValue()))}</span>,
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
      accessorKey: 'payment_status',
      header: 'Ödeme',
      cell: ({ getValue }) => PAYMENT_LABEL[getValue<string>()] ?? getValue<string>(),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Düzenle" onClick={() => handleEdit(row.original.id)}>
            <Pencil className="h-4 w-4" />
          </Button>
          {row.original.status !== 'cancelled' && (
            <Button variant="ghost" size="icon" title="İptal et" onClick={() => handleCancel(row.original.id, row.original.order_number)}>
              <Ban className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
      enableSorting: false,
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    initialState: { pagination: { pageSize: 10 } },
  });

  const selectedIds = Object.keys(rowSelection).map((idx) => data[Number(idx)]?.id).filter(Boolean);

  const handleNew = async () => {
    try {
      const num = await generateOrderNumber();
      setSuggestedNumber(num);
      setEditing(null);
      setFormOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sipariş numarası oluşturulamadı');
    }
  };

  const handleEdit = async (id: string) => {
    try {
      const full = await getOrder(id);
      setEditing({
        id: full.id,
        order_number: full.order_number,
        order_date: full.order_date,
        platform_id: full.platform_id,
        customer_id: full.customer_id,
        customer_name: full.customers?.name ?? '',
        customer_phone: full.customers?.phone ?? '',
        customer_address: full.shipping_address ?? full.customers?.shipping_address ?? '',
        items: (full.order_items ?? []).map((it: any) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: Number(it.unit_price),
          line_discount_percent: Number(it.line_discount_percent ?? 0),
          tax_rate: Number(it.tax_rate ?? 10),
        })),
        order_discount_percent: Number(full.order_discount_percent ?? 0),
        shipping_cost: Number(full.shipping_cost ?? 0),
        status: full.status,
        payment_status: full.payment_status,
        shipment_status: full.shipment_status,
        invoice_number: full.invoice_number ?? '',
        tracking_number: full.tracking_number ?? '',
        notes: full.notes ?? '',
      });
      setFormOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sipariş yüklenemedi');
    }
  };

  const handleCancel = async (id: string, orderNumber: string) => {
    if (!confirm(`"${orderNumber}" siparişini iptal etmek istediğinize emin misiniz? Stok geri alınacak.`)) return;
    try {
      await cancelOrder(id);
      toast.success('Sipariş iptal edildi, stok geri alındı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İptal başarısız');
    }
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`${selectedIds.length} siparişi silmek istediğinize emin misiniz? Stok etkileri geri alınacak.`)) return;
    try {
      await softDeleteOrders(selectedIds);
      setRowSelection({});
      toast.success('Seçili siparişler silindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme başarısız');
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        'Sipariş No': 'SIP-2026-90001', 'Tarih': '2026-07-01', 'Platform': 'So-mass',
        'Müşteri Adı': 'Ayşe Yılmaz', 'Telefon': '05xx xxx xx xx', 'Adres': 'Örnek Mah. No:1 Denizli',
        'Ürün Kodu': 'YNG-001', 'Adet': 2, 'Birim Fiyat': 1500,
        'Satır İndirim %': 0, 'Sipariş İndirim %': 0, 'Kargo': 0, 'Durum': 'Onaylandı',
      },
      {
        'Sipariş No': 'SIP-2026-90001', 'Tarih': '2026-07-01', 'Platform': 'So-mass',
        'Müşteri Adı': 'Ayşe Yılmaz', 'Telefon': '', 'Adres': '',
        'Ürün Kodu': 'YNG-002', 'Adet': 1, 'Birim Fiyat': 800,
        'Satır İndirim %': 10, 'Sipariş İndirim %': 0, 'Kargo': 0, 'Durum': 'Onaylandı',
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
    XLSX.writeFile(wb, 'siparis_import_sablonu.xlsx');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]]);
      const rows = json.map((r) => ({
        order_number: String(r['Sipariş No'] ?? '').trim(),
        order_date: excelCellToISODate(r['Tarih']),
        platform_name: String(r['Platform'] ?? '').trim(),
        customer_name: r['Müşteri Adı'] ? String(r['Müşteri Adı']) : undefined,
        customer_phone: r['Telefon'] ? String(r['Telefon']) : undefined,
        customer_address: r['Adres'] ? String(r['Adres']) : undefined,
        product_code: String(r['Ürün Kodu'] ?? '').trim(),
        quantity: Number(r['Adet'] ?? 1),
        unit_price: Number(r['Birim Fiyat'] ?? 0),
        line_discount_percent: Number(r['Satır İndirim %'] ?? 0),
        order_discount_percent: Number(r['Sipariş İndirim %'] ?? 0),
        shipping_cost: Number(r['Kargo'] ?? 0),
        status: r['Durum'] ? String(r['Durum']) : undefined,
      }));
      const result = await bulkImportOrders(rows);
      let msg = `${result.imported} sipariş içe aktarıldı`;
      if (result.skipped.length) msg += `, ${result.skipped.length} mevcut sipariş atlandı`;
      if (result.errors.length) {
        toast.warning(`${msg}. Hatalar: ${result.errors.slice(0, 3).join('; ')}`);
      } else {
        toast.success(msg);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İçe aktarma başarısız');
    } finally {
      e.target.value = '';
    }
  };

  const handleExport = () => {
    const rows = table.getFilteredRowModel().rows.map((r) => ({
      'Sipariş No': r.original.order_number,
      'Tarih': r.original.order_date,
      'Platform': r.original.platforms?.name ?? '',
      'Müşteri': r.original.customers?.name ?? '',
      'Ara Toplam (KDV dahil)': Number(r.original.subtotal),
      'Sipariş İndirimi': Number(r.original.order_discount_amount),
      'Kargo': Number(r.original.shipping_cost),
      'Genel Toplam': Number(r.original.total),
      'İçindeki KDV': Number(r.original.tax_amount),
      'Net Satış (KDV hariç)': Number(r.original.net_total),
      'Durum': STATUS_LABEL[r.original.status] ?? r.original.status,
      'Ödeme': PAYMENT_LABEL[r.original.payment_status] ?? r.original.payment_status,
      'Fatura No': r.original.invoice_number ?? '',
      'Takip No': r.original.tracking_number ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Siparişler');
    XLSX.writeFile(wb, `siparisler_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Sipariş ara…" className="pl-8" />
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
          <Button size="sm" onClick={handleNew}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Sipariş
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
                Sipariş bulunamadı. Yeni bir sipariş oluşturun veya Excel ile içe aktarın.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {table.getFilteredRowModel().rows.length} sipariş · Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <OrderForm
        open={formOpen}
        onOpenChange={setFormOpen}
        order={editing}
        platforms={platforms}
        products={products}
        suggestedNumber={suggestedNumber}
      />
    </div>
  );
}
