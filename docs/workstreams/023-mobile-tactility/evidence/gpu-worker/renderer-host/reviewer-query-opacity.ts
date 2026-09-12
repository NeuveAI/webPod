import assert from 'node:assert/strict';
import {Group,Texture,Mesh} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {prepareDeviceSteps,restorePreparedDevice,disposePreparedDevice} from '../../../../../../packages/device/src/device-preparation-data';
import {drainSteps} from '../../../../../../packages/device/src/sticker-computation-steps';
import {DEFAULT_DEVICE_FORM as form} from '../../../../../../packages/device/src/form';
import {DEFAULT_DEVICE_MATERIALS as defaults} from '../../../../../../packages/device/src/materials';
import {createDeviceQueryView} from '../../../../../../packages/device/src/device-query-view';
import {createDeviceAssemblyRecipe} from '../../../../../../packages/device/src/device-assembly-recipe';
import {createDeviceAssemblyGraph} from '../../../../../../packages/device/src/device-assembly-graph';
import {createDeviceAssemblyMaterials} from '../../../../../../packages/device/src/device-assembly-materials';
import {completeDeviceEnvelope} from '../../../../../../packages/device/src/device-envelope';
import {MeshBasicMaterial} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {stickerAssemblyRevision} from '../../../../../../packages/device/src/sticker-assembly-revision';
import type {DeviceAssemblyNode} from '../../../../../../packages/device/src/device-assembly-recipe';
const params={...defaults};
for(const key of ['bodyBlack','bodyWhite','wheelRingBlack','wheelRingWhite','selectBlack','selectWhite','wheelWellBlack','wheelWellWhite','steelBack','coverGlass'] as const){params[key]={...params[key],opacity:key.endsWith('White')?.3:0,transparent:true};}
const data=restorePreparedDevice(drainSteps(prepareDeviceSteps(form))), texture=new Texture(), screen=new MeshBasicMaterial();
const result:{black:boolean;comparisons:number;changedRevision:boolean;equalRevision:boolean}[]=[];
for(const black of [true,false]){
 const materials=createDeviceAssemblyMaterials({backend:{kind:'webgl'},params,isBlack:black,screen,maps:{prepared:data.textures,rearEnvironment:texture,studio:texture,screenStudio:texture,studioIntensity:.2,label:texture,backplate:{roughnessMap:texture,bumpMap:texture}}});
 const recipe=createDeviceAssemblyRecipe(form,data.hardware),graph=createDeviceAssemblyGraph(recipe,data,materials.materials), query=createDeviceQueryView(data,form,params,black), model=new Group();
 model.add(graph.root);graph.root.position.fromArray(completeDeviceEnvelope(form).center.map(x=>-x));
 let comparisons=0;
 const compare=(node:DeviceAssemblyNode)=>{if(node.kind==='group'){node.children.forEach(compare);return;}if(node.visible===false)return;const mesh=query.nodes.get(node.id);assert.ok(mesh instanceof Mesh);assert.ok(!Array.isArray(mesh.material));assert.equal(mesh.material.opacity,materials.materials[node.material].opacity,node.id);assert.equal(mesh.material.transparent,materials.materials[node.material].transparent,node.id);comparisons++;};
 recipe.forEach(compare);
 const revision=stickerAssemblyRevision(query.content)?.revision;
 query.updateMaterials(params,black);const equalRevision=stickerAssemblyRevision(query.content)?.revision===revision;assert.ok(equalRevision);
 query.updateMaterials(defaults,!black);const changedRevision=stickerAssemblyRevision(query.content)?.revision!==revision;assert.ok(changedRevision);
 query.dispose();query.dispose();graph.dispose();materials.dispose();result.push({black,comparisons,changedRevision,equalRevision});
}
screen.dispose();texture.dispose();disposePreparedDevice(data);
await Bun.write(new URL('./reviewer-query-opacity.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
