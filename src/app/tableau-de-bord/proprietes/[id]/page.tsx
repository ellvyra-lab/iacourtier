import { PropertyWorkspace } from "@/components/property-workspace";

export default async function PropertyPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; fromLabel?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const returnHref = query.from?.startsWith("/tableau-de-bord/") && !query.from.startsWith("//") ? query.from : undefined;
  const returnLabel = query.fromLabel?.slice(0, 80);
  return <PropertyWorkspace propertyId={id} returnHref={returnHref} returnLabel={returnLabel} />;
}
