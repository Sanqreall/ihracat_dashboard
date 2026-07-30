'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Excel benzeri çoklu seçim: açılır panelde her seçeneğin yanında kutucuk,
 * arama kutusu, "Tümü / Hiçbiri" kısayolları. Seçim anlık uygulanır.
 */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Seçiniz',
  searchPlaceholder = 'Ara…',
  allLabel = 'Tümü',
  labelMap,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  allLabel?: string;
  /** Opsiyonel: değer → görünen etiket (örn. 'sale' → 'Satış'). */
  labelMap?: Record<string, string>;
}) {
  const labelOf = (v: string) => labelMap?.[v] ?? v;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return options;
    return options.filter((o) => labelOf(o).toLocaleLowerCase('tr').includes(q) || o.toLocaleLowerCase('tr').includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt]);
  };

  const selectAllFiltered = () => {
    const set = new Set(selected);
    filtered.forEach((o) => set.add(o));
    onChange(Array.from(set));
  };
  const clearAllFiltered = () => {
    const filteredSet = new Set(filtered);
    onChange(selected.filter((o) => !filteredSet.has(o)));
  };

  const label =
    selected.length === 0 ? placeholder
    : selected.length === 1 ? labelOf(selected[0])
    : `${selected.length} seçili`;

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
        )}
      >
        <span className={cn('truncate text-left', !selected.length && 'text-muted-foreground')}>{label}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[100] mt-1 w-[280px] overflow-hidden rounded-md border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex items-center justify-between border-b border-border px-3 py-1.5 text-xs">
            <button type="button" onClick={selectAllFiltered} className="text-primary underline-offset-2 hover:underline">
              {query ? 'Görünenleri seç' : allLabel}
            </button>
            <button type="button" onClick={clearAllFiltered} className="text-muted-foreground underline-offset-2 hover:underline">
              {query ? 'Görünenleri kaldır' : 'Hiçbiri'}
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {filtered.length ? filtered.map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggle(o)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                  )}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                  {labelOf(o)}
                </button>
              );
            }) : (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">Sonuç yok</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
