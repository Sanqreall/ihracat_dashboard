import { listPlatforms } from './actions';
import { PlatformTable } from './platform-table';

export default async function PlatformsPage() {
  const platforms = await listPlatforms();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Platformlar</h1>
        <p className="text-sm text-muted-foreground">Satış yapılan pazaryerleri ve komisyon oranları</p>
      </div>
      <PlatformTable data={platforms ?? []} />
    </div>
  );
}
