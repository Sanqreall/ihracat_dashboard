'use client';

import { useMemo, useState } from 'react';
import { FileText, FileSpreadsheet, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { generateReportPdf } from '@/lib/pdf';
import { exportExcel } from '@/lib/xlsx-export';
import type { CustomerRevenueRow } from './actions';

const usd = (n: number) => `$${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type SortKey = 'name' | 'shippedUSD' | 'readyUSD' | 'pipelineUSD' | 'totalUSD' | 'sharePct';

export function ReportView({
  data,
}: {
  data: {
    rows: CustomerRevenueRow[];
    grandTotalUSD: number;
    shippedTotalUSD: number;
    readyTotalUSD: number;
    pipelineTotalUSD: number;
  };
}) {
  const [sortKey, setSortKey] = useState<SortKey>('totalUSD');
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const r = [...data.rows];
    r.sort((a, b) => {
      const av = a[sortKey]; const bv = b[sortKey];
      const cmp = typeof av === 'string' ? String(av).localeCompare(String(bv), 'tr') : (Number(av) - Number(bv));
      return asc ? cmp : -cmp;
    });
    return r;
  }, [data.rows, sortKey, asc]);

  const toggleSort = (k: SortKey) => { if (k === sortKey) setAsc((v) => !v); else { setSortKey(k); setAsc(false); } };

  const columns: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'name', label: 'Müşteri' },
    { key: 'shippedUSD', label: 'Sevk Edilen', align: 'right' },
    { key: 'readyUSD', label: 'Sevke Hazır', align: 'right' },
    { key: 'pipelineUSD', label: 'Pipeline', align: 'right' },
    { key: 'totalUSD', label: 'Toplam', align: 'right' },
    { key: 'sharePct', label: 'Ciro Payı', align: 'right' },
  ];

  const exportPdf = () => {
    generateReportPdf({
      title: 'Müşteri Ciro Raporu (USD)',
      subtitle: 'Durum bazlı ciro ve toplam içindeki pay',
      summary: `Genel toplam: ${usd(data.grandTotalUSD)}  ·  Sevk: ${usd(data.shippedTotalUSD)}  ·  Hazır: ${usd(data.readyTotalUSD)}  ·  Pipeline: ${usd(data.pipelineTotalUSD)}`,
      columns: [
        { header: 'Müşteri' },
        { header: 'Kod' },
        { header: 'Sevk Edilen', align: 'right' },
        { header: 'Sevke Hazır', align: 'right' },
        { header: 'Pipeline', align: 'right' },
        { header: 'Toplam', align: 'right' },
        { header: 'Ciro Payı', align: 'right' },
      ],
      rows: rows.map((r) => [r.name, r.code ?? '—', usd(r.shippedUSD), usd(r.readyUSD), usd(r.pipelineUSD), usd(r.totalUSD), `%${r.sharePct}`]),
      footerNote: 'İhracat ERP — Müşteri Ciro Raporu',
      orientation: 'landscape',
      fileName: `musteri-ciro-raporu-${new Date().toISOString().slice(0, 10)}.pdf`,
    });
  };

  const exportXlsx = () => {
    exportExcel(`musteri-ciro-raporu-${new Date().toISOString().slice(0, 10)}.xlsx`, [{
      name: 'Müşteri Ciro',
      columns: ['Müşteri', 'Kod', 'Sevk Edilen (USD)', 'Sevke Hazır (USD)', 'Pipeline (USD)', 'Toplam (USD)', 'Ciro Payı %'],
      rows: rows.map((r) => [r.name, r.code ?? '', r.shippedUSD, r.readyUSD, r.pipelineUSD, r.totalUSD, r.sharePct]),
    }]);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ['Genel Toplam', data.grandTotalUSD, 'text-foreground'],
          ['Sevk Edilen', data.shippedTotalUSD, 'text-green-600'],
          ['Sevke Hazır', data.readyTotalUSD, 'text-yellow-600'],
          ['Pipeline', data.pipelineTotalUSD, 'text-blue-600'],
        ].map(([label, val, cls]) => (
          <div key={label as string} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label as string}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums ${cls as string}`}>{usd(val as number)}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={exportPdf}><FileText className="mr-1.5 h-4 w-4" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}><FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                  <button className={`inline-flex items-center gap-1 ${c.align === 'right' ? 'flex-row-reverse' : ''}`} onClick={() => toggleSort(c.key)}>
                    {c.label}<ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? rows.map((r) => (
              <TableRow key={r.customer_id}>
                <TableCell className="font-medium">{r.name}{r.code ? <span className="ml-1 text-xs text-muted-foreground">{r.code}</span> : null}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(r.shippedUSD)}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(r.readyUSD)}</TableCell>
                <TableCell className="text-right tabular-nums">{usd(r.pipelineUSD)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{usd(r.totalUSD)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <span className="block h-full bg-primary" style={{ width: `${Math.min(100, r.sharePct)}%` }} />
                    </span>
                    %{r.sharePct}
                  </span>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Rapor için veri yok.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
