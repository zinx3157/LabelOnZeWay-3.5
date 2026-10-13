import test from 'node:test';
import assert from 'node:assert/strict';
import {profileGroups} from '../src/domain/profiles.js';
import {switchProfile,saveProfileData,PROFILE_COLLECTIONS} from '../src/services/profile-data.js';
import {createStore} from '../src/app/store.js';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v))};
test('overlapping legacy IDs show one company while retaining every saved ID',()=>{
 const state={workspace:{id:'w',profileId:'LUZDM'},profileSettings:{name:'LUZDM'},profiles:[{id:'LUZDM',name:'LUZDM'},{id:'old',name:' luzdm '},{id:'P1',name:'Company 1'},{id:'ps_1',name:'Company   1'},{id:'LUZDM',name:'LUZDM'}]};
 const groups=profileGroups(state);assert.equal(groups.length,2);assert.equal(groups[0].id,'LUZDM');assert.deepEqual(groups[0].aliases.sort(),['LUZDM','old']);assert.equal(groups[0].active,true);assert.equal(state.profiles.length,5);
});
test('company switching isolates all collections and restores the saved company',async()=>{
 memory.clear();const store=createStore({workspace:{id:'w',profileId:'A'},activeProfileId:'A',profileSettings:{name:'A'},customers:[{id:'a'}],parcels:[{id:'pa'}],inventory:[{id:'stock-a'}],settlements:[{id:'cash-a'}]});
 await switchProfile({store},{id:'B',name:'B'});for(const key of PROFILE_COLLECTIONS)assert.equal(store.getState()[key].length,0);assert.equal(store.getState().workspace.profileId,'B');
 store.setState({customers:[{id:'b'}],inventory:[{id:'stock-b'}]});await switchProfile({store},{id:'A',name:'A'});assert.deepEqual(store.getState().customers,[{id:'a'}]);assert.deepEqual(store.getState().inventory,[{id:'stock-a'}]);assert.deepEqual(store.getState().settlements,[{id:'cash-a'}]);
});
test('a failed outgoing sync leaves the active profile and its data untouched',async()=>{
 memory.clear();const store=createStore({session:{user:{id:'u'}},workspace:{id:'w',profileId:'A'},customers:[{id:'a'}]});await assert.rejects(switchProfile({store,services:{sync:{pushSnapshot:async()=>{throw Error('offline')}}}},{id:'B',name:'B'}),/offline/);assert.equal(store.getState().workspace.profileId,'A');assert.deepEqual(store.getState().customers,[{id:'a'}]);
});
