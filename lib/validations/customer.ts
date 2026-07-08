import { z } from 'zod';

export const customerSchema = z.object({
  name: z.string().min(1, 'Müşteri adı zorunlu'),
  company: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email('Geçersiz e-posta').optional().or(z.literal('')).nullable(),
  tax_number: z.string().optional().nullable(),
  billing_address: z.string().optional().nullable(),
  shipping_address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CustomerInput = z.infer<typeof customerSchema>;
