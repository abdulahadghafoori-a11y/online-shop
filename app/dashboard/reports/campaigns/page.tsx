import { CampaignReportTable } from "@/components/dashboard/CampaignReportTable";

export default function CampaignReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Campaign reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Performance by campaign for the selected dates.
        </p>
      </div>
      <CampaignReportTable />
    </div>
  );
}
