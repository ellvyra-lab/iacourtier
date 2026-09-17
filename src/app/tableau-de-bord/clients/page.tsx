import { ClientsCasesDashboard, type ClientFilter } from "@/components/clients-cases-dashboard";

const allowedFilters = new Set<ClientFilter>(["all", "prospect", "buyer", "seller", "buy_sell", "transaction", "after-sale", "former"]);

export default function ClientsPage({ searchParams }: { searchParams?: { vue?: string } }) {
  const requested = searchParams?.vue || "all";
  const initialFilter = allowedFilters.has(requested as ClientFilter) ? requested as ClientFilter : "all";
  return <ClientsCasesDashboard initialFilter={initialFilter} />;
}
