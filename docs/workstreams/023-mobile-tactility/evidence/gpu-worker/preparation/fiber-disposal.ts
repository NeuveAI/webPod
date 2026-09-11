import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {BufferGeometry,Mesh,MeshBasicMaterial,Object3D} from '../../../../../../packages/device/node_modules/three';
const directory='packages/device/node_modules/@react-three/fiber/dist';
const bundle=readdirSync(directory).find(name=>name.startsWith('events-')&&name.endsWith('.esm.js'));
if(!bundle)throw Error('Missing installed Fiber source');
const source=readFileSync(`${directory}/${bundle}`,'utf8');
const removal=source.slice(source.indexOf('function disposeOnIdle('),source.indexOf('function setFiberRef('));
type Instance={parent:Instance|null;children:Instance[];props:{attach?:string;dispose?:null};object:Object3D|MeshBasicMaterial;type:string};
// Run installed removal and disposal functions verbatim. Only event/root/attach
// infrastructure is inert; actual Three objects and dispose events are observed.
const remove:(parent:Instance,child:Instance)=>void=runInNewContext(`(function(parent,child){${removal};removeChild(parent,child);})`,{
 IS_REACT_ACT_ENVIRONMENT:true,detach:()=>{},isObject3D:(object:unknown)=>object instanceof Object3D,
 removeInteractivity:()=>{},findInitialRoot:()=>({}),invalidateInstance:()=>{},
});
const geometry=new BufferGeometry();let geometryDisposals=0,materialDisposals=0;
geometry.addEventListener('dispose',()=>geometryDisposals++);
const root:Instance={parent:null,children:[],props:{},object:new Object3D(),type:'group'};
function mounted(){const material=new MeshBasicMaterial();material.addEventListener('dispose',()=>materialDisposals++);const mesh:Instance={parent:root,children:[],props:{},object:new Mesh(geometry,material),type:'mesh'};
 const child:Instance={parent:mesh,children:[],props:{attach:'material'},object:material,type:'meshBasicMaterial'};mesh.children.push(child);root.children.push(mesh);root.object.add(mesh.object);return mesh;}
const first=mounted(),second=mounted();remove(root,first);
if(materialDisposals!==1||geometryDisposals!==0)throw Error('First mesh removed shared geometry or leaked material');
remove(root,second);
if(Number(materialDisposals)!==2||geometryDisposals!==0)throw Error('Second mesh removed shared geometry or leaked material');
geometry.dispose();if(Number(geometryDisposals)!==1)throw Error('Explicit cache disposal missing');
const result={fiberSource:`${directory}/${bundle}`,installedRemoveChild:true,firstUnmountMaterialDisposed:true,sharedGeometryRetainedAcrossBothUnmounts:true,secondUnmountMaterialDisposed:true,cacheFinallyDisposesGeometry:true};
writeFileSync('docs/workstreams/023-mobile-tactility/evidence/gpu-worker/preparation/fiber-disposal.json',JSON.stringify(result,null,2)+'\n');console.log(result);
