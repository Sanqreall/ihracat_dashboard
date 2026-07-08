import { listReturns, listOrdersLite } from './actions';
import { listPlatformsLite } from '../platforms/actions';
import { listProductsLite } from '../products/actions';
import { ReturnTable } from './return-table';

export default async function ReturnsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [returns, platforms, products, orders] = await Promise.all([
    listReturns(),
    listPlatformsLite(),
    listProductsLite(),
    listOrdersLite(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">İadeler</h1>
        <p className="text-sm text-muted-foreground">
          Sipariş seçince müşteri ve iade edilmemiş kalemler otomatik dolar; tek tıkla stoğa aktarın
        </p>
      </div>
      <ReturnTable data={returns ?? []} platforms={platforms} products={products} orders={orders as any} initialFilter={q ?? ''} />
    </div>
  );
}
