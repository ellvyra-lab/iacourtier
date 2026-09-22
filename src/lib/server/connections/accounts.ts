import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ConnectedAccount, Provider } from "@/lib/connections/types";

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
export function providerName(value: string): Provider {
  if (value !== "google" && value !== "microsoft") throw new Error("Fournisseur inconnu."); return value;
}
export const scopes = {
  google: ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose", "https://www.googleapis.com/auth/calendar.events"],
  microsoft: ["openid", "email", "offline_access", "User.Read", "Mail.ReadWrite", "Mail.Send", "Calendars.ReadWrite"],
};
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
  const { data, error } = await connectionStore().from("connected_accounts").select("id,provider,email,status").eq("user_id", userId);
  if (error) throw new Error("La migration des comptes connectés doit être appliquée."); return data || [];
}
export async function connectionAudit(userId: string, provider: string, action: string, status: string, entity?: string, source?: string) {
  const { error } = await connectionStore().from("connection_audit").insert({ user_id: userId, provider, action, status, entity, source_message_id: source });
  if (error) throw new Error("Le journal des connexions est indisponible.");
}
export async function beginOAuth(userId: string, provider: Provider) {
  const config = oauthConfig(provider); key();
  const state = randomBytes(32).toString("base64url"), verifier = randomBytes(48).toString("base64url");
  const { error } = await connectionStore().from("connection_oauth_states").insert({ id: createHash("sha256").update(state).digest("hex"), user_id: userId, provider, verifier, expires_at: new Date(Date.now() + 600000).toISOString() });
  if (error) throw new Error("Impossible de préparer la connexion. Vérifie la migration.");
  const params = new URLSearchParams({ client_id: config.clientId!, redirect_uri: config.redirectUri, response_type: "code", scope: scopes[provider].join(" "), state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", ...(provider === "google" ? { access_type: "offline", prompt: "consent" } : { response_mode: "query", prompt: "select_account" }) });
  return `${config.authorize}?${params}`;
}
async function exchange(provider: Provider, fields: Record<string,string>) {
  const c = oauthConfig(provider);
  let response: Response;
  try { response = await fetch(c.token, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: c.clientId!, client_secret: c.clientSecret!, ...fields }), signal: AbortSignal.timeout(20000), cache: "no-store" }); }
  catch { throw new Error("Le fournisseur ne répond pas. Réessaie la connexion plus tard."); }
  if (!response.ok) throw new Error("Ton compte doit être reconnecté : l’autorisation a expiré ou a été refusée.");
  const token = await response.json();
  if (!token.access_token) throw new Error("Autorisation incomplète. Reconnecte ton compte.");
  return token;
}
export async function finishOAuth(userId: string, provider: Provider, state: string, code: string) {
  if (!/^[\w-]{40,100}$/.test(state) || !code || code.length > 4096) throw new Error("Retour OAuth invalide.");
  const db = connectionStore();
  // DELETE RETURNING consumes state atomically, bound to the signed-in owner.
  const { data, error } = await db.from("connection_oauth_states").delete().eq("id", createHash("sha256").update(state).digest("hex")).eq("user_id", userId).eq("provider", provider).gt("expires_at", new Date().toISOString()).select("verifier").single();
  if (error || !data) throw new Error("Cette connexion a expiré. Recommence depuis les réglages.");
  const token = await exchange(provider, { grant_type: "authorization_code", code, code_verifier: data.verifier, redirect_uri: oauthConfig(provider).redirectUri });
  const granted = String(token.scope || "").split(" ");
  const required = scopes[provider].filter(s => !["openid", "email", "offline_access"].includes(s));
  if (required.some(scope => !granted.some(g => g.toLowerCase() === scope.toLowerCase() || g.toLowerCase() === `https://graph.microsoft.com/${scope.toLowerCase()}`))) throw new Error("Certaines permissions nécessaires ont été refusées. Reconnecte le compte en les accordant.");
  if (!token.refresh_token) throw new Error("L’accès renouvelable n’a pas été accordé. Reconnecte le compte.");
  const profileResponse = await fetch(provider === "google" ? "https://openidconnect.googleapis.com/v1/userinfo" : "https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName", { headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!profileResponse.ok) throw new Error("L’identité du compte n’a pas pu être vérifiée.");
  const profile = await profileResponse.json();
  const subject = String(profile.sub || profile.id || ""), email = String(profile.email || profile.mail || profile.userPrincipalName || "");
  if (!subject || !email.includes("@")) throw new Error("Le compte ne possède pas d’adresse courriel utilisable.");
  const old = await db.from("connected_accounts").select("id,provider_subject").eq("user_id", userId).eq("provider", provider).maybeSingle();
  if (old.error) throw new Error("Impossible de vérifier la connexion existante.");
  // Never allow an old preview to execute from a newly substituted mailbox.
  if (old.data) { const cleared = await db.from("connected_accounts").delete().eq("id", old.data.id).eq("user_id", userId); if (cleared.error) throw new Error("Impossible de remplacer la connexion."); }
  const saved = await db.from("connected_accounts").insert({ user_id: userId, provider, provider_subject: subject, email, scopes: token.scope, encrypted_tokens: encryptTokens({ access_token: token.access_token, refresh_token: token.refresh_token, expires_at: Date.now() + Number(token.expires_in || 3600) * 1000 }, `${userId}:${provider}`) });
  if (saved.error) throw new Error("La connexion n’a pas pu être enregistrée.");
  await connectionAudit(userId, provider, "connect", "completed");
}
export async function accountToken(userId: string, accountId: string) {
  const db = connectionStore();
  const { data: account, error } = await db.from("connected_accounts").select("*").eq("id", accountId).eq("user_id", userId).single();
  if (error || !account) throw new Error("Compte inaccessible. Connecte ton compte dans Réglages → Connexions.");
  if (account.status !== "connected") throw new Error("Ton compte doit être reconnecté dans Réglages → Connexions.");
  const provider = providerName(account.provider), aad = `${userId}:${provider}`;
  let token = decryptTokens(account.encrypted_tokens, aad);
  if (token.expires_at < Date.now() + 90000) {
    try {
      const next = await exchange(provider, { grant_type: "refresh_token", refresh_token: token.refresh_token });
      token = { access_token: next.access_token, refresh_token: next.refresh_token || token.refresh_token, expires_at: Date.now() + Number(next.expires_in || 3600) * 1000 };
      const saved = await db.from("connected_accounts").update({ encrypted_tokens: encryptTokens(token, aad), updated_at: new Date().toISOString() }).eq("id", accountId).eq("user_id", userId);
      if (saved.error) throw new Error("Impossible de conserver l’autorisation renouvelée.");
    } catch (error) { await db.from("connected_accounts").update({ status: "reconnect" }).eq("id", accountId).eq("user_id", userId); throw error; }
  }
  return { account: account as ConnectedAccount, accessToken: token.access_token };
}
export async function disconnectAccount(userId: string, provider: Provider) {
  const db = connectionStore();
  const { data, error } = await db.from("connected_accounts").delete().eq("user_id", userId).eq("provider", provider).select("encrypted_tokens").maybeSingle();
  if (error) throw new Error("La déconnexion a échoué.");
  let revoked = false;
  if (data && provider === "google") { try { const tokens = decryptTokens(data.encrypted_tokens, `${userId}:${provider}`); const response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: tokens.refresh_token }), signal: AbortSignal.timeout(10000) }); revoked = response.ok; } catch { /* Local credentials are already deleted. */ } }
  await connectionAudit(userId, provider, "disconnect", "completed");
  return provider === "microsoft" ? "Compte déconnecté d’IACourtier. Tu peux aussi retirer le consentement dans les paramètres de ton compte Microsoft." : revoked ? "Compte déconnecté et autorisation Google révoquée." : "Compte déconnecté d’IACourtier. Tu peux retirer le consentement dans les paramètres Google.";
}
