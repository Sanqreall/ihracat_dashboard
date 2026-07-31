import { z } from 'zod';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY'] as const;
export const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'] as const;
export const PAYMENT_METHODS = ['bank_transfer', 'letter_of_credit', 'cash', 'cheque', 'other'] as const;

export const customerSchema = z.object({
  code: z.string().optional().nullable(),
  name: z.string().min(1, 'Müşteri adı zorunlu'),
  contact_person: z.string().optional().nullable(),
  email: z.string().email('Geçersiz e-posta').optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  tax_number: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  credit_limit: z.coerce.number().min(0, 'Negatif olamaz').default(0),
  default_currency: z.enum(CURRENCIES).default('USD'),
  preferred_incoterm: z.string().optional().nullable(),
  default_payment_terms: z.coerce.number().int().min(0).default(0),
  default_payment_method: z.enum(PAYMENT_METHODS).default('bank_transfer'),
  default_prepayment_pct: z.coerce.number().min(0).max(100).default(0),
  default_pre_shipment_pct: z.coerce.number().min(0).max(100).default(0),
  default_deferred_pct: z.coerce.number().min(0).max(100).default(100),
});

export type CustomerInput = z.infer<typeof customerSchema>;
