import { getCustomerRevenueReport } from './actions';
import { ReportView } from './report-view';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const data = await getCustomerRevenueReport();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Raporlar</h1>
        <p className="text-sm text-muted-foreground">Müşteri bazlı, durum bazlı ciro (USD) · PDF ve Excel çıktı</p>
      </div>
      <ReportView data={data} />
    </div>
  );
}
