import { IntelligentJourney } from "@/components/intelligent-journey";

type JourneyPageProps = {
  params: Promise<{ journey: string }>;
};

export default async function JourneyPage({ params }: JourneyPageProps) {
  const { journey } = await params;
  return <IntelligentJourney slug={journey} />;
}
