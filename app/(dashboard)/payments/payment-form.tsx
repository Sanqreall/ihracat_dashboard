'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  paymentSchema, type PaymentInput,
  CURRENCIES, PAYMENT_METHODS, PAYMENT_STATUSES, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS,
} from '@/lib/validations/payment';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createPayment, updatePayment } from './actions';

type Lite = Record<string, any>;

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function PaymentForm({
  open, onOpenChange, payment, orders, banks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment?: Lite | null;
  orders: Lite[];
  banks: Lite[];
}) {
  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<PaymentInput>({
      resolver: zodResolver(paymentSchema),
      defaultValues: { currency: 'USD', method: 'bank_transfer', status: 'pending', amount: 0 as any },
    });

  useEffect(() => {
    if (!open) return;
    reset(payment
      ? {
          order_id: payment.order_id, plan_item_id: payment.plan_item_id ?? null, type: payment.type ?? '',
          amount: payment.amount, currency: payment.currency, method: payment.method ?? 'bank_transfer',
          status: payment.status, due_date: payment.due_date ?? '', paid_date: payment.paid_date ?? '',
          bank_account_id: payment.bank_account_id ?? null, reference_number: payment.reference_number ?? '',
          shipment_no: payment.shipment_no ?? null, notes: payment.notes ?? '',
        }
      : { currency: 'USD', method: 'bank_transfer', status: 'pending', amount: 0 as any });
  }, [open, payment, reset]);

  const onOrderChange = (orderId: string) => {
    setValue('order_id', orderId as any);
    const o = orders.find((x) => x.id === orderId);
    if (o?.currency) setValue('currency', o.currency);
  };

  const onSubmit = async (values: PaymentInput) => {
    try {
      if (payment?.id) { await updatePayment(payment.id, values); toast.success('Ödeme güncellendi'); }
      else { await createPayment(values); toast.success('Ödeme kaydedildi'); }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{payment ? 'Ödemeyi Düzenle' : 'Yeni Ödeme'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Sipariş *</Label>
            <select className={selectClass} defaultValue={payment?.order_id ?? ''} onChange={(e) => onOrderChange(e.target.value)}>
              <option value="">Seçin…</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.order_number} · {o.customer_name} ({o.currency})</option>)}
            </select>
            {errors.order_id && <p className="text-xs text-destructive">{errors.order_id.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Tutar *</Label>
            <Input type="number" step="0.01" {...register('amount')} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Para Birimi</Label>
            <select className={selectClass} {...register('currency')}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Durum</Label>
            <select className={selectClass} {...register('status')}>
              {PAYMENT_STATUSES.map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Yöntem</Label>
            <select className={selectClass} {...register('method')}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Vade Tarihi</Label>
            <Input type="date" {...register('due_date')} />
          </div>
          <div className="space-y-1.5">
            <Label>Tahsil Tarihi</Label>
            <Input type="date" {...register('paid_date')} />
          </div>
          <div className="space-y-1.5">
            <Label>Banka Hesabı</Label>
            <select className={selectClass} {...register('bank_account_id')}>
              <option value="">—</option>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.name}{b.currency ? ` (${b.currency})` : ''}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Referans No</Label>
            <Input {...register('reference_number')} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Notlar</Label>
            <Input {...register('notes')} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
