import { z } from 'zod';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY'] as const;
export const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;
export const ORDER_STATUSES = [
  'draft', 'confirmed', 'production', 'ready', 'shipped', 'delivered', 'completed', 'cancelled',
] as const;
export const PAYMENT_PLAN_TYPES = ['prepayment', 'preShipment', 'deferred', 'vat', 'other'] as const;
export const PAYMENT_METHODS = ['bank_transfer', 'letter_of_credit', 'cash', 'cheque', 'other'] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak', confirmed: 'Onaylandı', production: 'Üretimde', ready: 'Sevke Hazır',
  shipped: 'Sevk Edildi', delivered: 'Teslim Edildi', completed: 'Tamamlandı', cancelled: 'İptal',
};
export const PAYMENT_PLAN_TYPE_LABELS: Record<string, string> = {
  prepayment: 'Peşinat', preShipment: 'Sevk Öncesi', deferred: 'Vadeli', vat: 'KDV', other: 'Diğer',
};

const orderItemSchema = z.object({
  product_id: z.string().uuid().optional().nullable(),
  product_code: z.string().optional().nullable(),
  manufacturing_code: z.string().optional().nullable(),
  name_tr: z.string().optional().nullable(),
  name_en: z.string().optional().nullable(),
  unit: z.string().default('adet'),
  quantity: z.coerce.number().min(0).default(0),
  unit_price: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).max(100).default(0),
  shipment_no: z.coerce.number().int().optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
});

const additionalCostSchema = z.object({
  description: z.string().min(1, 'Açıklama zorunlu'),
  amount: z.coerce.number().default(0),
});

const paymentPlanItemSchema = z.object({
  type: z.enum(PAYMENT_PLAN_TYPES),
  amount: z.coerce.number().default(0),
  percentage: z.coerce.number().optional().nullable(),
  due_date: z.string().optional().nullable(),
  method: z.string().default('bank_transfer'),
  notes: z.string().optional().nullable(),
  shipment_no: z.coerce.number().int().optional().nullable(),
  sort_order: z.coerce.number().int().default(0),
});

export const orderSchema = z.object({
  order_number: z.string().optional().nullable(),
  customer_id: z.string().uuid({ message: 'Müşteri seçin' }),
  status: z.enum(ORDER_STATUSES).default('draft'),
  currency: z.enum(CURRENCIES).default('USD'),
  vat_rate: z.coerce.number().min(0).max(100).default(0),
  incoterms: z.string().optional().nullable(),
  order_date: z.string().optional().nullable(),
  shipment_date: z.string().optional().nullable(),
  actual_shipment_date: z.string().optional().nullable(),
  shipping_method: z.string().optional().nullable(),
  port_of_loading: z.string().optional().nullable(),
  port_of_discharge: z.string().optional().nullable(),
  bill_of_lading: z.string().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  discount_type: z.enum(['percent', 'amount']).optional().nullable(),
  discount_value: z.coerce.number().min(0).default(0),
  payment_basis: z.string().default('order'),
  items: z.array(orderItemSchema).default([]),
  additional_costs: z.array(additionalCostSchema).default([]),
  payment_plan: z.array(paymentPlanItemSchema).default([]),
});

export type OrderInput = z.infer<typeof orderSchema>;
export type OrderItemInput = z.infer<typeof orderItemSchema>;

/** Sipariş toplamlarını hesaplar (uygulamanın tek doğruluk kaynağı; DB'de saklanmaz). */
export function calculateOrderTotals(input: {
  items: { quantity: number; unit_price: number; discount: number }[];
  discount_type?: string | null;
  discount_value?: number;
  vat_rate?: number;
  additional_costs?: { amount: number }[];
}) {
  const lines = (input.items ?? []).map((it) => {
    const gross = (Number(it.quantity) || 0) * (Number(it.unit_price) || 0);
    const lineTotal = gross * (1 - (Number(it.discount) || 0) / 100);
    return { gross, lineTotal: Math.round(lineTotal * 100) / 100 };
  });
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100;

  let orderDiscount = 0;
  if (input.discount_type === 'percent') orderDiscount = subtotal * (Number(input.discount_value) || 0) / 100;
  else if (input.discount_type === 'amount') orderDiscount = Number(input.discount_value) || 0;
  orderDiscount = Math.round(orderDiscount * 100) / 100;

  const additional = Math.round((input.additional_costs ?? []).reduce((s, c) => s + (Number(c.amount) || 0), 0) * 100) / 100;
  const exVat = Math.round((subtotal - orderDiscount + additional) * 100) / 100;
  const vatAmount = Math.round(exVat * (Number(input.vat_rate) || 0) / 100 * 100) / 100;
  const total = Math.round((exVat + vatAmount) * 100) / 100;

  return { lines, subtotal, orderDiscount, additional, exVat, vatAmount, total };
}
