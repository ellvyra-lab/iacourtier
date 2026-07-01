import { ProspectDetail } from "@/components/sonia-beta/prospect-detail";

export default function ProspectDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { demoCall?: string };
}) {
  return <ProspectDetail id={params.id} demoCall={searchParams?.demoCall === "1"} />;
}
