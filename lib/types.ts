export type UserRole = 'admin' | 'manager' | 'employee';
export type ProductStatus = 'active' | 'passive' | 'discontinued';
export type MovementType = 'purchase' | 'production' | 'sale' | 'return' | 'adjustment' | 'manual' | 'transfer' | 'cancellation';
export type OrderStatus = 'draft' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded';
export type ShipmentStatus = 'pending' | 'preparing' | 'shipped' | 'delivered' | 'returned';
export type ProductionStatus = 'queued' | 'in_production' | 'completed' | 'transferred' | 'cancelled';

export interface Product {
  id: string;
  product_code: string;
  barcode: string | null;
  name: string;
  series_id: string | null;
  category_id: string | null;
  brand: string | null;
  description: string | null;
  status: ProductStatus;
  sales_price: number;
  cost_price: number;
  tax_rate: number;
  weight_kg: number;
  volume_m3: number;
  desi: number;
  shipping_class: string | null;
  critical_stock: number;
  forecast_stock: number;
  current_stock: number;
  production_stock: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface SeriesItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface Platform {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  commission_rate: number;
}

export interface Customer {
  id: string;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  tax_number: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  notes: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  order_date: string;
  platform_id: string | null;
  customer_id: string | null;
  order_discount_percent: number;
  order_discount_amount: number;
  shipping_cost: number;
  tax_amount: number;
  subtotal: number;
  total: number;
  net_total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  shipment_status: ShipmentStatus;
  invoice_number: string | null;
  tracking_number: string | null;
  notes: string | null;
}

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
}

// Minimal Database generic placeholder so @supabase/ssr typing compiles.
// Replace with `npx supabase gen types typescript` output when you connect
// the Supabase CLI locally for full end-to-end type safety.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any;
