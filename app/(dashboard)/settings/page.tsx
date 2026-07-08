import { getSettings, listCategories, listSeries, listProfiles } from './actions';
import { SettingsView } from './settings-view';

export default async function SettingsPage() {
  const [settings, categories, series, profiles] = await Promise.all([
    getSettings(),
    listCategories(),
    listSeries(),
    listProfiles(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Ayarlar</h1>
        <p className="text-sm text-muted-foreground">Firma bilgileri, kategoriler, seriler ve kullanıcı rolleri</p>
      </div>
      <SettingsView settings={settings} categories={categories} series={series} profiles={profiles} />
    </div>
  );
}
