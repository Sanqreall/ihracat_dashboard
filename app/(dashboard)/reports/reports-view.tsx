'use client';

import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import * as XLSX from 'xlsx';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatCurrency, formatNumber, formatUsd, cn } from '@/lib/utils';
import { DATE_PRESETS, resolvePreset, bucketKey, bucketLabel, type Granularity, type PresetId } from '@/lib/reporting';
import { MultiSelect } from '@/components/ui/multi-select';
import type { ReportData } from './actions';

const SERIES_COLORS = [
  'hsl(24 45% 42%)', 'hsl(210 20% 40%)', 'hsl(142 40% 38%)', 'hsl(38 75% 48%)',
  'hsl(4 62% 50%)', 'hsl(270 30% 50%)', 'hsl(190 40% 40%)', 'hsl(330 40% 50%)',
];

type Currency = 'TRY' | 'USD';
type SalesMetric = 'netSales' | 'discount' | 'orders';

/** Küçük yatay seçici. */
function Segmented<T extends string>({
  value, onChange, options, size = 'sm',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: 'sm' | 'xs';
}) {
  return (
    <div className="flex flex-wrap rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded transition-colors',
            size === 'xs' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
            value === o.value ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function FilterBar({
  from, to, provinces, provinceOptions,
}: {
  from?: string; to?: string; provinces: string[]; provinceOptions: string[];
}) {
  const router = useRouter();
  const [localFrom, setLocalFrom] = useState(from ?? '');
  const [localTo, setLocalTo] = useState(to ?? '');
  const [localProvinces, setLocalProvinces] = useState<string[]>(provinces);

  // URL'den gelen iller değişirse yerel seçimi eşitle
  useEffect(() => { setLocalProvinces(provinces); }, [provinces.join(',')]);

  const go = (f?: string, t?: string, provs?: string[]) => {
    const p = new URLSearchParams();
    if (f) p.set('from', f);
    if (t) p.set('to', t);
    if (provs && provs.length) p.set('province', provs.join(','));
    router.push(p.toString() ? `/reports?${p.toString()}` : '/reports');
  };

  const applyPreset = (id: PresetId) => {
    const { from: f, to: t } = resolvePreset(id);
    setLocalFrom(f ?? '');
    setLocalTo(t ?? '');
    go(f, t, localProvinces);
  };

  const apply = () => go(localFrom || undefined, localTo || undefined, localProvinces);
  const clearAll = () => { setLocalFrom(''); setLocalTo(''); setLocalProvinces([]); go(); };

  const active = !!(from || to || provinces.length);

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex flex-wrap gap-1.5">
        {DATE_PRESETS.map((p) => (
          <Button key={p.id} variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyPreset(p.id)}>
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
        <div className="space-y-1">
          <Label className="text-xs">Başlangıç</Label>
          <Input type="date" value={localFrom} onChange={(e) => setLocalFrom(e.target.value)} className="h-8 w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bitiş</Label>
          <Input type="date" value={localTo} onChange={(e) => setLocalTo(e.target.value)} className="h-8 w-[150px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Teslimat İli</Label>
          <div className="w-[200px]">
            <MultiSelect
              options={provinceOptions}
              selected={localProvinces}
              onChange={setLocalProvinces}
              placeholder="Tüm iller"
              searchPlaceholder="İl ara…"
              allLabel="Tümü"
            />
          </div>
        </div>
        <Button size="sm" onClick={apply}>Uygula</Button>
        {active && (
          <Button size="sm" variant="ghost" onClick={clearAll}>
            <X className="mr-1 h-3.5 w-3.5" /> Temizle
          </Button>
        )}
      </div>
      {active && (
        <p className="text-xs text-muted-foreground">
          {from || 'başlangıçsız'} → {to || 'bugün'}
          {provinces.length ? ` · ${provinces.length === 1 ? provinces[0] : `${provinces.length} il`}` : ''}
        </p>
      )}
    </div>
  );
}

/**
 * Günlük seriyi seçilen kırılıma göre toplar.
 * Jenerik K, toplanan alan adlarını taşır; böylece dönen satırlarda
 * `row.netSales` gibi alanlar tipli kalır.
 */
function bucketize<K extends string>(
  rows: ({ date: string } & Record<K, number>)[],
  granularity: Granularity,
  sumKeys: readonly K[]
): (Record<K, number> & { key: string; label: string })[] {
  const map = new Map<string, Record<string, number>>();
  for (const row of rows) {
    const key = bucketKey(row.date, granularity);
    if (!key) continue;
    let acc = map.get(key);
    if (!acc) { acc = {}; map.set(key, acc); }
    for (const k of sumKeys) {
      acc[k] = (acc[k] ?? 0) + Number(row[k] ?? 0);
    }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, values]) => {
      const filled = {} as Record<K, number>;
      for (const k of sumKeys) filled[k] = values[k] ?? 0;
      return { key, label: bucketLabel(key, granularity), ...filled };
    });
}

export function ReportsView({ data }: { data: ReportData }) {
  const [currency, setCurrency] = useState<Currency>('TRY');
  const [salesGran, setSalesGran] = useState<Granularity>('month');
  const [salesMetric, setSalesMetric] = useState<SalesMetric>('netSales');
  const [expenseGran, setExpenseGran] = useState<Granularity>('month');
  const [returnGran, setReturnGran] = useState<Granularity>('month');
  const [returnMetric, setReturnMetric] = useState<'refund' | 'units'>('refund');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(data.expenseCategories.slice(0, 6));

  const isUsd = currency === 'USD';
  const fmt = (v: number) => (isUsd ? formatUsd(v) : formatCurrency(v));
  const t = data.totals;

  const GRAN_OPTIONS: { value: Granularity; label: string }[] = [
    { value: 'day', label: 'Günlük' },
    { value: 'week', label: 'Haftalık' },
    { value: 'month', label: 'Aylık' },
  ];

  // --- Satış / indirim serisi
  const salesSeries = useMemo(
    () => bucketize(data.dailySales, salesGran, ['netSales', 'netSalesUsd', 'discount', 'grossSales', 'orders', 'cogs']),
    [data.dailySales, salesGran]
  );

  const salesKey = salesMetric === 'netSales' ? (isUsd ? 'netSalesUsd' : 'netSales') : salesMetric;
  const salesMetricLabel =
    salesMetric === 'netSales' ? 'Net Satış' : salesMetric === 'discount' ? 'İndirim' : 'Sipariş Adedi';
  const salesIsMoney = salesMetric !== 'orders';

  // --- Gider serisi (kategori bazlı)
  const expenseSeries = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const row of data.dailyExpenses) {
      if (!selectedCategories.includes(row.category)) continue;
      const key = bucketKey(row.date, expenseGran);
      if (!key) continue;
      let acc = map.get(key);
      if (!acc) { acc = {}; map.set(key, acc); }
      acc[row.category] = (acc[row.category] ?? 0) + row.amount;
      acc.__total = (acc.__total ?? 0) + row.amount;
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => {
        const filled: Record<string, number> = {};
        for (const c of selectedCategories) filled[c] = values[c] ?? 0;
        return { key, label: bucketLabel(key, expenseGran), ...filled, __total: values.__total ?? 0 };
      });
  }, [data.dailyExpenses, expenseGran, selectedCategories]);

  const toggleCategory = (c: string) =>
    setSelectedCategories((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  // --- İade serisi
  const returnSeries = useMemo(
    () => bucketize(data.dailyReturns, returnGran, ['count', 'units', 'refund']),
    [data.dailyReturns, returnGran]
  );

  // --- Detay tablosu (satış kırılımıyla aynı)
  const detailRows = useMemo(() => {
    const expenseByBucket = new Map<string, number>();
    for (const row of data.dailyExpenses) {
      const key = bucketKey(row.date, salesGran);
      expenseByBucket.set(key, (expenseByBucket.get(key) ?? 0) + row.amount);
    }
    return salesSeries.map((b) => {
      const expense = expenseByBucket.get(b.key) ?? 0;
      const profit = b.netSales - b.cogs - expense;
      return { ...b, expense, profit };
    });
  }, [salesSeries, data.dailyExpenses, salesGran]);

  const handleExportAll = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      detailRows.map((r) => ({
        'Dönem': r.label,
        'Brüt Satış': r.grossSales,
        'İndirim': r.discount,
        'Net Satış': r.netSales,
        'Net Satış (USD)': r.netSalesUsd,
        'Ürün Maliyeti': r.cogs,
        'Gider': r.expense,
        'Net Kâr': r.profit,
        'Sipariş': r.orders,
      }))
    ), 'Dönemsel Özet');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.dailyExpenses.map((r) => ({ 'Tarih': r.date, 'Kategori': r.category, 'Tutar': r.amount }))
    ), 'Giderler (günlük)');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.expenseTotalsByCategory.map((r) => ({ 'Kategori': r.category, 'Toplam': r.total }))
    ), 'Gider Kategorileri');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.dailyReturns.map((r) => ({ 'Tarih': r.date, 'İade Sayısı': r.count, 'Adet': r.units, 'Tutar': r.refund }))
    ), 'İadeler (günlük)');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.salesByPlatform.map((r) => ({ 'Platform': r.platform, 'Net Satış': r.netSales, 'Sipariş': r.orders }))
    ), 'Platform');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.topProducts.map((r) => ({ 'Ürün': r.product, 'Adet': r.quantity, 'Ciro': r.revenue }))
    ), 'En Çok Satanlar');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.returnsByReason.map((r) => ({ 'Neden': r.reason, 'Adet': r.count, 'Tutar': r.refund }))
    ), 'İade Nedenleri');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.salesByProvince.map((r) => ({ 'İl': r.province, 'Sipariş': r.orders, 'Adet': r.units, 'Net Satış': r.netSales }))
    ), 'İl Bazlı');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.salesByDiscountBand.map((r) => ({ 'Sipariş İndirimi': r.band, 'Sipariş': r.orders, 'Adet': r.units, 'Net Satış': r.netSales }))
    ), 'Sipariş İndirim Bandı');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.itemsByDiscountBand.map((r) => ({ 'Kalem İndirimi': r.band, 'Satır': r.lines, 'Adet': r.units, 'Ciro': r.revenue }))
    ), 'Kalem İndirim Bandı');
    XLSX.writeFile(wb, `rapor_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tooltipStyle = { borderRadius: 8, border: '1px solid hsl(var(--border))' };

  return (
    <div className="space-y-6">
      <FilterBar from={data.filter.from} to={data.filter.to} provinces={data.filter.provinces ?? []} provinceOptions={data.provinceOptions} />

      {data.provinceFilterActive && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-primary">İl filtresi aktif.</span>{' '}
          Satış, iade ve siparişe bağlı giderler (komisyon, kargo) seçili illere göre süzülür.
          Reklam, kira gibi il-bağımsız genel giderler bu görünümde hariç tutulur; ROAS ve toplam
          gider yalnızca seçili illerin sipariş kaynaklı giderlerini yansıtır.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Currency>
          value={currency}
          onChange={setCurrency}
          options={[{ value: 'TRY', label: '₺ TRY' }, { value: 'USD', label: '$ USD' }]}
        />
        {isUsd && t.avgUsdRate > 0 && (
          <span className="text-xs text-muted-foreground">
            Satışlar kilitli kurla; gider/maliyet ort. {t.avgUsdRate.toFixed(4)} ₺/$ ile çevrilmiştir
          </span>
        )}
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={handleExportAll}>
            <Download className="mr-1.5 h-4 w-4" /> Excel'e Aktar
          </Button>
        </div>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle>Net Satış (KDV dahil)</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{fmt(isUsd ? t.netSalesUsd : t.netSales)}</div>
            <p className="mt-1 text-xs text-muted-foreground">{formatNumber(t.orderCount)} sipariş</p>
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle>Brüt Satış / İndirim</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{formatCurrency(t.grossSales)}</div>
            <p className="mt-1 text-xs text-warning">−{formatCurrency(t.discountTotal)} (%{t.discountRate})</p>
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle>Ürün Maliyeti</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-semibold">{fmt(isUsd ? t.cogsTotalUsd : t.cogsTotal)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle>Toplam Gider</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{fmt(isUsd ? t.expenseTotalUsd : t.expenseTotal)}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Komisyon {formatCurrency(t.commissionTotal)} · Kargo {formatCurrency(t.shippingExpenseTotal)}
            </p>
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle>Satılan / İade Adedi</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{formatNumber(t.soldUnits)} / {formatNumber(t.returnedUnits)}</div>
            <p className="mt-1 text-xs text-muted-foreground">İade oranı %{t.returnRate}</p>
          </CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle>İade Tutarı</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{formatCurrency(t.refundTotal)}</div>
            <p className="mt-1 text-xs text-muted-foreground">Net satıştan düşülmez</p>
          </CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader className="pb-2"><CardTitle>Net Kâr</CardTitle></CardHeader>
          <CardContent>
            <div className={(isUsd ? t.netProfitUsd : t.netProfit) >= 0 ? 'text-2xl font-semibold text-success' : 'text-2xl font-semibold text-destructive'}>
              {fmt(isUsd ? t.netProfitUsd : t.netProfit)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Net Satış − Ürün Maliyeti − Giderler</p>
          </CardContent></Card>
      </div>

      {/* Satış / indirim grafiği */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold text-foreground">{salesMetricLabel}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Segmented<SalesMetric>
              value={salesMetric}
              onChange={setSalesMetric}
              size="xs"
              options={[
                { value: 'netSales', label: 'Net Satış' },
                { value: 'discount', label: 'İndirim' },
                { value: 'orders', label: 'Sipariş' },
              ]}
            />
            <Segmented<Granularity> value={salesGran} onChange={setSalesGran} size="xs" options={GRAN_OPTIONS} />
          </div>
        </CardHeader>
        <CardContent className="h-80">
          {salesSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => (salesIsMoney ? fmt(v) : formatNumber(v))}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey={salesKey} name={salesMetricLabel} fill={SERIES_COLORS[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Bu aralıkta veri yok</div>
          )}
        </CardContent>
      </Card>

      {/* Giderler: kategori karşılaştırmalı */}
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base font-semibold text-foreground">Giderler (kategori bazlı)</CardTitle>
            <Segmented<Granularity> value={expenseGran} onChange={setExpenseGran} size="xs" options={GRAN_OPTIONS} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {data.expenseCategories.map((c, i) => {
              const on = selectedCategories.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                    on ? 'border-transparent bg-accent font-medium' : 'border-border text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: on ? SERIES_COLORS[i % SERIES_COLORS.length] : 'hsl(var(--muted-foreground))' }}
                  />
                  {c}
                </button>
              );
            })}
            {!data.expenseCategories.length && (
              <span className="text-xs text-muted-foreground">Bu aralıkta gider yok</span>
            )}
          </div>
        </CardHeader>
        <CardContent className="h-80">
          {expenseSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={expenseSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                <Legend />
                {selectedCategories.map((c) => {
                  const idx = data.expenseCategories.indexOf(c);
                  return (
                    <Line
                      key={c}
                      type="monotone"
                      dataKey={c}
                      name={c}
                      stroke={SERIES_COLORS[idx % SERIES_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {data.expenseCategories.length ? 'Kategori seçin' : 'Bu aralıkta gider yok'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* İadeler */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base font-semibold text-foreground">İadeler</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Segmented<'refund' | 'units'>
              value={returnMetric}
              onChange={setReturnMetric}
              size="xs"
              options={[{ value: 'refund', label: 'Tutar' }, { value: 'units', label: 'Adet' }]}
            />
            <Segmented<Granularity> value={returnGran} onChange={setReturnGran} size="xs" options={GRAN_OPTIONS} />
          </div>
        </CardHeader>
        <CardContent className="h-72">
          {returnSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={returnSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => (returnMetric === 'refund' ? formatCurrency(v) : formatNumber(v))}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey={returnMetric}
                  name={returnMetric === 'refund' ? 'İade Tutarı' : 'İade Adedi'}
                  fill={SERIES_COLORS[4]}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Bu aralıkta iade yok</div>
          )}
        </CardContent>
      </Card>

      {/* Dönemsel detay tablosu */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold text-foreground">Dönemsel Detay</CardTitle></CardHeader>
        <CardContent>
          {detailRows.length ? (
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dönem</TableHead>
                    <TableHead className="text-right">Brüt Satış</TableHead>
                    <TableHead className="text-right">İndirim</TableHead>
                    <TableHead className="text-right">Net Satış</TableHead>
                    <TableHead className="text-right">Ürün Maliyeti</TableHead>
                    <TableHead className="text-right">Gider</TableHead>
                    <TableHead className="text-right">Net Kâr</TableHead>
                    <TableHead className="text-right">Marj</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.grossSales)}</TableCell>
                      <TableCell className="text-right tabular-nums text-warning">−{formatCurrency(r.discount)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.netSales)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.cogs)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.expense)}</TableCell>
                      <TableCell className={r.profit >= 0 ? 'text-right tabular-nums font-medium text-success' : 'text-right tabular-nums font-medium text-destructive'}>
                        {formatCurrency(r.profit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.netSales > 0 ? `%${((r.profit / r.netSales) * 100).toFixed(1)}` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Bu aralıkta veri yok</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold text-foreground">Gider Dağılımı</CardTitle></CardHeader>
          <CardContent className="h-80">
            {data.expenseTotalsByCategory.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.expenseTotalsByCategory} dataKey="total" nameKey="category" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {data.expenseTotalsByCategory.map((_, i) => (
                      <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Bu aralıkta gider yok</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold text-foreground">Platform Bazlı Net Satış</CardTitle></CardHeader>
          <CardContent className="h-80">
            {data.salesByPlatform.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.salesByPlatform} dataKey="netSales" nameKey="platform" innerRadius={55} outerRadius={95} paddingAngle={2}>
                    {data.salesByPlatform.map((_, i) => (
                      <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Bu aralıkta satış yok</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ROAS — reklam harcamasının getirisi */}
      <RoasCard roas={data.roas} />

      {/* İl bazlı + indirim bandı analizleri */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold text-foreground">İl Bazlı Satış</CardTitle></CardHeader>
          <CardContent>
            {data.salesByProvince.length ? (
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>İl</TableHead>
                      <TableHead className="text-right">Sipariş</TableHead>
                      <TableHead className="text-right">Adet</TableHead>
                      <TableHead className="text-right">Net Satış</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.salesByProvince.map((r) => (
                      <TableRow key={r.province}>
                        <TableCell className="font-medium">{r.province}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.orders)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.units)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.netSales)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Bu aralıkta veri yok</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground">Sipariş İndirimine Göre Satış</CardTitle>
            <p className="text-sm text-muted-foreground">Sipariş geneli indirim oranına göre sipariş, adet ve net satış.</p>
          </CardHeader>
          <CardContent>
            {data.salesByDiscountBand.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>İndirim</TableHead>
                    <TableHead className="text-right">Sipariş</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Net Satış</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.salesByDiscountBand.map((r) => (
                    <TableRow key={r.band}>
                      <TableCell className="font-medium">{r.band}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.orders)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.units)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.netSales)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Bu aralıkta veri yok</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Kalem İndirimine Göre Satış</CardTitle>
          <p className="text-sm text-muted-foreground">Ürün satırı (kalem) indirim oranına göre satır sayısı, adet ve ciro.</p>
        </CardHeader>
        <CardContent>
          {data.itemsByDiscountBand.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kalem İndirimi</TableHead>
                  <TableHead className="text-right">Satır Sayısı</TableHead>
                  <TableHead className="text-right">Adet</TableHead>
                  <TableHead className="text-right">Ciro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.itemsByDiscountBand.map((r) => (
                  <TableRow key={r.band}>
                    <TableCell className="font-medium">{r.band}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.lines)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(r.units)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(r.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Bu aralıkta veri yok</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold text-foreground">İade Nedenleri</CardTitle></CardHeader>
          <CardContent>
            {data.returnsByReason.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Neden</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Tutar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.returnsByReason.map((r) => (
                    <TableRow key={r.reason}>
                      <TableCell>{r.reason}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(r.count)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.refund)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Bu aralıkta iade yok</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base font-semibold text-foreground">En Çok Satan Ürünler</CardTitle></CardHeader>
          <CardContent>
            {data.topProducts.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ürün</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">Ciro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topProducts.map((p) => (
                    <TableRow key={p.product}>
                      <TableCell className="max-w-[260px] truncate" title={p.product}>{p.product}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatNumber(p.quantity)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(p.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Bu aralıkta satış yok</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * ROAS kartı — reklam harcamasının getirisi.
 *
 * ROAS = seçili platformların net satışı ÷ reklam harcaması.
 * Kullanıcı platform seçebilir; payda (net satış) buna göre daralır.
 * Meta, Google ve toplam için ayrı ayrı gösterilir.
 */
function RoasCard({ roas }: { roas: ReportData['roas'] }) {
  const allPlatforms = roas.netSalesByPlatform.map((p) => p.platform);
  const [selected, setSelected] = useState<string[]>(allPlatforms);

  const toggle = (p: string) =>
    setSelected((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));

  const selectAll = () => setSelected(allPlatforms);
  const clearAll = () => setSelected([]);

  // Seçili platformların net satışı = payda
  const netSales = roas.netSalesByPlatform
    .filter((p) => selected.includes(p.platform))
    .reduce((s, p) => s + p.netSales, 0);

  const div = (a: number, b: number) => (b > 0 ? a / b : 0);
  const roasMeta = div(netSales, roas.metaSpend);
  const roasGoogle = div(netSales, roas.googleSpend);
  const roasTotal = div(netSales, roas.totalSpend);

  const allSelected = selected.length === allPlatforms.length;
  const hasSpend = roas.totalSpend > 0;

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold text-foreground">ROAS — Reklam Getirisi</CardTitle>
          <span className="text-xs text-muted-foreground">
            Net Satış {formatCurrency(netSales)} ÷ Reklam Harcaması
          </span>
        </div>
        {/* Platform seçimi */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Platformlar:</span>
          {allPlatforms.map((p) => {
            const on = selected.includes(p);
            return (
              <button
                key={p}
                type="button"
                onClick={() => toggle(p)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs transition-colors',
                  on ? 'border-transparent bg-accent font-medium' : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {p}
              </button>
            );
          })}
          {!allSelected ? (
            <button type="button" onClick={selectAll} className="text-xs text-primary underline-offset-2 hover:underline">Tümü</button>
          ) : (
            <button type="button" onClick={clearAll} className="text-xs text-muted-foreground underline-offset-2 hover:underline">Temizle</button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasSpend ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <RoasStat label="Meta Reklam" spend={roas.metaSpend} roas={roasMeta} netSales={netSales} color="hsl(210 60% 45%)" />
            <RoasStat label="Google Reklam" spend={roas.googleSpend} roas={roasGoogle} netSales={netSales} color="hsl(4 62% 50%)" />
            <RoasStat label="Toplam" spend={roas.totalSpend} roas={roasTotal} netSales={netSales} color="hsl(24 45% 42%)" highlight />
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center text-center text-sm text-muted-foreground">
            Bu aralıkta reklam gideri yok. Giderler sayfasından "Meta Reklam" veya "Google Reklam"
            kategorisiyle aylık gider girin.
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          ROAS = 1 ₺ reklam harcamasına karşılık gelen net satış. Örn. 4,00× → her 1 ₺ reklam 4 ₺ satış getirmiş.
          Reklam giderleri aylık girildiğinde seçili tarih aralığına düşen pay otomatik hesaplanır.
        </p>
      </CardContent>
    </Card>
  );
}

function RoasStat({
  label, spend, roas, netSales, color, highlight,
}: {
  label: string; spend: number; roas: number; netSales: number; color: string; highlight?: boolean;
}) {
  return (
    <div className={cn('rounded-lg border p-4', highlight ? 'border-primary/40 bg-primary/5' : 'border-border')}>
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums">
        {spend > 0 ? `${roas.toFixed(2)}×` : '—'}
      </div>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        <div>Harcama: {formatCurrency(spend)}</div>
        {spend > 0 && <div>Getiri: {formatCurrency(netSales)} net satış</div>}
      </div>
    </div>
  );
}
