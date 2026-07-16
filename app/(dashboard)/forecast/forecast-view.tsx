'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Search, Download, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatNumber, cn } from '@/lib/utils';
import type { ForecastRow } from './actions';

type FocusMode = null | 'critical' | 'need1' | 'need3';

const FOCUS_LABEL: Record<Exclude<FocusMode, null>, string> = {
  critical: '30 gün içinde stoku bitecek ürünler',
  need1: '1 ay içinde üretim gereken ürünler',
  need3: '3 ay içinde üretim gereken ürünler',
};

export function ForecastView({ data }: { data: ForecastRow[] }) {
  const [filter, setFilter] = useState('');
  const [focus, setFocus] = useState<FocusMode>(null);

  const criticalRows = useMemo(
    () => data.filter((r) => r.stockoutDays !== null && r.stockoutDays <= 30),
    [data]
  );
  const need1Rows = useMemo(() => data.filter((r) => r.need1 > 0), [data]);
  const need3Rows = useMemo(() => data.filter((r) => r.need3 > 0), [data]);

  const criticalCount = criticalRows.length;
  const need1Total = useMemo(() => data.reduce((s, r) => s + r.need1, 0), [data]);
  const need3Total = useMemo(() => data.reduce((s, r) => s + r.need3, 0), [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (focus === 'critical') rows = criticalRows;
    else if (focus === 'need1') rows = need1Rows;
    else if (focus === 'need3') rows = need3Rows;

    const q = filter.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) => r.product.toLocaleLowerCase('tr').includes(q));
  }, [data, filter, focus, criticalRows, need1Rows, need3Rows]);

  const toggleFocus = (mode: Exclude<FocusMode, null>) =>
    setFocus((cur) => (cur === mode ? null : mode));

  const handleExport = () => {
    const rows = filtered.map((f) => ({
      'Ürün': f.product,
      '90 Gün Satış': f.sold90,
      'Aylık Hız': f.monthlyVelocity,
      'Mevcut Stok': f.current_stock,
      'Üretimde': f.production_stock,
      'Kullanılabilir': f.available,
      '1 Ay İhtiyaç': f.need1,
      '3 Ay İhtiyaç': f.need3,
      '6 Ay İhtiyaç': f.need6,
      '1 Yıl İhtiyaç': f.need12,
      'Stok Biter (gün)': f.stockoutDays ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Talep Tahmini');
    XLSX.writeFile(wb, `talep_tahmini_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button type="button" onClick={() => toggleFocus('critical')} className="text-left">
          <Card className={cn('h-full transition-colors hover:border-primary/50', focus === 'critical' && 'border-primary ring-1 ring-primary')}>
            <CardHeader className="pb-2"><CardTitle>30 Gün İçinde Stoku Bitecek</CardTitle></CardHeader>
            <CardContent>
              <div className={cn('flex items-center gap-2 text-2xl font-semibold', criticalCount > 0 && 'text-destructive')}>
                {criticalCount > 0 && <AlertTriangle className="h-5 w-5" />}
                {formatNumber(criticalCount)} ürün
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Listelemek için tıklayın</p>
            </CardContent>
          </Card>
        </button>
        <button type="button" onClick={() => toggleFocus('need1')} className="text-left">
          <Card className={cn('h-full transition-colors hover:border-primary/50', focus === 'need1' && 'border-primary ring-1 ring-primary')}>
            <CardHeader className="pb-2"><CardTitle>1 Aylık Toplam Üretim İhtiyacı</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatNumber(need1Total)} adet</div>
              <p className="mt-1 text-xs text-muted-foreground">{formatNumber(need1Rows.length)} üründe ihtiyaç · tıklayın</p>
            </CardContent>
          </Card>
        </button>
        <button type="button" onClick={() => toggleFocus('need3')} className="text-left">
          <Card className={cn('h-full transition-colors hover:border-primary/50', focus === 'need3' && 'border-primary ring-1 ring-primary')}>
            <CardHeader className="pb-2"><CardTitle>3 Aylık Toplam Üretim İhtiyacı</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatNumber(need3Total)} adet</div>
              <p className="mt-1 text-xs text-muted-foreground">{formatNumber(need3Rows.length)} üründe ihtiyaç · tıklayın</p>
            </CardContent>
          </Card>
        </button>
      </div>

      {focus && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium text-primary">{FOCUS_LABEL[focus]}</span>
          <span className="text-muted-foreground">· {formatNumber(filtered.length)} ürün</span>
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={() => setFocus(null)}>
            <X className="mr-1 h-3.5 w-3.5" /> Filtreyi kaldır
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Ürün ara…" className="pl-8" />
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1.5 h-4 w-4" /> Dışa Aktar
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ürün</TableHead>
            <TableHead className="text-right">90 Gün Satış</TableHead>
            <TableHead className="text-right">Aylık Hız</TableHead>
            <TableHead className="text-right">Mevcut</TableHead>
            <TableHead className="text-right">Üretimde</TableHead>
            <TableHead className="text-right">Kullanılabilir</TableHead>
            <TableHead className="text-right">1 Ay</TableHead>
            <TableHead className="text-right">3 Ay</TableHead>
            <TableHead className="text-right">6 Ay</TableHead>
            <TableHead className="text-right">1 Yıl</TableHead>
            <TableHead className="text-right">Stok Biter</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length ? filtered.map((f) => (
            <TableRow key={f.product}>
              <TableCell className="max-w-[280px] truncate" title={f.product}>{f.product}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(f.sold90)}</TableCell>
              <TableCell className="text-right tabular-nums">{f.monthlyVelocity.toFixed(1)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(f.current_stock)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(f.production_stock)}</TableCell>
              <TableCell className="text-right tabular-nums font-medium">{formatNumber(f.available)}</TableCell>
              <TableCell className={cn('text-right tabular-nums', f.need1 > 0 ? 'font-medium text-warning' : 'text-muted-foreground')}>{formatNumber(f.need1)}</TableCell>
              <TableCell className={cn('text-right tabular-nums', f.need3 > 0 ? 'font-medium text-warning' : 'text-muted-foreground')}>{formatNumber(f.need3)}</TableCell>
              <TableCell className={cn('text-right tabular-nums', f.need6 > 0 ? 'font-medium text-warning' : 'text-muted-foreground')}>{formatNumber(f.need6)}</TableCell>
              <TableCell className={cn('text-right tabular-nums', f.need12 > 0 ? 'font-medium text-warning' : 'text-muted-foreground')}>{formatNumber(f.need12)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {f.stockoutDays === null ? '—' : f.stockoutDays <= 30
                  ? <span className="font-medium text-destructive">{f.stockoutDays} gün</span>
                  : `${f.stockoutDays} gün`}
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                {focus ? 'Bu kritere uyan ürün yok.' : 'Ürün bulunamadı.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
