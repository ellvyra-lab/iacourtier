import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
export function loader(overrides = {}) {
  const cache = new Map();
  function load(name, parent = '') {
    if (name === 'server-only') return {};
    if (name.startsWith('.')) name = path.posix.normalize(path.posix.join(path.posix.dirname(parent),name));
    if (overrides[name]) return overrides[name];
    if (!name.startsWith('@/')) return nativeRequire(name);
    if (cache.has(name)) return cache.get(name);
    const source = readFileSync(`src/${name.slice(2)}.ts`,'utf8');
    const js = ts.transpileModule(source,{ compilerOptions:{ target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS } }).outputText;
    const module = {exports:{}}; cache.set(name,module.exports);
    new Function('require','module','exports',js)(child => load(child,name),module,module.exports);
    return module.exports;
  }
  return load;
}
// Database query-contract double. Live RLS and provider acceptance remain separate tests.
export function database(seed={}) {
  const tables=structuredClone(seed), locks=new Set();
  return { tables,rpc(name,args) { if(name==='claim_coach_lock'){if(locks.size)return Promise.resolve({data:false});locks.add(args.lock_token);}else locks.delete(args.lock_token);return Promise.resolve({data:true}); },from(table) {
    const rows=tables[table] ||= [];let filters=[],op,values,options={},single=false,start=0,end=Infinity,sort;
    const q={ select(){return q;},eq(k,v){filters.push(r=>r[k]===v);return q;},neq(k,v){filters.push(r=>r[k]!==v);return q;},gt(k,v){filters.push(r=>r[k]>v);return q;},gte(k,v){filters.push(r=>r[k]>=v);return q;},lte(k,v){filters.push(r=>r[k]<=v);return q;},is(k,v){filters.push(r=>(r[k]??null)===v);return q;},in(k,v){filters.push(r=>v.includes(r[k]));return q;},order(k,o={}){sort={k,asc:o.ascending!==false};return q;},range(a,b){start=a;end=b+1;return q;},limit(n){end=n;return q;},single(){single=true;return q;},maybeSingle(){single=true;return q;},insert(v){op='insert';values=v;return q;},update(v){op='update';values=v;return q;},delete(){op='delete';return q;},upsert(v,o={}){op='upsert';values=v;options=o;return q;},then(resolve,reject){return Promise.resolve().then(()=>{
      let found=rows.filter(r=>filters.every(f=>f(r)));if(sort)found.sort((a,b)=>String(a[sort.k]??'').localeCompare(String(b[sort.k]??''))*(sort.asc?1:-1));found=found.slice(start,end);
      if(op==='update')found.forEach(r=>Object.assign(r,structuredClone(values)));
      if(op==='delete')for(const row of found)rows.splice(rows.indexOf(row),1);
      if(op==='insert'||op==='upsert')found=(Array.isArray(values)?values:[values]).map(v=>{const keys=options.onConflict?.split(',');const existing=keys&&rows.find(r=>keys.every(k=>r[k]===v[k]));if(existing){Object.assign(existing,structuredClone(v));return existing;}const row={id:randomUUID(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),status:table==='connected_actions'?'preview':'pending',metadata:{},...structuredClone(v)};rows.push(row);return row;});
      return {data:structuredClone(single?found[0]||null:found),error:null};
    }).then(resolve,reject);}};return q;
  }};
}
