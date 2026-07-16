'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { platformSchema, type PlatformInput } from '@/lib/validations/platform';
import { createPlatform, updatePlatform, togglePlatformActive, softDeletePlatform } from './actions';

type Row = Record<string, any>;

function PlatformForm({ open, onOpenChange, platform }: { open: boolean; onOpenChange: (o: boolean) => void; platform?: (PlatformInput & { id: string }) | null }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<PlatformInput>({
    resolver: zodResolver(platformSchema),
    defaultValues: { name: '', slug: '', is_active: true, commission_rate: 0 },
  });

  useEffect(() => {
    if (open) {
      reset(platform ? {
        name: platform.name, slug: platform.slug,
        commission_rate: Number(platform.commission_rate ?? 0),
        is_active: platform.is_active ?? true,
      } : { name: '', slug: '', is_active: true, commission_rate: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, platform?.id]);

  const onSubmit = async (values: PlatformInput) => {
    try {
      if (platform?.id) {
        await updatePlatform(platform.id, values);
        toast.success('Platform güncellendi');
      } else {
        await createPlatform(values);
        toast.success('Platform oluşturuldu');
      }
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{platform ? 'Platformu Düzenle' : 'Yeni Platform'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Platform Adı</Label>
            <Input {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Slug</Label>
            <Input {...register('slug')} placeholder="so-mass" />
            {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Komisyon Oranı (%)</Label>
            <Input type="number" step="0.01" {...register('commission_rate')} />
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

export function PlatformTable({ data }: { data: Row[] }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" platformunu silmek istediğinize emin misiniz?`)) return;
    await softDeletePlatform(id);
    toast.success('Platform silindi');
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> Yeni Platform
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Platform</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Komisyon</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length ? data.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-medium">{p.name}</TableCell>
              <TableCell><span className="font-mono text-xs text-muted-foreground">{p.slug}</span></TableCell>
              <TableCell>%{p.commission_rate}</TableCell>
              <TableCell>
                <button onClick={() => togglePlatformActive(p.id, !p.is_active)}>
                  <Badge variant={p.is_active ? 'success' : 'secondary'}>{p.is_active ? 'Aktif' : 'Pasif'}</Badge>
                </button>
              </TableCell>
              <TableCell className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" onClick={() => { setEditing(p); setFormOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id, p.name)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          )) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Platform bulunamadı.</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <PlatformForm open={formOpen} onOpenChange={setFormOpen} platform={editing as any} />
    </div>
  );
}
