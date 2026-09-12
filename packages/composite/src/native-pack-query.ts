import {BufferGeometry,Group,Matrix4,Mesh,MeshBasicMaterial,MeshPhysicalMaterial} from 'three';
import {stickerPackLeafSlots} from '../../device/src/sticker-pack-graph';
import {sampleGpuPaperBounds} from '../../device/src/sticker-paper-gpu';
import {stickerPackGeometryKey,stickerPackSleeveParts,type StickerPackNode} from '../../device/src/sticker-pack-recipe';
import {setStickerMaterialDamage} from '../../device/src/sticker-alpha';
import type {prepareNativePackFrame} from './native-pack-resources';
/** Only print ray/query wrappers and exact stock AABBs live on main. Stock
 * deformation/shading/render meshes stay in the renderer worker. */
export function createNativePackQuery(frame:Awaited<ReturnType<typeof prepareNativePackFrame>>){
 const root=new Group();root.name='sticker-pack-wrapper';const owners:(()=>void)[]=[],prints=new Map<string,Mesh>();
 const paper=new Map<string,{curl:number;sample:ReturnType<typeof sampleGpuPaperBounds>|null}>();
 const bounds=new Map<string,{mesh:Mesh;geometry:BufferGeometry}[]>();
 const material=new MeshBasicMaterial();owners.push(()=>material.dispose());
 for(const {node}of stickerPackLeafSlots(frame.frame.recipe)){
  if(node.kind==='print'){
   const print=frame.queryPrints.get(node.id);if(!print)throw new Error('Missing native pack query print');
   const front=new MeshPhysicalMaterial({map:print.texture,transparent:true,depthWrite:false});setStickerMaterialDamage(front,print.damage);owners.push(()=>front.dispose());
   const mesh=new Mesh(print.geometry,front);mesh.name=`sticker-${node.artId}`;mesh.matrixAutoUpdate=false;mesh.raycast=()=>{};root.add(mesh);prints.set(node.id,mesh);
  }else{
   const rows=[];
   for(let index=0;index<(node.kind==='paper'?3:stickerPackSleeveParts(node.size).length);index++){
    const geometry=new BufferGeometry(),mesh=new Mesh(geometry,material);mesh.matrixAutoUpdate=false;mesh.raycast=()=>{};root.add(mesh);owners.push(()=>geometry.dispose());rows.push({mesh,geometry});
   }bounds.set(node.id,rows);
   if(node.kind==='paper'){
    const state={curl:node.curl,sample:null as ReturnType<typeof sampleGpuPaperBounds>|null};paper.set(node.id,state);
    for(const [index,part]of (['front','back','edge']as const).entries()){const row=rows[index];if(!row)throw new Error('Missing paper bound');row.geometry.computeBoundingBox=()=>{state.sample??=sampleGpuPaperBounds({...node.size,liner:node.liner},state.curl);row.geometry.boundingBox=state.sample[part].clone();};}
   }
  }
 }
 const update=(recipe:StickerPackNode)=>{
  root.visible=recipe.visible??true;
  for(const {node,world,visible}of stickerPackLeafSlots(recipe)){
   const print=prints.get(node.id);if(print){print.matrix.fromArray(world);print.matrixWorldNeedsUpdate=true;print.visible=visible;continue;}
   const rows=bounds.get(node.id);if(!rows)throw new Error('Missing packet bounds owner');
   if(node.kind==='paper'){
    const state=paper.get(node.id);if(!state)throw new Error('Missing paper bound sampler');const changed=state.curl!==node.curl;if(changed){state.curl=node.curl;state.sample=null;}
    for(const [index]of (['front','back','edge']as const).entries()){const row=rows[index];if(!row)throw new Error('Missing paper bounds');if(changed)row.geometry.boundingBox=null;row.mesh.matrix.fromArray(world);row.mesh.matrixWorldNeedsUpdate=true;row.mesh.visible=visible;}
   }else if(node.kind==='sleeve'){
    for(const [index,part]of stickerPackSleeveParts(node.size).entries()){const row=rows[index],geometry=frame.prepared.get(stickerPackGeometryKey(part.geometry))?.parts['geometry'];if(!row||!geometry?.boundingBox)throw new Error('Missing sleeve bounds');row.geometry.boundingBox=geometry.boundingBox.clone();const local=new Group();local.position.fromArray(part.position);local.rotation.set(...part.rotation);local.updateMatrix();row.mesh.matrix.multiplyMatrices(new Matrix4().fromArray(world),local.matrix);row.mesh.matrixWorldNeedsUpdate=true;row.mesh.visible=visible;}
   }
  }root.updateWorldMatrix(true,true);
 };
 update(frame.frame.recipe);
 return{root,update,dispose(){root.removeFromParent();root.clear();for(const retire of owners.reverse())retire();}};
}
