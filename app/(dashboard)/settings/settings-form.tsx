'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { saveSettings, type CompanySettings } from './actions';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'TRY'];
const INCOTERMS = ['EXW', 'FCA', 'FOB', 'CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
const selectClass = 'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export function SettingsForm({ initial }: { initial: CompanySettings }) {
  const [form, setForm] = useState<CompanySettings>(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof CompanySettings, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try { await saveSettings(form); toast.success('Ayarlar kaydedildi'); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Firma Bilgileri</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5"><Label>Firma Adı</Label><Input value={form.company_name ?? ''} onChange={(e) => set('company_name', e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5"><Label>Adres</Label><Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Vergi No</Label><Input value={form.tax_number ?? ''} onChange={(e) => set('tax_number', e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Telefon</Label><Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></div>
          <div className="col-span-2 space-y-1.5"><Label>E-posta</Label><Input value={form.email ?? ''} onChange={(e) => set('email', e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Varsayılanlar</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Varsayılan Para Birimi</Label>
            <select className={selectClass} value={form.default_currency ?? 'USD'} onChange={(e) => set('default_currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Varsayılan Incoterm</Label>
            <select className={selectClass} value={form.default_incoterm ?? ''} onChange={(e) => set('default_incoterm', e.target.value)}>
              <option value="">—</option>
              {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </div>
  );
}
