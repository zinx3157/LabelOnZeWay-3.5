import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../src/app/store.js';
import {startAutoSync} from '../src/services/auto-sync.js';
import {createSyncService} from '../src/services/sync.js';
import {createPrintService} from '../src/services/print.js';
const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
const state=()=>({session:{user:{id:'u'}},workspace:{id:'w',profileId:'p'},online:true});
test('automatic sync pushes local edits, polls cloud and avoids echoing remote data',async()=>{
 const store=createStore(state());let pushes=0,pulls=0,applying=false;const intervals=[];
 const sync={isApplying:()=>applying,captureChanges(){},queue(){},pending:()=>0,pushSnapshot:async()=>{pushes++},pullSnapshot:async()=>{pulls++;applying=true;store.setState({customers:[{id:'remote',name:'Cloud'}]});applying=false}};
 const timers={setTimeout:()=>1,clearTimeout(){},setInterval:fn=>(intervals.push(fn),2),clearInterval(){}};
 const auto=startAutoSync({store,sync,timers});await auto.run();assert.equal(pushes,1);assert.equal(pulls,1);
 await auto.run();assert.equal(pushes,1);store.setState({customers:[{id:'local',name:'Device'}]});assert.ok(store.getState().customers[0].modifiedAt);await auto.run();assert.equal(pushes,2);auto.stop();
});
test('sync pushes over 250 records in server-safe batches including deletion tombstones',async()=>{
 map.clear();const calls=[];const client={rpc:async(_,args)=>(calls.push(args.p_changes),{data:args.p_changes.length,error:null})};
 const store=createStore({...state(),customers:Array.from({length:275},(_,i)=>({id:`c${i}`,name:'Test'}))});const sync=createSyncService({store,supabase:{connect:async()=>client}});
 const before=store.getState();store.setState({customers:before.customers.slice(1)});sync.captureChanges(before,store.getState());await sync.pushSnapshot();
 assert.ok(calls.length>=3);assert.ok(calls.every(x=>x.length<=100));assert.ok(calls.flat().some(r=>r.entity_id==='c0'&&r.deleted_at));
});
test('cloud deletion removes remote customer and preserves a newer local edit',async()=>{
 map.clear();const rows=[{entity_type:'customer',entity_id:'a',payload:{id:'a'},deleted_at:'2026-10-13T00:00:00Z',modified_at:'2026-10-13T00:00:00Z'},{entity_type:'customer',entity_id:'b',payload:{id:'b'},deleted_at:'2026-10-13T00:00:00Z',modified_at:'2026-10-13T00:00:00Z'}];
 const chain={select(){return this},eq(){return this},in(){return this},order:async()=>({data:rows,error:null})};
 const store=createStore({...state(),customers:[{id:'a',modifiedAt:'2026-10-12T00:00:00Z'},{id:'b',modifiedAt:'2026-10-13T01:00:00Z'}]});
 await createSyncService({store,supabase:{connect:async()=>({from:()=>chain})}}).pullSnapshot();assert.deepEqual(store.getState().customers.map(x=>x.id),['b']);
});
test('signed-in default printing uses cloud and confirms job state without contacting the Mac',async()=>{
 map.clear();let fetches=0;const savedFetch=globalThis.fetch;globalThis.fetch=async()=>{fetches++;throw Error('LAN must not be used')};
 const chain={insert(){return this},select(){return this},eq(){return this},single:async()=>({data:{id:'job',status:'printed'},error:null})};
 try{const service=createPrintService({store:createStore(state()),supabase:{connect:async()=>({from:()=>chain})}});const result=await service.print({data:'AA=='});assert.equal(result.status,'printed');assert.equal(fetches,0);}finally{globalThis.fetch=savedFetch}
});
