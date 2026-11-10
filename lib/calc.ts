// Sipariş formunda canlı önizleme için hesap — veritabanındaki v_order_totals ile AYNI formül.
import type { OrderDraft } from "./types";
import { round2 } from "./format";

export interface ShipmentCalc {
  shipment_no: number;
  goods: number;      // satır iskontolu brüt mal bedeli
  share: number;      // sipariş mal bedeli içindeki payı
  netGoods: number;   // sipariş iskontosu dağıtılmış mal bedeli
  vat: number;
  total: number;      // sipariş toplamından düşen pay (ek maliyet dahil)
}

export interface Totals {
  subtotal: number;
  discount: number;
  netGoods: number;
  vatAmount: number;
  costs: number;
  costsVat: number;
  total: number;
  shipments: ShipmentCalc[];
}

export const lineTotal = (q: number, p: number, disc: number) =>
  (Number(q) || 0) * (Number(p) || 0) * (1 - (Number(disc) || 0) / 100);

export function calcTotals(d: OrderDraft): Totals {
  const o = d.order;
  const shipNos = d.shipments.length ? d.shipments.map((s) => s.shipment_no) : [1];
  const goodsBy = new Map<number, number>(shipNos.map((n) => [n, 0]));
  for (const it of d.items) {
    const n = goodsBy.has(it.shipment_no) ? it.shipment_no : shipNos[0];
    goodsBy.set(n, (goodsBy.get(n) || 0) + lineTotal(it.quantity, it.unit_price, it.discount_pct));
  }
  const subtotal = [...goodsBy.values()].reduce((a, b) => a + b, 0);
  let discount = 0;
  if (o.discount_type === "percentage") discount = (subtotal * (Number(o.discount_value) || 0)) / 100;
  else if (o.discount_type === "amount") discount = Math.min(Number(o.discount_value) || 0, subtotal);
  const netGoods = subtotal - discount;
  const vatRate = Number(o.vat_rate) || 0;
  const vatAmount = (netGoods * vatRate) / 100;
  const costs = d.costs.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  const costsVat = d.costs.reduce((s, c) => s + ((Number(c.amount) || 0) * (Number(c.vat_rate) || 0)) / 100, 0);
  const total = netGoods + vatAmount + costs + costsVat;

  const shipments: ShipmentCalc[] = shipNos.map((n) => {
    const goods = goodsBy.get(n) || 0;
    const share = subtotal > 0 ? goods / subtotal : 1 / shipNos.length;
    return {
      shipment_no: n,
      goods,
      share,
      netGoods: netGoods * share,
      vat: vatAmount * share,
      total: total * share,
    };
  });

  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    netGoods: round2(netGoods),
    vatAmount: round2(vatAmount),
    costs: round2(costs),
    costsVat: round2(costsVat),
    total: round2(netGoods * (1 + vatRate / 100) + costs + costsVat),
    shipments,
  };
}

// Tutarları kuruşu kuruşuna dağıt: parçaların toplamı tam olarak `total` olur.
export function splitExact(total: number, weights: number[]): number[] {
  const t = Math.round(total * 100);
  const wsum = weights.reduce((a, b) => a + b, 0);
  if (!weights.length) return [];
  if (wsum <= 0) return weights.map((_, i) => (i === 0 ? t / 100 : 0));
  const raw = weights.map((w) => (t * w) / wsum);
  const floors = raw.map(Math.floor);
  let rest = t - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < order.length && rest > 0; k++, rest--) floors[order[k][1]] += 1;
  return floors.map((c) => c / 100);
}
