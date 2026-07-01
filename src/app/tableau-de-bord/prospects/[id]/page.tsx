import { ProspectDetail } from "@/components/sonia-beta/prospect-detail";

export default function ProspectDetailPage({ params }: { params: { id: string } }) {
  return <ProspectDetail id={params.id} />;
}
