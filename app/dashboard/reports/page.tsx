import { CampaignReportTable } from "@/components/dashboard/CampaignReportTable";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">
          Campaign profit from the{" "}
          <code className="text-xs">campaignprofitreport</code> RPC (spend vs
          revenue).
        </p>
      </div>
      <CampaignReportTable />
    </div>
  );
}
