import assert from 'node:assert/strict';
import {BufferGeometry,Group,Mesh,MeshBasicMaterial} from '../../../../../../packages/device/node_modules/three';
import {createNativeCarryAdoption} from '../../../../../../packages/device/src/native-carry-adoption';
import type {NativeCarryState} from '../../../../../../packages/composite/src/native-carry-controller';
const gate=createNativeCarryAdoption();
const geometry=new BufferGeometry(),material=new MeshBasicMaterial(),source=new Mesh(geometry,material),scene=new Group();scene.add(source);
const first:NativeCarryState={epoch:1,assemblyRevision:3,active:true,id:'art',source:'pack',handoff:'none'};
assert(gate.update(first));assert(gate.waiting());
let sourceReleases=0,rejected=0,adopted=0;
const replacement=new Group();
gate.replace('pack',accept=>{if(accept){source.removeFromParent();sourceReleases++;scene.add(replacement);adopted++;}else rejected++;});
assert.equal(source.parent,scene);assert.equal(source.geometry,geometry);assert.equal(sourceReleases,0);
assert.equal(gate.adopt(0,3),false);assert.equal(gate.adopt(1,2),false);assert.equal(sourceReleases,0);
// Early cancel retires only the undisplayed candidate. Original source survives.
assert(gate.update({...first,epoch:2,active:false,handoff:'pack'}));assert.equal(rejected,1);assert.equal(source.parent,scene);assert.equal(sourceReleases,0);assert(gate.handoff('pack'));
// Supersession similarly cannot consume an older first carry completion.
assert(gate.update({...first,epoch:3}));gate.replace('pack',accept=>{if(!accept)rejected++;});
assert(gate.update({...first,epoch:4}));assert.equal(rejected,2);assert.equal(gate.adopt(3,3),false);
let equippedAdopts=0;
gate.replace('pack',accept=>{if(accept){source.removeFromParent();sourceReleases++;scene.add(replacement);adopted++;}else rejected++;});
gate.replace('equipped',accept=>{if(accept)equippedAdopts++;});
assert.equal(source.parent,scene);assert(gate.adopt(4,3));assert.equal(sourceReleases,1);assert.equal(adopted,1);assert.equal(equippedAdopts,1);assert.equal(replacement.parent,scene);assert(!gate.waiting());
// Progress replaces immediately after first adoption; the owner is not blocked
// by a notification acknowledgement or a later first-frame barrier.
let finalSample=0;gate.replace('pack',accept=>{assert(accept);finalSample=9999;});assert.equal(finalSample,9999);
assert(gate.update({...first,epoch:5,active:false,handoff:'equipped'}));assert(gate.handoff('equipped'));assert(!gate.handoff('pack'));
assert(gate.update({...first,epoch:6}));gate.replace('pack',accept=>{assert(!accept);rejected++;});gate.dispose();gate.dispose();assert.equal(rejected,3);assert.equal(gate.adopt(6,3),false);
geometry.dispose();material.dispose();scene.clear();
const result={kind:'Offline actual worker adoption-policy ownership proof; no browser GPU or tactile claim',checks:{sourceGeometryIdentityRetainedUntilFirstCarry:true,earlyCancelRetainsDisplayedSource:true,supersededGestureCannotAdopt:true,assemblyRevisionMismatchRejected:true,sourceOwnersReleaseOnlyOnMatchingAdoption:true,twoSourceCandidatesDrainOnce:true,postAdoptionFinalSamplePersists:true,handoffOwnerExact:true,disposalRejectsPendingOnce:true}};
await Bun.write(new URL('./carry-adoption.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(result);
