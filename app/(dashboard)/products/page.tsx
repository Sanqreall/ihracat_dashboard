import { listProducts, listCategoriesAndSeries } from './actions';
import { ProductTable } from './product-table';

export default async function ProductsPage() {
  const [products, { categories, series }] = await Promise.all([
    listProducts(),
    listCategoriesAndSeries(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ürünler</h1>
        <p className="text-sm text-muted-foreground">Ürün kataloğu, fiyatlandırma ve stok bilgileri</p>
      </div>
      <ProductTable data={products ?? []} categories={categories} series={series} />
    </div>
  );
}
