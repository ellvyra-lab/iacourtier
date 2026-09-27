import assert from 'node:assert/strict';
import test from 'node:test';
import {loader,database} from './helpers/connected-test-harness.mjs';

test('Centris stays unavailable with no authorized adapter, even with guessed environment flags',async()=>{
 process.env.CENTRIS_CONNECTED='true';
 const {centrisProvider}=loader()('@/lib/server/connections/centris');
 assert.throws(()=>centrisProvider(''),/Authentification/);
 const provider=centrisProvider('owner'),status=await provider.getConnectionStatus();
 assert.equal(status.status,'not_configured');assert.deepEqual(status.capabilities,[]);
 for(const call of [()=>provider.searchListings({}),()=>provider.getListing('123'),()=>provider.getReferenceTables()])await assert.rejects(call,/officielle/);
 delete process.env.CENTRIS_CONNECTED;
});

test('Gmail reads only an attachment belonging to the selected message, rejects oversized files',async()=>{
 const {GoogleEmailProvider}=loader()('@/lib/server/connections/providers');
 const calls=[];let size=4;
 const p=new GoogleEmailProvider(async path=>{calls.push(path);return path.includes('/attachments/')?{data:Buffer.from('test').toString('base64url')}:{payload:{parts:[{filename:'test.txt',mimeType:'text/plain',body:{attachmentId:'a',size}}]}};});
 assert.equal(Buffer.from((await p.readAttachment('message','a')).data).toString(),'test');
 await assert.rejects(p.readAttachment('message','foreign'),/introuvable/);
 assert.equal(calls.filter(p=>p.includes('/attachments/')).length,1);
 size=4*1024*1024;await assert.rejects(p.readAttachment('message','a'),/3 Mo/);
});

test('attachment route requires owner session and returns safe private download headers',async()=>{
 const id='11111111-1111-4111-8111-111111111111';let user='owner',reads=0;
 const db=database({connected_references:[{id,user_id:'owner',kind:'email',account_id:'account',remote_id:'mail'}]});
 db.auth={getUser:async()=>({data:{user:user?{id:user}:null}})};
 const route=loader({'@/lib/supabase/server':{createSupabaseServerClient:async()=>db},'@/lib/server/connections/accounts':{connectionStore:()=>db},'@/lib/server/connections/providers':{connectedProviders:async(owner,account)=>{assert.equal(owner,'owner');assert.equal(account,'account');return {email:{readAttachment:async()=>{reads++;return {name:'unsafe.html',data:new Uint8Array([1,2])};}}};}}})('@/app/api/connections/attachments/route');
 const request=new Request(`https://example.test/api/connections/attachments?reference=${id}&attachment=a`);
 user=null;assert.equal((await route.GET(request)).status,401);user='other';assert.equal((await route.GET(request)).status,404);assert.equal(reads,0);
 user='owner';const response=await route.GET(request);assert.equal(response.status,200);assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');assert.match(response.headers.get('Content-Disposition'),/^attachment/);assert.match(response.headers.get('Cache-Control'),/no-store/);
});

test('business events feed existing CRM tasks and automations, deduplicated, without external delivery',async()=>{
 const db=database(),scope={db,userId:'owner'},ref={id:'mail-ref',account_id:'account',client_id:'client',case_id:'case',property_id:null};
 const {prepareReplyFollowup,recordConnectionEvent}=loader()('@/lib/server/connections/business-events');
 await prepareReplyFollowup(scope,ref);await prepareReplyFollowup(scope,ref);
 assert.equal(db.tables.crm_events.length,1);assert.equal(db.tables.tasks.length,1);assert.equal(db.tables.tasks[0].validation_required,true);
 assert.equal(db.tables.automations.length,1);assert.equal(db.tables.automations[0].external_delivery_enabled,false);
 await recordConnectionEvent(scope,ref,'calendar_event_created','operation');await recordConnectionEvent(scope,ref,'calendar_event_created','operation');assert.equal(db.tables.crm_events.length,2);
 await prepareReplyFollowup(scope,{...ref,id:'unknown',client_id:null,case_id:null});assert.equal(db.tables.tasks.length,1);
});

test('revoked refresh token requires reconnection; transient failure preserves authorization; disconnect revokes',async()=>{
 const db=database();Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'fixture',CONNECTIONS_ENCRYPTION_KEY:Buffer.alloc(32,4).toString('base64'),CONNECTIONS_APP_URL:'https://example.test',GOOGLE_CLIENT_ID:'fixture',GOOGLE_CLIENT_SECRET:'fixture'});
 const a=loader({'@/lib/supabase/admin':{createSupabaseAdminClient:()=>db}})('@/lib/server/connections/accounts');
 const account={id:'account',user_id:'owner',provider:'google',email:'owner@example.test',status:'connected',encrypted_tokens:a.encryptTokens({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_at:0},'owner:google')};
 const original=global.fetch;
 try {
  db.tables.connected_accounts=[{...account}];global.fetch=async()=>new Response('',{status:503});await assert.rejects(a.accountToken('owner','account'));assert.equal(db.tables.connected_accounts[0].status,'connected');
  global.fetch=async()=>new Response('',{status:400});await assert.rejects(a.accountToken('owner','account'));assert.equal(db.tables.connected_accounts[0].status,'reconnect');
  let revoked=false;global.fetch=async(url)=>{revoked=String(url)==='https://oauth2.googleapis.com/revoke';return new Response('');};await a.disconnectAccount('owner','google');assert.equal(db.tables.connected_accounts.length,0);assert.equal(revoked,true);
 }finally{global.fetch=original;}
});
