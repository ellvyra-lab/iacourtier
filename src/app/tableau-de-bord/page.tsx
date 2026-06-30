import { ActionCenterDashboard } from "@/components/action-center-dashboard";
import { buildActionCenterData } from "@/lib/action-center";

export default function DashboardOverviewPage() {
  const data = buildActionCenterData();

  return <ActionCenterDashboard data={data} />;
}
