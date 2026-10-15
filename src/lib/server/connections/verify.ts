import "server-only";
import type { ConnectionService } from "@/lib/connections/types";
import { listAccounts } from "./accounts";
import { connectedProviders } from "./providers";
import { dateWindow } from "@/lib/connections/dates";

export async function verifyAccountAccess(userId: string, accountId: string, required?: ConnectionService[]) {
  const account = (await listAccounts(userId)).find(a => a.id === accountId && a.status === "connected");
  const services = required || account?.services || [];
  if (!account || !services.length || services.some(service => !account.services?.includes(service))) throw new Error("Le compte ne possède pas toutes les autorisations demandées. Reconnecte-le depuis Google ou Microsoft.");
  const p = await connectedProviders(userId,account.id), window = dateWindow("aujourd’hui");
  await Promise.all([
    ...(services.includes("email") ? [p.email.listMessages({limit:1})] : []),
    ...(services.includes("calendar") ? [p.calendar.listEvents(window.start,window.end)] : []),
    ...(services.includes("contacts") ? [p.searchContacts("",1)] : []),
  ]);
  return account;
}
