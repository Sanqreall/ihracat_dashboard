import { listExpenses, listExpenseCategories } from './actions';
import { ExpensesView } from './expenses-view';

export default async function ExpensesPage() {
  const [expenses, categories] = await Promise.all([listExpenses(), listExpenseCategories()]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Giderler</h1>
        <p className="text-sm text-muted-foreground">Aylık işletme giderleri ve kategori bazlı özet</p>
      </div>
      <ExpensesView data={expenses ?? []} categories={categories} />
    </div>
  );
}
