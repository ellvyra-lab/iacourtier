export type CentrisStatus = "not_configured" | "pending_authorization" | "officially_connected" | "error";
export type CentrisCapability = "searchListings" | "getListing" | "getReferenceTables";
export type CentrisConnection = {
  status: CentrisStatus;
  label: string;
  message: string;
  capabilities: CentrisCapability[];
};
export interface CentrisProvider {
  getConnectionStatus(): Promise<CentrisConnection>;
  searchListings(query: Record<string, string>): Promise<ReadonlyArray<Record<string, unknown>>>;
  getListing(id: string): Promise<Record<string, unknown>>;
  getReferenceTables(): Promise<Record<string, unknown>>;
}
export const unconfiguredCentris: CentrisConnection = {
  status: "not_configured",
  label: "Non configuré",
  message: "Intégration officielle à configurer. Aucun accès Centris autorisé n’est actuellement disponible dans IACourtier.",
  capabilities: [],
};
