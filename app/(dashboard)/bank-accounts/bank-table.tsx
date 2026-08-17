'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { bankSchema, type BankInput, CURRENCIES } from '@/lib/validations/bank';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { createBank, updateBank, softDeleteBank } from './actions';

type Row = Record<string, any>;
const selectClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

function BankForm({ open, onOpenChange, bank }: { open: boolean; onOpenChange: (o: boolean) => void; bank?: Row | null }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<BankInput>({
    resolver: zodResolver(bankSchema), defaultValues: { currency: 'USD' },
  });
  useEffect(() => {
    if (!open) return;
    reset(bank ? {
      name: bank.name, bank_name: bank.bank_name ?? '', account_number: bank.account_number ?? '',
      iban: bank.iban ?? '', swift: bank.swift ?? '', currency: bank.currency ?? 'USD', notes: bank.notes ?? '',
    } : { currency: 'USD' });
  }, [open, bank, reset]);

  const onSubmit = async (v: BankInput) => {
    try {
      if (bank?.id) { await updateBank(bank.id, v); toast.success('Hesap güncellendi'); }
      else { await createBank(v); toast.success('Hesap eklendi'); }
      onOpenChange(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{bank ? 'Hesabı Düzenle' : 'Yeni Banka Hesabı'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5"><Label>Hesap Adı *</Label><Input {...register('name')} />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
          <div className="space-y-1.5"><Label>Banka</Label><Input {...register('bank_name')} /></div>
          <div className="space-y-1.5"><Label>Para Birimi</Label><select className={selectClass} {...register('currency')}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="space-y-1.5"><Label>Hesap No</Label><Input {...register('account_number')} /></div>
          <div className="space-y-1.5"><Label>SWIFT</Label><Input {...register('swift')} /></div>
          <div className="col-span-2 space-y-1.5"><Label>IBAN</Label><Input {...register('iban')} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Notlar</Label><Input {...register('notes')} /></div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>İptal</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function BankTable({ data }: { data: Row[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);

  const remove = async (id: string) => {
    if (!confirm('Hesap silinsin mi?')) return;
    try { await softDeleteBank(id); toast.success('Silindi'); } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="mr-1.5 h-4 w-4" /> Yeni Hesap</Button>
      </div>
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hesap Adı</TableHead><TableHead>Banka</TableHead><TableHead>IBAN</TableHead>
              <TableHead>Para Br.</TableHead><TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length ? data.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.name}</TableCell>
                <TableCell>{b.bank_name ?? '—'}</TableCell>
                <TableCell className="font-mono text-xs">{b.iban ?? '—'}</TableCell>
                <TableCell>{b.currency}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )) : (
              <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Banka hesabı yok. Yeni bir hesap ekleyin.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <BankForm open={open} onOpenChange={setOpen} bank={editing} />
    </div>
  );
}
