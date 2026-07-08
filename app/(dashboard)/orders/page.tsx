import { listOrders } from './actions';
import { listPlatformsLite } from '../platforms/actions';
import { listProductsLite } from '../products/actions';
import { OrderTable } from './order-table';

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [orders, platforms, products] = await Promise.all([
    listOrders(),
    listPlatformsLite(),
    listProductsLite(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Siparişler</h1>
        <p className="text-sm text-muted-foreground">
          Fiyatlar KDV dahildir; onaylanan siparişler stoğu düşer, iptal/silme geri alır
        </p>
      </div>
      <OrderTable data={orders ?? []} platforms={platforms} products={products} initialFilter={q ?? ''} />
    </div>
  );
}
