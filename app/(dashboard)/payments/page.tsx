import { listPayments, listOrdersForPayment, listBankAccountsLite } from './actions';
import { PaymentTable } from './payment-table';

export const dynamic = 'force-dynamic';

export default async function PaymentsPage() {
  const [payments, orders, banks] = await Promise.all([
    listPayments(), listOrdersForPayment(), listBankAccountsLite(),
  ]);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Tahsilat</h1>
        <p className="text-sm text-muted-foreground">Gerçekleşen ve bekleyen ödemeler · gecikme takibi · plandan otomatik üretim</p>
      </div>
      <PaymentTable data={payments} orders={orders} banks={banks} />
    </div>
  );
}
