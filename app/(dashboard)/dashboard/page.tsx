import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const dynamic = 'force-dynamic';

const MODULES = [
  ['Müşteriler', 'Müşteri kayıtları, açık bakiye, durum bazlı ciro'],
  ['Siparişler', 'Kalemler, çoklu sevkiyat, ödeme planı'],
  ['Tahsilat', 'Gerçekleşen ödemeler, gecikme takibi'],
  ['Nakit Akışı', 'Yaklaşan tahsilatlar, vade listesi'],
  ['Raporlar', 'PDF/Excel çıktılar, durum ve müşteri analizleri'],
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Panel</h1>
        <p className="text-sm text-muted-foreground">
          İhracat ERP iskeleti kuruldu. Modüller sırayla eklenecek.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kurulum durumu</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>✓ Next.js 15 + Supabase (SSR) + shadcn/ui iskeleti</p>
          <p>✓ Kimlik doğrulama, RLS, yetki (admin/manager/employee)</p>
          <p>✓ Veri şeması (müşteri, ürün, sipariş, ödeme, kur, banka) — Yonga konvansiyonu</p>
          <p className="text-muted-foreground/70">Sıradaki: Müşteriler ve Ürünler modülleri (CRUD + Excel + PDF)</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map(([title, desc]) => (
          <Card key={title} className="opacity-70">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{desc}</p>
              <span className="mt-2 inline-block rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">yakında</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
