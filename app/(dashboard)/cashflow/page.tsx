import { listCashflow } from './actions';
import { CashflowView } from './cashflow-view';

export const dynamic = 'force-dynamic';

export default async function CashflowPage() {
  const rows = await listCashflow();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Nakit Akışı</h1>
        <p className="text-sm text-muted-foreground">Yaklaşan tahsilatların vade listesi · gecikmişler her zaman gösterilir</p>
      </div>
      <CashflowView rows={rows} />
    </div>
  );
}
