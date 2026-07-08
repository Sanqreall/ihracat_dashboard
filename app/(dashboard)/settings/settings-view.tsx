'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  updateSettings, createCategory, deleteCategory, createSeries, deleteSeries, updateProfileRole,
  type SettingsInput,
} from './actions';

type Row = Record<string, any>;

const ROLE_LABEL: Record<string, string> = { admin: 'Yönetici', manager: 'Müdür', employee: 'Çalışan' };

function CompanyCard({ settings }: { settings: Row | null }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<SettingsInput>({
    defaultValues: {
      company_name: settings?.company_name ?? 'Yonga',
      default_currency: settings?.default_currency ?? 'TRY',
      default_tax_rate: Number(settings?.default_tax_rate ?? 10),
      shipping_price_per_desi: Number(settings?.shipping_price_per_desi ?? 0),
    },
  });

  const onSubmit = async (values: SettingsInput) => {
    try {
      await updateSettings(values);
      toast.success('Ayarlar kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bir hata oluştu');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-semibold text-foreground">Firma Bilgileri</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Firma Adı</Label>
            <Input {...register('company_name')} />
          </div>
          <div className="space-y-1.5">
            <Label>Para Birimi</Label>
            <Input {...register('default_currency')} placeholder="TRY" />
          </div>
          <div className="space-y-1.5">
            <Label>Varsayılan KDV (%)</Label>
            <Input type="number" step="0.01" {...register('default_tax_rate')} />
          </div>
          <div className="space-y-1.5">
            <Label>Desi Başına Kargo Ücreti</Label>
            <Input type="number" step="0.01" {...register('shipping_price_per_desi')} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Kaydediliyor…' : 'Kaydet'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TagManagerCard({
  title, items, onAdd, onDelete, placeholder,
}: {
  title: string;
  items: Row[];
  onAdd: (name: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  placeholder: string;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    if (!value.trim()) return;
    setBusy(true);
    try {
      await onAdd(value.trim());
      setValue('');
      toast.success('Eklendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ekleme başarısız');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`"${name}" silinsin mi? (Ürünlerdeki bağlantı korunur, listelerden kaldırılır)`)) return;
    try {
      await onDelete(id);
      toast.success('Silindi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme başarısız');
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdd(); } }}
          />
          <Button onClick={handleAdd} disabled={busy} size="icon"><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {items.length ? items.map((item) => (
            <Badge key={item.id} variant="outline" className="gap-1.5 py-1 pl-3 pr-1.5">
              {item.name}
              <button onClick={() => handleDelete(item.id, item.name)} className="rounded-full p-0.5 hover:bg-destructive/10">
                <X className="h-3 w-3 text-destructive" />
              </button>
            </Badge>
          )) : (
            <span className="text-sm text-muted-foreground">Henüz kayıt yok.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function UsersCard({ profiles }: { profiles: Row[] }) {
  const handleRoleChange = async (id: string, role: string) => {
    try {
      await updateProfileRole(id, role as 'admin' | 'manager' | 'employee');
      toast.success('Rol güncellendi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Rol güncellenemedi');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">Kullanıcılar</CardTitle>
        <p className="text-sm text-muted-foreground">
          Yeni kullanıcı eklemek için Supabase panelinden Authentication → Users → Add user kullanın.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {profiles.length ? profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="text-sm font-medium">{p.full_name ?? '—'}</div>
              <div className="text-xs text-muted-foreground">{p.is_active ? 'Aktif' : 'Pasif'}</div>
            </div>
            <div className="w-40">
              <Select value={p.role} onValueChange={(v) => handleRoleChange(p.id, v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )) : (
          <span className="text-sm text-muted-foreground">Kullanıcı bulunamadı.</span>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsView({
  settings, categories, series, profiles,
}: {
  settings: Row | null;
  categories: Row[];
  series: Row[];
  profiles: Row[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="space-y-4">
        <CompanyCard settings={settings} />
        <UsersCard profiles={profiles} />
      </div>
      <div className="space-y-4">
        <TagManagerCard
          title="Kategoriler"
          items={categories}
          onAdd={createCategory}
          onDelete={deleteCategory}
          placeholder="Yeni kategori adı"
        />
        <TagManagerCard
          title="Seriler"
          items={series}
          onAdd={createSeries}
          onDelete={deleteSeries}
          placeholder="Yeni seri adı"
        />
      </div>
    </div>
  );
}
