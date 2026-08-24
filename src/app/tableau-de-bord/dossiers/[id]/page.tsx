import { ClientCaseWorkspace } from "@/components/client-case-workspace";

export default async function ClientCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClientCaseWorkspace caseId={id} />;
}
