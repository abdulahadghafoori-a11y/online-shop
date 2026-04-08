import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";
import { formatDbMoney } from "@/lib/formatDbMoney";
import { ExpenseForm } from "@/components/dashboard/ExpenseForm";
import { ExpenseTable } from "@/components/dashboard/ExpenseTable";
import { CategoryManager } from "@/components/dashboard/CategoryManager";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type ExpenseRow = {
  id: string;
  category: string;
  amount: string;
  date: string;
  notes: string | null;
  amountFormatted: string;
};

export type CategoryOption = {
  id: string;
  name: string;
};

export default async function ExpensesPage() {
  const supabase = await createClient();
  const [currency, fx] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
  ]);
  const amountBase = getAmountBaseCurrency();
  const money = (n: number) => formatDbMoney(n, currency, amountBase, fx);

  const [{ data: expenses }, { data: categories }] = await Promise.all([
    supabase
      .from("expenses")
      .select("id, category, amount, date, notes")
      .order("date", { ascending: false })
      .limit(100),
    supabase
      .from("expense_categories")
      .select("id, name")
      .order("name"),
  ]);

  const rows: ExpenseRow[] = (expenses ?? []).map((e) => ({
    id: e.id as string,
    category: e.category as string,
    amount: String(e.amount),
    date: e.date as string,
    notes: (e.notes as string | null) ?? null,
    amountFormatted: money(Number(e.amount)),
  }));

  const cats: CategoryOption[] = (categories ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground text-sm">
          Operational costs (separate from ad spend).
        </p>
      </div>

      <ExpenseForm categories={cats} />

      <details className="group">
        <summary className="text-muted-foreground cursor-pointer text-sm font-medium hover:text-foreground">
          Manage categories
        </summary>
        <div className="mt-3">
          <CategoryManager categories={cats} />
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>Recent expenses</CardTitle>
          <CardDescription>Latest 100 rows.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExpenseTable expenses={rows} categories={cats} />
        </CardContent>
      </Card>
    </div>
  );
}
