import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const sections: { href: string; title: string; description: string }[] = [
  {
    href: "/dashboard/reports/orders",
    title: "Orders",
    description:
      "Per-order P&L: revenue, COGS from snapshots, delivery, allocated ads.",
  },
  {
    href: "/dashboard/reports/products",
    title: "Products",
    description: "SKU-level sales, cost, and profit for the period.",
  },
  {
    href: "/dashboard/reports/campaigns",
    title: "Campaigns",
    description: "Spend, attributed revenue, ROAS, and CPA by campaign.",
  },
  {
    href: "/dashboard/reports/inventory",
    title: "Inventory",
    description: "WAC valuation, on-hand by SKU, and movement totals in range.",
  },
  {
    href: "/dashboard/reports/purchases",
    title: "Purchases",
    description: "Purchase orders created in the range with cost rollups.",
  },
];

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Profit and operations views use book amounts in{" "}
          <code className="text-xs">AMOUNT_BASE_CURRENCY</code>. The sidebar
          currency is for display only.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="group block">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {s.description}
                  </CardDescription>
                </div>
                <ArrowRight className="text-muted-foreground size-4 shrink-0 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
