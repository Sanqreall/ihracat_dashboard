import Link from 'next/link';
import { DollarSign, Wallet, AlertTriangle, CalendarClock, ShoppingCart, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getDashboardKpis } from './actions';

export const dynamic = 'force-dynamic';

const usd = (n: number) => `$${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted-foreground/40', confirmed: 'bg-blue-500', production: 'bg-amber-500', ready: 'bg-yellow-500',
  shipped: 'bg-indigo-500', delivered: 'bg-teal-500', completed: 'bg-green-500', cancelled: 'bg-red-400',
};

export default async function DashboardPage() {
  const k = await getDashboardKpis();
  const maxCount = Math.max(1, ...k.orderCounts.map((c) => c.count));

  const kpis = [
    { label: 'Gerçekleşen Ciro', value: usd(k.realizedRevenueUSD), icon: DollarSign, accent: 'text-green-600', href: '/reports' },
    { label: 'Açık Tahsilat', value: usd(k.openReceivablesUSD), icon: Wallet, accent: 'text-blue-600', href: '/payments' },
    { label: 'Gecikmiş', value: usd(k.overdueUSD), icon: AlertTriangle, accent: 'text-red-600', href: '/payments' },
    { label: 'Önümüzdeki 30 Gün', value: usd(k.next30USD), icon: CalendarClock, accent: 'text-amber-600', href: '/cashflow' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Panel</h1>
        <p className="text-sm text-muted-foreground">İhracat operasyonlarının özeti (tutarlar USD)</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.label} href={kpi.href}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{kpi.label}</span>
                    <Icon className={`h-4 w-4 ${kpi.accent}`} />
                  </div>
                  <p className={`mt-2 text-2xl font-semibold tabular-nums ${kpi.accent}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3"><CardTitle className="text-base">Siparişler — Durum Dağılımı</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {k.orderCounts.map((c) => (
              <div key={c.status} className="flex items-center gap-3">
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{c.label}</span>
                <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                  <div className={`h-full ${STATUS_COLOR[c.status]}`} style={{ width: `${(c.count / maxCount) * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-sm tabular-nums font-medium">{c.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Özet</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Link href="/orders" className="flex items-center gap-3 rounded-md p-2 hover:bg-accent">
              <ShoppingCart className="h-5 w-5 text-indigo-600" />
              <div><p className="text-lg font-semibold">{k.openOrderCount}</p><p className="text-xs text-muted-foreground">Açık sipariş</p></div>
            </Link>
            <Link href="/customers" className="flex items-center gap-3 rounded-md p-2 hover:bg-accent">
              <Users className="h-5 w-5 text-teal-600" />
              <div><p className="text-lg font-semibold">{k.customerCount}</p><p className="text-xs text-muted-foreground">Müşteri</p></div>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
