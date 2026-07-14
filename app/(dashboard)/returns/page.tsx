import { listReturns, listOrdersLite } from './actions';
import { listPlatformsLite } from '../platforms/actions';
import { listProductsLite } from '../products/actions';
import { getSettings } from '../settings/actions';
import { ReturnTable } from './return-table';

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [returns, platforms, products, orders, settings] = await Promise.all([
    listReturns(),
    listPlatformsLite(),
    listProductsLite(),
    listOrdersLite(),
    getSettings(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">İadeler</h1>
        <p className="text-sm text-muted-foreground">
          Sipariş seçince müşteri, platform ve iade edilmemiş kalemler otomatik dolar; tutarlar sipariş fiyatından hesaplanır
        </p>
      </div>
      <ReturnTable
        data={returns ?? []}
        platforms={platforms}
        products={products}
        orders={orders as any}
        initialFilter={q ?? ''}
        pricePerDesi={Number(settings?.shipping_price_per_desi ?? 0)}
      />
    </div>
  );
}
