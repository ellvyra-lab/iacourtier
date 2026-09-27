import "server-only";
import { unconfiguredCentris, type CentrisProvider } from "@/lib/centris/provider";

// No adapter is activated by a flag or by possession of a broker password.
// An authorized future adapter must implement this interface and bind credentials
// to the authenticated owner, then verify access before reporting connected.
class UnconfiguredCentrisProvider implements CentrisProvider {
  async getConnectionStatus() { return { ...unconfiguredCentris, capabilities: [] }; }
  async searchListings(): Promise<never> { throw new Error(unconfiguredCentris.message); }
  async getListing(): Promise<never> { throw new Error(unconfiguredCentris.message); }
  async getReferenceTables(): Promise<never> { throw new Error(unconfiguredCentris.message); }
}
export function centrisProvider(userId: string): CentrisProvider {
  if (!userId) throw new Error("Authentification requise.");
  return new UnconfiguredCentrisProvider();
}
