'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight, ArrowUpDown, CheckCircle2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, isOverdue } from '@/lib/validations/payment';
import { PaymentForm } from './payment-form';
import { deletePayments, markPaid, generatePaymentsFromPlan } from './actions';

type Row = Record<string, any>;

const fmt = (n: number, cur: string) =>
  `${cur} ${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Filter = 'all' | 'pending' | 'overdue' | 'paid';

export function PaymentTable({ data, orders, banks }: { data: Row[]; orders: Row[]; banks: Row[] }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [statusFilter, setStatusFilter] = useState<Filter>('all');

  const filtered = useMemo(() => data.filter((p) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'overdue') return isOverdue(p);
    if (statusFilter === 'pending') return p.status === 'pending';
    if (statusFilter === 'paid') return p.status === 'paid';
    return true;
  }), [data, statusFilter]);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} />,
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
      enableSorting: false,
    },
    { id: 'order', header: 'Sipariş', accessorFn: (r) => r.orders?.order_number ?? '—', cell: ({ getValue }) => <span className="font-mono text-xs font-semibold">{getValue<string>()}</span> },
    { id: 'customer', header: 'Müşteri', accessorFn: (r) => r.orders?.customers?.name ?? '—', cell: ({ getValue }) => getValue<string>() },
    { id: 'amount', header: 'Tutar', accessorFn: (r) => r.amount, cell: ({ row }) => <span className="tabular-nums font-medium">{fmt(row.original.amount, row.original.currency)}</span> },
    { accessorKey: 'method', header: 'Yöntem', cell: ({ getValue }) => PAYMENT_METHOD_LABELS[getValue<string>()] ?? getValue<string>() },
    { accessorKey: 'due_date', header: 'Vade', cell: ({ getValue }) => getValue<string>() ?? '—' },
    { accessorKey: 'paid_date', header: 'Tahsil', cell: ({ getValue }) => getValue<string>() ?? '—' },
    {
      id: 'status', header: 'Durum', accessorKey: 'status',
      cell: ({ row }) => {
        const p = row.original;
        if (isOverdue(p)) return <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-300">Gecikmiş</span>;
        const cls = p.status === 'paid'
          ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
          : p.status === 'cancelled'
          ? 'bg-muted text-muted-foreground'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';
        return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{PAYMENT_STATUS_LABELS[p.status]}</span>;
      },
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className="flex gap-1">
          {row.original.status === 'pending' && (
            <Button variant="ghost" size="icon" title="Tahsil edildi" onClick={async () => {
              try { await markPaid(row.original.id); toast.success('Tahsil edildi olarak işaretlendi'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
            }}><CheckCircle2 className="h-4 w-4 text-green-600" /></Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => { setEditing(row.original); setFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
        </div>
      ),
      enableSorting: false,
    },
  ], []);

  const table = useReactTable({
    data: filtered, columns,
    state: { globalFilter, sorting, rowSelection },
    onGlobalFilterChange: setGlobalFilter, onSortingChange: setSorting, onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(), getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 12 } },
  });

  const selectedIds = Object.keys(rowSelection).map((idx) => filtered[Number(idx)]?.id).filter(Boolean);

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`${selectedIds.length} ödemeyi silmek istediğinize emin misiniz?`)) return;
    try { await deletePayments(selectedIds); setRowSelection({}); toast.success('Seçili ödemeler silindi'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Silme başarısız'); }
  };

  const handleGenerate = async () => {
    const orderId = prompt('Ödeme planından ödeme üretmek için sipariş numarasını girin:');
    if (!orderId) return;
    const o = orders.find((x) => x.order_number?.toLowerCase() === orderId.trim().toLowerCase());
    if (!o) { toast.error('Sipariş bulunamadı'); return; }
    try {
      const res = await generatePaymentsFromPlan(o.id);
      toast.success(`${res.created} ödeme üretildi${res.skipped ? `, ${res.skipped} atlandı` : ''}`);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Üretim başarısız'); }
  };

  const FilterBtn = ({ f, label }: { f: Filter; label: string }) => (
    <button
      onClick={() => setStatusFilter(f)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${statusFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
    >{label}</button>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Ödeme ara…" className="pl-8" />
        </div>
        <div className="flex items-center gap-1">
          <FilterBtn f="all" label="Tümü" />
          <FilterBtn f="pending" label="Bekleyen" />
          <FilterBtn f="overdue" label="Gecikmiş" />
          <FilterBtn f="paid" label="Tahsil" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Sil ({selectedIds.length})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleGenerate}>
            <Zap className="mr-1.5 h-4 w-4" /> Plandan Üret
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Ödeme
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border">
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
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">Ödeme bulunamadı.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {table.getFilteredRowModel().rows.length} ödeme · Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <PaymentForm open={formOpen} onOpenChange={setFormOpen} payment={editing} orders={orders} banks={banks} />
    </div>
  );
}
