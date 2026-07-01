import { ProspectingCoachDashboard } from "@/components/prospecting-coach-dashboard";

type CoachPageProps = {
  searchParams?: {
    scenario?: string;
  };
};

export default function CoachPage({ searchParams }: CoachPageProps) {
  return <ProspectingCoachDashboard initialScenario={searchParams?.scenario} />;
}
