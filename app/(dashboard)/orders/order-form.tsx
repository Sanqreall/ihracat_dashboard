'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2, Wand2, Hash } from 'lucide-react';
import {
  orderSchema, type OrderInput, calculateOrderTotals,
  CURRENCIES, INCOTERMS, ORDER_STATUSES, ORDER_STATUS_LABELS,
  PAYMENT_PLAN_TYPES, PAYMENT_PLAN_TYPE_LABELS, PAYMENT_METHODS,
} from '@/lib/validations/order';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createOrder, updateOrder, generateOrderNumber } from './actions';

type Lite = Record<string, any>;

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

const fmt = (n: number, cur: string) =>
  `${cur} ${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyDefaults = (): OrderInput => ({
  order_number: '', customer_id: '' as any, status: 'draft', currency: 'USD', vat_rate: 0,
  incoterms: '', order_date: new Date().toISOString().slice(0, 10), shipment_date: '', actual_shipment_date: '',
  shipping_method: '', port_of_loading: '', port_of_discharge: '', bill_of_lading: '', invoice_number: '', notes: '',
  discount_type: null, discount_value: 0, payment_basis: 'order',
  items: [], additional_costs: [], payment_plan: [],
});

export function OrderForm({
  open, onOpenChange, order, customers, products,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: Lite | null;
  customers: Lite[];
  products: Lite[];
}) {
  const { register, control, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } =
    useForm<OrderInput>({ resolver: zodResolver(orderSchema), defaultValues: emptyDefaults() });

  const items = useFieldArray({ control, name: 'items' });
  const costs = useFieldArray({ control, name: 'additional_costs' });
  const plan = useFieldArray({ control, name: 'payment_plan' });

  useEffect(() => {
    if (!open) return;
    if (order) {
      reset({
        order_number: order.order_number ?? '',
        customer_id: order.customer_id ?? ('' as any),
        status: order.status ?? 'draft',
        currency: order.currency ?? 'USD',
        vat_rate: order.vat_rate ?? 0,
        incoterms: order.incoterms ?? '',
        order_date: order.order_date ?? '',
        shipment_date: order.shipment_date ?? '',
        actual_shipment_date: order.actual_shipment_date ?? '',
        shipping_method: order.shipping_method ?? '',
        port_of_loading: order.port_of_loading ?? '',
        port_of_discharge: order.port_of_discharge ?? '',
        bill_of_lading: order.bill_of_lading ?? '',
        invoice_number: order.invoice_number ?? '',
        notes: order.notes ?? '',
        discount_type: order.discount_type ?? null,
        discount_value: order.discount_value ?? 0,
        payment_basis: order.payment_basis ?? 'order',
        items: (order.order_items ?? []).map((it: Lite) => ({
          product_id: it.product_id ?? null, product_code: it.product_code ?? '', manufacturing_code: it.manufacturing_code ?? '',
          name_tr: it.name_tr ?? '', name_en: it.name_en ?? '', unit: it.unit ?? 'adet',
          quantity: it.quantity ?? 0, unit_price: it.unit_price ?? 0, discount: it.discount ?? 0,
          shipment_no: it.shipment_no ?? null, sort_order: it.sort_order ?? 0,
        })),
        additional_costs: (order.order_additional_costs ?? []).map((c: Lite) => ({ description: c.description, amount: c.amount })),
        payment_plan: (order.payment_plan_items ?? []).map((p: Lite) => ({
          type: p.type, amount: p.amount, percentage: p.percentage ?? null, due_date: p.due_date ?? '',
          method: p.method ?? 'bank_transfer', notes: p.notes ?? '', shipment_no: p.shipment_no ?? null, sort_order: p.sort_order ?? 0,
        })),
      });
    } else {
      reset(emptyDefaults());
    }
  }, [open, order, reset]);

  const watched = useWatch({ control });
  const totals = useMemo(() => calculateOrderTotals({
    items: (watched.items ?? []) as any,
    discount_type: watched.discount_type,
    discount_value: watched.discount_value,
    vat_rate: watched.vat_rate,
    additional_costs: (watched.additional_costs ?? []) as any,
  }), [watched]);
  const currency = watched.currency ?? 'USD';

  const onPickProduct = (index: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    setValue(`items.${index}.product_id`, productId || null);
    if (p) {
      setValue(`items.${index}.product_code`, p.product_code ?? '');
      setValue(`items.${index}.manufacturing_code`, p.manufacturing_code ?? '');
      setValue(`items.${index}.name_tr`, p.name_tr ?? '');
      setValue(`items.${index}.name_en`, p.name_en ?? '');
      setValue(`items.${index}.unit`, p.unit ?? 'adet');
      setValue(`items.${index}.unit_price`, p.default_price ?? 0);
    }
  };

  const genNumber = async () => {
    try { setValue('order_number', await generateOrderNumber()); } catch { /* ignore */ }
  };

  // Seçili müşterinin varsayılan yüzdelerinden ödeme planı üret
  const genPlanFromCustomer = () => {
    const c = customers.find((x) => x.id === watched.customer_id);
    if (!c) { toast.error('Önce müşteri seçin'); return; }
    const total = totals.total;
    const rows: OrderInput['payment_plan'] = [];
    const add = (type: any, pct: number) => {
      if (pct > 0) rows.push({
        type, percentage: pct, amount: Math.round(total * pct / 100 * 100) / 100,
        due_date: '', method: c.default_payment_method ?? 'bank_transfer', notes: '', shipment_no: null, sort_order: rows.length,
      });
    };
    add('prepayment', Number(c.default_prepayment_pct) || 0);
    add('preShipment', Number(c.default_pre_shipment_pct) || 0);
    add('deferred', Number(c.default_deferred_pct) || 0);
    if (!rows.length) { toast.error('Müşterinin varsayılan yüzdeleri tanımlı değil'); return; }
    plan.replace(rows);
    toast.success('Ödeme planı müşteri varsayılanlarından oluşturuldu');
  };

  const onSubmit = async (values: OrderInput) => {
    try {
      if (order?.id) { await updateOrder(order.id, values); toast.success('Sipariş güncellendi'); }
      else { await createOrder(values); toast.success('Sipariş oluşturuldu'); }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order ? 'Siparişi Düzenle' : 'Yeni Sipariş'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* BAŞLIK */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Sipariş No</Label>
              <div className="flex gap-1">
                <Input {...register('order_number')} />
                <Button type="button" variant="outline" size="icon" onClick={genNumber} title="Otomatik numara"><Hash className="h-4 w-4" /></Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Müşteri *</Label>
              <select className={selectClass} {...register('customer_id')}>
                <option value="">Seçin…</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.code ? `${c.code} · ` : ''}{c.name}</option>)}
              </select>
              {errors.customer_id && <p className="text-xs text-destructive">{errors.customer_id.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Durum</Label>
              <select className={selectClass} {...register('status')}>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Para Birimi</Label>
              <select className={selectClass} {...register('currency')}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Sipariş Tarihi</Label>
              <Input type="date" {...register('order_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>Planlanan Sevk</Label>
              <Input type="date" {...register('shipment_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>Gerçek Sevk</Label>
              <Input type="date" {...register('actual_shipment_date')} />
            </div>
            <div className="space-y-1.5">
              <Label>KDV %</Label>
              <Input type="number" step="0.01" {...register('vat_rate')} />
            </div>
            <div className="space-y-1.5">
              <Label>Incoterm</Label>
              <select className={selectClass} {...register('incoterms')}>
                <option value="">—</option>
                {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Yükleme Limanı</Label>
              <Input {...register('port_of_loading')} />
            </div>
            <div className="space-y-1.5">
              <Label>Varış Limanı</Label>
              <Input {...register('port_of_discharge')} />
            </div>
            <div className="space-y-1.5">
              <Label>Fatura No</Label>
              <Input {...register('invoice_number')} />
            </div>
          </div>

          {/* KALEMLER */}
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Sipariş Kalemleri</h3>
              <Button type="button" size="sm" variant="outline" onClick={() => items.append({ product_id: null, product_code: '', name_tr: '', unit: 'adet', quantity: 1, unit_price: 0, discount: 0, sort_order: items.fields.length } as any)}>
                <Plus className="mr-1 h-4 w-4" /> Kalem
              </Button>
            </div>
            <div className="space-y-2">
              {items.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-12 items-center gap-2">
                  <select className={`${selectClass} col-span-3`} defaultValue={(f as any).product_id ?? ''} onChange={(e) => onPickProduct(i, e.target.value)}>
                    <option value="">Ürün seç / elle</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.product_code ? `${p.product_code} · ` : ''}{p.name_tr}</option>)}
                  </select>
                  <Input className="col-span-3" placeholder="Ürün adı" {...register(`items.${i}.name_tr`)} />
                  <Input className="col-span-1" placeholder="Br." {...register(`items.${i}.unit`)} />
                  <Input className="col-span-1" type="number" step="0.01" placeholder="Adet" {...register(`items.${i}.quantity`)} />
                  <Input className="col-span-2" type="number" step="0.0001" placeholder="Birim fiyat" {...register(`items.${i}.unit_price`)} />
                  <Input className="col-span-1" type="number" step="0.01" placeholder="İsk%" {...register(`items.${i}.discount`)} />
                  <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => items.remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {items.fields.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Kalem ekleyin</p>}
            </div>
          </div>

          {/* EK MALİYETLER + İSKONTO */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Ek Maliyetler</h3>
                <Button type="button" size="sm" variant="outline" onClick={() => costs.append({ description: '', amount: 0 })}>
                  <Plus className="mr-1 h-4 w-4" /> Ekle
                </Button>
              </div>
              <div className="space-y-2">
                {costs.fields.map((f, i) => (
                  <div key={f.id} className="flex items-center gap-2">
                    <Input placeholder="Açıklama (palet, navlun…)" {...register(`additional_costs.${i}.description`)} />
                    <Input className="w-32" type="number" step="0.01" placeholder="Tutar" {...register(`additional_costs.${i}.amount`)} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => costs.remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                {costs.fields.length === 0 && <p className="py-1 text-center text-xs text-muted-foreground">Yok</p>}
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <h3 className="text-sm font-semibold">Sipariş İskontosu</h3>
              <div className="flex gap-2">
                <select className={selectClass} {...register('discount_type')}>
                  <option value="">Yok</option>
                  <option value="percent">Yüzde %</option>
                  <option value="amount">Tutar</option>
                </select>
                <Input type="number" step="0.01" placeholder="Değer" {...register('discount_value')} />
              </div>
            </div>
          </div>

          {/* ÖDEME PLANI */}
          <div className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Ödeme Planı</h3>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={genPlanFromCustomer}>
                  <Wand2 className="mr-1 h-4 w-4" /> Müşteri varsayılanından
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => plan.append({ type: 'deferred', amount: 0, percentage: null, due_date: '', method: 'bank_transfer', sort_order: plan.fields.length } as any)}>
                  <Plus className="mr-1 h-4 w-4" /> Satır
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {plan.fields.map((f, i) => (
                <div key={f.id} className="grid grid-cols-12 items-center gap-2">
                  <select className={`${selectClass} col-span-2`} {...register(`payment_plan.${i}.type`)}>
                    {PAYMENT_PLAN_TYPES.map((t) => <option key={t} value={t}>{PAYMENT_PLAN_TYPE_LABELS[t]}</option>)}
                  </select>
                  <Input className="col-span-2" type="number" step="0.01" placeholder="%" {...register(`payment_plan.${i}.percentage`)} />
                  <Input className="col-span-3" type="number" step="0.01" placeholder="Tutar" {...register(`payment_plan.${i}.amount`)} />
                  <Input className="col-span-2" type="date" {...register(`payment_plan.${i}.due_date`)} />
                  <select className={`${selectClass} col-span-2`} {...register(`payment_plan.${i}.method`)}>
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <Button type="button" variant="ghost" size="icon" className="col-span-1" onClick={() => plan.remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {plan.fields.length === 0 && <p className="py-1 text-center text-xs text-muted-foreground">Plan yok</p>}
            </div>
          </div>

          {/* NOTLAR + TOPLAMLAR */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Notlar</Label>
              <textarea className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm" {...register('notes')} />
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <div className="flex justify-between py-0.5"><span className="text-muted-foreground">Ara Toplam</span><span className="tabular-nums">{fmt(totals.subtotal, currency)}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted-foreground">İskonto</span><span className="tabular-nums">-{fmt(totals.orderDiscount, currency)}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted-foreground">Ek Maliyet</span><span className="tabular-nums">{fmt(totals.additional, currency)}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted-foreground">KDV Hariç</span><span className="tabular-nums">{fmt(totals.exVat, currency)}</span></div>
              <div className="flex justify-between py-0.5"><span className="text-muted-foreground">KDV</span><span className="tabular-nums">{fmt(totals.vatAmount, currency)}</span></div>
              <div className="mt-1 flex justify-between border-t border-border pt-1 font-semibold"><span>Genel Toplam</span><span className="tabular-nums">{fmt(totals.total, currency)}</span></div>
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
