'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComboOption = {
  id: string;
  product_code: string;
  name: string;
};

/**
 * Yazarak arama yapılabilen ürün seçici.
 * Radix Select yerine kendi popover'ımızı kullanıyoruz çünkü Select
 * klavye ile yazıp filtrelemeye izin vermiyor (sadece ilk harfe atlıyor).
 */
export function ProductCombobox({
  options,
  value,
  onChange,
  placeholder = 'Ürün seçiniz',
  disabled = false,
}: {
  options: ComboOption[];
  value?: string;
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.id === value), [options, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return options.slice(0, 100);
    // Kod ve isimde arama; kod eşleşmesi öne alınır
    const scored = options
      .map((o) => {
        const code = o.product_code.toLocaleLowerCase('tr');
        const name = o.name.toLocaleLowerCase('tr');
        if (code.startsWith(q)) return { o, score: 0 };
        if (code.includes(q)) return { o, score: 1 };
        if (name.startsWith(q)) return { o, score: 2 };
        if (name.includes(q)) return { o, score: 3 };
        return null;
      })
      .filter(Boolean) as { o: ComboOption; score: number }[];
    return scored.sort((a, b) => a.score - b.score).slice(0, 100).map((s) => s.o);
  }, [options, query]);

  // Dışarı tıklayınca kapat
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
    if (open) {
      setHighlight(0);
      // Popover açılınca arama kutusuna odaklan
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt.id);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery('');
    }
  };

  // Seçili öğeyi görünür tut
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50'
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>
          {selected ? `${selected.product_code} — ${selected.name}` : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[100] mt-1 w-[min(560px,90vw)] min-w-full overflow-hidden rounded-md border border-border bg-background shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
              onKeyDown={onKeyDown}
              placeholder="Kod veya isim ile ara…"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
            {filtered.length ? filtered.map((o, i) => (
              <button
                key={o.id}
                type="button"
                data-index={i}
                onClick={() => pick(o.id)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm',
                  i === highlight && 'bg-accent text-accent-foreground'
                )}
              >
                <Check className={cn('mt-0.5 h-4 w-4 shrink-0', o.id === value ? 'opacity-100' : 'opacity-0')} />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="font-mono text-xs text-muted-foreground">{o.product_code}</span>
                  <span className="truncate">{o.name}</span>
                </span>
              </button>
            )) : (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">Ürün bulunamadı</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
