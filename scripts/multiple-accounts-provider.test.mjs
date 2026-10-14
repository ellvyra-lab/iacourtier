import assert from 'node:assert/strict';
import test from 'node:test';
import {database,loader} from './helpers/connected-test-harness.mjs';

function providerFixture(services) {
 const account={id:'fixture-account',user_id:'fixture-owner',provider:'google',email:'fixture@example.test',status:'connected',services};
 const db=database({connected_accounts:[account]});
 const providers=loader({'@/lib/server/connections/accounts':{
  accountToken:async(owner,id)=>{if(owner!==account.user_id || id!==account.id)throw Error('Compte inaccessible');return {account,accessToken:'synthetic-provider-token'};},
  connectionAudit:async()=>{},connectionStore:()=>db,
 }})('@/lib/server/connections/providers');
 return {account,db,providers};
}

test('055B: service non autorisé et compte étranger refusés avant transport Google',async()=>{
 const {providers}=providerFixture(['calendar']);const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return Response.json({items:[]});};
 try {
  await assert.rejects(providers.connectedProviders('other','fixture-account'),/inaccessible/);
  const p=await providers.connectedProviders('fixture-owner','fixture-account');
  await assert.rejects(p.email.listMessages({limit:1}),/pas autorisé/);
  await assert.rejects(p.searchContacts('Jacques'),/pas autorisé/);
  assert.equal(calls,0);
  assert.deepEqual(await p.calendar.listEvents('2026-10-15T00:00:00Z','2026-10-16T00:00:00Z'),[]);
  assert.equal(calls,1);
 } finally {global.fetch=original;}
});

test('055B: People recherche par compte, cache préparé et contacts normalisés sans écriture',async()=>{
 const {providers}=providerFixture(['contacts']);const original=global.fetch;const calls=[];
 global.fetch=async(url,init)=>{
  const u=new URL(url);calls.push({url:u,method:init.method||'GET'});
  assert.equal(init.headers.Authorization,'Bearer synthetic-provider-token');
  return Response.json(u.searchParams.get('query') ? {results:[{person:{resourceName:'people/test-person',names:[{displayName:'Jacques Test'}],emailAddresses:[{value:'jacques@example.test'}],phoneNumbers:[{value:'555-0100'}]}}]} : {});
 };
 try {
  const p=await providers.connectedProviders('fixture-owner','fixture-account');
  const contacts=await p.searchContacts('Jacques É',2);
  assert.deepEqual(contacts,[{id:'people/test-person',name:'Jacques Test',emails:['jacques@example.test'],phones:['555-0100']}]);
  assert.equal(calls.length,2);assert.equal(calls[0].url.searchParams.get('query'),'');
  assert.equal(calls[1].url.origin,'https://people.googleapis.com');
  assert.equal(calls[1].url.pathname,'/v1/people:searchContacts');
  assert.equal(calls[1].url.searchParams.get('query'),'Jacques É');
  assert.equal(calls[1].url.searchParams.get('pageSize'),'2');
  assert.equal(calls.every(c=>c.method==='GET'),true);
 } finally {global.fetch=original;}
});

test('055B: erreur 403 d’un service ne révoque pas les autres services du compte',async()=>{
 const {providers,db}=providerFixture(['contacts','calendar']);const original=global.fetch;
 global.fetch=async()=>new Response(null,{status:403});
 try {
  const p=await providers.connectedProviders('fixture-owner','fixture-account');
  await assert.rejects(p.searchContacts('Jacques'),/403/);
  assert.equal(db.tables.connected_accounts[0].status,'connected');
 } finally {global.fetch=original;}
});
