import { listProductionLines } from './actions';
import { listProductsLite } from '../products/actions';
import { ProductionView } from './production-view';

export default async function ProductionPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const [lines, products] = await Promise.all([listProductionLines(), listProductsLite()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Üretim</h1>
        <p className="text-sm text-muted-foreground">
          Bir emir numarası altında birden fazla ürün; satıra tıklayınca ürünler açılır, satır veya emir düzeyinde stoğa aktarılır
        </p>
      </div>
      <ProductionView lines={lines ?? []} products={products} initialFilter={q ?? ''} />
    </div>
  );
}
