import { OrdersReportTable } from "@/components/dashboard/OrdersReportTable";

export default function OrderReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Order reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          One row per order with full contribution margin after delivery and
          allocated ad spend.
        </p>
      </div>
      <OrdersReportTable />
    </div>
  );
}
