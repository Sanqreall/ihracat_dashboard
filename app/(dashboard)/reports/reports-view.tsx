'use client';

import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts';
import * as XLSX from 'xlsx';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { ReportData } from './actions';

const PIE_COLORS = [
  'hsl(24 45% 42%)', 'hsl(210 20% 40%)', 'hsl(142 40% 38%)', 'hsl(38 75% 48%)',
  'hsl(4 62% 50%)', 'hsl(270 30% 50%)', 'hsl(190 40% 40%)', 'hsl(330 40% 50%)',
];

export function ReportsView({ data }: { data: ReportData }) {
  const handleExportAll = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.salesByMonth.map((r) => ({ 'Ay': r.month, 'Brüt Satış': r.grossSales, 'Net Satış': r.netSales, 'Sipariş': r.orders }))
    ), 'Aylık Satış');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.salesByPlatform.map((r) => ({ 'Platform': r.platform, 'Net Satış': r.netSales, 'Sipariş': r.orders }))
    ), 'Platform');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.topProducts.map((r) => ({ 'Ürün': r.product, 'Adet': r.quantity, 'Ciro': r.revenue }))
    ), 'En Çok Satanlar');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.profitByMonth.map((r) => ({ 'Ay': r.month, 'Net Satış': r.revenue, 'Ürün Maliyeti': r.cogs, 'Gider': r.expense, 'Net Kâr': r.profit }))
    ), 'Kâr-Zarar');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.forecast.map((f) => ({
        'Ürün': f.product, '90 Gün Satış': f.sold90, 'Aylık Hız': f.monthlyVelocity,
        'Kullanılabilir Stok': f.available, '1 Ay İhtiyaç': f.need1, '3 Ay İhtiyaç': f.need3,
        '6 Ay İhtiyaç': f.need6, '1 Yıl İhtiyaç': f.need12,
        'Stok Biter (gün)': f.stockoutDays ?? '',
      }))
    ), 'Talep Tahmini');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      data.returnsByReason.map((r) => ({ 'Neden': r.reason, 'Adet': r.count, 'İade Tutarı': r.refund }))
    ), 'İade Nedenleri');
    XLSX.writeFile(wb, `rapor_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const t = data.totals;

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleExportAll}>
          <Download className="mr-1.5 h-4 w-4" /> Tüm Raporu Excel'e Aktar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle>Brüt Satış</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-semibold">{formatCurrency(t.grossSales)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle>Net Satış</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-semibold">{formatCurrency(t.netSales)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle>Sipariş / İade</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-semibold">{formatNumber(t.orderCount)} / {formatNumber(t.returnCount)}</div>
            <p className="mt-1 text-xs text-muted-foreground">İade oranı %{t.returnRate}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle>Toplam Gider</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-semibold">{formatCurrency(t.expenseTotal)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle>Ürün Maliyeti (COGS)</CardTitle></CardHeader>
          <CardContent><div className="text-xl font-semibold">{formatCurrency(t.cogsTotal)}</div></CardContent></Card>
        <Card className="lg:col-span-3"><CardHeader className="pb-2"><CardTitle>Net Kâr (Net Satış − Ürün Maliyeti − Giderler)</CardTitle></CardHeader>
          <CardContent><div className={t.netProfit >= 0 ? 'text-2xl font-semibold text-success' : 'text-2xl font-semibold text-destructive'}>{formatCurrency(t.netProfit)}</div></CardContent></Card>
      </div>

      {/* Monthly sales */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold text-foreground">Aylık Satış (Brüt / Net)</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.salesByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Legend />
              <Bar dataKey="grossSales" name="Brüt" fill="hsl(210 20% 45%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="netSales" name="Net" fill="hsl(24 45% 42%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Profit vs Expense */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold text-foreground">Aylık Net Kâr (Net Satış − Ürün Maliyeti − Gider)</CardTitle></CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.profitByMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
              <Legend />
              <Bar dataKey="revenue" name="Net Satış" fill="hsl(142 40% 38%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cogs" name="Ürün Maliyeti" fill="hsl(38 75% 48%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Gider" fill="hsl(4 62% 50%)" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="profit" name="Net Kâr" stroke="hsl(24 45% 42%)" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Aylık detay tablosu */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold text-foreground">Aylık Detay</CardTitle></CardHeader>
        <CardContent>
          {data.profitByMonth.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ay</TableHead>
                  <TableHead className="text-right">Net Satış</TableHead>
                  <TableHead className="text-right">Ürün Maliyeti</TableHead>
                  <TableHead className="text-right">Gider</TableHead>
                  <TableHead className="text-right">Net Kâr</TableHead>
                  <TableHead className="text-right">Kâr Marjı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.profitByMonth.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">{m.month}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.cogs)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.expense)}</TableCell>
                    <TableCell className={m.profit >= 0 ? 'text-right tabular-nums font-medium text-success' : 'text-right tabular-nums font-medium text-destructive'}>
                      {formatCurrency(m.profit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.revenue > 0 ? `%${((m.profit / m.revenue) * 100).toFixed(1)}` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Henüz veri yok</div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Platform pie */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold text-foreground">Platform Bazlı Net Satış</CardTitle></CardHeader>
          <CardContent className="h-80">
            {data.salesByPlatform.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.salesByPlatform} dataKey="netSales" nameKey="platform" innerRadius={60} outerRadius={100} paddingAngle={2}>
                    {data.salesByPlatform.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Henüz veri yok</div>
            )}
          </CardContent>
        </Card>

        {/* Return reasons */}
        <Card>
          <CardHeader><CardTitle className="text-base font-semibold text-foreground">İade Nedenleri</CardTitle></CardHeader>
          <CardContent>
            {data.returnsByReason.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Neden</TableHead>
                    <TableHead className="text-right">Adet</TableHead>
                    <TableHead className="text-right">İade Tutarı</TableHead>
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
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Henüz iade yok</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      <Card>
        <CardHeader><CardTitle className="text-base font-semibold text-foreground">En Çok Satan Ürünler (Ciroya Göre)</CardTitle></CardHeader>
        <CardContent>
          {data.topProducts.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-right">Adet</TableHead>
                  <TableHead className="text-right">Ciro (Net)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topProducts.map((p) => (
                  <TableRow key={p.product}>
                    <TableCell>{p.product}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(p.quantity)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(p.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Henüz satış yok</div>
          )}
        </CardContent>
      </Card>

      {/* Talep tahmini */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground">Talep Tahmini (Son 90 Günün Satış Hızına Göre)</CardTitle>
          <p className="text-sm text-muted-foreground">
            İhtiyaç = dönem talebi − kullanılabilir stok (mevcut + üretimde − rezerve). 0 ise stok yeterli.
          </p>
        </CardHeader>
        <CardContent>
          {data.forecast.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ürün</TableHead>
                  <TableHead className="text-right">90 Gün Satış</TableHead>
                  <TableHead className="text-right">Aylık Hız</TableHead>
                  <TableHead className="text-right">Kullanılabilir</TableHead>
                  <TableHead className="text-right">1 Ay</TableHead>
                  <TableHead className="text-right">3 Ay</TableHead>
                  <TableHead className="text-right">6 Ay</TableHead>
                  <TableHead className="text-right">1 Yıl</TableHead>
                  <TableHead className="text-right">Stok Biter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.forecast.map((f) => (
                  <TableRow key={f.product}>
                    <TableCell className="max-w-[280px] truncate" title={f.product}>{f.product}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(f.sold90)}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.monthlyVelocity.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatNumber(f.available)}</TableCell>
                    <TableCell className={f.need1 > 0 ? 'text-right tabular-nums font-medium text-warning' : 'text-right tabular-nums text-muted-foreground'}>{formatNumber(f.need1)}</TableCell>
                    <TableCell className={f.need3 > 0 ? 'text-right tabular-nums font-medium text-warning' : 'text-right tabular-nums text-muted-foreground'}>{formatNumber(f.need3)}</TableCell>
                    <TableCell className={f.need6 > 0 ? 'text-right tabular-nums font-medium text-warning' : 'text-right tabular-nums text-muted-foreground'}>{formatNumber(f.need6)}</TableCell>
                    <TableCell className={f.need12 > 0 ? 'text-right tabular-nums font-medium text-warning' : 'text-right tabular-nums text-muted-foreground'}>{formatNumber(f.need12)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.stockoutDays === null ? '—' : f.stockoutDays <= 30
                        ? <span className="font-medium text-destructive">{f.stockoutDays} gün</span>
                        : `${f.stockoutDays} gün`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">Aktif ürün bulunamadı</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
