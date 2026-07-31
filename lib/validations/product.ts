import { z } from 'zod';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY'] as const;
export const UNITS = ['adet', 'set', 'takım', 'koli', 'palet', 'm²', 'm³', 'kg'] as const;

export const productSchema = z.object({
  product_code: z.string().optional().nullable(),
  manufacturing_code: z.string().optional().nullable(),
  name_tr: z.string().min(1, 'Türkçe ad zorunlu'),
  name_en: z.string().optional().nullable(),
  unit: z.string().default('adet'),
  category: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  default_price: z.coerce.number().min(0, 'Fiyat negatif olamaz').default(0),
  default_currency: z.enum(CURRENCIES).default('USD'),
});

export type ProductInput = z.infer<typeof productSchema>;
