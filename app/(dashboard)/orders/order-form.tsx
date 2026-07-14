'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Trash2, ClipboardPaste } from 'lucide-react';
import { orderSchema, calculateOrderTotals, type OrderInput } from '@/lib/validations/order';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ProductCombobox } from '@/components/ui/product-combobox';
import { SearchSelect } from '@/components/ui/search-select';
import { TURKEY_PROVINCES } from '@/lib/provinces';
import { formatCurrency, parsePastedProductLines } from '@/lib/utils';
import { createOrder, updateOrder } from './actions';

type Option = { id: string; name: string };
type ProductOption = { id: string; product_code: string; name: string; sales_price: number; tax_rate: number; current_stock: number; desi?: number };

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
  delivery_province: null,
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
  open, onOpenChange, order, platforms, products, suggestedNumber, pricePerDesi = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order?: (OrderInput & { id: string }) | null;
  platforms: Option[];
  products: ProductOption[];
  pricePerDesi?: number;
  suggestedNumber: string;
}) {
  const {
    register, handleSubmit, setValue, watch, control, formState: { errors, isSubmitting }, reset,
  } = useForm<OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: order ?? EMPTY_DEFAULTS(suggestedNumber),
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'items' });
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handleBulkPaste = () => {
    const parsed = parsePastedProductLines(pasteText);
    if (!parsed.length) { toast.error('Yapıştırılan metinde satır bulunamadı'); return; }

    const byCode = new Map(products.map((p) => [p.product_code.trim().toLocaleUpperCase('tr'), p]));
    const matched: { product_id: string; quantity: number; unit_price: number; line_discount_percent: number; tax_rate: number }[] = [];
    const unmatched: string[] = [];
    for (const row of parsed) {
      const p = byCode.get(row.code.trim().toLocaleUpperCase('tr'));
      if (!p) { unmatched.push(row.code); continue; }
      matched.push({
        product_id: p.id,
        quantity: row.quantity,
        unit_price: p.sales_price,
        line_discount_percent: 0,
        tax_rate: p.tax_rate,
      });
    }

    if (!matched.length) {
      toast.error(`Hiçbir ürün kodu eşleşmedi: ${unmatched.slice(0, 5).join(', ')}`);
      return;
    }

    // Mevcut satırlardan boş olmayanları koru, tek boş placeholder varsa at
    const current = (watch('items') ?? []).filter((it) => it?.product_id);
    replace([...current, ...matched]);

    if (unmatched.length) {
      toast.warning(`${matched.length} satır eklendi; eşleşmeyen kodlar: ${unmatched.slice(0, 5).join(', ')}${unmatched.length > 5 ? '…' : ''}`);
    } else {
      toast.success(`${matched.length} satır eklendi`);
    }
    setPasteText('');
    setPasteOpen(false);
  };

  // Kullanıcı kargoyu elle değiştirdiyse otomatik hesap üzerine yazmaz
  const [shippingTouched, setShippingTouched] = useState(false);

  useEffect(() => {
    if (open) {
      reset(order ?? EMPTY_DEFAULTS(suggestedNumber));
      // Mevcut siparişi düzenlerken kayıtlı kargo korunur
      setShippingTouched(!!order);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, order?.id]);

  const watchedItems = watch('items');
  const watchedOrderDiscount = watch('order_discount_percent');
  const watchedShipping = watch('shipping_cost');

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // Otomatik kargo: Σ (adet × ürün desisi) × desi başına ücret
  const shippingSuggestion = (() => {
    let totalDesi = 0;
    for (const it of watchedItems ?? []) {
      const qty = Number(it?.quantity) || 0;
      const desi = Number(productById.get(it?.product_id ?? '')?.desi ?? 0);
      totalDesi += qty * desi;
    }
    return { totalDesi: Math.round(totalDesi * 100) / 100, cost: Math.round(totalDesi * (pricePerDesi || 0) * 100) / 100 };
  })();

  useEffect(() => {
    if (!shippingTouched) setValue('shipping_cost', shippingSuggestion.cost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shippingSuggestion.cost]);

  // useMemo KULLANILMAZ: react-hook-form watch() aynı dizi referansını döndürdüğü
  // için memo değişikliği fark etmez ve toplamlar donuk kalır. watch aboneliği her
  // tuş vuruşunda render tetiklediğinden burada doğrudan hesaplamak anlık sonuç verir.
  const totals = calculateOrderTotals({
    items: (watchedItems ?? []).map((it) => ({
      quantity: Number(it?.quantity) || 0,
      unit_price: Number(it?.unit_price) || 0,
      line_discount_percent: Number(it?.line_discount_percent) || 0,
      tax_rate: Number(it?.tax_rate) || 0,
    })),
    order_discount_percent: Number(watchedOrderDiscount) || 0,
    shipping_cost: Number(watchedShipping) || 0,
  });

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
                    <ProductCombobox
                      options={products}
                      value={watch(`items.${index}.product_id`) || undefined}
                      onChange={(v) => handleProductSelect(index, v)}
                    />
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
            <div className="flex gap-2">
              <Button
                type="button" variant="outline" size="sm"
                onClick={() => append({ product_id: '', quantity: 1, unit_price: 0, line_discount_percent: 0, tax_rate: 10 })}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Satır Ekle
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPasteOpen((v) => !v)}>
                <ClipboardPaste className="mr-1.5 h-4 w-4" /> Toplu Yapıştır
              </Button>
            </div>
            {pasteOpen && (
              <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/20 p-3">
                <p className="text-xs text-muted-foreground">
                  Her satıra bir ürün: <span className="font-mono">KOD ADET</span> veya{' '}
                  <span className="font-mono">KOD İSİM ADET</span> (Excel'den kopyala-yapıştır desteklenir; isim sütunu yok sayılır)
                </p>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={5}
                  placeholder={'YNG-001\t2\nYNG-002\tCeviz Sehpa\t1'}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setPasteOpen(false); setPasteText(''); }}>Vazgeç</Button>
                  <Button type="button" size="sm" onClick={handleBulkPaste}>Satırları Ekle</Button>
                </div>
              </div>
            )}
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
                <Input
                  type="number" step="0.01" min={0}
                  {...register('shipping_cost', { onChange: () => setShippingTouched(true) })}
                />
                <p className="text-xs text-muted-foreground">
                  Otomatik: {shippingSuggestion.totalDesi} desi × {formatCurrency(pricePerDesi || 0)}
                  {shippingTouched && (
                    <button
                      type="button"
                      onClick={() => { setShippingTouched(false); setValue('shipping_cost', shippingSuggestion.cost); }}
                      className="ml-1 text-primary underline-offset-2 hover:underline"
                    >
                      otomatiğe dön
                    </button>
                  )}
                </p>
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
              <div className="flex justify-between text-muted-foreground">
                <span>Kargo (gider olarak yazılır, toplama eklenmez)</span>
                <span className="tabular-nums">{formatCurrency(totals.shipping_cost)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>Genel Toplam</span><span className="tabular-nums">{formatCurrency(totals.total)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>İçindeki KDV</span><span className="tabular-nums">{formatCurrency(totals.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Net Satış (KDV hariç)</span><span className="tabular-nums">{formatCurrency(totals.net_total)}</span>
              </div>
              <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                Kaydedildiğinde TCMB (bir önceki iş günü) USD/TRY kuru ile USD tutarı otomatik hesaplanıp kilitlenir.
                Kargo ve platform komisyonu, sipariş tarihiyle Giderler'e yazılır.
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
