import { LocalMandatePage } from "@/components/local-mandate-page";

type LocalMandateRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function LocalMandateRoute({ params }: LocalMandateRouteProps) {
  const { id } = await params;
  return <LocalMandatePage id={id} />;
}
