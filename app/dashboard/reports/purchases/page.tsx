import { PurchasesReportTable } from "@/components/dashboard/PurchasesReportTable";

export default function PurchasesReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Purchase reports
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Purchase orders created in the date range with line and value totals.
        </p>
      </div>
      <PurchasesReportTable />
    </div>
  );
}
