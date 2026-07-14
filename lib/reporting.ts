/**
 * YONGA ERP — Ortak satış/kâr tanımları
 * Panel (dashboard) ve Raporlar sayfası BU dosyayı kullanır; böylece iki
 * ekranda gösterilen rakamlar her zaman birbiriyle uyumludur.
 *
 * TANIMLAR (hepsi KDV DAHİL):
 *   Brüt Satış = Σ (adet × birim liste fiyatı)      → hiç indirim uygulanmamış
 *   İndirim    = satır indirimleri + sipariş indirimi
 *   Net Satış  = Brüt Satış − İndirim = orders.total → KDV DAHİL satış tutarı
 *
 *   Net Kâr    = Net Satış − Ürün Maliyeti − Giderler
 *
 * KARGO satış değildir: sipariş toplamına girmez, yalnızca Giderler tarafında
 * (kargo gideri olarak) yer alır ve bu yolla net kârı düşürür.
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Rapor/panel hesaplarına dahil edilen sipariş durumları. */
export const REPORTABLE_STATUSES = ['confirmed', 'processing', 'shipped', 'delivered'] as const;

export type OrderRow = {
  id: string;
  order_date: string;
  total: number | null;
  shipping_cost: number | null;
  total_usd: number | null;
  usd_rate: number | null;
  commission_amount: number | null;
};

export type OrderItemRow = {
  quantity: number | null;
  unit_price: number | null;
  line_total: number | null;
  order_id?: string;
  products?: { product_code?: string; name?: string; cost_price?: number } | null;
  orders?: { order_date?: string } | null;
};

/** Bir siparişin net satışı = orders.total (indirim sonrası, KDV dahil, kargo hariç). */
export function orderNetSales(order: Pick<OrderRow, 'total'>) {
  return Number(order.total ?? 0);
}

/** Siparişin USD net satışı: sipariş anında kilitlenen kur ile (kur yoksa 0). */
export function orderNetSalesUsd(order: Pick<OrderRow, 'total' | 'total_usd'>) {
  return Number(order.total_usd ?? 0);
}

/** Kalem satırının indirimsiz brüt tutarı. */
export function itemGross(item: Pick<OrderItemRow, 'quantity' | 'unit_price'>) {
  return Number(item.quantity ?? 0) * Number(item.unit_price ?? 0);
}

/** Kalem satırının ürün maliyeti. */
export function itemCogs(item: OrderItemRow) {
  return Number(item.quantity ?? 0) * Number(item.products?.cost_price ?? 0);
}

/** YYYY-MM anahtarı. */
export function monthKey(date: string | null | undefined) {
  return String(date ?? '').slice(0, 7);
}

/** Tarih aralığı filtresi (dahil sınırlar). Boş bırakılan uç sınırsızdır. */
export function inRange(date: string | null | undefined, from?: string, to?: string) {
  const d = String(date ?? '').slice(0, 10);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Zaman kırılımı (gün / hafta / ay)
// ---------------------------------------------------------------------------

export type Granularity = 'day' | 'week' | 'month';

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Verilen tarihin ait olduğu haftanın Pazartesi gününü döndürür. */
export function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  const dow = (d.getDay() + 6) % 7; // Pazartesi = 0
  d.setDate(d.getDate() - dow);
  return iso(d);
}

/** Bir tarihi seçilen kırılıma göre kova anahtarına çevirir. */
export function bucketKey(dateStr: string, granularity: Granularity): string {
  const d = String(dateStr ?? '').slice(0, 10);
  if (!d) return '';
  if (granularity === 'month') return d.slice(0, 7);
  if (granularity === 'week') return weekStart(d);
  return d;
}

/** Kova anahtarını okunur etikete çevirir. */
export function bucketLabel(key: string, granularity: Granularity): string {
  if (granularity === 'month') {
    const [y, m] = key.split('-');
    const names = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
    return `${names[Number(m) - 1] ?? m} ${y}`;
  }
  if (granularity === 'week') {
    const [, m, d] = key.split('-');
    return `${d}.${m} haftası`;
  }
  const [, m, d] = key.split('-');
  return `${d}.${m}`;
}

// ---------------------------------------------------------------------------
// Hazır tarih aralıkları
// ---------------------------------------------------------------------------

export type PresetId =
  | 'last7' | 'last30' | 'last90' | 'thisMonth' | 'lastMonth'
  | 'last6months' | 'thisYear' | 'lastYear' | 'all';

export const DATE_PRESETS: { id: PresetId; label: string }[] = [
  { id: 'last7', label: 'Son 7 gün' },
  { id: 'last30', label: 'Son 30 gün' },
  { id: 'last90', label: 'Son 90 gün' },
  { id: 'thisMonth', label: 'Bu ay' },
  { id: 'lastMonth', label: 'Geçen ay' },
  { id: 'last6months', label: 'Son 6 ay' },
  { id: 'thisYear', label: 'Bu yıl' },
  { id: 'lastYear', label: 'Geçen yıl' },
  { id: 'all', label: 'Tümü' },
];

/** Hazır aralığı { from, to } ISO tarihlerine çevirir. 'all' → boş. */
export function resolvePreset(id: PresetId, today = new Date()): { from?: string; to?: string } {
  const end = iso(today);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n + 1);
    return iso(d);
  };

  switch (id) {
    case 'last7': return { from: daysAgo(7), to: end };
    case 'last30': return { from: daysAgo(30), to: end };
    case 'last90': return { from: daysAgo(90), to: end };
    case 'thisMonth': {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: iso(d), to: end };
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const finish = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: iso(start), to: iso(finish) };
    }
    case 'last6months': {
      const d = new Date(today.getFullYear(), today.getMonth() - 5, 1);
      return { from: iso(d), to: end };
    }
    case 'thisYear': return { from: `${today.getFullYear()}-01-01`, to: end };
    case 'lastYear': {
      const y = today.getFullYear() - 1;
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    case 'all':
    default:
      return {};
  }
}
