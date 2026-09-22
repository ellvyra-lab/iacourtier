import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {loader,database} from './helpers/connected-test-harness.mjs';
// All credentials and transport responses below are synthetic fixtures.
let db;
const accounts=loader({'@/lib/supabase/admin':{createSupabaseAdminClient:()=>db}})('@/lib/server/connections/accounts');
function setup(){db=database();Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test-only',CONNECTIONS_ENCRYPTION_KEY:Buffer.alloc(32,3).toString('base64'),CONNECTIONS_APP_URL:'http://localhost:3100',GOOGLE_CLIENT_ID:'test-client',GOOGLE_CLIENT_SECRET:'test-secret'});}
test('OAuth PKCE : état lié au propriétaire, à usage unique; stockage chiffré',async()=>{
  setup();const url=new URL(await accounts.beginOAuth('owner','google')),state=url.searchParams.get('state');
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(url.searchParams.get('redirect_uri'),'http://localhost:3100/api/connections/google/callback');
  const verifier=db.tables.connection_oauth_states[0].verifier;
  assert.equal(createHash('sha256').update(verifier).digest('base64url'),url.searchParams.get('code_challenge'));
  await assert.rejects(accounts.finishOAuth('other','google',state,'code'),/expiré/);assert.equal(db.tables.connection_oauth_states.length,1);
  const original=global.fetch;let requests=0;
  global.fetch=async(url,init)=>{requests++;if(String(url).includes('/token')){assert.equal(new URLSearchParams(init.body).get('code_verifier'),verifier);return Response.json({access_token:'test-access',refresh_token:'test-refresh',expires_in:3600,scope:accounts.scopes.google.join(' ')});}return Response.json({sub:'google-user',email:'account@example.test'});};
  try { await accounts.finishOAuth('owner','google',state,'code');assert.equal(db.tables.connected_accounts.length,1);assert.doesNotMatch(db.tables.connected_accounts[0].encrypted_tokens,/test-access|test-refresh/);await assert.rejects(accounts.finishOAuth('owner','google',state,'code'),/expiré/);assert.equal(requests,2); }
  finally {global.fetch=original;}
});
test('OAuth refuse les permissions partielles et le renouvellement absent',async()=>{
  setup();const original=global.fetch;
  try {const url=new URL(await accounts.beginOAuth('owner','google'));global.fetch=async()=>Response.json({access_token:'test',refresh_token:'test',scope:'openid email'});await assert.rejects(accounts.finishOAuth('owner','google',url.searchParams.get('state'),'code'),/permissions/);assert.equal((db.tables.connected_accounts||[]).length,0);}
  finally {global.fetch=original;}
});
test('token : propriétaire vérifié avant tout appel fournisseur; rotation sauvegardée',async()=>{
  setup();const encrypted=accounts.encryptTokens({access_token:'old',refresh_token:'refresh',expires_at:0},'owner:google');db.tables.connected_accounts=[{id:'account',user_id:'owner',provider:'google',email:'a@example.test',status:'connected',encrypted_tokens:encrypted}];
  const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return Response.json({access_token:'new',refresh_token:'rotated',expires_in:3600});};
  try {await assert.rejects(accounts.accountToken('other','account'),/inaccessible/);assert.equal(calls,0);const result=await accounts.accountToken('owner','account');assert.equal(result.accessToken,'new');assert.equal(accounts.decryptTokens(db.tables.connected_accounts[0].encrypted_tokens,'owner:google').refresh_token,'rotated');assert.equal(calls,1);}
  finally {global.fetch=original;}
});
