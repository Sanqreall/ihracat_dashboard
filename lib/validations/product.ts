import { z } from 'zod';

export const productSchema = z.object({
  product_code: z.string().min(1, 'Ürün kodu zorunlu'),
  barcode: z.string().optional().nullable(),
  name: z.string().min(1, 'Ürün adı zorunlu'),
  category_id: z.string().uuid().optional().nullable(),
  series_id: z.string().uuid().optional().nullable(),
  brand: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(['active', 'passive', 'discontinued']).default('active'),
  sales_price: z.coerce.number().min(0, 'Fiyat negatif olamaz'),
  cost_price: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0).max(100),
  weight_kg: z.coerce.number().min(0).optional(),
  desi: z.coerce.number().min(0).optional(),
  critical_stock: z.coerce.number().int().min(0).default(0),
  current_stock: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
});

export type ProductInput = z.infer<typeof productSchema>;
