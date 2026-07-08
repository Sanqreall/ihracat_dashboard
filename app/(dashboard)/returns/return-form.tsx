'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { returnSchema, RETURN_REASONS, type ReturnInput } from '@/lib/validations/return';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { createReturn } from './actions';

type Option = { id: string; name: string };
type ProductOption = { id: string; product_code: string; name: string; sales_price: number };
type OrderLite = {
  id: string;
  order_number: string;
  customer_id: string | null;
  platform_id: string | null;
  customers: { name: string | null; phone: string | null } | null;
  order_items: { product_id: string; quantity: number; unit_price: number }[];
  returns: { return_items: { product_id: string; quantity: number }[] }[] | null;
};

export function ReturnForm({
  open, onOpenChange, platforms, products, orders, suggestedNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platforms: Option[];
  products: ProductOption[];
  orders: OrderLite[];
  suggestedNumber: string;
}) {
  const {
    register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting }, reset,
  } = useForm<ReturnInput>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      return_number: suggestedNumber,
      return_date: new Date().toISOString().slice(0, 10),
      items: [{ product_id: '', quantity: 1, unit_price: 0 }],
      refund_amount: 0,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const [customerDisplay, setCustomerDisplay] = useState('');

  useEffect(() => {
    if (open) {
      reset({
        return_number: suggestedNumber,
        return_date: new Date().toISOString().slice(0, 10),
        items: [{ product_id: '', quantity: 1, unit_price: 0 }],
        refund_amount: 0,
      });
      setCustomerDisplay('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleOrderSelect = (orderId: string) => {
    setValue('order_id', orderId);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // Müşteri bilgileri otomatik gelir
    if (order.customer_id) setValue('customer_id', order.customer_id);
    const name = order.customers?.name ?? '';
    const phone = order.customers?.phone ?? '';
    setCustomerDisplay([name, phone].filter(Boolean).join(' · ') || '—');
    if (order.platform_id) setValue('platform_id', order.platform_id);

    // Daha önce iade edilen adetleri düş — kalanı yoksa kalem hiç görünmez
    const returned = new Map<string, number>();
    for (const ret of order.returns ?? []) {
      for (const it of ret.return_items ?? []) {
        returned.set(it.product_id, (returned.get(it.product_id) ?? 0) + (it.quantity ?? 0));
      }
    }
    const remaining = (order.order_items ?? [])
      .map((it) => ({
        product_id: it.product_id,
        quantity: (it.quantity ?? 0) - (returned.get(it.product_id) ?? 0),
        unit_price: Number(it.unit_price),
      }))
      .filter((it) => it.quantity > 0);

    if (!remaining.length) {
      toast.info('Bu siparişin tüm kalemleri zaten iade edilmiş');
      replace([{ product_id: '', quantity: 1, unit_price: 0 }]);
      return;
    }
    replace(remaining);
  };

  const onSubmit = async (values: ReturnInput) => {
    try {
      await createReturn(values);
      toast.success('İade kaydedildi');
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>Yeni İade</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>İade No</Label>
              <Input {...register('return_number')} />
              {errors.return_number && <p className="text-xs text-destructive">{errors.return_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tarih</Label>
              <Input type="date" {...register('return_date')} />
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>İlgili Sipariş (seçince müşteri ve kalan ürünler otomatik dolar)</Label>
              <Select value={watch('order_id') ?? undefined} onValueChange={handleOrderSelect}>
                <SelectTrigger><SelectValue placeholder="Seçiniz (opsiyonel)" /></SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_number}{o.customers?.name ? ` — ${o.customers.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Müşteri</Label>
              <Input value={customerDisplay} readOnly disabled placeholder="Sipariş seçince dolar" />
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={watch('platform_id') ?? undefined} onValueChange={(v) => setValue('platform_id', v)}>
                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>İade Nedeni</Label>
              <Select value={watch('reason') ?? undefined} onValueChange={(v) => setValue('reason', v)}>
                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>İade Tutarı</Label>
              <Input type="number" step="0.01" min={0} {...register('refund_amount')} />
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="col-span-7">Ürün</span>
              <span className="col-span-2">Adet</span>
              <span className="col-span-2">Birim Fiyat</span>
              <span className="col-span-1" />
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-7 min-w-0">
                  <Select
                    value={watch(`items.${index}.product_id`) || undefined}
                    onValueChange={(v) => setValue(`items.${index}.product_id`, v)}
                  >
                    <SelectTrigger className="w-full [&>span]:truncate [&>span]:text-left">
                      <SelectValue placeholder="Ürün seçiniz" />
                    </SelectTrigger>
                    <SelectContent className="max-w-[480px]">
                      {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.product_code} — {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Input type="number" min={1} {...register(`items.${index}.quantity`)} />
                </div>
                <div className="col-span-2">
                  <Input type="number" step="0.01" {...register(`items.${index}.unit_price`)} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {errors.items && <p className="text-xs text-destructive">{errors.items.message ?? errors.items.root?.message}</p>}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ product_id: '', quantity: 1, unit_price: 0 })}>
              <Plus className="mr-1.5 h-4 w-4" /> Satır Ekle
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Notlar</Label>
            <Input {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
