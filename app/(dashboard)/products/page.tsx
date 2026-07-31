import { listProducts } from './actions';
import { ProductTable } from './product-table';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const products = await listProducts();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Ürünler</h1>
        <p className="text-sm text-muted-foreground">Ürün kartları — sipariş kalemlerinde otomatik tamamlama için</p>
      </div>
      <ProductTable data={products} />
    </div>
  );
}
