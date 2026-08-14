import { SellerListingWorkspace } from "@/components/seller-listing-workspace";

type PageProps = { params: Promise<{ id: string }> };

export default async function SellerListingPage({ params }: PageProps) {
  const { id } = await params;
  return <SellerListingWorkspace id={id} />;
}
