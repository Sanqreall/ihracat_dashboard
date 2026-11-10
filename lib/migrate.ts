// ESKİ SİSTEM (v3) → YENİ SİSTEM (v4) DÖNÜŞÜMÜ
// Saf fonksiyonlar — tarayıcıya veya veritabanına bağımlı değil (test edilebilir).
//
// Kurallar:
//  • Eski "ödenen" (paid) ödemeler → tahsilat. Eski "bekleyen" kayıtlar aktarılmaz:
//    yeni sistemde bekleyen tutar plan − tahsilat olarak hesaplanır.
//  • Eski sistemdeki çift/yetim ön ödemeler bu yüzden kendiliğinden temizlenir.
//  • Her siparişe en az 1 sevkiyat açılır; eski sipariş seviyesindeki kilitli kur korunur.
//  • Kimlikler (id) aynen korunur → eski ve yeni kayıt birebir eşleştirilebilir.

export type Raw = Record<string, unknown>;

export interface OldData {
  customers: Raw[];
  products: Raw[];
  bank_accounts: Raw[];
  exchange_rates: Raw[];
  orders: Raw[];
  order_items: Raw[];
  order_shipments: Raw[];
  order_additional_costs: Raw[];
  payment_plan_items: Raw[];
  payments: Raw[];
  customer_notes: Raw[];
}

export interface NewData {
  exchange_rates: Raw[];
  bank_accounts: Raw[];
  customers: Raw[];
  products: Raw[];
  orders: Raw[];
  order_shipments: Raw[];
  order_items: Raw[];
  order_costs: Raw[];
  plan_items: Raw[];
  collections: Raw[];
  customer_notes: Raw[];
}

export const IMPORT_ORDER: (keyof NewData)[] = [
  "exchange_rates", "bank_accounts", "customers", "products", "orders",
  "order_shipments", "order_items", "order_costs", "plan_items", "collections", "customer_notes",
];

export interface Warning { kind: string; text: string }

export interface PendingInfo { count: number; byCurrency: Record<string, number> }

export interface TransformResult {
  data: NewData;
  warnings: Warning[];
  pending: PendingInfo;       // aktarılmayan "bekleyen" eski ödeme kayıtları (bilgi için)
  cancelledPayments: number;
}

const ORDER_STATUSES = ["draft", "confirmed", "production", "ready", "shipped", "delivered", "completed", "cancelled"];
const PLAN_TYPES = ["prepayment", "preShipment", "deferred", "vat", "cost", "other"];

const str = (v: unknown): string | null => (v === null || v === undefined || String(v).trim() === "" ? null : String(v));
const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return isFinite(n) ? n : d;
};
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const date = (v: unknown): string | null => {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};
const ts = (v: unknown): string => str(v) || new Date().toISOString();
const cur3 = (v: unknown): string | null => {
  const s = (str(v) || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : null;
};

let _seq = 0;
const genId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(++_seq).toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function transform(old: OldData, today: string): TransformResult {
  const warnings: Warning[] = [];
  const warn = (kind: string, text: string) => warnings.push({ kind, text });
  const now = new Date().toISOString();

  // ------------------------------------------------------------ KURLAR
  const exchange_rates: Raw[] = [];
  for (const r of old.exchange_rates) {
    const c = cur3(r.currency);
    const rate = num(r.rate_to_usd);
    if (!c || c === "USD" || !(rate > 0)) continue;
    exchange_rates.push({ rate_date: date(r.last_update) || today, currency: c, rate_to_usd: rate, source: str(r.source) || "Eski sistem", created_at: now });
  }

  // ------------------------------------------------------------ BANKALAR
  const bankIds = new Set<string>();
  const bank_accounts = old.bank_accounts.map((b) => {
    bankIds.add(String(b.id));
    return {
      id: String(b.id), name: str(b.name) || "Hesap", bank_name: str(b.bank_name), account_number: str(b.account_number),
      iban: str(b.iban), swift: str(b.swift), currency: cur3(b.currency) || "USD", notes: str(b.notes),
      is_active: true, created_at: ts(b.created_at), updated_at: now,
    };
  });

  // ------------------------------------------------------------ MÜŞTERİLER
  const custById = new Map<string, Raw>();
  const customers: Raw[] = old.customers.map((c) => {
    let pre = num(c.default_prepayment_pct), ps = num(c.default_pre_shipment_pct), def = num(c.default_deferred_pct, 100);
    if (Math.abs(pre + ps + def - 100) > 0.001) {
      const fixed = Math.max(0, 100 - pre - ps);
      warn("Müşteri", `${str(c.name)}: varsayılan ödeme yüzdeleri toplamı %${pre + ps + def} idi → vadeli %${fixed} yapıldı`);
      def = fixed;
      if (pre + ps > 100) { pre = Math.min(pre, 100); ps = Math.max(0, 100 - pre); }
    }
    const terms = Math.round(num(c.default_payment_terms));
    const row = {
      id: String(c.id), code: str(c.code), name: str(c.name) || "İsimsiz müşteri",
      contact_person: str(c.contact_person), email: str(c.email), phone: str(c.phone), address: str(c.address),
      country: str(c.country), tax_number: str(c.tax_number), notes: str(c.notes),
      credit_limit: Math.max(0, num(c.credit_limit)), default_currency: cur3(c.default_currency) || "USD",
      preferred_incoterm: str(c.preferred_incoterm),
      // Eski sistem 0 günü "30 gün" olarak kullanıyordu
      payment_terms_days: terms > 0 ? terms : 30,
      default_payment_method: str(c.default_payment_method) || "bank_transfer",
      default_prepayment_pct: pre, default_pre_shipment_pct: ps, default_deferred_pct: def,
      is_active: true, created_at: ts(c.created_at), updated_at: now,
    };
    custById.set(row.id, row);
    return row;
  });

  // ------------------------------------------------------------ ÜRÜNLER
  const productIds = new Set<string>();
  const products = old.products.map((p) => {
    productIds.add(String(p.id));
    return {
      id: String(p.id), product_code: str(p.product_code), manufacturing_code: str(p.manufacturing_code),
      name_tr: str(p.name_tr), name_en: str(p.name_en), unit: str(p.unit) || "adet", category: str(p.category),
      notes: str(p.notes), default_price: Math.max(0, num(p.default_price)), default_currency: cur3(p.default_currency) || "USD",
      packages: Array.isArray(p.packages) ? p.packages : [], is_active: true, created_at: ts(p.created_at), updated_at: now,
    };
  });

  // ------------------------------------------------------------ SİPARİŞLER
  const group = <T extends Raw>(rows: T[]) => {
    const m = new Map<string, T[]>();
    rows.forEach((r) => { const k = String(r.order_id); m.set(k, [...(m.get(k) || []), r]); });
    return m;
  };
  const itemsBy = group(old.order_items);
  const shipsBy = group(old.order_shipments);
  const costsBy = group(old.order_additional_costs);
  const planBy = group(old.payment_plan_items);

  const orders: Raw[] = [];
  const order_shipments: Raw[] = [];
  const order_items: Raw[] = [];
  const order_costs: Raw[] = [];
  const plan_items: Raw[] = [];
  const orderIds = new Set<string>();
  const orderCurrency = new Map<string, string>();
  const planIds = new Set<string>();
  const usedNumbers = new Set<string>();
  let placeholder: Raw | null = null;

  const sorted = [...old.orders].sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  for (const o of sorted) {
    const id = String(o.id);
    let customerId = str(o.customer_id);
    if (!customerId || !custById.has(customerId)) {
      if (!placeholder) {
        placeholder = {
          id: "eski-bilinmeyen-musteri", code: null, name: "Bilinmeyen müşteri (eski sistem)", contact_person: null, email: null,
          phone: null, address: null, country: null, tax_number: null, notes: "Eski sistemde müşterisi olmayan siparişler için açıldı",
          credit_limit: 0, default_currency: "USD", preferred_incoterm: null, payment_terms_days: 30, default_payment_method: "bank_transfer",
          default_prepayment_pct: 0, default_pre_shipment_pct: 0, default_deferred_pct: 100, is_active: true, created_at: now, updated_at: now,
        };
        customers.push(placeholder);
        custById.set(String(placeholder.id), placeholder);
      }
      warn("Sipariş", `${str(o.order_number) || id}: müşterisi bulunamadı → "Bilinmeyen müşteri"ye bağlandı`);
      customerId = String(placeholder.id);
    }
    const cust = custById.get(customerId)!;

    let number = str(o.order_number)?.trim() || `ESKI-${id.slice(0, 8)}`;
    if (usedNumbers.has(number)) {
      let k = 2;
      while (usedNumbers.has(`${number}-${k}`)) k++;
      warn("Sipariş", `${number} numarası birden fazla siparişte vardı → bu sipariş ${number}-${k} oldu`);
      number = `${number}-${k}`;
    }
    usedNumbers.add(number);

    let status = String(o.status || "draft");
    if (!ORDER_STATUSES.includes(status)) { warn("Sipariş", `${number}: bilinmeyen durum "${status}" → Onaylı`); status = "confirmed"; }
    let currency = cur3(o.currency);
    if (!currency) { warn("Sipariş", `${number}: geçersiz para birimi "${String(o.currency)}" → USD`); currency = "USD"; }
    const dt = String(o.discount_type || "");
    const tpl = o.payment_plan_template as Raw | null;

    orders.push({
      id, order_number: number, customer_id: customerId, status, currency,
      order_date: date(o.order_date) || date(o.created_at) || today,
      incoterm: str(o.incoterms), shipping_method: str(o.shipping_method), port_of_loading: str(o.port_of_loading),
      port_of_discharge: str(o.port_of_discharge), bill_of_lading: str(o.bill_of_lading), invoice_number: str(o.invoice_number),
      notes: str(o.notes), vat_rate: Math.max(0, num(o.vat_rate)),
      discount_type: dt === "percentage" || dt === "amount" ? dt : "none",
      discount_value: dt === "percentage" || dt === "amount" ? Math.max(0, num(o.discount_value)) : 0,
      payment_basis: o.payment_basis === "shipment" ? "shipment" : "order",
      plan_template: tpl && typeof tpl === "object" ? {
        prepPct: num(tpl.prepPct), preShipPct: num(tpl.preShipPct), defPct: num(tpl.defPct),
        termDays: num(cust.payment_terms_days, 30), method: String(cust.default_payment_method || "bank_transfer"), auto: false,
      } : null,
      created_by: null, created_at: ts(o.created_at), updated_at: now,
    });
    orderIds.add(id);
    orderCurrency.set(id, currency);

    // Sevkiyatlar
    const lock = num(o.locked_rate_at_shipment) > 0 ? num(o.locked_rate_at_shipment) : null;
    const shipNos = new Set<number>();
    const oldShips = (shipsBy.get(id) || []).filter((s) => num(s.shipment_no) >= 1);
    if (oldShips.length === 0) {
      order_shipments.push({
        id: genId("sh"), order_id: id, shipment_no: 1, name: null, planned_date: date(o.shipment_date),
        actual_date: date(o.actual_shipment_date), locked_rate_to_usd: lock, locked_at: lock ? (date(o.locked_at) || date(o.actual_shipment_date)) : null, notes: null,
      });
      shipNos.add(1);
    } else {
      for (const s of oldShips) {
        const no = Math.round(num(s.shipment_no));
        if (shipNos.has(no)) continue;
        shipNos.add(no);
        order_shipments.push({
          id: String(s.id), order_id: id, shipment_no: no, name: str(s.name),
          planned_date: date(s.shipment_date), actual_date: date(s.actual_shipment_date),
          locked_rate_to_usd: lock, locked_at: lock ? (date(o.locked_at) || date(s.actual_shipment_date)) : null, notes: str(s.notes),
        });
      }
    }
    const ensureShip = (no: number) => {
      if (shipNos.has(no)) return;
      shipNos.add(no);
      order_shipments.push({ id: genId("sh"), order_id: id, shipment_no: no, name: null, planned_date: date(o.shipment_date), actual_date: null, locked_rate_to_usd: lock, locked_at: null, notes: null });
      warn("Sevkiyat", `${number}: kalemlerin bağlı olduğu ${no}. sevkiyat kaydı yoktu → oluşturuldu`);
    };

    // Kalemler
    const its = [...(itemsBy.get(id) || [])].sort((a, b) => num(a.sort_order) - num(b.sort_order));
    its.forEach((it, i) => {
      const sn = it.shipment_no == null ? Math.min(...shipNos) : Math.max(1, Math.round(num(it.shipment_no)));
      ensureShip(sn);
      const pid = str(it.product_id);
      order_items.push({
        id: String(it.id), order_id: id, shipment_no: sn, product_id: pid && productIds.has(pid) ? pid : null,
        product_code: str(it.product_code), manufacturing_code: str(it.manufacturing_code), name_tr: str(it.name_tr),
        name_en: str(it.name_en), unit: str(it.unit) || "adet", quantity: Math.max(0, num(it.quantity)),
        unit_price: Math.max(0, num(it.unit_price)), discount_pct: Math.min(100, Math.max(0, num(it.discount))), sort_order: i,
      });
    });

    // Ek maliyetler (eski sistemde maliyet KDV'si kaydedilmiyordu → %0)
    const costIds = new Set<string>();
    (costsBy.get(id) || []).forEach((c, i) => {
      costIds.add(String(c.id));
      order_costs.push({ id: String(c.id), order_id: id, shipment_no: null, description: str(c.description) || "", amount: Math.max(0, num(c.amount)), vat_rate: 0, sort_order: i });
    });

    // Ödeme planı
    const pl = [...(planBy.get(id) || [])].sort((a, b) => num(a.sort_order) - num(b.sort_order));
    pl.forEach((p, i) => {
      let type = String(p.type || "other");
      if (type === "additionalCost") type = "cost";
      if (!PLAN_TYPES.includes(type)) type = "other";
      const sn = p.shipment_no == null ? null : Math.round(num(p.shipment_no));
      const acid = str(p.additional_cost_id);
      plan_items.push({
        id: String(p.id), order_id: id, type, shipment_no: sn != null && shipNos.has(sn) ? sn : null,
        cost_id: acid && costIds.has(acid) ? acid : null,
        percentage: p.percentage == null ? null : num(p.percentage), amount: r2(Math.max(0, num(p.amount))),
        due_date: date(p.due_date), method: str(p.method) || "bank_transfer", notes: str(p.notes), sort_order: i,
      });
      planIds.add(String(p.id));
    });
  }

  // ------------------------------------------------------------ TAHSİLATLAR
  const collections: Raw[] = [];
  const pending: PendingInfo = { count: 0, byCurrency: {} };
  let cancelledPayments = 0;
  for (const p of old.payments) {
    const status = String(p.status || "pending");
    const oid = String(p.order_id);
    const amount = r2(num(p.amount));
    if (status === "cancelled") { cancelledPayments++; continue; }
    if (status !== "paid") {
      pending.count++;
      const c = cur3(p.currency) || "USD";
      pending.byCurrency[c] = r2((pending.byCurrency[c] || 0) + amount);
      continue;
    }
    if (!orderIds.has(oid)) { warn("Tahsilat", `Siparişi bulunamayan ödenmiş kayıt atlandı: ${amount} ${String(p.currency)} (${date(p.paid_date) || "?"})`); continue; }
    if (!(amount > 0)) { warn("Tahsilat", `Tutarı 0 veya eksi ödenmiş kayıt atlandı (sipariş ${oid})`); continue; }
    const orderCur = orderCurrency.get(oid)!;
    const payCur = cur3(p.currency) || orderCur;
    if (payCur !== orderCur) {
      const on = orders.find((o) => o.id === oid)?.order_number;
      warn("Döviz", `${on}: ${amount} ${payCur} tahsilat ${orderCur} sipariş içinde. Eski sistem bunu ${amount} ${orderCur} olarak sayıyordu; aynen aktarıldı — gerekirse tahsilatı düzelt.`);
    }
    const pid = str(p.plan_item_id);
    const rate = num(p.exchange_rate_at_payment);
    collections.push({
      id: String(p.id), order_id: oid, plan_item_id: pid && planIds.has(pid) ? pid : null,
      received_date: date(p.paid_date) || date(p.due_date) || date(p.created_at) || today,
      amount, received_currency: payCur, received_amount: amount,
      rate_to_usd: rate > 0 && payCur === orderCur ? rate : null,
      bank_account_id: str(p.bank_account_id) && bankIds.has(String(p.bank_account_id)) ? String(p.bank_account_id) : null,
      method: str(p.method) || "bank_transfer", reference: str(p.reference_number), notes: str(p.notes),
      created_by: null, created_at: ts(p.created_at), updated_at: now,
    });
  }

  // ------------------------------------------------------------ NOTLAR
  const customer_notes = old.customer_notes
    .filter((n) => custById.has(String(n.customer_id)) && str(n.text))
    .map((n) => ({
      id: String(n.id), customer_id: String(n.customer_id), text: String(n.text), done: !!n.done,
      created_by: null, created_at: ts(n.created_at), updated_at: ts(n.updated_at || n.created_at),
    }));

  return {
    data: { exchange_rates, bank_accounts, customers, products, orders, order_shipments, order_items, order_costs, plan_items, collections, customer_notes },
    warnings,
    pending,
    cancelledPayments,
  };
}

// ------------------------------------------------------------ ESKİ SİSTEM HESABI (mutabakat için)
export interface OldOrderFigures { order_id: string; order_number: string; customer_id: string; currency: string; status: string; total: number; paid: number; open: number }

export function oldOrderFigures(old: OldData): OldOrderFigures[] {
  const itemsBy = new Map<string, Raw[]>();
  old.order_items.forEach((r) => itemsBy.set(String(r.order_id), [...(itemsBy.get(String(r.order_id)) || []), r]));
  const costBy = new Map<string, number>();
  old.order_additional_costs.forEach((r) => costBy.set(String(r.order_id), (costBy.get(String(r.order_id)) || 0) + num(r.amount)));
  const paidBy = new Map<string, number>();
  const openBy = new Map<string, number>();
  old.payments.forEach((p) => {
    const k = String(p.order_id);
    if (p.status === "paid") paidBy.set(k, (paidBy.get(k) || 0) + num(p.amount));
    else if (p.status !== "cancelled") openBy.set(k, (openBy.get(k) || 0) + num(p.amount));
  });
  return old.orders.map((o) => {
    const id = String(o.id);
    const sub = (itemsBy.get(id) || []).reduce((s, i) => s + num(i.quantity) * num(i.unit_price) * (1 - num(i.discount) / 100), 0);
    let disc = 0;
    if (o.discount_type === "percentage") disc = (sub * num(o.discount_value)) / 100;
    else if (o.discount_type === "amount") disc = num(o.discount_value);
    const after = Math.max(0, sub - disc);
    const total = after * (1 + num(o.vat_rate) / 100) + (costBy.get(id) || 0);
    return {
      order_id: id, order_number: String(o.order_number || ""), customer_id: String(o.customer_id || ""),
      currency: cur3(o.currency) || "USD", status: String(o.status || ""),
      total: r2(total), paid: r2(paidBy.get(id) || 0), open: r2(openBy.get(id) || 0),
    };
  });
}

// ------------------------------------------------------------ YEDEK DOSYASI (JSON) → ham satırlar
// Eski uygulamanın "Tam Yedek Al" dosyasını, veritabanından okunmuş gibi ham satırlara çevirir.
export function backupToOld(b: Record<string, unknown>): OldData {
  const arr = (k: string) => (Array.isArray(b[k]) ? (b[k] as Raw[]) : []);
  const out: OldData = {
    customers: arr("customers").map((c) => ({
      id: c.id, code: c.code, name: c.name, email: c.email, phone: c.phone, address: c.address, country: c.country,
      tax_number: c.taxNumber, notes: c.notes, contact_person: c.contactPerson, credit_limit: c.creditLimit,
      default_currency: c.defaultCurrency, preferred_incoterm: c.preferredIncoterm, default_payment_terms: c.defaultPaymentTerms,
      default_payment_method: c.defaultPaymentMethod, default_prepayment_pct: c.defaultPrepaymentPct,
      default_pre_shipment_pct: c.defaultPreShipmentPct, default_deferred_pct: c.defaultDeferredPct, created_at: c.createdAt,
    })),
    products: arr("products").map((p) => ({
      id: p.id, product_code: p.productCode, manufacturing_code: p.manufacturingCode, name_tr: p.nameTr, name_en: p.nameEn,
      unit: p.unit, category: p.category, notes: p.notes, default_price: p.defaultPrice, default_currency: p.defaultCurrency,
      packages: p.packages, created_at: p.createdAt,
    })),
    bank_accounts: arr("bankAccounts").map((x) => ({
      id: x.id, name: x.name, bank_name: x.bankName, account_number: x.accountNumber, iban: x.iban, swift: x.swift,
      currency: x.currency, notes: x.notes, created_at: x.createdAt,
    })),
    exchange_rates: Object.entries((b.rates as Record<string, unknown>) || {})
      .filter(([k, v]) => !k.startsWith("_") && typeof v === "number")
      .map(([currency, rate]) => ({ currency, rate_to_usd: rate, source: "Yedek", last_update: (b.rates as Raw)?._lastUpdate })),
    orders: [], order_items: [], order_shipments: [], order_additional_costs: [], payment_plan_items: [],
    payments: arr("payments").map((p) => ({
      id: p.id, order_id: p.orderId, plan_item_id: p.planItemId, type: p.type, amount: p.amount, currency: p.currency,
      method: p.method, status: p.status === "overdue" ? "pending" : p.status, due_date: p.dueDate, paid_date: p.paidDate,
      bank_account_id: p.bankAccountId, reference_number: p.referenceNumber, exchange_rate_at_payment: p.exchangeRateAtPayment,
      shipment_no: p.shipmentNo, notes: p.notes, created_at: p.createdAt,
    })),
    customer_notes: arr("customerNotes").map((n) => ({ id: n.id, customer_id: n.customerId, text: n.text, done: n.done, created_at: n.createdAt, updated_at: n.updatedAt })),
  };
  for (const o of arr("orders")) {
    out.orders.push({
      id: o.id, order_number: o.orderNumber, customer_id: o.customerId, status: o.status, currency: o.currency, vat_rate: o.vatRate,
      incoterms: o.incoterms, order_date: o.orderDate, shipment_date: o.shipmentDate, actual_shipment_date: o.actualShipmentDate,
      shipping_method: o.shippingMethod, port_of_loading: o.portOfLoading, port_of_discharge: o.portOfDischarge,
      bill_of_lading: o.billOfLading, invoice_number: o.invoiceNumber, notes: o.notes, discount_type: o.discountType,
      discount_value: o.discountValue, payment_basis: o.paymentBasis, payment_plan_template: o.paymentPlanTemplate,
      locked_at: o.lockedAt, locked_rate_at_shipment: o.lockedRateAtShipment, created_at: o.createdAt,
    });
    ((o.items as Raw[]) || []).forEach((it, i) => out.order_items.push({
      id: it.id, order_id: o.id, product_id: it.productId, product_code: it.productCode, manufacturing_code: it.manufacturingCode,
      name_tr: it.nameTr, name_en: it.nameEn, unit: it.unit, quantity: it.quantity, unit_price: it.unitPrice, discount: it.discount,
      shipment_no: it.shipmentNo, sort_order: i,
    }));
    ((o.shipments as Raw[]) || []).forEach((s) => out.order_shipments.push({
      id: s.id || genId("sh"), order_id: o.id, shipment_no: s.no, name: s.name, notes: s.notes, shipment_date: s.shipmentDate, actual_shipment_date: s.actualShipmentDate,
    }));
    ((o.additionalCosts as Raw[]) || []).forEach((c) => out.order_additional_costs.push({ id: c.id, order_id: o.id, description: c.description, amount: c.amount }));
    ((o.paymentPlan as Raw[]) || []).forEach((p, i) => out.payment_plan_items.push({
      id: p.id, order_id: o.id, type: p.type, amount: p.amount, percentage: p.percentage, due_date: p.dueDate, method: p.method,
      notes: p.notes, shipment_no: p.shipmentNo, prepayment_basis: p._prepaymentBasis, additional_cost_id: p._additionalCostId, sort_order: i,
    }));
  }
  return out;
}
