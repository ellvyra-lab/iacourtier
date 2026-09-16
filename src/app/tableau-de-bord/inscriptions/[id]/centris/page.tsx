import { CentrisPreparationWorkspace } from "@/components/centris-preparation-workspace";

export default async function CentrisPreparationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CentrisPreparationWorkspace listingId={id} />;
}
