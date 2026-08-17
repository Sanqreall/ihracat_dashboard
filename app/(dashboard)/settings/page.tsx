import { getSettings } from './actions';
import { SettingsForm } from './settings-form';
export const dynamic = 'force-dynamic';
export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Ayarlar</h1>
        <p className="text-sm text-muted-foreground">Firma bilgileri ve varsayılanlar (PDF çıktılarında da kullanılabilir)</p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
