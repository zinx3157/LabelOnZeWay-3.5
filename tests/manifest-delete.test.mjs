import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteManifestParcels,restoreArchivedParcel} from '../src/domain/manifest-delete.js';
const parcel={id:'a',pickId:'131026-1',status:'ready',collect:40000,labelCopy:{escposBase64:'copy'}};
test('delete selected manifest rows keeps a recoverable copy and leaves other rows alone',()=>{
 const state={parcels:[parcel,{id:'b',status:'ready'}],archive:[],ui:{}};
 const next=deleteManifestParcels(state,['a'],'2026-10-13T09:00:00Z');assert.deepEqual(next.parcels.map(p=>p.id),['b']);assert.equal(state.parcels.length,2);assert.equal(next.archive[0].deletedFromManifest,true);assert.equal(next.archive[0].collect,40000);assert.equal(next.archive[0].labelCopy.escposBase64,'copy');
 const restored=restoreArchivedParcel(next.archive[0]);assert.equal(restored.id,'a');assert.equal(restored.status,'ready');assert.ok(!('deletedFromManifest' in restored));assert.ok(!('archivedAt' in restored));
});
test('unknown and repeated delete IDs do not duplicate recovery records',()=>{const state={parcels:[parcel],archive:[],ui:{}};assert.equal(deleteManifestParcels(state,['missing']),state);const next=deleteManifestParcels(state,['a','a']);assert.equal(next.archive.length,1);assert.equal(deleteManifestParcels(next,['a']),next);});
