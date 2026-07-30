// İhracat ERP — domain tipleri.
// Tam uçtan-uca tip güvenliği için Supabase CLI ile:
//   npx supabase gen types typescript --project-id <id> > lib/database.types.ts
// üretip Database'i oradan alabilirsin. Şimdilik generic placeholder.

export type UserRole = 'admin' | 'manager' | 'employee';

export type ExportOrderStatus =
  | 'draft' | 'confirmed' | 'production' | 'ready'
  | 'shipped' | 'delivered' | 'completed' | 'cancelled';

export type ExportPaymentStatus = 'paid' | 'pending' | 'cancelled';

export type PaymentPlanType = 'prepayment' | 'preShipment' | 'deferred' | 'vat' | 'other';

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  can_edit: boolean;
  is_active: boolean;
}

export interface ExchangeRate {
  currency: string;
  rate_to_usd: number;
  source: string | null;
  last_update: string | null;
  updated_at: string;
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
  deleted_at: string | null;
}

export interface Customer {
  id: string;
  code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  country: string | null;
  tax_number: string | null;
  notes: string | null;
  contact_person: string | null;
  credit_limit: number;
  default_currency: string;
  preferred_incoterm: string | null;
  default_payment_terms: number;
  default_payment_method: string;
  default_prepayment_pct: number;
  default_pre_shipment_pct: number;
  default_deferred_pct: number;
  deleted_at: string | null;
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
  deleted_at: string | null;
}

export interface Order {
  id: string;
  order_number: string | null;
  customer_id: string | null;
  status: ExportOrderStatus;
  currency: string;
  vat_rate: number;
  incoterms: string | null;
  order_date: string | null;
  shipment_date: string | null;
  actual_shipment_date: string | null;
  shipping_method: string | null;
  port_of_loading: string | null;
  port_of_discharge: string | null;
  bill_of_lading: string | null;
  invoice_number: string | null;
  notes: string | null;
  discount_type: string | null;
  discount_value: number;
  payment_basis: string;
  payment_plan_template: Record<string, number> | null;
  locked_at: string | null;
  locked_rate_at_shipment: number | null;
  deleted_at: string | null;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_code: string | null;
  manufacturing_code: string | null;
  name_tr: string | null;
  name_en: string | null;
  unit: string;
  quantity: number;
  unit_price: number;
  discount: number;
  shipment_no: number | null;
  sort_order: number;
}

export interface Payment {
  id: string;
  order_id: string;
  plan_item_id: string | null;
  type: string | null;
  amount: number;
  currency: string;
  method: string;
  status: ExportPaymentStatus;
  due_date: string | null;
  paid_date: string | null;
  bank_account_id: string | null;
  reference_number: string | null;
  exchange_rate_at_payment: number | null;
  shipment_no: number | null;
  notes: string | null;
}

// Minimal Database generic — @supabase/ssr tiplemesi derlensin diye.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
