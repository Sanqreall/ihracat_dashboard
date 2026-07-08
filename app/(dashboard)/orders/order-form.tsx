'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { orderSchema, calculateOrderTotals, type OrderInput } from '@/lib/validations/order';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { createOrder, updateOrder } from './actions';

type Option = { id: string; name: string };
type ProductOption = { id: string; product_code: string; name: string; sales_price: number; tax_rate: number; current_stock: number };

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Taslak' },
  { value: 'confirmed', label: 'Onaylandı' },
  { value: 'processing', label: 'Hazırlanıyor' },
  { value: 'shipped', label: 'Kargolandı' },
  { value: 'delivered', label: 'Teslim Edildi' },
  { value: 'cancelled', label: 'İptal' },
] as const;

const PAYMENT_OPTIONS = [
  { value: 'unpaid', label: 'Ödenmedi' },
  { value: 'partial', label: 'Kısmi' },
  { value: 'paid', label: 'Ödendi' },
  { value: 'refunded', label: 'İade Edildi' },
] as const;

const EMPTY_DEFAULTS = (suggestedNumber: string): OrderInput => ({
  order_number: suggestedNumber,
  order_date: new Date().toISOString().slice(0, 10),
  platform_id: '' as unknown as string,
  customer_name: '',
  customer_phone: '',
  customer_address: '',
  items: [{ product_id: '', quantity: 1, unit_price: 0, line_discount_percent: 0, tax_rate: 10 }],
  order_discount_percent: 0,
  shipping_cost: 0,
  status: 'confirmed',
  payment_status: 'unpaid',
  shipment_status: 'pending',
  invoice_number: '',
  tracking_number: '',
  notes: '',
});

export function OrderForm({
  open, onOpenChange, order, platforms, products, suggestedNumber,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: (OrderInput & { id: string }) | null;
  platforms: Option[];
  products: ProductOption[];
  suggestedNumber: string;
}) {
  const {
    register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting }, reset,
  } = useForm<OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: order ?? EMPTY_DEFAULTS(suggestedNumber),
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  useEffect(() => {
    if (open) {
      reset(order ?? EMPTY_DEFAULTS(suggestedNumber));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  const watchedItems = watch('items');
  const watchedOrderDiscount = watch('order_discount_percent');
  const watchedShipping = watch('shipping_cost');

  const totals = useMemo(() => calculateOrderTotals({
    items: (watchedItems ?? []).map((it) => ({
      quantity: Number(it?.quantity) || 0,
      unit_price: Number(it?.unit_price) || 0,
      line_discount_percent: Number(it?.line_discount_percent) || 0,
      tax_rate: Number(it?.tax_rate) || 0,
    })),
    order_discount_percent: Number(watchedOrderDiscount) || 0,
    shipping_cost: Number(watchedShipping) || 0,
  }), [watchedItems, watchedOrderDiscount, watchedShipping]);

  const handleProductSelect = (index: number, productId: string) => {
    setValue(`items.${index}.product_id`, productId);
    const product = products.find((p) => p.id === productId);
    if (product) {
      setValue(`items.${index}.unit_price`, product.sales_price);
      setValue(`items.${index}.tax_rate`, product.tax_rate);
    }
  };

  const onSubmit = async (values: OrderInput) => {
    try {
      if (order?.id) {
        await updateOrder(order.id, values);
        toast.success('Sipariş güncellendi');
      } else {
        await createOrder(values);
        toast.success('Sipariş oluşturuldu');
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{order ? 'Siparişi Düzenle' : 'Yeni Sipariş'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Sipariş No</Label>
              <Input {...register('order_number')} />
              {errors.order_number && <p className="text-xs text-destructive">{errors.order_number.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tarih</Label>
              <Input type="date" {...register('order_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <Select value={watch('platform_id') || undefined} onValueChange={(v) => setValue('platform_id', v)}>
                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.platform_id && <p className="text-xs text-destructive">{errors.platform_id.message}</p>}
            </div>
          </div>

          {/* Müşteri bilgileri */}
          <div className="rounded-md border border-border p-3">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Müşteri Bilgileri</p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Müşteri Adı</Label>
                <Input {...register('customer_name')} placeholder="Ad Soyad" />
              </div>
              <div className="space-y-1.5">
                <Label>Telefon</Label>
                <Input {...register('customer_phone')} placeholder="05xx xxx xx xx" />
              </div>
              <div className="col-span-2 space-y-1.5 md:col-span-1">
                <Label>Adres</Label>
                <Input {...register('customer_address')} placeholder="Teslimat adresi" />
              </div>
            </div>
          </div>

          {/* Ürün satırları — ürün adına geniş alan */}
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="col-span-5">Ürün</span>
              <span className="col-span-1">Adet</span>
              <span className="col-span-2">Birim Fiyat (KDV dahil)</span>
              <span className="col-span-2">İndirim %</span>
              <span className="col-span-1 text-right">Tutar</span>
              <span className="col-span-1" />
            </div>
            {fields.map((field, index) => {
              const line = totals.lines[index];
              return (
                <div key={field.id} className="grid grid-cols-12 items-center gap-2">
                  <div className="col-span-5 min-w-0">
                    <Select
                      value={watch(`items.${index}.product_id`) || undefined}
                      onValueChange={(v) => handleProductSelect(index, v)}
                    >
                      <SelectTrigger className="w-full [&>span]:truncate [&>span]:text-left">
                        <SelectValue placeholder="Ürün seçiniz" />
                      </SelectTrigger>
                      <SelectContent className="max-w-[480px]">
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.product_code} — {p.name} (stok: {p.current_stock})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-1">
                    <Input type="number" min={1} {...register(`items.${index}.quantity`)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" step="0.01" {...register(`items.${index}.unit_price`)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" step="0.01" min={0} max={100} {...register(`items.${index}.line_discount_percent`)} />
                  </div>
                  <div className="col-span-1 text-right text-sm tabular-nums">
                    {formatCurrency(line?.line_total ?? 0)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {errors.items && <p className="text-xs text-destructive">{errors.items.message ?? errors.items.root?.message}</p>}
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => append({ product_id: '', quantity: 1, unit_price: 0, line_discount_percent: 0, tax_rate: 10 })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Satır Ekle
            </Button>
          </div>

          {/* Sipariş alanları + özet */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Sipariş İndirimi (%)</Label>
                <Input type="number" step="0.01" min={0} max={100} {...register('order_discount_percent')} />
              </div>
              <div className="space-y-1.5">
                <Label>Kargo Ücreti</Label>
                <Input type="number" step="0.01" min={0} {...register('shipping_cost')} />
              </div>
              <div className="space-y-1.5">
                <Label>Sipariş Durumu</Label>
                <Select value={watch('status')} onValueChange={(v) => setValue('status', v as OrderInput['status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Ödeme Durumu</Label>
                <Select value={watch('payment_status')} onValueChange={(v) => setValue('payment_status', v as OrderInput['payment_status'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Fatura No</Label>
                <Input {...register('invoice_number')} />
              </div>
              <div className="space-y-1.5">
                <Label>Takip No</Label>
                <Input {...register('tracking_number')} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notlar</Label>
                <Input {...register('notes')} />
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Ara Toplam (KDV dahil)</span><span className="tabular-nums">{formatCurrency(totals.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Sipariş İndirimi</span><span className="tabular-nums text-destructive">−{formatCurrency(totals.order_discount_amount)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Kargo</span><span className="tabular-nums">{formatCurrency(totals.shipping_cost)}</span></div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Genel Toplam</span><span className="tabular-nums">{formatCurrency(totals.total)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>İçindeki KDV</span><span className="tabular-nums">{formatCurrency(totals.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Net Satış (KDV hariç)</span><span className="tabular-nums">{formatCurrency(totals.net_total)}</span>
              </div>
            </div>
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
