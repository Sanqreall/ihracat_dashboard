"use client";
// Veri erişim katmanı — tüm okuma/yazma buradan geçer.
import { supabase } from "./supabase/client";
import { fetchAll, q } from "./hooks";
import type {
  BankAccount, CollectionRow, Customer, CustomerBalance, OrderDraft, OrderSummary, PlanStatusRow, Product, ShipmentTotal,
} from "./types";
import { newId, todayTR } from "./format";

const sb = () => supabase();

export const db = {
  customers: () => fetchAll<Customer>((f, t) => sb().from("customers").select("*").order("name").order("id").range(f, t)),
  products: () => fetchAll<Product>((f, t) => sb().from("products").select("*").order("product_code", { nullsFirst: false }).order("id").range(f, t)),
  banks: () => fetchAll<BankAccount>((f, t) => sb().from("bank_accounts").select("*").order("name").order("id").range(f, t)),

  latestRates: async (): Promise<Record<string, number>> => {
    const rows = await q<{ currency: string; rate_to_usd: number }[]>(sb().from("v_latest_rates").select("currency, rate_to_usd"));
    const out: Record<string, number> = { USD: 1 };
    rows.forEach((r) => (out[r.currency.trim()] = Number(r.rate_to_usd)));
    return out;
  },

  orderSummaries: (opts: { customerId?: string } = {}) =>
    fetchAll<OrderSummary>((f, t) => {
      let qb = sb().from("v_order_summary").select("*");
      if (opts.customerId) qb = qb.eq("customer_id", opts.customerId);
      return qb.order("order_date", { ascending: false }).order("order_number", { ascending: false }).range(f, t);
    }),

  orderSummary: async (id: string) =>
    q<OrderSummary | null>(sb().from("v_order_summary").select("*").eq("order_id", id).maybeSingle()),

  planStatus: (orderId?: string, customerId?: string) =>
    fetchAll<PlanStatusRow>((f, t) => {
      let qb = sb().from("v_plan_status").select("*");
      if (orderId) qb = qb.eq("order_id", orderId);
      if (customerId) qb = qb.eq("customer_id", customerId);
      return qb.order("due_date", { ascending: true, nullsFirst: false }).order("sort_order").order("plan_item_id").range(f, t);
    }),

  openPlan: () =>
    fetchAll<PlanStatusRow>((f, t) =>
      sb().from("v_plan_status").select("*").in("status", ["open", "partial", "overdue"])
        .order("due_date", { ascending: true, nullsFirst: false }).order("plan_item_id").range(f, t)),

  shipmentTotals: (orderId?: string) =>
    fetchAll<ShipmentTotal>((f, t) => {
      let qb = sb().from("v_shipment_totals").select("*");
      if (orderId) qb = qb.eq("order_id", orderId);
      return qb.order("effective_date", { ascending: true, nullsFirst: false }).order("shipment_id").range(f, t);
    }),

  collections: (opts: { orderId?: string; customerId?: string; from?: string; to?: string } = {}) =>
    fetchAll<CollectionRow>((f, t) => {
      let qb = sb().from("v_collections").select("*");
      if (opts.orderId) qb = qb.eq("order_id", opts.orderId);
      if (opts.customerId) qb = qb.eq("customer_id", opts.customerId);
      if (opts.from) qb = qb.gte("received_date", opts.from);
      if (opts.to) qb = qb.lte("received_date", opts.to);
      return qb.order("received_date", { ascending: false }).order("created_at", { ascending: false }).order("id").range(f, t);
    }),

  customerBalances: (customerId?: string) =>
    fetchAll<CustomerBalance>((f, t) => {
      let qb = sb().from("v_customer_balances").select("*");
      if (customerId) qb = qb.eq("customer_id", customerId);
      return qb.order("customer_id").order("currency").range(f, t);
    }),

  // Siparişi düzenleme formu için yükle
  loadOrderDraft: async (id: string): Promise<OrderDraft> => {
    const [o, ships, items, costs, plan] = await Promise.all([
      q<Record<string, unknown>>(sb().from("orders").select("*").eq("id", id).single()),
      q<Record<string, unknown>[]>(sb().from("order_shipments").select("*").eq("order_id", id).order("shipment_no")),
      q<Record<string, unknown>[]>(sb().from("order_items").select("*").eq("order_id", id).order("sort_order")),
      q<Record<string, unknown>[]>(sb().from("order_costs").select("*").eq("order_id", id).order("sort_order")),
      q<Record<string, unknown>[]>(sb().from("plan_items").select("*").eq("order_id", id).order("sort_order")),
    ]);
    const s = (v: unknown) => (v == null ? "" : String(v));
    const n = (v: unknown) => (v == null || v === "" ? 0 : Number(v));
    const tpl = o.plan_template as OrderDraft["order"]["plan_template"];
    return {
      order: {
        id: s(o.id), order_number: s(o.order_number), customer_id: s(o.customer_id),
        status: o.status as OrderDraft["order"]["status"], currency: s(o.currency).trim() || "USD",
        order_date: s(o.order_date), incoterm: s(o.incoterm), shipping_method: s(o.shipping_method),
        port_of_loading: s(o.port_of_loading), port_of_discharge: s(o.port_of_discharge),
        bill_of_lading: s(o.bill_of_lading), invoice_number: s(o.invoice_number), notes: s(o.notes),
        vat_rate: n(o.vat_rate), discount_type: (o.discount_type as OrderDraft["order"]["discount_type"]) || "none",
        discount_value: n(o.discount_value), payment_basis: (o.payment_basis as "order" | "shipment") || "order",
        plan_template: tpl && typeof tpl === "object"
          ? { prepPct: n(tpl.prepPct), preShipPct: n(tpl.preShipPct), defPct: n(tpl.defPct), termDays: tpl.termDays == null ? 30 : n(tpl.termDays), method: tpl.method || "bank_transfer", auto: tpl.auto === true }
          : null,
        updated_at: s(o.updated_at) || null,
      },
      shipments: ships.map((x) => ({
        id: s(x.id), shipment_no: n(x.shipment_no), name: s(x.name), planned_date: s(x.planned_date),
        actual_date: s(x.actual_date), notes: s(x.notes), locked_rate_to_usd: x.locked_rate_to_usd == null ? null : Number(x.locked_rate_to_usd),
      })),
      items: items.map((x) => ({
        id: s(x.id), shipment_no: n(x.shipment_no) || 1, product_id: (x.product_id as string) || null,
        product_code: s(x.product_code), manufacturing_code: s(x.manufacturing_code), name_tr: s(x.name_tr),
        name_en: s(x.name_en), unit: s(x.unit) || "adet", quantity: n(x.quantity), unit_price: n(x.unit_price),
        discount_pct: n(x.discount_pct),
      })),
      costs: costs.map((x) => ({
        id: s(x.id), shipment_no: x.shipment_no == null ? null : n(x.shipment_no), description: s(x.description),
        amount: n(x.amount), vat_rate: n(x.vat_rate),
      })),
      plan: plan.map((x) => ({
        id: s(x.id), type: x.type as OrderDraft["plan"][number]["type"], shipment_no: x.shipment_no == null ? null : n(x.shipment_no),
        cost_id: (x.cost_id as string) || null, percentage: x.percentage == null ? null : n(x.percentage),
        amount: n(x.amount), due_date: s(x.due_date), method: s(x.method) || "bank_transfer", notes: s(x.notes),
      })),
    };
  },

  saveOrder: async (d: OrderDraft): Promise<string> => {
    const payload = {
      order: { ...d.order, id: d.order.id || null },
      shipments: d.shipments,
      items: d.items,
      costs: d.costs,
      plan: d.plan,
    };
    const { data, error } = await sb().rpc("save_order", { p: payload });
    if (error) throw error;
    return data as string;
  },

  deleteOrder: async (id: string) => {
    const { error } = await sb().rpc("delete_order", { p_id: id });
    if (error) throw error;
  },

  nextOrderNumber: async (): Promise<string> => {
    const { data, error } = await sb().rpc("next_order_number", {});
    if (error) throw error;
    return data as string;
  },
};

export function emptyDraft(): OrderDraft {
  return {
    order: {
      id: null, order_number: "", customer_id: "", status: "draft", currency: "USD", order_date: todayTR(),
      incoterm: "", shipping_method: "", port_of_loading: "", port_of_discharge: "", bill_of_lading: "",
      invoice_number: "", notes: "", vat_rate: 0, discount_type: "none", discount_value: 0,
      payment_basis: "order", plan_template: null, updated_at: null,
    },
    shipments: [{ id: newId(), shipment_no: 1, name: "", planned_date: "", actual_date: "", notes: "" }],
    items: [],
    costs: [],
    plan: [],
  };
}
