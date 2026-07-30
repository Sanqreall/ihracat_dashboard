'use client';

import { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDir = 'asc' | 'desc';
export type SortState<K extends string> = { key: K; dir: SortDir } | null;

/**
 * TanStack kullanmayan basit tablolar için sıralama.
 * accessor: her satırdan sıralama değerini çıkarır (string ya da number).
 */
export function useSort<T, K extends string>(
  rows: T[],
  accessors: Record<K, (row: T) => string | number | null | undefined>,
  initial: SortState<K> = null,
) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const acc = accessors[sort.key];
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = acc(a); const vb = acc(b);
      // null/undefined sona
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      let cmp: number;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'tr', { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [rows, sort, accessors]);

  const toggle = (key: K) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null; // üçüncü tık: sıralamayı kaldır
    });
  };

  return { sorted, sort, toggle };
}

/** Basit tablolarda tıklanabilir sıralama başlığı. */
export function SortTh<K extends string>({
  label, sortKey, sort, onToggle, align = 'left', className,
}: {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onToggle: (key: K) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const active = sort?.key === sortKey ? sort.dir : null;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={cn(
        'inline-flex items-center gap-1 select-none hover:text-foreground',
        align === 'right' && 'flex-row-reverse',
        align === 'center' && 'justify-center',
        active ? 'text-foreground font-medium' : 'text-muted-foreground',
        className,
      )}
    >
      {label}
      {active === 'asc' ? <ArrowUp className="h-3.5 w-3.5" />
        : active === 'desc' ? <ArrowDown className="h-3.5 w-3.5" />
        : <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />}
    </button>
  );
}
