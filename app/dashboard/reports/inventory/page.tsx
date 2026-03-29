import { InventoryReportTable } from "@/components/dashboard/InventoryReportTable";

export default function InventoryReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Inventory reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Stock valuation from weighted average cost and movement activity in
          the chosen window.
        </p>
      </div>
      <InventoryReportTable />
    </div>
  );
}
