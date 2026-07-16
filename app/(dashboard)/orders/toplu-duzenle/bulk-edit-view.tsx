'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Save, X, Search, Wand2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchSelect } from '@/components/ui/search-select';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { TURKEY_PROVINCES } from '@/lib/provinces';
import {
  ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, SHIPMENT_STATUS_OPTIONS,
} from '@/lib/order-constants';
import { bulkUpdateOrders, type BulkOrderPatch } from '../actions';

type Platform = { id: string; name: string };

/** Düzenlenebilir alanlar (kalemler hariç). */
type EditableRow = {
  id: string;
  order_number: string;
  order_date: string;
  platform_id: string;
  delivery_province: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: string;
  payment_status: string;
  shipment_status: string;
  invoice_number: string;
  tracking_number: string;
  notes: string;
};

const EDITABLE_KEYS: (keyof Omit<EditableRow, 'id' | 'order_number'>)[] = [
  'order_date', 'platform_id', 'delivery_province', 'customer_name', 'customer_phone',
  'customer_address', 'status', 'payment_status', 'shipment_status',
  'invoice_number', 'tracking_number', 'notes',
];

function toRow(o: any): EditableRow {
  return {
    id: o.id,
    order_number: o.order_number,
    order_date: String(o.order_date ?? '').slice(0, 10),
    platform_id: o.platform_id ?? '',
    delivery_province: o.delivery_province ?? null,
    customer_name: o.customers?.name ?? '',
    customer_phone: o.customers?.phone ?? '',
    customer_address: o.shipping_address ?? '',
    status: o.status ?? 'confirmed',
    payment_status: o.payment_status ?? 'unpaid',
    shipment_status: o.shipment_status ?? 'pending',
    invoice_number: o.invoice_number ?? '',
    tracking_number: o.tracking_number ?? '',
    notes: o.notes ?? '',
  };
}

export function BulkEditView({ orders, platforms }: { orders: any[]; platforms: Platform[] }) {
  const original = useMemo(() => orders.map(toRow), [orders]);
  const originalById = useMemo(() => new Map(original.map((r) => [r.id, r])), [original]);

  const [rows, setRows] = useState<EditableRow[]>(original);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const platformName = useMemo(() => new Map(platforms.map((p) => [p.id, p.name])), [platforms]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase('tr');
    if (!q) return rows;
    return rows.filter((r) =>
      r.order_number.toLocaleLowerCase('tr').includes(q) ||
      r.customer_name.toLocaleLowerCase('tr').includes(q) ||
      (r.delivery_province ?? '').toLocaleLowerCase('tr').includes(q)
    );
  }, [rows, filter]);

  // Değişen satırları tespit et
  const isDirty = (r: EditableRow) => {
    const o = originalById.get(r.id);
    if (!o) return false;
    return EDITABLE_KEYS.some((k) => (r[k] ?? '') !== (o[k] ?? ''));
  };
  const dirtyRows = useMemo(() => rows.filter(isDirty), [rows]);

  const setCell = (id: string, key: keyof EditableRow, value: string | null) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleSelectAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((r) => next.delete(r.id));
      else filtered.forEach((r) => next.add(r.id));
      return next;
    });

  const resetAll = () => {
    setRows(original);
    setSelected(new Set());
    toast.info('Değişiklikler geri alındı');
  };

  const save = async () => {
    if (!dirtyRows.length) { toast.info('Kaydedilecek değişiklik yok'); return; }
    setSaving(true);
    try {
      const patches: BulkOrderPatch[] = dirtyRows.map((r) => {
        const o = originalById.get(r.id)!;
        const patch: BulkOrderPatch = { id: r.id };
        for (const k of EDITABLE_KEYS) {
          if ((r[k] ?? '') !== (o[k] ?? '')) {
            (patch as any)[k] = r[k];
          }
        }
        return patch;
      });

      const result = await bulkUpdateOrders(patches);
      if (result.errors.length) {
        toast.warning(`${result.updated} sipariş güncellendi · ${result.errors.length} hata: ${result.errors.slice(0, 2).join('; ')}`);
      } else {
        toast.success(`${result.updated} sipariş güncellendi`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const th = 'whitespace-nowrap px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground';
  const td = 'px-1.5 py-1 align-top';

  return (
    <div className="space-y-4">
      {/* Araç çubuğu */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Sipariş no, müşteri, il ara…"
            className="h-9 w-64 pl-8"
          />
        </div>
        <Button variant="outline" size="sm" disabled={!selected.size} onClick={() => setBulkOpen((v) => !v)}>
          <Wand2 className="mr-1.5 h-4 w-4" /> Seçili {selected.size} siparişe uygula
        </Button>
        <div className="ml-auto flex items-center gap-2">
          {dirtyRows.length > 0 && (
            <>
              <span className="text-sm text-warning">{dirtyRows.length} değişiklik</span>
              <Button variant="ghost" size="sm" onClick={resetAll}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Geri Al
              </Button>
            </>
          )}
          <Button size="sm" disabled={saving || !dirtyRows.length} onClick={save}>
            <Save className="mr-1.5 h-4 w-4" /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      </div>

      {/* Toplu uygulama paneli */}
      {bulkOpen && selected.size > 0 && (
        <BulkApplyPanel
          count={selected.size}
          platforms={platforms}
          onApply={(key, value) => {
            setRows((prev) => prev.map((r) => (selected.has(r.id) ? { ...r, [key]: value } : r)));
            toast.success(`${selected.size} siparişe uygulandı`);
          }}
          onClose={() => setBulkOpen(false)}
        />
      )}

      {/* Tablo */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className={cn(th, 'w-8')}>
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAll} className="h-4 w-4" />
              </th>
              <th className={th}>Sipariş No</th>
              <th className={th}>Tarih</th>
              <th className={th}>Platform</th>
              <th className={th}>Teslimat İli</th>
              <th className={th}>Müşteri</th>
              <th className={th}>Telefon</th>
              <th className={th}>Adres</th>
              <th className={th}>Durum</th>
              <th className={th}>Ödeme</th>
              <th className={th}>Kargo Durumu</th>
              <th className={th}>Fatura No</th>
              <th className={th}>Takip No</th>
              <th className={th}>Not</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const dirty = isDirty(r);
              return (
                <tr key={r.id} className={cn('border-b border-border/60', dirty && 'bg-warning/5', selected.has(r.id) && 'bg-accent/40')}>
                  <td className={cn(td, 'text-center')}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleSelect(r.id)} className="h-4 w-4" />
                  </td>
                  <td className={cn(td, 'whitespace-nowrap font-mono text-xs')}>
                    {r.order_number}
                    {dirty && <span className="ml-1 text-warning">•</span>}
                  </td>
                  <td className={td}>
                    <Input type="date" value={r.order_date} onChange={(e) => setCell(r.id, 'order_date', e.target.value)} className="h-8 w-[140px]" />
                  </td>
                  <td className={td}>
                    <Select value={r.platform_id || undefined} onValueChange={(v) => setCell(r.id, 'platform_id', v)}>
                      <SelectTrigger className="h-8 w-[140px]"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className={td}>
                    <div className="w-[150px]">
                      <SearchSelect
                        options={TURKEY_PROVINCES}
                        value={r.delivery_province}
                        onChange={(v) => setCell(r.id, 'delivery_province', v)}
                        placeholder="İl"
                      />
                    </div>
                  </td>
                  <td className={td}>
                    <Input value={r.customer_name} onChange={(e) => setCell(r.id, 'customer_name', e.target.value)} className="h-8 w-[150px]" />
                  </td>
                  <td className={td}>
                    <Input value={r.customer_phone} onChange={(e) => setCell(r.id, 'customer_phone', e.target.value)} className="h-8 w-[130px]" />
                  </td>
                  <td className={td}>
                    <Input value={r.customer_address} onChange={(e) => setCell(r.id, 'customer_address', e.target.value)} className="h-8 w-[200px]" />
                  </td>
                  <td className={td}>
                    <Select value={r.status} onValueChange={(v) => setCell(r.id, 'status', v)}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className={td}>
                    <Select value={r.payment_status} onValueChange={(v) => setCell(r.id, 'payment_status', v)}>
                      <SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className={td}>
                    <Select value={r.shipment_status} onValueChange={(v) => setCell(r.id, 'shipment_status', v)}>
                      <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SHIPMENT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className={td}>
                    <Input value={r.invoice_number} onChange={(e) => setCell(r.id, 'invoice_number', e.target.value)} className="h-8 w-[120px]" />
                  </td>
                  <td className={td}>
                    <Input value={r.tracking_number} onChange={(e) => setCell(r.id, 'tracking_number', e.target.value)} className="h-8 w-[130px]" />
                  </td>
                  <td className={td}>
                    <Input value={r.notes} onChange={(e) => setCell(r.id, 'notes', e.target.value)} className="h-8 w-[160px]" />
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr><td colSpan={14} className="py-10 text-center text-sm text-muted-foreground">Sipariş bulunamadı</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Not: Bir siparişi İptal'e çekmek stoğu geri verir ve otomatik giderlerini siler; İptal'den çıkarmak stoğu yeniden düşer.
        Kalemler (ürün/adet) bu ekrandan düzenlenemez — bunun için siparişi tek tek açın.
      </p>
    </div>
  );
}

/** Seçili siparişlere tek bir alanı topluca uygulama paneli. */
function BulkApplyPanel({
  count, platforms, onApply, onClose,
}: {
  count: number;
  platforms: Platform[];
  onApply: (key: keyof EditableRow, value: string | null) => void;
  onClose: () => void;
}) {
  const [field, setField] = useState<keyof EditableRow>('delivery_province');
  const [textValue, setTextValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [province, setProvince] = useState<string | null>(null);

  const apply = () => {
    if (field === 'delivery_province') { onApply(field, province); return; }
    if (field === 'platform_id') {
      if (!selectValue) return;
      onApply(field, selectValue); return;
    }
    if (field === 'status' || field === 'payment_status' || field === 'shipment_status') {
      if (!selectValue) return;
      onApply(field, selectValue); return;
    }
    onApply(field, textValue);
  };

  const FIELD_OPTIONS: { value: keyof EditableRow; label: string }[] = [
    { value: 'delivery_province', label: 'Teslimat İli' },
    { value: 'platform_id', label: 'Platform' },
    { value: 'status', label: 'Durum' },
    { value: 'payment_status', label: 'Ödeme Durumu' },
    { value: 'shipment_status', label: 'Kargo Durumu' },
    { value: 'order_date', label: 'Tarih' },
    { value: 'invoice_number', label: 'Fatura No' },
    { value: 'tracking_number', label: 'Takip No' },
    { value: 'notes', label: 'Not' },
  ];

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="space-y-1">
        <Label className="text-xs">Alan</Label>
        <Select value={field} onValueChange={(v) => setField(v as keyof EditableRow)}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {FIELD_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Değer</Label>
        {field === 'delivery_province' ? (
          <div className="w-[200px]">
            <SearchSelect options={TURKEY_PROVINCES} value={province} onChange={setProvince} placeholder="İl seçin" />
          </div>
        ) : field === 'platform_id' ? (
          <Select value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Platform seçin" /></SelectTrigger>
            <SelectContent>
              {platforms.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : field === 'status' ? (
          <Select value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Durum seçin" /></SelectTrigger>
            <SelectContent>
              {ORDER_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : field === 'payment_status' ? (
          <Select value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Ödeme durumu" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : field === 'shipment_status' ? (
          <Select value={selectValue} onValueChange={setSelectValue}>
            <SelectTrigger className="h-9 w-[200px]"><SelectValue placeholder="Kargo durumu" /></SelectTrigger>
            <SelectContent>
              {SHIPMENT_STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : field === 'order_date' ? (
          <Input type="date" value={textValue} onChange={(e) => setTextValue(e.target.value)} className="h-9 w-[200px]" />
        ) : (
          <Input value={textValue} onChange={(e) => setTextValue(e.target.value)} placeholder="Değer" className="h-9 w-[200px]" />
        )}
      </div>

      <Button size="sm" onClick={apply}>Seçili {count} siparişe uygula</Button>
      <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
    </div>
  );
}
