import { IntelligentPipelineDashboard } from "@/components/intelligent-pipeline-dashboard";
import { buildPipelineDashboardData } from "@/lib/pipeline-intelligence";

export default function PipelinePage() {
  return <IntelligentPipelineDashboard data={buildPipelineDashboardData()} />;
}
