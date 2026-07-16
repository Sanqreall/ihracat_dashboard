import { listOrders } from '../actions';
import { listPlatformsLite } from '../../platforms/actions';
import { BulkEditView } from './bulk-edit-view';

export default async function OrdersBulkEditPage() {
  const [orders, platforms] = await Promise.all([listOrders(), listPlatformsLite()]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Toplu Sipariş Düzenleme</h1>
        <p className="text-sm text-muted-foreground">
          Hücrelere doğrudan girerek düzenleyin. Değişen satırlar işaretlenir; kaydedene kadar hiçbir şey yazılmaz.
        </p>
      </div>
      <BulkEditView orders={orders ?? []} platforms={platforms ?? []} />
    </div>
  );
}
