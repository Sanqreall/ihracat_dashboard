'use client';

import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import type { Column } from '@tanstack/react-table';
import { cn } from '@/lib/utils';

/**
 * TanStack tablolarında tıklanabilir, sıralanabilir sütun başlığı.
 * Kullanım: header: ({ column }) => <SortHeader column={column} label="Tarih" />
 */
export function SortHeader<T>({
  column, label, align = 'left',
}: {
  column: Column<T, unknown>;
  label: string;
  align?: 'left' | 'right' | 'center';
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === 'asc')}
      className={cn(
        'inline-flex items-center gap-1 select-none hover:text-foreground',
        align === 'right' && 'flex-row-reverse',
        align === 'center' && 'justify-center',
        sorted ? 'text-foreground font-medium' : 'text-muted-foreground'
      )}
    >
      {label}
      {sorted === 'asc' ? <ArrowUp className="h-3.5 w-3.5" />
        : sorted === 'desc' ? <ArrowDown className="h-3.5 w-3.5" />
        : <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />}
    </button>
  );
}
