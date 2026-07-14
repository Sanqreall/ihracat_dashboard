import { listStockSummary, listStockMovements } from './actions';
import { listProductsLite } from '../products/actions';
import { InventoryView } from './inventory-view';

export default async function InventoryPage() {
  const [summary, movements, products] = await Promise.all([
    listStockSummary(),
    listStockMovements(),
    listProductsLite(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Stok</h1>
        <p className="text-sm text-muted-foreground">
          Ürün bazında stok özeti ve tüm hareketlerin kaydı (ledger)
        </p>
      </div>
      <InventoryView summary={summary} movements={movements ?? []} products={products} />
    </div>
  );
}
