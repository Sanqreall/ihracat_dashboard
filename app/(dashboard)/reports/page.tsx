import { getReportData } from './actions';
import { ReportsView } from './reports-view';

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; province?: string }>;
}) {
  const { from, to, province } = await searchParams;
  // Çoklu il: virgülle ayrılmış (province=İstanbul,Ankara)
  const provinces = province ? province.split(',').map((p) => p.trim()).filter(Boolean) : undefined;
  const data = await getReportData({ from, to, provinces });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Raporlar</h1>
        <p className="text-sm text-muted-foreground">
          Tarih aralığı seçin, grafikleri gün / hafta / ay olarak kırın.
          Net satış indirim düşülmüş, KDV dahil tutardır; kâr hesapları bunun üzerinden yapılır.
        </p>
      </div>
      <ReportsView data={data} />
    </div>
  );
}
