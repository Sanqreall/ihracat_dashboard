'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight, ArrowUpDown, Ban, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { calculateOrderTotals, ORDER_STATUS_LABELS } from '@/lib/validations/order';
import { OrderForm } from './order-form';
import { softDeleteOrders, cancelOrder, getOrder } from './actions';

type Row = Record<string, any>;

const STATUS_VARIANT: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  production: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  ready: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300',
  shipped: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  delivered: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300',
  completed: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const orderTotal = (o: Row) =>
  calculateOrderTotals({
    items: o.order_items ?? [],
    discount_type: o.discount_type,
    discount_value: o.discount_value,
    vat_rate: o.vat_rate,
    additional_costs: o.order_additional_costs ?? [],
  }).total;

const paidOf = (o: Row) =>
  (o.payments ?? []).filter((p: Row) => p.status === 'paid').reduce((s: number, p: Row) => s + (Number(p.amount) || 0), 0);

const money = (n: number, cur: string) =>
  `${cur} ${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const usdFmt = (n: number) => `$${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function OrderTable({ data, customers, products, rateMap = { USD: 1 } }: { data: Row[]; customers: Row[]; products: Row[]; rateMap?: Record<string, number> }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const rate = (cur: string) => rateMap[cur] ?? 1;

  const filtered = useMemo(
    () => (statusFilter === 'all' ? data : data.filter((o) => o.status === statusFilter)),
    [data, statusFilter],
  );

  const summary = useMemo(() => {
    const byCur: Record<string, number> = {};
    let totalUSD = 0, paidUSD = 0;
    for (const o of filtered) {
      if (o.status === 'cancelled') continue;
      const t = orderTotal(o); const cur = o.currency ?? 'USD';
      byCur[cur] = (byCur[cur] ?? 0) + t;
      totalUSD += t * rate(cur);
      paidUSD += paidOf(o) * rate(cur);
    }
    return { byCur, totalUSD, paidUSD, remainingUSD: totalUSD - paidUSD };
  }, [filtered, rateMap]);

  const openEdit = async (id: string) => {
    try { const full = await getOrder(id); setEditing(full); setFormOpen(true); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Sipariş açılamadı'); }
  };

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} />,
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
      enableSorting: false,
    },
    {
      accessorKey: 'order_number', header: 'Sipariş No',
      cell: ({ row }) => {
        const shipCount = (row.original.order_shipments ?? []).length;
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold">{row.original.order_number ?? '—'}</span>
            {shipCount > 1 && <span title={`${shipCount} sevkiyata bölünmüş`} className="inline-flex items-center gap-0.5 rounded bg-indigo-100 px-1 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"><Package className="h-2.5 w-2.5" />{shipCount}</span>}
          </div>
        );
      },
    },
    { id: 'customer', header: 'Müşteri', accessorFn: (r) => r.customers?.name ?? '—', cell: ({ getValue }) => <span className="block max-w-[180px] truncate">{getValue<string>()}</span> },
    { id: 'items', header: 'Klm', accessorFn: (r) => (r.order_items ?? []).length, cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{getValue<number>()}</span> },
    { accessorKey: 'order_date', header: 'Tarih', cell: ({ getValue }) => <span className="text-xs">{getValue<string>() ?? '—'}</span> },
    {
      id: 'status', header: 'Durum', accessorKey: 'status',
      cell: ({ getValue }) => {
        const s = getValue<string>();
        return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_VARIANT[s] ?? ''}`}>{ORDER_STATUS_LABELS[s] ?? s}</span>;
      },
    },
    {
      id: 'total', header: 'Tutar / Ödenen', accessorFn: (r) => orderTotal(r),
      cell: ({ row }) => {
        const o = row.original; const cur = o.currency ?? 'USD';
        const total = orderTotal(o); const paid = paidOf(o);
        const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
        const remaining = total - paid;
        return (
          <div className="min-w-[150px] space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="tabular-nums font-medium">{money(total, cur)}</span>
              <span className={`tabular-nums text-xs ${remaining <= 0.5 ? 'text-green-600' : 'text-muted-foreground'}`}>{pct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full ${pct >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
            </div>
            {remaining > 0.5 && <p className="text-[11px] text-muted-foreground">Kalan {money(remaining, cur)}</p>}
          </div>
        );
      },
    },
    { id: 'usd', header: 'USD', accessorFn: (r) => orderTotal(r) * rate(r.currency ?? 'USD'), cell: ({ getValue }) => <span className="tabular-nums text-muted-foreground">{usdFmt(getValue<number>())}</span> },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original.id)}><Pencil className="h-4 w-4" /></Button>
          {row.original.status !== 'cancelled' && (
            <Button variant="ghost" size="icon" title="İptal et" onClick={async () => {
              if (!confirm('Sipariş iptal edilsin mi?')) return;
              try { await cancelOrder(row.original.id); toast.success('Sipariş iptal edildi'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
            }}><Ban className="h-4 w-4 text-amber-600" /></Button>
          )}
        </div>
      ),
      enableSorting: false,
    },
  ], [rateMap]);

  const table = useReactTable({
    data: filtered, columns,
    state: { globalFilter, sorting, rowSelection },
    onGlobalFilterChange: setGlobalFilter, onSortingChange: setSorting, onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const selectedIds = Object.keys(rowSelection).map((idx) => filtered[Number(idx)]?.id).filter(Boolean);

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`${selectedIds.length} siparişi silmek istediğinize emin misiniz?`)) return;
    try { await softDeleteOrders(selectedIds); setRowSelection({}); toast.success('Seçili siparişler silindi'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Silme başarısız'); }
  };

  const STATUSES = ['all', 'draft', 'confirmed', 'production', 'ready', 'shipped', 'delivered', 'completed', 'cancelled'];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Toplam Değer (USD)</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{usdFmt(summary.totalUSD)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{Object.entries(summary.byCur).map(([c, v]) => `${money(v, c)}`).join(' · ') || '—'}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Tahsil Edilen (USD)</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-green-600">{usdFmt(summary.paidUSD)}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-green-500" style={{ width: `${summary.totalUSD > 0 ? Math.min(100, (summary.paidUSD / summary.totalUSD) * 100) : 0}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">Kalan Tahsilat (USD)</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-600">{usdFmt(summary.remainingUSD)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Sipariş / müşteri ara…" className="pl-8" />
        </div>
        <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s === 'all' ? 'Tüm durumlar' : ORDER_STATUS_LABELS[s] ?? s}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Sil ({selectedIds.length})
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Sipariş
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className={['total', 'usd'].includes(header.column.id) ? 'text-right' : ''}>
                    {header.isPlaceholder ? null : (
                      <button className={`flex items-center gap-1 disabled:cursor-default ${['total', 'usd'].includes(header.column.id) ? 'ml-auto' : ''}`} disabled={!header.column.getCanSort()} onClick={header.column.getToggleSortingHandler()}>
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
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined} className={row.original.status === 'cancelled' ? 'opacity-50' : ''}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={['usd'].includes(cell.column.id) ? 'text-right' : ''}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Sipariş bulunamadı. Yeni bir sipariş ekleyin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {table.getFilteredRowModel().rows.length} sipariş · Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <OrderForm open={formOpen} onOpenChange={setFormOpen} order={editing} customers={customers} products={products} />
    </div>
  );
}
