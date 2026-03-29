import { ProductReportTable } from "@/components/dashboard/ProductReportTable";

export default function ProductReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Product reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Units sold and margin by SKU (non-cancelled orders).
        </p>
      </div>
      <ProductReportTable />
    </div>
  );
}
