import { listOrders } from './actions';
import { listRates } from '../exchange-rates/actions';
import { listCustomersLite } from '../customers/actions';
import { listProductsLite } from '../products/actions';
import { OrderTable } from './order-table';

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const [orders, customers, products, rates] = await Promise.all([
    listOrders(), listCustomersLite(), listProductsLite(), listRates(),
  ]);
  const rateMap: Record<string, number> = { USD: 1 };
  for (const r of rates) rateMap[r.currency] = Number(r.rate_to_usd) || 1;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Siparişler</h1>
        <p className="text-sm text-muted-foreground">Kalemler, ek maliyetler ve ödeme planı birlikte yönetilir</p>
      </div>
      <OrderTable data={orders} customers={customers} products={products} rateMap={rateMap} />
    </div>
  );
}
