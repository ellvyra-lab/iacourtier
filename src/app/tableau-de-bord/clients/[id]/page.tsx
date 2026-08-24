import { Client360Workspace } from "@/components/client-360-workspace";

export default async function Client360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Client360Workspace clientId={id} />;
}
