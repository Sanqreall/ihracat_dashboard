import { z } from 'zod';

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY'] as const;
export const PAYMENT_METHODS = ['bank_transfer', 'letter_of_credit', 'cash', 'cheque', 'other'] as const;
export const PAYMENT_STATUSES = ['paid', 'pending', 'cancelled'] as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Havale/EFT', letter_of_credit: 'Akreditif (L/C)', cash: 'Nakit', cheque: 'Çek', other: 'Diğer',
};
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: 'Tahsil Edildi', pending: 'Bekliyor', cancelled: 'İptal',
};

export const paymentSchema = z.object({
  order_id: z.string().uuid({ message: 'Sipariş seçin' }),
  plan_item_id: z.string().uuid().optional().nullable(),
  type: z.string().optional().nullable(),
  amount: z.coerce.number().positive('Tutar 0’dan büyük olmalı'),
  currency: z.enum(CURRENCIES),
  method: z.enum(PAYMENT_METHODS).default('bank_transfer'),
  status: z.enum(PAYMENT_STATUSES).default('pending'),
  due_date: z.string().optional().nullable(),
  paid_date: z.string().optional().nullable(),
  bank_account_id: z.string().uuid().optional().nullable(),
  reference_number: z.string().optional().nullable(),
  shipment_no: z.coerce.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;

/** Bir ödeme gecikmiş mi? (bekliyor + vadesi geçmiş) */
export function isOverdue(p: { status?: string | null; due_date?: string | null }) {
  if (p.status !== 'pending' || !p.due_date) return false;
  return p.due_date < new Date().toISOString().slice(0, 10);
}
