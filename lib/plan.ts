// Ödeme planı üretimi.
// • Yüzdeler (ön ödeme + sevk öncesi + vadeli) toplamı %100 olmalı.
// • Tutarlar kuruşu kuruşuna dağıtılır: plan toplamı = sipariş toplamı.
// • Sevkiyat bazlı planda iskonto, KDV ve ek maliyetler sevkiyatlara doğru dağıtılır.
// • Yeniden üretimde mevcut kalemlerin kimlikleri korunur (aynı tip + sevkiyat + maliyet).
import type { Customer, OrderDraft, PlanDraft, PlanTemplate, PlanType } from "./types";
import { calcTotals, splitExact } from "./calc";
import { addDays, newId, todayTR } from "./format";

export const PRESETS: { key: string; label: string; t: Pick<PlanTemplate, "prepPct" | "preShipPct" | "defPct"> }[] = [
  { key: "30-40-30", label: "%30 Ön · %40 Sevk Öncesi · %30 Vadeli", t: { prepPct: 30, preShipPct: 40, defPct: 30 } },
  { key: "30-0-70", label: "%30 Ön · %70 Vadeli", t: { prepPct: 30, preShipPct: 0, defPct: 70 } },
  { key: "50-50-0", label: "%50 Ön · %50 Sevk Öncesi", t: { prepPct: 50, preShipPct: 50, defPct: 0 } },
  { key: "100-0-0", label: "%100 Peşin", t: { prepPct: 100, preShipPct: 0, defPct: 0 } },
  { key: "0-100-0", label: "%100 Sevk Öncesi (L/C, CAD)", t: { prepPct: 0, preShipPct: 100, defPct: 0 } },
  { key: "0-0-100", label: "%100 Vadeli", t: { prepPct: 0, preShipPct: 0, defPct: 100 } },
];

export function templateFromCustomer(c?: Customer | null): PlanTemplate {
  const pre = Number(c?.default_prepayment_pct) || 0;
  const ps = Number(c?.default_pre_shipment_pct) || 0;
  let def = Number(c?.default_deferred_pct) || 0;
  if (pre + ps + def !== 100) def = Math.max(0, 100 - pre - ps);
  return {
    prepPct: pre,
    preShipPct: ps,
    defPct: def,
    termDays: c?.payment_terms_days ?? 30,
    method: c?.default_payment_method || "bank_transfer",
    auto: true,
  };
}

export function templateError(t: PlanTemplate | null): string | null {
  if (!t) return null;
  const sum = (Number(t.prepPct) || 0) + (Number(t.preShipPct) || 0) + (Number(t.defPct) || 0);
  if (Math.abs(sum - 100) > 0.001) return `Yüzdelerin toplamı %100 olmalı (şu an %${sum})`;
  return null;
}

const shipDateOf = (d: OrderDraft, no: number | null): string => {
  const list = [...d.shipments].sort((a, b) => a.shipment_no - b.shipment_no);
  const s = (no != null ? list.find((x) => x.shipment_no === no) : null) ?? list[0];
  return s?.actual_date || s?.planned_date || d.order.order_date || todayTR();
};

interface Row {
  type: PlanType;
  shipment_no: number | null;
  cost_id: string | null;
  percentage: number | null;
  weight: number; // tutar dağıtım ağırlığı
  group: "goods" | "vat" | "cost";
  due_date: string;
  notes: string;
  fixedAmount?: number;
}

export function generatePlan(d: OrderDraft, t: PlanTemplate, existing: PlanDraft[] = []): PlanDraft[] {
  const tot = calcTotals(d);
  const term = Number(t.termDays) || 0;
  const orderDate = d.order.order_date || todayTR();
  const shipmentMode = d.order.payment_basis === "shipment" && d.shipments.length > 1;
  const rows: Row[] = [];
  const pre = Number(t.prepPct) || 0, ps = Number(t.preShipPct) || 0, def = Number(t.defPct) || 0;

  if (!shipmentMode) {
    const sd = shipDateOf(d, null);
    if (pre > 0) rows.push({ type: "prepayment", shipment_no: null, cost_id: null, percentage: pre, weight: pre, group: "goods", due_date: orderDate, notes: "Sipariş onayında ön ödeme" });
    if (ps > 0) rows.push({ type: "preShipment", shipment_no: null, cost_id: null, percentage: ps, weight: ps, group: "goods", due_date: sd, notes: "Sevkiyat öncesi" });
    if (def > 0) rows.push({ type: "deferred", shipment_no: null, cost_id: null, percentage: def, weight: def, group: "goods", due_date: addDays(sd, term), notes: `Sevkten ${term} gün sonra` });
    if (tot.vatAmount > 0) rows.push({ type: "vat", shipment_no: null, cost_id: null, percentage: 100, weight: 1, group: "vat", due_date: addDays(sd, term), notes: `KDV — sevkten ${term} gün sonra` });
  } else {
    // Ön ödeme sipariş geneline; sevk öncesi / vadeli / KDV her sevkiyata kendi payı kadar
    if (pre > 0) rows.push({ type: "prepayment", shipment_no: null, cost_id: null, percentage: pre, weight: pre, group: "goods", due_date: orderDate, notes: "Sipariş onayında ön ödeme (tüm sipariş)" });
    for (const s of tot.shipments) {
      const sh = d.shipments.find((x) => x.shipment_no === s.shipment_no);
      const label = sh?.name || `${s.shipment_no}. Sevkiyat`;
      const sd = shipDateOf(d, s.shipment_no);
      if (ps > 0) rows.push({ type: "preShipment", shipment_no: s.shipment_no, cost_id: null, percentage: ps, weight: ps * s.share, group: "goods", due_date: sd, notes: `${label} — sevk öncesi` });
      if (def > 0) rows.push({ type: "deferred", shipment_no: s.shipment_no, cost_id: null, percentage: def, weight: def * s.share, group: "goods", due_date: addDays(sd, term), notes: `${label} — sevkten ${term} gün sonra` });
      if (tot.vatAmount > 0) rows.push({ type: "vat", shipment_no: s.shipment_no, cost_id: null, percentage: 100, weight: s.share, group: "vat", due_date: addDays(sd, term), notes: `${label} — KDV` });
    }
  }

  // Ek maliyetler — her biri KDV'siyle ayrı plan kalemi
  const lastGoodsDue = rows.reduce((m, r) => (r.due_date > m ? r.due_date : m), addDays(shipDateOf(d, null), term));
  for (const c of d.costs) {
    const amt = (Number(c.amount) || 0) * (1 + (Number(c.vat_rate) || 0) / 100);
    if (amt <= 0) continue;
    const due = c.shipment_no != null && shipmentMode ? addDays(shipDateOf(d, c.shipment_no), term) : lastGoodsDue;
    rows.push({ type: "cost", shipment_no: shipmentMode ? c.shipment_no : null, cost_id: c.id, percentage: null, weight: 1, group: "cost", due_date: due, notes: c.description || "Ek maliyet", fixedAmount: amt });
  }

  // Kuruş hassasiyetinde dağıtım
  const goodsRows = rows.filter((r) => r.group === "goods");
  const vatRows = rows.filter((r) => r.group === "vat");
  const goodsAmts = splitExact(tot.netGoods, goodsRows.map((r) => r.weight));
  const vatAmts = splitExact(tot.vatAmount, vatRows.map((r) => r.weight));
  const amountOf = new Map<Row, number>();
  goodsRows.forEach((r, i) => amountOf.set(r, goodsAmts[i]));
  vatRows.forEach((r, i) => amountOf.set(r, vatAmts[i]));
  // Ek maliyet tutarları: toplamları sipariş toplamındaki maliyet+KDV ile birebir tutsun
  const costRows = rows.filter((r) => r.group === "cost");
  const costAmts = splitExact(tot.costs + tot.costsVat, costRows.map((r) => r.fixedAmount || 0));
  costRows.forEach((r, i) => amountOf.set(r, costAmts[i]));

  // Kimlik koruma: aynı anahtarlı mevcut kalemin id'sini kullan
  const pool = new Map<string, string[]>();
  for (const e of existing) {
    const k = `${e.type}|${e.shipment_no ?? ""}|${e.cost_id ?? ""}`;
    pool.set(k, [...(pool.get(k) || []), e.id]);
  }
  const takeId = (r: Row) => {
    const k = `${r.type}|${r.shipment_no ?? ""}|${r.cost_id ?? ""}`;
    const ids = pool.get(k);
    return ids && ids.length ? ids.shift()! : newId();
  };

  return rows.map((r) => ({
    id: takeId(r),
    type: r.type,
    shipment_no: r.shipment_no,
    cost_id: r.cost_id,
    percentage: r.percentage,
    amount: amountOf.get(r) ?? 0,
    due_date: r.due_date,
    method: t.method || "bank_transfer",
    notes: r.notes,
  }));
}

// Plan ile sipariş toplamı karşılaştırması
export function planCheck(d: OrderDraft) {
  const tot = calcTotals(d);
  const sum = (types: PlanType[]) =>
    d.plan.filter((p) => types.includes(p.type)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const goods = sum(["prepayment", "preShipment", "deferred", "other"]);
  const vat = sum(["vat"]);
  const cost = sum(["cost"]);
  const all = goods + vat + cost;
  const diff = Math.round((tot.total - all) * 100) / 100;
  return { tot, goods, vat, cost, all, diff, ok: Math.abs(diff) < 0.005 };
}
