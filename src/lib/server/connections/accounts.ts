import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ConnectedAccount, ConnectionService, Provider } from "@/lib/connections/types";

export function connectionStore() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Les connexions ne sont pas configurées sur le serveur.");
  return createSupabaseAdminClient();
}
function key() {
  const value = Buffer.from(process.env.CONNECTIONS_ENCRYPTION_KEY || "", "base64");
  if (value.length !== 32) throw new Error("La clé de chiffrement des connexions n’est pas configurée.");
  return value;
}
export function encryptTokens(value: unknown, owner: string) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner));
  return [iv, cipher.update(JSON.stringify(value), "utf8"), cipher.final(), cipher.getAuthTag()].map(b => b.toString("base64url")).join(".");
}
export function decryptTokens(value: string, owner: string): Tokens {
  const [iv, data, final, tag] = value.split(".").map(part => Buffer.from(part, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(owner)); cipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([cipher.update(Buffer.concat([data, final])), cipher.final()]).toString("utf8"));
}
type Tokens = { access_token: string; refresh_token: string; expires_at: number };
class OAuthAuthorizationError extends Error {}
export function providerName(value: string): Provider {
  if (value !== "google" && value !== "microsoft") throw new Error("Fournisseur inconnu."); return value;
}
export const scopes = {
  google: ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose", "https://www.googleapis.com/auth/calendar.events"],
  microsoft: ["openid", "email", "offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send", "Calendars.ReadWrite"],
};
const googleServiceScopes: Record<ConnectionService,string[]> = {
  email: scopes.google.filter(s => s.includes("gmail.")),
  calendar: scopes.google.filter(s => s.includes("calendar.")),
  contacts: ["https://www.googleapis.com/auth/contacts.readonly"],
};
export function authorizedServices(provider: Provider, granted: string): ConnectionService[] {
  const values = granted.toLowerCase().split(/\s+/);
  return (["email","calendar","contacts"] as const).filter(service => {
    const required = provider === "google" ? googleServiceScopes[service] : service === "email" ? ["Mail.ReadWrite","Mail.Send"] : service === "calendar" ? ["Calendars.ReadWrite"] : [];
    return required.length > 0 && required.every(s => values.includes(s.toLowerCase()) || values.includes(`https://graph.microsoft.com/${s.toLowerCase()}`));
  });
}
export function oauthConfig(provider: Provider) {
  const prefix = provider === "google" ? "GOOGLE" : "MICROSOFT";
  const clientId = process.env[`${prefix}_CLIENT_ID`], clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const origin = process.env.CONNECTIONS_APP_URL;
  if (!origin || !clientId || !clientSecret) throw new Error(`La connexion ${provider === "google" ? "Google" : "Microsoft"} doit être configurée par l’administrateur.`);
  const url = new URL(origin);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.hostname === "localhost")) throw new Error("Adresse OAuth non sécurisée.");
  const tenant = process.env.MICROSOFT_TENANT_ID || "common";
  if (!/^[a-zA-Z0-9.-]+$/.test(tenant)) throw new Error("Tenant Microsoft invalide.");
  return { clientId, clientSecret, origin: url.origin, redirectUri: `${url.origin}/api/connections/${provider}/callback`,
    authorize: provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    token: provider === "google" ? "https://oauth2.googleapis.com/token" : `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token` };
}
export function configurationReady(provider: Provider) { try { oauthConfig(provider); key(); connectionStore(); return true; } catch { return false; } }
export async function listAccounts(userId: string): Promise<ConnectedAccount[]> {
  const db = connectionStore();
  const { data, error } = await db.from("connected_accounts").select("id,provider,email,status,scopes,connected_at,reconnected_at,disconnected_at").eq("user_id", userId);
  const defaults = await db.from("connected_account_defaults").select("service,account_id").eq("user_id",userId);
  if (error || defaults.error) throw new Error("La migration des comptes connectés doit être appliquée.");
  return (data || []).map(a => ({ id:a.id,provider:a.provider,email:a.email,status:a.status,connected_at:a.connected_at,reconnected_at:a.reconnected_at,disconnected_at:a.disconnected_at,services:authorizedServices(providerName(a.provider),a.scopes || ""),defaults:(defaults.data || []).filter(d => d.account_id === a.id).map(d => d.service as ConnectionService) }));
}
export async function setDefaultAccount(userId: string, accountId: string, service: ConnectionService) {
  const account = (await listAccounts(userId)).find(a => a.id === accountId && a.status === "connected" && a.services?.includes(service));
  if (!account) throw new Error("Ce compte ne possède pas l’autorisation pour ce service.");
  const saved = await connectionStore().from("connected_account_defaults").upsert({user_id:userId,service,account_id:accountId},{onConflict:"user_id,service"});
  if (saved.error) throw new Error("Impossible de définir le compte par défaut.");
}
export async function connectionAudit(userId: string, provider: string, action: string, status: string, entity?: string, source?: string) {
  const { error } = await connectionStore().from("connection_audit").insert({ user_id: userId, provider, action, status, entity, source_message_id: source });
  if (error) throw new Error("Le journal des connexions est indisponible.");
}
export async function beginOAuth(userId: string, provider: Provider, services: ConnectionService[] = ["email","calendar"], accountId?: string) {
  const config = oauthConfig(provider); key();
  if (!Array.isArray(services) || !services.length || services.some(s => !["email","calendar","contacts"].includes(s))) throw new Error("Choisis au moins un service autorisé.");
  const target = accountId ? (await listAccounts(userId)).find(a => a.id === accountId && a.provider === provider) : undefined;
  if (accountId && !target) throw new Error("Compte inaccessible.");
  const requested = provider === "google" ? [...new Set(["openid","email",...services.flatMap(s => googleServiceScopes[s])])] : scopes.microsoft;
  const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
  const { error } = await connectionStore().from("connection_oauth_states").insert({ id: createHash("sha256").update(state).digest("hex"), user_id: userId, provider, verifier, requested_scopes:requested.join(" "),account_id:accountId || null, expires_at: new Date(Date.now() + 600000).toISOString() });
  if (error) throw new Error("Impossible de préparer la connexion. Vérifie la migration.");
  const params = new URLSearchParams({ client_id: config.clientId!, redirect_uri: config.redirectUri, response_type: "code", scope: requested.join(" "), state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", ...(provider === "google" ? { access_type: "offline", prompt: "consent select_account",...(target ? {login_hint:target.email} : {}) } : { response_mode: "query", prompt: "select_account" }) });
  return `${config.authorize}?${params}`;
}
async function exchange(provider: Provider, fields: Record<string,string>) {
  const c = oauthConfig(provider);
  let response: Response;
  try { response = await fetch(c.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.clientId!, client_secret: c.clientSecret!, ...fields }), signal: AbortSignal.timeout(20000), cache: "no-store" }); }
  catch { throw new Error("Le fournisseur ne répond pas. Réessaie la connexion plus tard."); }
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) throw new OAuthAuthorizationError("Ton compte doit être reconnecté : l’autorisation a expiré ou a été refusée.");
    throw new Error("Le fournisseur est temporairement indisponible. Réessaie plus tard.");
  }
  const token = await response.json();
  if (!token.access_token) throw new Error("Autorisation incomplète. Reconnecte ton compte.");
  return token;
}
export async function finishOAuth(userId: string, provider: Provider, state: string, code: string) {
  if (!/^[\w-]{40,100}$/.test(state) || !code || code.length > 4096) throw new Error("Retour OAuth invalide.");
  const db = connectionStore();
  // DELETE RETURNING consumes state atomically, bound to the signed-in owner.
  const { data, error } = await db.from("connection_oauth_states").delete().eq("id", createHash("sha256").update(state).digest("hex")).eq("user_id", userId).eq("provider", provider).gt("expires_at", new Date().toISOString()).select("verifier,requested_scopes,account_id").single();
  if (error || !data) throw new Error("Cette connexion a expiré. Recommence depuis les réglages.");
  const token = await exchange(provider, { grant_type: "authorization_code", code, code_verifier: data.verifier, redirect_uri: oauthConfig(provider).redirectUri });
  const granted = String(token.scope || "").split(" ");
  const required = String(data.requested_scopes || scopes[provider].join(" ")).split(" ").filter(s => !["openid", "email", "offline_access"].includes(s));
  if (required.some(scope => !granted.some(g => g.toLowerCase() === scope.toLowerCase() || g.toLowerCase() === `https://graph.microsoft.com/${scope.toLowerCase()}`))) throw new Error("Certaines permissions nécessaires ont été refusées. Reconnecte le compte en les accordant.");
  const profileResponse = await fetch(provider === "google" ? "https://openidconnect.googleapis.com/v1/userinfo" : "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!profileResponse.ok) throw new Error("L’identité du compte n’a pas pu être vérifiée.");
  const profile = await profileResponse.json();
  const subject = String(profile.sub || profile.id || ""), email = String(profile.email || profile.mail || profile.userPrincipalName || "");
  if (!subject || !email.includes("@")) throw new Error("Le compte ne possède pas d’adresse courriel utilisable.");
  const old = await db.from("connected_accounts").select("*").eq("user_id", userId).eq("provider", provider).eq("provider_subject",subject).maybeSingle();
  if (old.error) throw new Error("Impossible de vérifier la connexion existante.");
  if (data.account_id && old.data?.id !== data.account_id) throw new Error("Le compte Google choisi ne correspond pas au compte à reconnecter. Aucun compte n’a été remplacé.");
  const refresh = token.refresh_token || (old.data?.status !== "disconnected" && old.data?.encrypted_tokens ? decryptTokens(old.data.encrypted_tokens,tokenOwner(userId,old.data)).refresh_token : "");
  if (!refresh) throw new Error("L’accès renouvelable n’a pas été accordé. Reconnecte le compte.");
  const now = new Date().toISOString();
  const saved = await db.from("connected_accounts").upsert({ user_id: userId, provider, provider_subject: subject, email, scopes: String(token.scope),status:"connected",token_version:2,updated_at:now,connected_at:old.data ? old.data.connected_at : now,reconnected_at:old.data ? now : null,disconnected_at:null, encrypted_tokens: encryptTokens({ access_token: token.access_token, refresh_token: refresh, expires_at: Date.now() + Number(token.expires_in || 3600) * 1000 }, `${userId}:${provider}:${subject}`) },{onConflict:"user_id,provider,provider_subject"}).select("id").single();
  if (saved.error) throw new Error("La connexion n’a pas pu être enregistrée.");
  if (old.data) {
    const cancelled = await db.from("connected_actions").update({status:"cancelled"}).eq("user_id",userId).eq("account_id",old.data.id).eq("status","preview");
    if (cancelled.error) throw new Error("Compte connecté, mais impossible d’annuler ses anciens aperçus.");
    const allowed = authorizedServices(provider,String(token.scope));
    for (const service of ["email","calendar","contacts"] as const) if (!allowed.includes(service)) {
      const cleared = await db.from("connected_account_defaults").delete().eq("user_id",userId).eq("account_id",old.data.id).eq("service",service);
      if (cleared.error) throw new Error("Compte connecté, mais défaut d’un service retiré indisponible.");
    }
  }
  for (const service of authorizedServices(provider,String(token.scope))) {
    const existing = await db.from("connected_account_defaults").select("account_id").eq("user_id",userId).eq("service",service).maybeSingle();
    if (existing.error) throw new Error("Impossible de vérifier les comptes par défaut.");
    if (!existing.data) {
      const inserted = await db.from("connected_account_defaults").upsert({user_id:userId,service,account_id:saved.data.id},{onConflict:"user_id,service",ignoreDuplicates:true});
      if (inserted.error) throw new Error("Compte connecté, mais défaut du service indisponible.");
    }
  }
  await connectionAudit(userId, provider, "connect", "completed");
}
export async function accountToken(userId: string, accountId: string) {
  const db = connectionStore();
  const { data: account, error } = await db.from("connected_accounts").select("*").eq("id", accountId).eq("user_id", userId).single();
  if (error || !account) throw new Error("Compte inaccessible. Connecte ton compte dans Réglages → Connexions.");
  if (account.status !== "connected") throw new Error("Ton compte doit être reconnecté dans Réglages → Connexions.");
  const provider = providerName(account.provider), aad = tokenOwner(userId,account);
  let token = decryptTokens(account.encrypted_tokens, aad);
  if (token.expires_at < Date.now() + 90000) {
    try {
      const next = await exchange(provider, { grant_type: "refresh_token", refresh_token: token.refresh_token });
      token = { access_token: next.access_token, refresh_token: next.refresh_token || token.refresh_token, expires_at: Date.now() + Number(next.expires_in || 3600) * 1000 };
      const saved = await db.from("connected_accounts").update({ encrypted_tokens: encryptTokens(token, aad), updated_at: new Date().toISOString() }).eq("id", accountId).eq("user_id", userId);
      if (saved.error) throw new Error("Impossible de conserver l’autorisation renouvelée.");
    } catch (error) { if(error instanceof OAuthAuthorizationError)await db.from("connected_accounts").update({ status: "reconnect" }).eq("id", accountId).eq("user_id", userId); throw error; }
  }
  return { account: {...account,services:authorizedServices(provider,account.scopes || "")} as ConnectedAccount, accessToken: token.access_token };
}
function tokenOwner(userId: string, account: {provider:string;provider_subject?:string;token_version?:number}) {
  return account.token_version === 2 ? `${userId}:${account.provider}:${account.provider_subject}` : `${userId}:${account.provider}`;
}
export async function disconnectAccount(userId: string, provider: Provider, accountId: string) {
  const db = connectionStore();
  const {data,error} = await db.from("connected_accounts").select("*").eq("user_id",userId).eq("provider",provider).eq("id",accountId).single();
  if (error || !data) throw new Error("Compte inaccessible.");
  const saved = await db.from("connected_accounts").update({status:"disconnected",encrypted_tokens:"",disconnected_at:new Date().toISOString()}).eq("user_id",userId).eq("id",accountId);
  if (saved.error) throw new Error("La déconnexion a échoué.");
  const defaults = await db.from("connected_account_defaults").delete().eq("user_id",userId).eq("account_id",accountId);
  const previews = await db.from("connected_actions").update({status:"cancelled"}).eq("user_id",userId).eq("account_id",accountId).eq("status","preview");
  if (defaults.error || previews.error) throw new Error("Compte déconnecté; nettoyage des aperçus ou des défauts indisponible.");
  let revoked = false;
  if (data.encrypted_tokens && provider === "google") { try { const tokens = decryptTokens(data.encrypted_tokens, tokenOwner(userId,data)); const response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: tokens.refresh_token }), signal: AbortSignal.timeout(10000) }); revoked = response.ok; } catch { /* Local credentials are already deleted. */ } }
  await connectionAudit(userId, provider, "disconnect", "completed");
  return provider === "microsoft" ? "Compte déconnecté d’IACourtier. Tu peux aussi retirer le consentement dans les paramètres de ton compte Microsoft." : revoked ? "Compte déconnecté et autorisation Google révoquée." : "Compte déconnecté d’IACourtier. Tu peux retirer le consentement dans les paramètres Google.";
}
