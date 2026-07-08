import { z } from 'zod';

export const returnItemSchema = z.object({
  product_id: z.string().uuid('Ürün seçiniz'),
  quantity: z.coerce.number().int().min(1, 'Adet en az 1'),
  unit_price: z.coerce.number().min(0).default(0),
});

export const returnSchema = z.object({
  return_number: z.string().min(1, 'İade numarası zorunlu'),
  return_date: z.string().min(1, 'Tarih zorunlu'),
  order_id: z.string().uuid().optional().nullable(),
  customer_id: z.string().uuid().optional().nullable(),
  platform_id: z.string().uuid().optional().nullable(),
  reason: z.string().optional().nullable(),
  refund_amount: z.coerce.number().min(0).default(0),
  items: z.array(returnItemSchema).min(1, 'En az bir ürün ekleyin'),
  notes: z.string().optional().nullable(),
});

export type ReturnItemInput = z.infer<typeof returnItemSchema>;
export type ReturnInput = z.infer<typeof returnSchema>;

export const RETURN_REASONS = [
  'Hasarlı ürün',
  'Yanlış ürün gönderildi',
  'Beğenilmedi',
  'Beden/ölçü uyumsuzluğu',
  'Renk farklılığı',
  'Kargo hasarı',
  'Geç teslimat',
  'Diğer',
] as const;
