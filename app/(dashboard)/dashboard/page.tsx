import { Package, ShoppingCart, Warehouse, AlertTriangle, TrendingUp, Receipt } from 'lucide-react';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { getDashboardKpis } from './actions';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default async function DashboardPage() {
  const kpi = await getDashboardKpis();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Genel Bakış</h1>
        <p className="text-sm text-muted-foreground">So-mass iç pazar operasyonlarının özeti</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <KpiCard label="Ürün Sayısı" value={formatNumber(kpi.productCount)} icon={Package} />
        <KpiCard label="Sipariş Sayısı" value={formatNumber(kpi.orderCount)} icon={ShoppingCart} />
        <KpiCard label="Stok Değeri" value={formatCurrency(kpi.inventoryValue)} icon={Warehouse} />
        <KpiCard
          label="Kritik Stok"
          value={formatNumber(kpi.criticalStockCount)}
          icon={AlertTriangle}
          tone={kpi.criticalStockCount > 0 ? 'warning' : 'success'}
        />
        <KpiCard label="Brüt Satış" value={formatCurrency(kpi.grossSales)} icon={TrendingUp} />
        <KpiCard label="Net Satış" value={formatCurrency(kpi.netSales)} icon={Receipt} tone="success" />
        <KpiCard label="Ortalama Sipariş Değeri" value={formatCurrency(kpi.avgOrderValue)} icon={ShoppingCart} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <SalesChart data={kpi.salesByMonth} />
      </div>
    </div>
  );
}
