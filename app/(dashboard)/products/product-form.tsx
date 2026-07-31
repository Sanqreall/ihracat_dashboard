'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { productSchema, type ProductInput, CURRENCIES, UNITS } from '@/lib/validations/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { createProduct, updateProduct } from './actions';

const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function ProductForm({
  open, onOpenChange, product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: (Partial<ProductInput> & { id: string }) | null;
}) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { unit: 'adet', default_currency: 'USD', default_price: 0 },
  });

  useEffect(() => {
    if (open) {
      reset(product ? (product as ProductInput) : { unit: 'adet', default_currency: 'USD', default_price: 0 });
    }
  }, [open, product, reset]);

  const onSubmit = async (values: ProductInput) => {
    try {
      if (product?.id) {
        await updateProduct(product.id, values);
        toast.success('Ürün güncellendi');
      } else {
        await createProduct(values);
        toast.success('Ürün oluşturuldu');
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
          <DialogTitle>{product ? 'Ürünü Düzenle' : 'Yeni Ürün'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Ürün Kodu</Label>
            <Input {...register('product_code')} />
          </div>
          <div className="space-y-1.5">
            <Label>Üretim Kodu</Label>
            <Input {...register('manufacturing_code')} />
          </div>
          <div className="space-y-1.5">
            <Label>Ad (TR) *</Label>
            <Input {...register('name_tr')} />
            {errors.name_tr && <p className="text-xs text-destructive">{errors.name_tr.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Ad (EN)</Label>
            <Input {...register('name_en')} />
          </div>
          <div className="space-y-1.5">
            <Label>Birim</Label>
            <select className={selectClass} {...register('unit')}>
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Kategori</Label>
            <Input {...register('category')} />
          </div>
          <div className="space-y-1.5">
            <Label>Varsayılan Fiyat</Label>
            <Input type="number" step="0.0001" {...register('default_price')} />
            {errors.default_price && <p className="text-xs text-destructive">{errors.default_price.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Para Birimi</Label>
            <select className={selectClass} {...register('default_currency')}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
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
