import { listBanks } from './actions';
import { BankTable } from './bank-table';
export const dynamic = 'force-dynamic';
export default async function BankAccountsPage() {
  const banks = await listBanks();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Banka Hesapları</h1>
        <p className="text-sm text-muted-foreground">Tahsilatlarda kullanılan banka hesapları</p>
      </div>
      <BankTable data={banks} />
    </div>
  );
}
