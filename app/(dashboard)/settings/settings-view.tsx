'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Plus, X, Download, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  updateSettings, createSeries, deleteSeries, updateProfileRole,
  getBackupData, restoreBackup, resetAllData,
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


function BackupCard() {
  const [busy, setBusy] = useState<'backup' | 'restore' | 'reset' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setBusy('backup');
    try {
      const data = await getBackupData();
      const totalRows = Object.values(data.tables).reduce((s, rows) => s + rows.length, 0);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yonga-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Yedek indirildi (${totalRows} kayıt)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yedek alınamadı');
    } finally {
      setBusy(null);
    }
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!payload?.tables) {
        toast.error('Geçersiz yedek dosyası');
        return;
      }
      const totalRows = Object.values(payload.tables as Record<string, unknown[]>).reduce(
        (s: number, rows) => s + (Array.isArray(rows) ? rows.length : 0), 0
      );
      if (!confirm(
        `DİKKAT: Geri yükleme MEVCUT TÜM VERİYİ SİLER ve yedekteki ${totalRows} kaydı yükler.\n\n` +
        `Yedek tarihi: ${payload.exported_at ?? 'bilinmiyor'}\n\nDevam etmek istiyor musunuz?`
      )) return;
      setBusy('restore');
      const result = await restoreBackup(payload);
      const restored = Object.values(result.counts).reduce((s, n) => s + n, 0);
      toast.success(`Geri yükleme tamamlandı: ${restored} kayıt yüklendi`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Geri yükleme başarısız');
    } finally {
      setBusy(null);
      e.target.value = '';
    }
  };

  const handleReset = async () => {
    const answer = prompt(
      'DİKKAT: Bu işlem tüm ürünleri, siparişleri, iadeleri, üretim emirlerini, stok hareketlerini, ' +
      'giderleri ve müşterileri KALICI olarak siler.\n' +
      'Kategoriler, seriler, platformlar, gider kategorileri ve firma ayarları korunur.\n\n' +
      'Sıfırlamadan önce yedek almanız önerilir.\n\nOnaylamak için büyük harflerle SIFIRLA yazın:'
    );
    if (answer === null) return;
    if (answer.trim() !== 'SIFIRLA') {
      toast.error('Onay metni eşleşmedi, işlem iptal edildi');
      return;
    }
    setBusy('reset');
    try {
      await resetAllData();
      toast.success('Tüm operasyonel veriler sıfırlandı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Sıfırlama başarısız');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">Yedekleme ve Sıfırlama</CardTitle>
        <p className="text-sm text-muted-foreground">
          Yedek dosyası (.json) tüm verileri içerir: ürünler, siparişler, iadeler, üretim, stok hareketleri,
          giderler, müşteriler, tanımlar ve ayarlar.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleBackup} disabled={busy !== null}>
            {busy === 'backup' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
            Yedek İndir
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy !== null}>
            {busy === 'restore' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
            Yedekten Geri Yükle
          </Button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleRestoreFile} />
        </div>

        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="h-4 w-4" /> Tehlikeli Bölge
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Sıfırlama tüm operasyonel verileri kalıcı olarak siler (tanımlar ve ayarlar korunur).
            Geri yükleme ise mevcut her şeyi silip yedekteki verileri yükler. İki işlem de geri alınamaz —
            önce mutlaka yedek alın.
          </p>
          <Button variant="destructive" onClick={handleReset} disabled={busy !== null}>
            {busy === 'reset' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-1.5 h-4 w-4" />}
            Tüm Verileri Sıfırla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsView({
  settings, series, profiles,
}: {
  settings: Row | null;
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
          title="Seriler"
          items={series}
          onAdd={createSeries}
          onDelete={deleteSeries}
          placeholder="Yeni seri adı"
        />
        <BackupCard />
      </div>
    </div>
  );
}
