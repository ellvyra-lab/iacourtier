import { ClientCaseWorkspace } from "@/components/client-case-workspace";

export default async function ClientCasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ import?: string; add?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  return <ClientCaseWorkspace caseId={id} importCompleted={query.import === "automatic"} addDocument={query.add === "document"} />;
}

