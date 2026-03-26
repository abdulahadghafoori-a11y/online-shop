import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart2,
  Box,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getCachedUsdAfnRate } from "@/lib/exchangeRates";
import { CurrencyProvider } from "@/components/dashboard/CurrencyProvider";
import { CurrencySwitcher } from "@/components/dashboard/CurrencySwitcher";
import { Button } from "@/components/ui/button";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/purchases", label: "Purchases", icon: Truck },
  { href: "/dashboard/inventory", label: "Inventory", icon: Box },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart2 },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
];

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
    getCachedUsdAfnRate(),
  ]);
  const amountBaseCurrency = getAmountBaseCurrency();

  return (
    <CurrencyProvider
      initialCurrency={displayCurrency}
      amountBaseCurrency={amountBaseCurrency}
      fx={fx}
    >
      <div className="flex min-h-screen bg-muted/20">
        <aside className="flex w-60 flex-col border-r border-border bg-card">
          <div className="border-b border-border px-6 py-5">
            <span className="text-lg font-semibold tracking-tight">Sales OS</span>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 p-3">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
          <CurrencySwitcher />
          <div className="border-t border-border p-3">
            <form action="/api/auth/signout" method="post">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        </aside>
        <main className="flex-1 overflow-auto p-8">{children}</main>
      </div>
    </CurrencyProvider>
  );
}
