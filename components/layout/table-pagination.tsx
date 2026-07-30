'use client';

import type { Table } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PAGE_SIZES = [50, 100, 250];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TablePagination({ table, label = 'kayıt' }: { table: Table<any>; label?: string }) {
  const total = table.getFilteredRowModel().rows.length;
  const pageSize = table.getState().pagination.pageSize;
  const showingAll = pageSize >= total && total > 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span>
          Toplam {total} {label}
          {!showingAll && ` · Sayfa ${table.getState().pagination.pageIndex + 1} / ${table.getPageCount() || 1}`}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs">Sayfa başına:</span>
          {PAGE_SIZES.map((size) => (
            <button
              key={size}
              onClick={() => table.setPageSize(size)}
              className={`rounded px-2 py-0.5 text-xs transition-colors ${
                pageSize === size ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent'
              }`}
            >
              {size}
            </button>
          ))}
          <button
            onClick={() => table.setPageSize(Math.max(total, 1))}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              showingAll ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-accent'
            }`}
          >
            Tümü
          </button>
        </div>
      </div>
      {!showingAll && (
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
