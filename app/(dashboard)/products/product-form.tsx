'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { productSchema, type ProductInput } from '@/lib/validations/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { createProduct, updateProduct } from './actions';

type Option = { id: string; name: string };

const PRODUCT_DEFAULTS: ProductInput = {
  product_code: '', name: '', series_id: null,
  brand: '', description: '', status: 'active',
  sales_price: 0, cost_price: 0, tax_rate: 10,
  weight_kg: 0, desi: 0, critical_stock: 0, current_stock: 0, notes: '',
};

function mapProductToForm(p: Record<string, unknown>): ProductInput {
  return {
    product_code: String(p.product_code ?? ''),
    name: String(p.name ?? ''),
    series_id: (p.series_id as string) ?? null,
    brand: (p.brand as string) ?? '',
    description: (p.description as string) ?? '',
    status: (p.status as ProductInput['status']) ?? 'active',
    sales_price: Number(p.sales_price ?? 0),
    cost_price: Number(p.cost_price ?? 0),
    tax_rate: Number(p.tax_rate ?? 10),
    weight_kg: Number(p.weight_kg ?? 0),
    desi: Number(p.desi ?? 0),
    critical_stock: Number(p.critical_stock ?? 0),
    current_stock: Number(p.current_stock ?? 0),
    notes: (p.notes as string) ?? '',
  };
}

export function ProductForm({
  open, onOpenChange, product, series,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: (Record<string, unknown> & { id: string }) | null;
  series: Option[];
}) {
  const {
    register, handleSubmit, setValue, watch, formState: { errors, isSubmitting }, reset,
  } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: PRODUCT_DEFAULTS,
  });

  // Load the clicked product's data into the form every time the dialog opens
  useEffect(() => {
    if (open) {
      reset(product ? mapProductToForm(product) : PRODUCT_DEFAULTS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  const onSubmit = async (values: ProductInput) => {
    try {
      if (product?.id) {
        await updateProduct(product.id, values);
        toast.success('Ürün güncellendi');
      } else {
        await createProduct(values);
        toast.success('Ürün oluşturuldu');
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{product ? 'Ürünü Düzenle' : 'Yeni Ürün'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Ürün Kodu</Label>
            <Input {...register('product_code')} />
            {errors.product_code && <p className="text-xs text-destructive">{errors.product_code.message}</p>}
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Ürün Adı</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Seri</Label>
            <Select value={watch('series_id') ?? undefined} onValueChange={(v) => setValue('series_id', v)}>
              <SelectTrigger><SelectValue placeholder="Seçiniz" /></SelectTrigger>
              <SelectContent>
                {series.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Satış Fiyatı</Label>
            <Input type="number" step="0.01" {...register('sales_price')} />
          </div>
          <div className="space-y-1.5">
            <Label>Maliyet Fiyatı</Label>
            <Input type="number" step="0.01" {...register('cost_price')} />
          </div>
          <div className="space-y-1.5">
            <Label>KDV (%)</Label>
            <Input type="number" step="0.01" {...register('tax_rate')} />
          </div>
          <div className="space-y-1.5">
            <Label>Desi</Label>
            <Input type="number" step="0.01" {...register('desi')} />
          </div>

          <div className="space-y-1.5">
            <Label>Mevcut Stok</Label>
            <Input type="number" {...register('current_stock')} />
          </div>
          <div className="space-y-1.5">
            <Label>Kritik Stok</Label>
            <Input type="number" {...register('critical_stock')} />
          </div>

          <div className="space-y-1.5">
            <Label>Durum</Label>
            <Select value={watch('status')} onValueChange={(v) => setValue('status', v as ProductInput['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="passive">Pasif</SelectItem>
                <SelectItem value="discontinued">Üretimi Durduruldu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Marka</Label>
            <Input {...register('brand')} />
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
