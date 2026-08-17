'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Check, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { upsertRate, deleteRate } from './actions';

type Row = Record<string, any>;

export function RatesTable({ data }: { data: Row[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [newCur, setNewCur] = useState('');
  const [newRate, setNewRate] = useState('');

  const save = async (currency: string, value: string) => {
    const n = parseFloat(value);
    if (!(n > 0)) { toast.error('Geçerli bir kur girin'); return; }
    try { await upsertRate(currency, n); setEditing(null); toast.success(`${currency} kuru güncellendi`); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const add = async () => {
    const n = parseFloat(newRate);
    try { await upsertRate(newCur, n); setNewCur(''); setNewRate(''); toast.success('Kur eklendi'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const remove = async (currency: string) => {
    if (!confirm(`${currency} kuru silinsin mi?`)) return;
    try { await deleteRate(currency); toast.success('Silindi'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="mb-2 text-sm font-medium">Yeni / güncelle</p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Para Birimi</Label>
            <Input value={newCur} onChange={(e) => setNewCur(e.target.value.toUpperCase())} placeholder="EUR" maxLength={3} className="w-24 uppercase" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">1 birim = ? USD</Label>
            <Input value={newRate} onChange={(e) => setNewRate(e.target.value)} placeholder="1.15" type="number" step="0.0001" className="w-36" />
          </div>
          <Button size="sm" onClick={add} disabled={!newCur || !newRate}><Plus className="mr-1.5 h-4 w-4" /> Kaydet</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Kur, <b>1 birim dövizin USD karşılığı</b>dır (örn. EUR = 1.15). Raporlar ve panel bu kuru kullanır.</p>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Para Birimi</TableHead>
              <TableHead className="text-right">USD Karşılığı</TableHead>
              <TableHead>Kaynak</TableHead>
              <TableHead>Güncelleme</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.currency}>
                <TableCell className="font-mono font-semibold">{r.currency}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {editing === r.currency ? (
                    <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} type="number" step="0.0001" className="ml-auto w-32 text-right" autoFocus />
                  ) : (
                    Number(r.rate_to_usd).toLocaleString('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.source ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{r.last_update ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {editing === r.currency ? (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => save(r.currency, editVal)}><Check className="h-4 w-4 text-green-600" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => { setEditing(r.currency); setEditVal(String(r.rate_to_usd)); }}><Pencil className="h-4 w-4" /></Button>
                        {r.currency !== 'USD' && <Button variant="ghost" size="icon" onClick={() => remove(r.currency)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
