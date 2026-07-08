import { getReportData } from './actions';
import { ReportsView } from './reports-view';

export default async function ReportsPage() {
  const data = await getReportData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Raporlar</h1>
        <p className="text-sm text-muted-foreground">
          Satış, kâr/zarar, platform ve iade analizleri (taslak ve iptal siparişler hariç)
        </p>
      </div>
      <ReportsView data={data} />
    </div>
  );
}
