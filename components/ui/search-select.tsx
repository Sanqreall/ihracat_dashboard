'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Basit, aranabilir metin seçici (il gibi sabit listeler için). */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = 'Seçiniz',
  disabled = false,
  allowClear = true,
  allowCustom = false,
}: {
  options: string[];
  value?: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  /** true ise: listede olmayan bir değer yazıldığında 'ekle' seçeneği çıkar. */
  allowCustom?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr');
    if (!q) return options;
    const scored = options
      .map((o) => {
        const n = o.toLocaleLowerCase('tr');
        if (n.startsWith(q)) return { o, score: 0 };
        if (n.includes(q)) return { o, score: 1 };
        return null;
      })
      .filter(Boolean) as { o: string; score: number }[];
    return scored.sort((a, b) => a.score - b.score).map((s) => s.o);
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
    if (open) {
      setHighlight(0);
      // Aşağıda yeterli yer yoksa listeyi yukarı doğru aç — böylece modal
      // içinde kaydırmak zorunda kalmadan seçenekler görünür.
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const needed = 280; // arama kutusu + liste için yaklaşık yükseklik
        setDropUp(spaceBelow < needed && spaceAbove > spaceBelow);
      }
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const trimmedQuery = query.trim();
  const canAddCustom =
    allowCustom &&
    trimmedQuery.length > 0 &&
    !options.some((o) => o.toLocaleLowerCase('tr') === trimmedQuery.toLocaleLowerCase('tr'));

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = filtered[highlight]; if (o) pick(o); else if (canAddCustom) pick(trimmedQuery); }
    else if (e.key === 'Escape') { setOpen(false); setQuery(''); }
  };

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' });
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
        <span className={cn('truncate text-left', !value && 'text-muted-foreground')}>
          {value || placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute left-0 z-[100] w-full min-w-[220px] overflow-hidden rounded-md border border-border bg-background shadow-lg',
            dropUp ? 'bottom-full mb-1' : 'top-full mt-1'
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
              onKeyDown={onKeyDown}
              placeholder="Ara…"
              className="h-9 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div ref={listRef} className="max-h-64 overflow-y-auto p-1">
            {allowClear && (
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false); setQuery(''); }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent"
              >
                <span className="h-4 w-4 shrink-0" /> Temizle
              </button>
            )}
            {canAddCustom && (
              <button
                type="button"
                onClick={() => pick(trimmedQuery)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
              >
                <Plus className="h-4 w-4 shrink-0" /> &quot;{trimmedQuery}&quot; ekle
              </button>
            )}
            {filtered.length ? filtered.map((o, i) => (
              <button
                key={o}
                type="button"
                data-index={i}
                onClick={() => pick(o)}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
                  i === highlight && 'bg-accent text-accent-foreground'
                )}
              >
                <Check className={cn('h-4 w-4 shrink-0', o === value ? 'opacity-100' : 'opacity-0')} />
                {o}
              </button>
            )) : !canAddCustom ? (
              <div className="px-2 py-6 text-center text-sm text-muted-foreground">Sonuç yok</div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
