import { listRates } from './actions';
import { RatesTable } from './rates-table';

export const dynamic = 'force-dynamic';

export default async function ExchangeRatesPage() {
  const rates = await listRates();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Döviz Kurları</h1>
        <p className="text-sm text-muted-foreground">USD bazlı kurlar — rapor ve panel dönüşümlerinde kullanılır</p>
      </div>
      <RatesTable data={rates} />
    </div>
  );
}
