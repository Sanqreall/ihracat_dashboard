import { listCustomers } from './actions';
import { CustomerTable } from './customer-table';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const customers = await listCustomers();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Müşteriler</h1>
        <p className="text-sm text-muted-foreground">Müşteri kayıtları, iletişim ve ihracat varsayılanları</p>
      </div>
      <CustomerTable data={customers} />
    </div>
  );
}
