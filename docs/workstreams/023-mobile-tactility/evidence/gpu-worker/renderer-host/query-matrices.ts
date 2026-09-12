import assert from 'node:assert/strict';
import {Group,Matrix4,Euler,Texture} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import {prepareDeviceSteps,restorePreparedDevice,disposePreparedDevice} from '../../../../../../packages/device/src/device-preparation-data';
import {drainSteps} from '../../../../../../packages/device/src/sticker-computation-steps';
import {DEFAULT_DEVICE_FORM as form} from '../../../../../../packages/device/src/form';
import {DEFAULT_DEVICE_MATERIALS as params} from '../../../../../../packages/device/src/materials';
import {createDeviceQueryView} from '../../../../../../packages/device/src/device-query-view';
import {createDeviceAssemblyRecipe} from '../../../../../../packages/device/src/device-assembly-recipe';
import {createDeviceAssemblyGraph} from '../../../../../../packages/device/src/device-assembly-graph';
import {createDeviceAssemblyMaterials} from '../../../../../../packages/device/src/device-assembly-materials';
import {completeDeviceEnvelope} from '../../../../../../packages/device/src/device-envelope';
import {MeshBasicMaterial} from '../../../../../../packages/device/node_modules/three/build/three.module.js';
const data=restorePreparedDevice(drainSteps(prepareDeviceSteps(form))), texture=new Texture(), screen=new MeshBasicMaterial();
const materials=createDeviceAssemblyMaterials({backend:{kind:'webgl'},params,isBlack:true,screen,maps:{prepared:data.textures,rearEnvironment:texture,studio:texture,screenStudio:texture,studioIntensity:.2,label:texture,backplate:{roughnessMap:texture,bumpMap:texture}}});
const graph=createDeviceAssemblyGraph(createDeviceAssemblyRecipe(form,data.hardware),data,materials.materials), query=createDeviceQueryView(data,form,params), model=new Group();
model.add(graph.root);graph.root.position.fromArray(completeDeviceEnvelope(form).center.map(x=>-x));
let comparisons=0,maxError=0;
for(let i=0;i<40;i++){
 const orientation={yawDeg:i*13,pitchDeg:i*2,rollDeg:i-20};
 const matrix=new Matrix4().makeRotationFromEuler(new Euler(i*.12,i*.2,i*.03));matrix.setPosition(0,37,0);
 model.matrixAutoUpdate=false;model.matrix.copy(matrix);
 const wheel=graph.objects.get('wheel-assembly');assert(wheel);wheel.rotation.set(i*.0007,-i*.0009,0);wheel.updateMatrix();
 const select=graph.objects.get('select');assert(select);select.position.z=-i*.005;select.updateMatrix();
 const pose={sequence:i,motionEpoch:1,lastAcceptedCommand:0,layoutRevision:1,sceneRevision:1,resourceRevision:1,orientation,reveal:null,nodes:[{id:'device-model',matrix:matrix.toArray()},{id:'wheel-assembly',matrix:wheel.matrix.toArray()},{id:'select',matrix:select.matrix.toArray()}]};
 model.updateMatrixWorld(true);query.applyPose(pose);
 for(const [id,object]of query.nodes){const rendered=graph.objects.get(id);if(!rendered||id==='wheel-assembly')continue;for(let j=0;j<16;j++){const error=Math.abs(object.matrixWorld.elements[j]-rendered.matrixWorld.elements[j]);maxError=Math.max(maxError,error);assert(error<1e-10,JSON.stringify({i,id,j,error,query:object.matrixWorld.elements,render:rendered.matrixWorld.elements}));comparisons++;}}
 assert.deepEqual(query.select.matrix.elements,select.matrix.elements);
}
query.dispose();graph.dispose();materials.dispose();screen.dispose();texture.dispose();disposePreparedDevice(data);
console.log(JSON.stringify({comparisons,maxError,selectChildLocalExact:true}));
