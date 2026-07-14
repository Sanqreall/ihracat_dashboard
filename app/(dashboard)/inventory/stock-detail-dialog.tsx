'use client';

import { useEffect, useState } from 'react';
import { Factory, Warehouse, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { getStockComposition } from './actions';

type Composition = Awaited<ReturnType<typeof getStockComposition>>;

export function StockDetailDialog({
  productId,
  open,
  onOpenChange,
}: {
  productId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState<Composition | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !productId) return;
    setLoading(true);
    setError(null);
    setData(null);
    getStockComposition(productId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Veri alınamadı'))
      .finally(() => setLoading(false));
  }, [open, productId]);

  const p = data?.product;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {p ? `${p.product_code} — ${p.name}` : 'Stok Detayı'}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yükleniyor…
          </div>
        )}
        {error && <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

        {p && !loading && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Warehouse className="h-3.5 w-3.5" /> Mevcut (Satılabilir)
                </div>
                <div className="mt-1 text-2xl font-semibold">{formatNumber(p.current_stock)}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(p.current_stock * p.cost_price)} maliyet</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Factory className="h-3.5 w-3.5" /> Üretimde
                </div>
                <div className="mt-1 text-2xl font-semibold">{formatNumber(p.production_stock)}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(p.production_stock * p.cost_price)} maliyet</div>
              </div>
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Warehouse className="h-4 w-4" /> Satılabilir Stok Kaynakları
              </h3>
              <SourceTable rows={data!.sellableSources} total={p.current_stock} />
            </div>

            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
                <Factory className="h-4 w-4" /> Üretimdeki Stok Kaynakları
              </h3>
              <SourceTable rows={data!.productionSources} total={p.production_stock} />
            </div>

            <p className="text-xs text-muted-foreground">
              Kaynaklar stok hareketi defterinden hesaplanır. Bir üretim emri stoğa aktarıldığında
              adetler "üretimde"den "satılabilir"e taşınır ve satılabilir tarafta o emrin numarasıyla görünür.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SourceTable({ rows, total }: { rows: { source: string; quantity: number }[]; total: number }) {
  if (!rows.length) {
    return <div className="rounded-md border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Kaynak kaydı yok</div>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Kaynak</TableHead>
          <TableHead className="text-right">Adet</TableHead>
          <TableHead className="text-right">Pay</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.source}>
            <TableCell className="font-mono text-xs">{r.source}</TableCell>
            <TableCell className={r.quantity >= 0 ? 'text-right tabular-nums' : 'text-right tabular-nums text-destructive'}>
              {r.quantity > 0 ? '+' : ''}{formatNumber(r.quantity)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {total > 0 && r.quantity > 0 ? `%${((r.quantity / total) * 100).toFixed(0)}` : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
