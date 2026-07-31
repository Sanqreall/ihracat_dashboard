'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  customerSchema, type CustomerInput,
  CURRENCIES, INCOTERMS, PAYMENT_METHODS,
} from '@/lib/validations/customer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createCustomer, updateCustomer } from './actions';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  bank_transfer: 'Havale/EFT',
  letter_of_credit: 'Akreditif (L/C)',
  cash: 'Nakit',
  cheque: 'Çek',
  other: 'Diğer',
};

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function CustomerForm({
  open, onOpenChange, customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: (Partial<CustomerInput> & { id: string }) | null;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      default_currency: 'USD', default_payment_method: 'bank_transfer',
      default_payment_terms: 0, credit_limit: 0,
      default_prepayment_pct: 0, default_pre_shipment_pct: 0, default_deferred_pct: 100,
    },
  });

  useEffect(() => {
    if (open) {
      reset(
        customer
          ? (customer as CustomerInput)
          : {
              default_currency: 'USD', default_payment_method: 'bank_transfer',
              default_payment_terms: 0, credit_limit: 0,
              default_prepayment_pct: 0, default_pre_shipment_pct: 0, default_deferred_pct: 100,
            },
      );
    }
  }, [open, customer, reset]);

  const onSubmit = async (values: CustomerInput) => {
    try {
      if (customer?.id) {
        await updateCustomer(customer.id, values);
        toast.success('Müşteri güncellendi');
      } else {
        await createCustomer(values);
        toast.success('Müşteri oluşturuldu');
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{customer ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Müşteri Kodu</Label>
            <Input {...register('code')} placeholder="MST-001" />
          </div>
          <div className="space-y-1.5">
            <Label>Müşteri Adı *</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Yetkili Kişi</Label>
            <Input {...register('contact_person')} />
          </div>
          <div className="space-y-1.5">
            <Label>Ülke</Label>
            <Input {...register('country')} />
          </div>
          <div className="space-y-1.5">
            <Label>E-posta</Label>
            <Input {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Telefon</Label>
            <Input {...register('phone')} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Adres</Label>
            <Input {...register('address')} />
          </div>
          <div className="space-y-1.5">
            <Label>Vergi No</Label>
            <Input {...register('tax_number')} />
          </div>
          <div className="space-y-1.5">
            <Label>Kredi Limiti (USD)</Label>
            <Input type="number" step="0.01" {...register('credit_limit')} />
          </div>

          <div className="col-span-2 mt-1 border-t border-border pt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">İhracat Varsayılanları</p>
          </div>
          <div className="space-y-1.5">
            <Label>Para Birimi</Label>
            <select className={selectClass} {...register('default_currency')}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Incoterm</Label>
            <select className={selectClass} {...register('preferred_incoterm')}>
              <option value="">—</option>
              {INCOTERMS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Ödeme Yöntemi</Label>
            <select className={selectClass} {...register('default_payment_method')}>
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Vade (gün)</Label>
            <Input type="number" {...register('default_payment_terms')} />
          </div>
          <div className="space-y-1.5">
            <Label>Peşinat %</Label>
            <Input type="number" step="0.01" {...register('default_prepayment_pct')} />
          </div>
          <div className="space-y-1.5">
            <Label>Sevk Öncesi %</Label>
            <Input type="number" step="0.01" {...register('default_pre_shipment_pct')} />
          </div>
          <div className="space-y-1.5">
            <Label>Vadeli %</Label>
            <Input type="number" step="0.01" {...register('default_deferred_pct')} />
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
