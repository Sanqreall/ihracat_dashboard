'use client';

import { useMemo } from 'react';
import { AlertTriangle, CalendarClock, CalendarDays, CalendarRange } from 'lucide-react';

type Row = Record<string, any>;

const fmt = (n: number, cur: string) =>
  `${cur} ${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: number) => { const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); };

type BucketKey = 'overdue' | 'next7' | 'next30' | 'later' | 'undated';

const BUCKETS: { key: BucketKey; label: string; icon: any; accent: string }[] = [
  { key: 'overdue', label: 'Gecikmiş', icon: AlertTriangle, accent: 'text-red-600' },
  { key: 'next7', label: 'Önümüzdeki 7 Gün', icon: CalendarClock, accent: 'text-amber-600' },
  { key: 'next30', label: 'Önümüzdeki 30 Gün', icon: CalendarDays, accent: 'text-blue-600' },
  { key: 'later', label: 'Daha Sonra', icon: CalendarRange, accent: 'text-muted-foreground' },
];

function bucketOf(due?: string | null): BucketKey {
  if (!due) return 'undated';
  const t = today();
  if (due < t) return 'overdue';
  if (due <= addDays(7)) return 'next7';
  if (due <= addDays(30)) return 'next30';
  return 'later';
}

function sumByCurrency(rows: Row[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const r of rows) m[r.currency] = (m[r.currency] ?? 0) + (Number(r.amount) || 0);
  return m;
}

export function CashflowView({ rows }: { rows: Row[] }) {
  const grouped = useMemo(() => {
    const g: Record<BucketKey, Row[]> = { overdue: [], next7: [], next30: [], later: [], undated: [] };
    for (const r of rows) g[bucketOf(r.due_date)].push(r);
    return g;
  }, [rows]);

  return (
    <div className="space-y-5">
      {/* ÖZET KARTLARI */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {BUCKETS.map((b) => {
          const list = grouped[b.key];
          const totals = sumByCurrency(list);
          const Icon = b.icon;
          return (
            <div key={b.key} className="rounded-lg border border-border bg-card p-4">
              <div className="mb-2 flex items-center gap-2">
                <Icon className={`h-4 w-4 ${b.accent}`} />
                <span className="text-sm font-medium">{b.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{list.length}</span>
              </div>
              {Object.keys(totals).length === 0 ? (
                <p className="text-xs text-muted-foreground">—</p>
              ) : (
                <div className="space-y-0.5">
                  {Object.entries(totals).map(([cur, amt]) => (
                    <div key={cur} className={`text-sm font-semibold tabular-nums ${b.accent}`}>{fmt(amt, cur)}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* VADE LİSTESİ */}
      {(['overdue', 'next7', 'next30', 'later', 'undated'] as BucketKey[]).map((key) => {
        const list = grouped[key];
        if (!list.length) return null;
        const meta = BUCKETS.find((b) => b.key === key);
        const label = meta?.label ?? 'Tarihsiz';
        return (
          <div key={key} className="rounded-lg border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground">({list.length})</span>
            </div>
            <div className="divide-y divide-border">
              {list.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">{r.due_date ?? 'Tarihsiz'}</span>
                  <span className="w-32 shrink-0 font-mono text-xs font-semibold">{r.orders?.order_number ?? '—'}</span>
                  <span className="flex-1 truncate">{r.orders?.customers?.name ?? '—'}</span>
                  <span className={`shrink-0 tabular-nums font-medium ${key === 'overdue' ? 'text-red-600' : ''}`}>{fmt(r.amount, r.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {rows.length === 0 && (
        <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          Bekleyen tahsilat yok.
        </div>
      )}
    </div>
  );
}
