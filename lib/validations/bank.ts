import { z } from 'zod';
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY'] as const;
export const bankSchema = z.object({
  name: z.string().min(1, 'Hesap adı zorunlu'),
  bank_name: z.string().optional().nullable(),
  account_number: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  swift: z.string().optional().nullable(),
  currency: z.enum(CURRENCIES).default('USD'),
  notes: z.string().optional().nullable(),
});
export type BankInput = z.infer<typeof bankSchema>;
