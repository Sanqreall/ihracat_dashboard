import { getForecastData } from './actions';
import { ForecastView } from './forecast-view';

export default async function ForecastPage() {
  const data = await getForecastData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Talep Tahmini</h1>
        <p className="text-sm text-muted-foreground">
          Son 90 günün satış hızına göre ürün bazlı ihtiyaç: 1 ay / 3 ay / 6 ay / 1 yıl.
          İhtiyaç = dönem talebi − kullanılabilir stok (mevcut + üretimde).
        </p>
      </div>
      <ForecastView data={data} />
    </div>
  );
}
