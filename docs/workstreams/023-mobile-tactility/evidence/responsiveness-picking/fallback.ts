import {BoxGeometry,Mesh,MeshBasicMaterial,Raycaster,Vector3,type Intersection} from '../../../../../packages/device/node_modules/three';
import {buildShellPickingIndex} from '../../../../../packages/device/src/shell-picking-index';
import {createIndexedShellRaycast,createShellPicking} from '../../../../../packages/device/src/shell-picking';
const geometry=new BoxGeometry(2,2,2), material=new MeshBasicMaterial(), mesh=new Mesh(geometry,material);
const p=geometry.getAttribute('position');
const prepared=createIndexedShellRaycast(geometry,buildShellPickingIndex({positions:Float32Array.from(p.array),indices:Uint32Array.from(geometry.index!.array)}));
const ray=new Raycaster(new Vector3(0,0,4),new Vector3(0,0,-1));
function check(raycast: Mesh['raycast']) {const a:Intersection[]=[],b:Intersection[]=[];Mesh.prototype.raycast.call(mesh,ray,a);raycast.call(mesh,ray,b);if(a.length!==b.length||a.some((h,i)=>h.faceIndex!==b[i]!.faceIndex||h.point.distanceTo(b[i]!.point)>1e-9))throw Error('fallback mismatch')}
check(prepared.raycast);mesh.material=[material,material,material,material,material,material];check(prepared.raycast);mesh.material=material;
geometry.setDrawRange(0,12);check(prepared.raycast);geometry.setDrawRange(0,Infinity);
p.setXYZ(0,3,3,3);p.needsUpdate=true;check(prepared.raycast);
const runtime=createShellPicking();check(runtime.raycast);const stop=runtime.prepare(geometry);await Promise.resolve();await Promise.resolve();check(runtime.raycast);stop();check(runtime.raycast);
prepared.dispose();geometry.dispose();material.dispose();
console.log(JSON.stringify({materialArray:true,partialDrawRange:true,changedPositionVersion:true,pending:true,unavailableWorker:true,disposed:true}));
