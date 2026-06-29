import { LocalMarketAnalysisPage } from "@/components/local-market-analysis-page";

type LocalAnalyseComparativePageProps = {
  params: Promise<{ id: string }>;
};

export default async function LocalAnalyseComparativePage({ params }: LocalAnalyseComparativePageProps) {
  const { id } = await params;
  return <LocalMarketAnalysisPage id={id} />;
}
