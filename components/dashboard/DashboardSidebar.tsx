"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  BarChart2,
  Box,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Package,
  Receipt,
  ShoppingCart,
  Truck,
} from "lucide-react";

import { CurrencySwitcher } from "@/components/dashboard/CurrencySwitcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const mainNav: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/purchases", label: "Purchases", icon: Truck },
  { href: "/dashboard/inventory", label: "Inventory", icon: Box },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/expenses", label: "Expenses", icon: Receipt },
];

const reportChildren: { href: string; label: string }[] = [
  { href: "/dashboard/reports", label: "Overview" },
  { href: "/dashboard/reports/orders", label: "Orders" },
  { href: "/dashboard/reports/products", label: "Products" },
  { href: "/dashboard/reports/campaigns", label: "Campaigns" },
  { href: "/dashboard/reports/inventory", label: "Inventory" },
  { href: "/dashboard/reports/purchases", label: "Purchases" },
];

function linkActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/dashboard/reports") {
    return pathname === "/dashboard/reports";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const reportsSectionActive = pathname?.startsWith("/dashboard/reports") ?? false;
  const [reportsOpen, setReportsOpen] = useState(reportsSectionActive);

  const reportsExpanded = useMemo(
    () => reportsOpen || reportsSectionActive,
    [reportsOpen, reportsSectionActive],
  );

  return (
    <aside className="flex w-60 flex-col border-r border-border bg-card">
      <div className="border-b border-border px-6 py-5">
        <span className="text-lg font-semibold tracking-tight">Sales OS</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {mainNav.map(({ href, label, icon: Icon }) => {
          const active = linkActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {label}
            </Link>
          );
        })}

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setReportsOpen((o) => !o)}
            aria-expanded={reportsExpanded}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              reportsSectionActive
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {reportsExpanded ? (
              <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden />
            ) : (
              <ChevronRight className="size-4 shrink-0 opacity-70" aria-hidden />
            )}
            <BarChart2 className="size-4 shrink-0" aria-hidden />
            Reports
          </button>

          {reportsExpanded ? (
            <div className="mt-1 ml-2 flex flex-col gap-0.5 border-l border-border pl-3">
              {reportChildren.map((child) => {
                const active = linkActive(pathname, child.href);
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "rounded-md px-2 py-1.5 text-xs transition-colors",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {child.label}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>
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
  );
}
