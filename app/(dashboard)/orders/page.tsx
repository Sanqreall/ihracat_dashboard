import { listOrders } from './actions';
import { listPlatformsLite } from '../platforms/actions';
import { listProductsLite } from '../products/actions';
import { getSettings } from '../settings/actions';
import { OrderTable } from './order-table';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [orders, platforms, products, settings] = await Promise.all([
    listOrders(),
    listPlatformsLite(),
    listProductsLite(),
    getSettings(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Siparişler</h1>
        <p className="text-sm text-muted-foreground">
          Fiyatlar KDV dahildir; kargo desiye göre otomatik hesaplanır, onaylanan siparişler stoğu düşer
        </p>
      </div>
      <OrderTable
        data={orders ?? []}
        platforms={platforms}
        products={products}
        initialFilter={q ?? ''}
        pricePerDesi={Number(settings?.shipping_price_per_desi ?? 0)}
      />
    </div>
  );
}
