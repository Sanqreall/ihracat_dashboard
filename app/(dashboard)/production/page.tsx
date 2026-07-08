import { listBatches } from './actions';
import { listProductsLite } from '../products/actions';
import { ProductionView } from './production-view';

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [batches, products] = await Promise.all([listBatches(), listProductsLite()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Üretim</h1>
        <p className="text-sm text-muted-foreground">
          Kuyruk → Üretimde → Tamamlandı → Stoğa Aktarıldı; üretimdeki adetler Stok sayfasında görünür
        </p>
      </div>
      <ProductionView batches={batches ?? []} products={products} initialFilter={q ?? ''} />
    </div>
  );
}
