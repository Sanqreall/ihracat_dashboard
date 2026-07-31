'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable, getCoreRowModel, getFilteredRowModel, getSortedRowModel, getPaginationRowModel,
  flexRender, type ColumnDef, type SortingState,
} from '@tanstack/react-table';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Pencil, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { CustomerForm } from './customer-form';
import { softDeleteCustomers } from './actions';

type Row = Record<string, any>;

export function CustomerTable({ data }: { data: Row[] }) {
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    {
      id: 'select',
      header: ({ table }) => <Checkbox checked={table.getIsAllPageRowsSelected()} onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)} />,
      cell: ({ row }) => <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} />,
      enableSorting: false,
    },
    { accessorKey: 'code', header: 'Kod', cell: ({ getValue }) => getValue<string>() ?? '—' },
    { accessorKey: 'name', header: 'Müşteri Adı' },
    { accessorKey: 'country', header: 'Ülke', cell: ({ getValue }) => getValue<string>() ?? '—' },
    { accessorKey: 'contact_person', header: 'Yetkili', cell: ({ getValue }) => getValue<string>() ?? '—' },
    { accessorKey: 'email', header: 'E-posta', cell: ({ getValue }) => getValue<string>() ?? '—' },
    { accessorKey: 'default_currency', header: 'Para Br.', cell: ({ getValue }) => getValue<string>() ?? 'USD' },
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
    initialState: { pagination: { pageSize: 10 } },
  });

  const selectedIds = Object.keys(rowSelection).map((idx) => data[Number(idx)]?.id).filter(Boolean);

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`${selectedIds.length} müşteriyi silmek istediğinize emin misiniz?`)) return;
    try {
      await softDeleteCustomers(selectedIds);
      setRowSelection({});
      toast.success('Seçili müşteriler silindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme başarısız');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} placeholder="Müşteri ara…" className="pl-8" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Sil ({selectedIds.length})
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Müşteri
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
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  Müşteri bulunamadı. Yeni bir müşteri ekleyin.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Toplam {table.getFilteredRowModel().rows.length} müşteri · Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}</span>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      <CustomerForm open={formOpen} onOpenChange={setFormOpen} customer={editing as any} />
    </div>
  );
}
