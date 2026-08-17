import { BuyerCaseWorkspace } from "@/components/buyer-case-workspace";

export default async function BuyerCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BuyerCaseWorkspace id={id} />;
}
