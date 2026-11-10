export type Role = "admin" | "editor" | "viewer" | "pending";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
  created_at?: string;
}

export interface Customer {
  id: string;
  code: string | null;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  tax_number: string | null;
  notes: string | null;
  credit_limit: number;
  default_currency: string;
  preferred_incoterm: string | null;
  payment_terms_days: number;
  default_payment_method: string;
  default_prepayment_pct: number;
  default_pre_shipment_pct: number;
  default_deferred_pct: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProductPackage {
  id: string;
  name: string;
  width: number | "";
  depth: number | "";
  height: number | "";
  grossWeight: number | "";
  netWeight: number | "";
  quantityPerPackage: number;
  notes: string;
}

export interface Product {
  id: string;
  product_code: string | null;
  manufacturing_code: string | null;
  name_tr: string | null;
  name_en: string | null;
  unit: string;
  category: string | null;
  notes: string | null;
  default_price: number;
  default_currency: string;
  packages: ProductPackage[];
  is_active: boolean;
}

export interface BankAccount {
  id: string;
  name: string;
  bank_name: string | null;
  account_number: string | null;
  iban: string | null;
  swift: string | null;
  currency: string;
  notes: string | null;
  is_active: boolean;
}

export type OrderStatus = "draft" | "confirmed" | "production" | "ready" | "shipped" | "delivered" | "completed" | "cancelled";
export type PlanType = "prepayment" | "preShipment" | "deferred" | "vat" | "cost" | "other";

export interface PlanTemplate {
  prepPct: number;
  preShipPct: number;
  defPct: number;
  termDays: number;
  method: string;
  auto: boolean; // sipariş değişince plan otomatik yeniden hesaplansın mı
}

export interface OrderHeader {
  id: string | null;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  currency: string;
  order_date: string;
  incoterm: string;
  shipping_method: string;
  port_of_loading: string;
  port_of_discharge: string;
  bill_of_lading: string;
  invoice_number: string;
  notes: string;
  vat_rate: number;
  discount_type: "none" | "percentage" | "amount";
  discount_value: number;
  payment_basis: "order" | "shipment";
  plan_template: PlanTemplate | null;
  updated_at?: string | null;
}

export interface ShipmentDraft {
  id: string;
  shipment_no: number;
  name: string;
  planned_date: string;
  actual_date: string;
  notes: string;
  locked_rate_to_usd?: number | null;
}

export interface ItemDraft {
  id: string;
  shipment_no: number;
  product_id: string | null;
  product_code: string;
  manufacturing_code: string;
  name_tr: string;
  name_en: string;
  unit: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
}

export interface CostDraft {
  id: string;
  shipment_no: number | null;
  description: string;
  amount: number;
  vat_rate: number;
}

export interface PlanDraft {
  id: string;
  type: PlanType;
  shipment_no: number | null;
  cost_id: string | null;
  percentage: number | null;
  amount: number;
  due_date: string;
  method: string;
  notes: string;
}

export interface OrderDraft {
  order: OrderHeader;
  shipments: ShipmentDraft[];
  items: ItemDraft[];
  costs: CostDraft[];
  plan: PlanDraft[];
}

export interface OrderSummary {
  order_id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_code: string | null;
  customer_country: string | null;
  status: OrderStatus;
  currency: string;
  order_date: string;
  payment_basis: string;
  vat_rate: number;
  subtotal: number;
  discount: number;
  net_goods: number;
  vat_amount: number;
  costs: number;
  costs_vat: number;
  total: number;
  total_usd: number;
  plan_total: number;
  plan_diff: number;
  collected: number;
  collected_usd: number;
  last_collection_date: string | null;
  open_amount: number;
  overdue_amount: number;
  open_usd: number;
  overdue_usd: number;
  next_due_date: string | null;
  unallocated: number;
  balance: number;
  first_shipment_date: string | null;
  last_shipment_date: string | null;
  shipment_count: number;
  shipped_count: number;
}

export interface PlanStatusRow {
  plan_item_id: string;
  order_id: string;
  order_number: string;
  customer_id: string;
  currency: string;
  order_status: OrderStatus;
  type: PlanType;
  shipment_no: number | null;
  cost_id: string | null;
  percentage: number | null;
  amount: number;
  due_date: string | null;
  method: string;
  notes: string | null;
  sort_order: number;
  paid: number;
  remaining: number;
  status: "open" | "partial" | "paid" | "overdue" | "cancelled";
  days_overdue: number;
  remaining_usd: number;
}

export interface CustomerBalance {
  customer_id: string;
  currency: string;
  order_count: number;
  total: number;
  total_usd: number;
  collected: number;
  balance: number;
  open_amount: number;
  overdue_amount: number;
  open_usd: number;
  overdue_usd: number;
  last_collection_date: string | null;
}

export interface Collection {
  id: string;
  order_id: string;
  plan_item_id: string | null;
  received_date: string;
  amount: number;
  received_currency: string | null;
  received_amount: number | null;
  rate_to_usd: number | null;
  bank_account_id: string | null;
  method: string;
  reference: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CollectionRow extends Collection {
  order_number: string;
  order_currency: string;
  customer_id: string;
  customer_name: string;
  customer_code: string | null;
  bank_account_name: string | null;
  amount_usd: number;
  plan_item_type: PlanType | null;
}

export interface ShipmentTotal {
  order_id: string;
  shipment_no: number;
  shipment_id: string;
  name: string | null;
  planned_date: string | null;
  actual_date: string | null;
  effective_date: string | null;
  locked_rate_to_usd: number | null;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  currency: string;
  share: number;
  total: number;
  rate_to_usd: number;
  total_usd: number;
}
