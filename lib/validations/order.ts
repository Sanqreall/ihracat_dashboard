import { z } from 'zod';

export const orderItemSchema = z.object({
  product_id: z.string().uuid('Ürün seçiniz'),
  quantity: z.coerce.number().int().min(1, 'Adet en az 1'),
  unit_price: z.coerce.number().min(0),
  line_discount_percent: z.coerce.number().min(0).max(100).default(0),
  tax_rate: z.coerce.number().min(0).max(100).default(10),
});

export const orderSchema = z.object({
  order_number: z.string().min(1, 'Sipariş numarası zorunlu'),
  order_date: z.string().min(1, 'Tarih zorunlu'),
  platform_id: z.string().uuid('Platform seçiniz'),
  customer_id: z.string().uuid().optional().nullable(),
  customer_name: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_address: z.string().optional().nullable(),
  items: z.array(orderItemSchema).min(1, 'En az bir ürün ekleyin'),
  order_discount_percent: z.coerce.number().min(0).max(100).default(0),
  shipping_cost: z.coerce.number().min(0).default(0),
  status: z.enum(['draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']).default('draft'),
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).default('unpaid'),
  shipment_status: z.enum(['pending', 'preparing', 'shipped', 'delivered', 'returned']).default('pending'),
  invoice_number: z.string().optional().nullable(),
  tracking_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type OrderItemInput = z.infer<typeof orderItemSchema>;
export type OrderInput = z.infer<typeof orderSchema>;

/**
 * Pure calculation shared by client (live totals) and server (persisted totals).
 *
 * PRICES ARE VAT-INCLUSIVE (KDV DAHİL). Tax is never added on top; it is
 * extracted from the discounted amount for reporting.
 *
 * Per line:  gross = qty * unit_price                     (KDV dahil)
 *            line_discount_amount = gross * line_discount_percent / 100
 *            line_net = gross - line_discount_amount      (KDV dahil)
 * Order:     subtotal = sum(line_net)                     (KDV dahil)
 *            order_discount_amount = subtotal * order_discount_percent / 100
 *            discounted = subtotal - order_discount_amount (KDV dahil)
 *            tax = per line: line_share_after_order_discount * rate/(100+rate)
 *                  (KDV'nin içinden ayrıştırılması)
 *            total = discounted + shipping                (müşterinin ödediği)
 *            net_total = discounted - tax                 (KDV hariç net satış)
 */
export function calculateOrderTotals(input: {
  items: { quantity: number; unit_price: number; line_discount_percent?: number; tax_rate?: number }[];
  order_discount_percent?: number;
  shipping_cost?: number;
}) {
  const round = (n: number) => Math.round(n * 100) / 100;

  const lines = input.items.map((it) => {
    const gross = (it.quantity || 0) * (it.unit_price || 0);
    const lineDiscount = gross * ((it.line_discount_percent || 0) / 100);
    const lineNet = gross - lineDiscount;
    return { ...it, gross, lineDiscount: round(lineDiscount), lineNet };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineNet, 0);
  const orderDiscountAmount = subtotal * ((input.order_discount_percent || 0) / 100);
  const discounted = subtotal - orderDiscountAmount;

  // Extract the VAT contained within each line's discounted share
  const tax = lines.reduce((s, l) => {
    const share = subtotal > 0 ? l.lineNet / subtotal : 0;
    const lineAfterOrderDiscount = l.lineNet - orderDiscountAmount * share;
    const rate = l.tax_rate || 0;
    return s + lineAfterOrderDiscount * (rate / (100 + rate));
  }, 0);

  const shipping = input.shipping_cost || 0;
  const total = discounted + shipping;

  return {
    lines: lines.map((l) => ({
      ...l,
      line_discount_amount: l.lineDiscount,
      line_total: round(l.lineNet),
    })),
    subtotal: round(subtotal),
    order_discount_amount: round(orderDiscountAmount),
    tax_amount: round(tax),
    shipping_cost: round(shipping),
    total: round(total),
    net_total: round(discounted - tax),
  };
}
