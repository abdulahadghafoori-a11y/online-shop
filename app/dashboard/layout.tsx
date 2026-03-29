import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";
import { CurrencyProvider } from "@/components/dashboard/CurrencyProvider";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [displayCurrency, fx] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
  ]);
  const amountBaseCurrency = getAmountBaseCurrency();

  return (
    <CurrencyProvider
      initialCurrency={displayCurrency}
      amountBaseCurrency={amountBaseCurrency}
      fx={fx}
    >
      <div className="flex min-h-screen bg-muted/20">
        <DashboardSidebar />
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </CurrencyProvider>
  );
}
