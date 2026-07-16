'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2, Lock } from 'lucide-react';
import { returnSchema, RETURN_REASONS, type ReturnInput } from '@/lib/validations/return';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ProductCombobox } from '@/components/ui/product-combobox';
import { formatCurrency } from '@/lib/utils';
import { createReturn, updateReturn, generateReturnNumberForOrder } from './actions';

type Option = { id: string; name: string };
type ProductOption = { id: string; product_code: string; name: string; sales_price: number; desi?: number };
type OrderLite = {
  id: string;
  order_number: string;
  customer_id: string | null;
  platform_id: string | null;
  customers: { name: string | null; phone: string | null } | null;
  order_items: { product_id: string; quantity: number; unit_price: number; line_total: number }[];
  returns: { id: string; return_items: { product_id: string; quantity: number }[] }[] | null;
};
export type EditingReturn = {
  id: string;
  return_number: string;
  return_date: string;
  order_id: string | null;
  customer_id: string | null;
  platform_id: string | null;
  reason: string | null;
  refund_amount: number;
  return_shipping_cost: number;
  notes: string | null;
  customer_display: string;
  items: { product_id: string; quantity: number; unit_price: number }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const EMPTY_ITEMS = [{ product_id: '', quantity: 1, unit_price: 0 }];

export function ReturnForm({
  open, onOpenChange, platforms, products, orders, suggestedNumber, pricePerDesi, editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platforms: Option[];
  products: ProductOption[];
  orders: OrderLite[];
  suggestedNumber: string;
  pricePerDesi: number;
  editing?: EditingReturn | null;
}) {
  const {
    register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting }, reset,
  } = useForm<ReturnInput>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      return_number: suggestedNumber,
      return_date: new Date().toISOString().slice(0, 10),
      items: EMPTY_ITEMS,
      refund_amount: 0,
      return_shipping_cost: 0,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const [customerDisplay, setCustomerDisplay] = useState('');
  const [refundTouched, setRefundTouched] = useState(false);
  const [shippingTouched, setShippingTouched] = useState(false);
  // Sipariş bağlıysa ürünler kilitli; her satırın iade edilebilir azami adedi
  const [maxByIndex, setMaxByIndex] = useState<number[]>([]);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const orderLinked = Boolean(watch('order_id'));

  useEffect(() => {
    if (open) {
      if (editing) {
        reset({
          return_number: editing.return_number,
          return_date: editing.return_date,
          order_id: editing.order_id ?? undefined,
          customer_id: editing.customer_id ?? undefined,
          platform_id: editing.platform_id ?? undefined,
          reason: editing.reason ?? undefined,
          refund_amount: Number(editing.refund_amount),
          return_shipping_cost: Number(editing.return_shipping_cost ?? 0),
          notes: editing.notes ?? '',
          items: editing.items.map((it) => ({
            product_id: it.product_id,
            quantity: it.quantity,
            unit_price: round2(Number(it.unit_price)),
          })),
        });
        setCustomerDisplay(editing.customer_display);
        // Kayıtlı tutarları koru; kullanıcı adet değiştirirse elle güncelleyebilir
        setRefundTouched(true);
        setShippingTouched(true);
        // Düzenlemede azami adet: kalan + bu iadenin kendi adedi
        if (editing.order_id) {
          const order = orders.find((o) => o.id === editing.order_id);
          if (order) {
            const returnedOther = new Map<string, number>();
            for (const ret of order.returns ?? []) {
              if (ret.id === editing.id) continue;
              for (const it of ret.return_items ?? []) {
                returnedOther.set(it.product_id, (returnedOther.get(it.product_id) ?? 0) + (it.quantity ?? 0));
              }
            }
            const orderedByProduct = new Map<string, number>();
            for (const it of order.order_items ?? []) {
              orderedByProduct.set(it.product_id, (orderedByProduct.get(it.product_id) ?? 0) + (it.quantity ?? 0));
            }
            setMaxByIndex(editing.items.map((it) =>
              Math.max(1, (orderedByProduct.get(it.product_id) ?? it.quantity) - (returnedOther.get(it.product_id) ?? 0))
            ));
          } else {
            setMaxByIndex(editing.items.map((it) => it.quantity));
          }
        } else {
          setMaxByIndex([]);
        }
      } else {
        reset({
          return_number: suggestedNumber,
          return_date: new Date().toISOString().slice(0, 10),
          items: EMPTY_ITEMS,
          refund_amount: 0,
          return_shipping_cost: 0,
        });
        setCustomerDisplay('');
        setRefundTouched(false);
        setShippingTouched(false);
        setMaxByIndex([]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const watchedItems = watch('items');

  // Kalem bazlı otomatik hesaplar:
  //   Ürün iade tutarı = Σ (iade adedi × birim fiyat)
  //   İade masrafı     = Σ (iade adedi × ürün desisi × desi başına kargo)
  // useMemo KULLANILMAZ: watch() aynı referansı döndürdüğü için memo güncellenmiyordu.
  // watch aboneliği her değişiklikte render tetikler; doğrudan hesap anlık sonuç verir.
  const computed = (() => {
    const items = watchedItems ?? [];
    let productRefund = 0;
    let shippingDefault = 0;
    for (const it of items) {
      const qty = Number(it?.quantity) || 0;
      const price = Number(it?.unit_price) || 0;
      productRefund += qty * price;
      const desi = Number(productById.get(it?.product_id ?? '')?.desi ?? 0);
      shippingDefault += qty * desi * (pricePerDesi || 0);
    }
    return { productRefund: round2(productRefund), shippingDefault: round2(shippingDefault) };
  })();

  useEffect(() => {
    if (!refundTouched) setValue('refund_amount', computed.productRefund);
    if (!shippingTouched) setValue('return_shipping_cost', computed.shippingDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed.productRefund, computed.shippingDefault]);

  const refundValue = Number(watch('refund_amount')) || 0;
  const shippingValue = Number(watch('return_shipping_cost')) || 0;
  const totalRefund = round2(refundValue + shippingValue);

  const handleOrderSelect = async (orderId: string) => {
    setValue('order_id', orderId);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    // İade numarası sipariş numarasından türetilir: İAD-SIP-2026-00001
    if (!editing) {
      try {
        const num = await generateReturnNumberForOrder(order.order_number);
        setValue('return_number', num);
      } catch {
        /* numara üretilemezse mevcut öneri kalır */
      }
    }

    if (order.customer_id) setValue('customer_id', order.customer_id);
    const name = order.customers?.name ?? '';
    const phone = order.customers?.phone ?? '';
    setCustomerDisplay([name, phone].filter(Boolean).join(' · ') || '—');
    if (order.platform_id) setValue('platform_id', order.platform_id);

    const returned = new Map<string, number>();
    for (const ret of order.returns ?? []) {
      for (const it of ret.return_items ?? []) {
        returned.set(it.product_id, (returned.get(it.product_id) ?? 0) + (it.quantity ?? 0));
      }
    }
    const remaining = (order.order_items ?? [])
      .map((it) => {
        const remainingQty = (it.quantity ?? 0) - (returned.get(it.product_id) ?? 0);
        const effectiveUnit = it.quantity > 0 ? round2(Number(it.line_total) / it.quantity) : Number(it.unit_price);
        return { product_id: it.product_id, quantity: remainingQty, unit_price: effectiveUnit, max: remainingQty };
      })
      .filter((it) => it.quantity > 0);

    setRefundTouched(false);
    setShippingTouched(false);

    if (!remaining.length) {
      toast.info('Bu siparişin tüm kalemleri zaten iade edilmiş');
      setValue('order_id', undefined);
      replace(EMPTY_ITEMS);
      setMaxByIndex([]);
      return;
    }
    replace(remaining.map(({ max: _max, ...it }) => it));
    setMaxByIndex(remaining.map((it) => it.max));
  };

  const clampQuantity = (index: number) => {
    const max = maxByIndex[index];
    if (!max) return;
    const val = Number(watch(`items.${index}.quantity`)) || 0;
    if (val > max) {
      setValue(`items.${index}.quantity`, max);
      toast.warning(`Bu kalemden en fazla ${max} adet iade edilebilir`);
    }
  };

  const handleRemoveLine = (index: number) => {
    remove(index);
    setMaxByIndex((prev) => prev.filter((_, i) => i !== index));
  };

  const productLabel = (id: string) => {
    const p = productById.get(id);
    return p ? `${p.product_code} — ${p.name}` : '—';
  };

  const onSubmit = async (values: ReturnInput) => {
    try {
      if (editing) {
        await updateReturn(editing.id, values);
        toast.success('İade güncellendi');
      } else {
        await createReturn(values);
        toast.success('İade kaydedildi');
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader><DialogTitle>{editing ? `İadeyi Düzenle — ${editing.return_number}` : 'Yeni İade'}</DialogTitle></DialogHeader>
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
              <Label>İlgili Sipariş (müşteri, platform ve kalan ürünler otomatik dolar)</Label>
              <Select value={watch('order_id') ?? undefined} onValueChange={handleOrderSelect} disabled={!!editing}>
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
                <SelectTrigger><SelectValue placeholder="Sipariş seçince dolar" /></SelectTrigger>
                <SelectContent>
                  {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1.5">
              <Label>İade Nedeni</Label>
              <Select value={watch('reason') ?? undefined} onValueChange={(v) => setValue('reason', v)}>
                <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
                <SelectContent>
                  {RETURN_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="grid grid-cols-12 gap-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="col-span-7">Ürün</span>
              <span className="col-span-2">İade Adedi</span>
              <span className="col-span-2">Birim Fiyat</span>
              <span className="col-span-1" />
            </div>
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 items-center gap-2">
                <div className="col-span-7 min-w-0">
                  {orderLinked ? (
                    <div className="flex h-9 items-center gap-2 truncate rounded-md border border-border bg-muted/40 px-3 text-sm">
                      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{productLabel(watch(`items.${index}.product_id`) ?? '')}</span>
                      {maxByIndex[index] ? (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">azami {maxByIndex[index]}</span>
                      ) : null}
                    </div>
                  ) : (
                    <ProductCombobox
                      options={products}
                      value={watch(`items.${index}.product_id`) || undefined}
                      onChange={(v) => setValue(`items.${index}.product_id`, v)}
                    />
                  )}
                </div>
                <div className="col-span-2">
                  <Input
                    type="number" min={1} max={maxByIndex[index] || undefined}
                    {...register(`items.${index}.quantity`, { onChange: () => clampQuantity(index) })}
                  />
                </div>
                <div className="col-span-2">
                  <Input type="number" step="0.01" {...register(`items.${index}.unit_price`)} />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveLine(index)} disabled={fields.length === 1}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            {errors.items && <p className="text-xs text-destructive">{errors.items.message ?? errors.items.root?.message}</p>}
            {!orderLinked && (
              <Button type="button" variant="outline" size="sm" onClick={() => append({ product_id: '', quantity: 1, unit_price: 0 })}>
                <Plus className="mr-1.5 h-4 w-4" /> Satır Ekle
              </Button>
            )}
            {orderLinked && (
              <p className="text-xs text-muted-foreground">
                Siparişe bağlı iade: ürünler değiştirilemez, satır eklenemez. İade edilmeyecek kalemi çöp kutusuyla kaldırın, adedi azaltın.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ürün İade Tutarı</Label>
                <Input
                  type="number" step="0.01" min={0}
                  {...register('refund_amount', { onChange: () => setRefundTouched(true) })}
                />
                <p className="text-xs text-muted-foreground">Otomatik: Σ iade adedi × birim fiyat</p>
              </div>
              <div className="space-y-1.5">
                <Label>İade Masrafı (Nakliye)</Label>
                <Input
                  type="number" step="0.01" min={0}
                  {...register('return_shipping_cost', { onChange: () => setShippingTouched(true) })}
                />
                <p className="text-xs text-muted-foreground">
                  Otomatik: Σ iade adedi × desi × {formatCurrency(pricePerDesi || 0)}/desi
                </p>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Notlar</Label>
                <Input {...register('notes')} />
              </div>
            </div>

            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ürün İade Tutarı</span>
                <span className="tabular-nums">{formatCurrency(refundValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">İade Masrafı (Nakliye)</span>
                <span className="tabular-nums">{formatCurrency(shippingValue)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Toplam İade Tutarı</span>
                <span className="tabular-nums">{formatCurrency(totalRefund)}</span>
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
