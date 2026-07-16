'use client';

import { Fragment, useMemo, useRef, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { readImportRows, getField, getText, getNumber, IMPORT_SHEET_NAME } from '@/lib/excel';
import { toast } from 'sonner';
import { Plus, Search, Download, Upload, Trash2, Pencil, Ban, ChevronLeft, ChevronRight, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { TablePagination } from '@/components/layout/table-pagination';
import { formatCurrency, formatNumber, formatUsd, excelCellToISODate, cn } from '@/lib/utils';
import Link from 'next/link';
import { OrderForm } from './order-form';
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, PAYMENT_STATUS_LABEL } from '@/lib/order-constants';
import { softDeleteOrders, cancelOrder, getOrder, generateOrderNumber, bulkImportOrders } from './actions';
import type { OrderInput } from '@/lib/validations/order';

type Row = Record<string, any>;
type Option = { id: string; name: string };
type ProductOption = { id: string; product_code: string; name: string; sales_price: number; tax_rate: number; current_stock: number; desi?: number };

const STATUS_LABEL = ORDER_STATUS_LABEL;
const STATUS_TONE = ORDER_STATUS_TONE;
const PAYMENT_LABEL = PAYMENT_STATUS_LABEL;

/** Siparişin ürün maliyeti: Σ adet × ürün maliyet fiyatı */
function orderCogs(order: Row): number {
  return ((order.order_items ?? []) as any[]).reduce(
    (s, it) => s + Number(it.quantity ?? 0) * Number(it.products?.cost_price ?? 0),
    0
  );
}

/**
 * Sipariş net kârı = Net Satış (KDV dahil, kargo hariç) − Ürün Maliyeti − Kargo − Komisyon
 * Kargo satış tutarına dahil değildir; burada maliyet olarak düşülür.
 */
function orderNetProfit(order: Row): number {
  const total = Number(order.total ?? 0);
  const cogs = orderCogs(order);
  const shipping = Number(order.shipping_cost ?? 0);
  const commission = Number(order.commission_amount ?? 0);
  return Math.round((total - cogs - shipping - commission) * 100) / 100;
}

export function OrderTable({
  data, platforms, products, initialFilter = '', pricePerDesi = 0,
}: {
  data: Row[];
  platforms: Option[];
  products: ProductOption[];
  initialFilter?: string;
  pricePerDesi?: number;
}) {
  const [globalFilter, setGlobalFilter] = useState(initialFilter);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<(OrderInput & { id: string }) | null>(null);
  const [suggestedNumber, setSuggestedNumber] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} />,
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
      enableSorting: false,
    },
    {
      id: 'expander',
      header: '',
      cell: ({ row }) => (
        <button type="button" onClick={(e) => { e.stopPropagation(); toggleExpand(row.original.id); }} className="text-muted-foreground hover:text-foreground">
          {expanded.has(row.original.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      ),
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
      header: 'Net Satış',
      cell: ({ getValue }) => <span className="tabular-nums">{formatCurrency(Number(getValue()))}</span>,
    },
    {
      accessorKey: 'total_usd',
      header: 'Net Satış (USD)',
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return v != null
          ? <span className="tabular-nums text-muted-foreground">{formatUsd(v)}</span>
          : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      accessorKey: 'usd_rate',
      header: 'Kur (₺/$)',
      cell: ({ getValue }) => {
        const v = getValue<number | null>();
        return v != null
          ? <span className="tabular-nums text-xs text-muted-foreground">{Number(v).toFixed(4)}</span>
          : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: 'commission',
      header: 'Komisyon',
      accessorFn: (r) => Number(r.commission_amount ?? 0),
      cell: ({ row }) => {
        const amt = Number(row.original.commission_amount ?? 0);
        const rate = Number(row.original.commission_rate ?? 0);
        return amt > 0
          ? <span className="tabular-nums text-muted-foreground">{formatCurrency(amt)} <span className="text-xs">(%{rate})</span></span>
          : <span className="text-muted-foreground">—</span>;
      },
    },
    {
      id: 'net_profit',
      header: 'Net Kâr',
      accessorFn: (r) => orderNetProfit(r),
      cell: ({ getValue }) => {
        const v = getValue<number>();
        return (
          <span className={v >= 0 ? 'tabular-nums font-medium text-success' : 'tabular-nums font-medium text-destructive'}>
            {formatCurrency(v)}
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
  ], [expanded]);

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting, rowSelection },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    // Özel arama: sipariş no, müşteri, telefon, platform, teslimat ili ve
    // sipariş içindeki ürün kodu/adı içinde arar.
    globalFilterFn: (row, _columnId, value) => {
      const q = String(value ?? '').trim().toLocaleLowerCase('tr');
      if (!q) return true;
      const o = row.original as any;
      const haystack: string[] = [
        o.order_number ?? '',
        o.customers?.name ?? '',
        o.customers?.phone ?? '',
        o.platforms?.name ?? '',
        o.delivery_province ?? '',
        o.shipping_address ?? '',
        o.invoice_number ?? '',
        o.tracking_number ?? '',
        ...((o.order_items ?? []) as any[]).flatMap((it) => [
          it.products?.product_code ?? '',
          it.products?.name ?? '',
        ]),
      ];
      return haystack.some((h) => String(h).toLocaleLowerCase('tr').includes(q));
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } },
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
        delivery_province: full.delivery_province ?? null,
        items: (full.order_items ?? []).map((it: any) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: Number(it.unit_price),
          line_discount_percent: Number(it.line_discount_percent ?? 0),
          line_discount_amount_input: Number(it.line_discount_amount_input ?? 0),
          tax_rate: Number(it.tax_rate ?? 10),
        })),
        order_discount_percent: Number(full.order_discount_percent ?? 0),
        order_discount_amount_input: Number(full.order_discount_amount_input ?? 0),
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
        'Satır İndirim %': 0, 'Satır İndirim ₺': 0, 'Sipariş İndirim %': 0, 'Sipariş İndirim ₺': 0, 'Kargo': 0, 'Durum': 'Onaylandı',
      },
      {
        'Sipariş No': 'SIP-2026-90001', 'Tarih': '2026-07-01', 'Platform': 'So-mass',
        'Müşteri Adı': 'Ayşe Yılmaz', 'Telefon': '', 'Adres': '',
        'Ürün Kodu': 'YNG-002', 'Adet': 1, 'Birim Fiyat': 800,
        'Satır İndirim %': 10, 'Satır İndirim ₺': 0, 'Sipariş İndirim %': 0, 'Sipariş İndirim ₺': 0, 'Kargo': 0, 'Durum': 'Onaylandı',
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
      // Kendi dışa aktarımımız iki sayfalı: doğru (içe aktarılabilir) sayfayı seç
      const json = await readImportRows(file, ['Sipariş No', 'Ürün Kodu', 'Adet']);
      const rows = json.map((r) => ({
        order_number: getText(r, 'Sipariş No', 'Siparis No', 'Sipariş Numarası') ?? '',
        order_date: excelCellToISODate(getField(r, 'Tarih', 'Sipariş Tarihi')),
        platform_name: getText(r, 'Platform', 'Satış Kanalı') ?? '',
        customer_name: getText(r, 'Müşteri Adı', 'Müşteri', 'Ad Soyad'),
        customer_phone: getText(r, 'Telefon', 'Tel', 'Cep Telefonu'),
        customer_address: getText(r, 'Adres', 'Teslimat Adresi'),
        delivery_province: getText(r, 'Teslimat İli', 'İl', 'Şehir'),
        product_code: getText(r, 'Ürün Kodu', 'Kod', 'Stok Kodu') ?? '',
        quantity: getNumber(r, ['Adet', 'Miktar'], 1),
        unit_price: getNumber(r, ['Birim Fiyat', 'Fiyat'], 0),
        line_discount_percent: getNumber(r, ['Satır İndirim %', 'Satır İndirim'], 0),
        line_discount_amount_input: getNumber(r, ['Satır İndirim ₺', 'Satır İndirim Tutar'], 0),
        order_discount_percent: getNumber(r, ['Sipariş İndirim %', 'Sipariş İndirim'], 0),
        order_discount_amount_input: getNumber(r, ['Sipariş İndirim ₺', 'Sipariş İndirim Tutar'], 0),
        shipping_cost: getNumber(r, ['Kargo', 'Kargo Ücreti'], 0),
        status: getText(r, 'Durum', 'Sipariş Durumu'),
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
      'Teslimat İli': r.original.delivery_province ?? '',
      'Ara Toplam (KDV dahil)': Number(r.original.subtotal),
      'Sipariş İndirimi': Number(r.original.order_discount_amount),
      'Kargo': Number(r.original.shipping_cost),
      'Net Satış (KDV dahil)': Number(r.original.total),
      'Net Satış (USD)': r.original.total_usd != null ? Number(r.original.total_usd) : '',
      'USD Kuru': r.original.usd_rate != null ? Number(r.original.usd_rate) : '',
      'İçindeki KDV': Number(r.original.tax_amount),
      'KDV Hariç Karşılığı': Number(r.original.net_total),
      'Komisyon Oranı %': Number(r.original.commission_rate ?? 0),
      'Komisyon Tutarı': Number(r.original.commission_amount ?? 0),
      'Ürün Maliyeti': orderCogs(r.original),
      'Net Kâr': orderNetProfit(r.original),
      'Durum': STATUS_LABEL[r.original.status] ?? r.original.status,
      'Ödeme': PAYMENT_LABEL[r.original.payment_status] ?? r.original.payment_status,
      'Fatura No': r.original.invoice_number ?? '',
      'Takip No': r.original.tracking_number ?? '',
    }));
    // 2. sayfa: içe aktarma şablonuyla BİREBİR aynı kolonlar => doğrudan geri yüklenebilir
    const importRows = table.getFilteredRowModel().rows.flatMap((r) =>
      ((r.original.order_items ?? []) as any[]).map((it) => ({
        'Sipariş No': r.original.order_number,
        'Tarih': r.original.order_date,
        'Platform': r.original.platforms?.name ?? '',
        'Müşteri Adı': r.original.customers?.name ?? '',
        'Telefon': r.original.customers?.phone ?? '',
        'Adres': r.original.shipping_address ?? '',
        'Teslimat İli': r.original.delivery_province ?? '',
        'Ürün Kodu': it.products?.product_code ?? '',
        'Adet': Number(it.quantity ?? 0),
        'Birim Fiyat': Number(it.unit_price ?? 0),
        'Satır İndirim %': Number(it.line_discount_percent ?? 0),
        'Satır İndirim ₺': Number(it.line_discount_amount_input ?? 0),
        'Sipariş İndirim %': Number(r.original.order_discount_percent ?? 0),
        'Sipariş İndirim ₺': Number(r.original.order_discount_amount_input ?? 0),
        'Kargo': Number(r.original.shipping_cost ?? 0),
        'Durum': STATUS_LABEL[r.original.status] ?? r.original.status,
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Siparişler');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(importRows), IMPORT_SHEET_NAME);
    XLSX.writeFile(wb, `siparisler_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Sipariş no, müşteri, ürün, il ara…" className="pl-8" />
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
          <Link href="/orders/toplu-duzenle" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <Pencil className="mr-1.5 h-4 w-4" /> Toplu Düzenle
          </Link>
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
            table.getRowModel().rows.map((row) => {
              const isOpen = expanded.has(row.original.id);
              const items = (row.original.order_items ?? []) as any[];
              return (
                <Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() ? 'selected' : undefined}
                    className={cn(
                      'cursor-pointer transition-colors',
                      isOpen
                        ? 'bg-primary/10 hover:bg-primary/15 shadow-[inset_3px_0_0_0_hsl(var(--primary))]'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => toggleExpand(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} onClick={cell.column.id === 'select' || cell.column.id === 'actions' ? (e) => e.stopPropagation() : undefined}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {isOpen && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="bg-muted/20 p-0">
                        <div className="px-6 py-3">
                          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                            <span>Ara Toplam: <span className="tabular-nums text-foreground">{formatCurrency(Number(row.original.subtotal ?? 0))}</span></span>
                            <span>İçindeki KDV: <span className="tabular-nums text-foreground">{formatCurrency(Number(row.original.tax_amount ?? 0))}</span></span>
                            <span>Kargo (gider): <span className="tabular-nums text-foreground">{formatCurrency(Number(row.original.shipping_cost ?? 0))}</span></span>
                            {row.original.usd_rate != null && (
                              <span>
                                USD (kilitli @ {Number(row.original.usd_rate).toFixed(4)}):{' '}
                                <span className="tabular-nums text-foreground">{formatUsd(Number(row.original.total_usd ?? 0))}</span>
                                {row.original.net_total_usd != null && (
                                  <span className="ml-1">/ net {formatUsd(Number(row.original.net_total_usd))}</span>
                                )}
                              </span>
                            )}
                            {Number(row.original.commission_amount ?? 0) > 0 && (
                              <span>
                                Platform Komisyonu (%{Number(row.original.commission_rate ?? 0)}):{' '}
                                <span className="tabular-nums text-destructive">−{formatCurrency(Number(row.original.commission_amount))}</span>
                              </span>
                            )}
                          </div>
                          <div className="mb-3 rounded-md border border-border bg-background/60 px-3 py-2 text-xs">
                            <span className="text-muted-foreground">Net Kâr = </span>
                            <span className="tabular-nums">Net Satış {formatCurrency(Number(row.original.total ?? 0))}</span>
                            <span className="text-muted-foreground"> − Maliyet {formatCurrency(orderCogs(row.original))}</span>
                            <span className="text-muted-foreground"> − Kargo {formatCurrency(Number(row.original.shipping_cost ?? 0))}</span>
                            <span className="text-muted-foreground"> − Komisyon {formatCurrency(Number(row.original.commission_amount ?? 0))}</span>
                            <span className="text-muted-foreground"> = </span>
                            <span className={orderNetProfit(row.original) >= 0 ? 'font-semibold text-success' : 'font-semibold text-destructive'}>
                              {formatCurrency(orderNetProfit(row.original))}
                            </span>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                                <th className="pb-2 pr-3 font-medium">Ürün</th>
                                <th className="pb-2 pr-3 text-right font-medium">Adet</th>
                                <th className="pb-2 pr-3 text-right font-medium">Birim Fiyat</th>
                                <th className="pb-2 text-right font-medium">Satır Tutarı</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((it: any) => (
                                <tr key={it.id} className="border-t border-border/60">
                                  <td className="py-2 pr-3">
                                    <span className="font-mono text-xs text-muted-foreground">{it.products?.product_code}</span>{' '}
                                    {it.products?.name}
                                  </td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(it.quantity)}</td>
                                  <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(Number(it.unit_price))}</td>
                                  <td className="py-2 text-right tabular-nums">{formatCurrency(Number(it.line_total))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                Sipariş bulunamadı. Yeni bir sipariş oluşturun veya Excel ile içe aktarın.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <TablePagination table={table} label="sipariş" />

      <OrderForm
        open={formOpen}
        onOpenChange={setFormOpen}
        order={editing}
        platforms={platforms}
        products={products}
        suggestedNumber={suggestedNumber}
        pricePerDesi={pricePerDesi}
      />
    </div>
  );
}
