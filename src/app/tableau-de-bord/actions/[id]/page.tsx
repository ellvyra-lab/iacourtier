import { notFound } from "next/navigation";

import { BusinessActionRunner } from "@/components/business-action-runner";
import { getBusinessAction, getBusinessActions } from "@/lib/business-actions";

export function generateStaticParams() {
  return getBusinessActions().map((action) => ({ id: action.id }));
}

export default function BusinessActionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const action = getBusinessAction(params.id);
  if (!action) notFound();

  return <BusinessActionRunner action={action} searchParams={searchParams} />;
}
