import {Group,Mesh,MeshBasicMaterial,PerspectiveCamera,Vector3} from '/Users/vinicius/code/webPod/packages/device/node_modules/three/build/three.module.js';
import {actualShell} from '../wrapped-witness-4/source-shell';
import {pngAlpha} from '../wrapped-witness-4/png-alpha';
import {createStickerDamageField} from '/Users/vinicius/code/webPod/packages/device/src/sticker-alpha';
import {createStickerWrapSurface} from '/Users/vinicius/code/webPod/packages/device/src/sticker-wrap';
import {createStickerSurfaceGeometry} from '/Users/vinicius/code/webPod/packages/device/src/sticker-surface';
import {createStickerVisibility,stickerVisibilityQuery} from '/Users/vinicius/code/webPod/packages/device/src/sticker-visibility';
import {projectStickerContourField,stickerAlphaContours} from '/Users/vinicius/code/webPod/packages/device/src/sticker-contour';
import {DEFAULT_DEVICE_FORM} from '/Users/vinicius/code/webPod/packages/device/src/form';
import {getSticker} from '/Users/vinicius/code/webPod/packages/stickers/src/catalogue';
const shell=actualShell(),faces=shell.faces.filter(f=>f.source!=='top cap and outer bevel candidate support'),front=faces.filter(f=>!f.source.includes('rear')).map(f=>({geometry:f.geometry,offset:f.transform?[f.transform.elements[12],f.transform.elements[13],f.transform.elements[14]]:undefined})),wrap=createStickerWrapSurface(DEFAULT_DEVICE_FORM,front),art=getSticker('PW-C03')!,field=createStickerDamageField(await pngAlpha('/Users/vinicius/code/webPod/assets/stickers/playworn/rock/pw-c03-last-encore.png'),art.id);
const data=await Bun.file(import.meta.dir+'/../wrapped-witness-7/candidates.json').json(),r=data.results.find(r=>r.viewport.width===1280&&r.face==='side');
const content=new Group(),material=new MeshBasicMaterial(); content.matrixAutoUpdate=false;content.matrix.fromArray(r.matrices.contentWorld);content.matrixWorldNeedsUpdate=true;
for(const f of faces){const m=new Mesh(f.geometry,material);m.name=f.source;m.matrixAutoUpdate=false;if(f.transform)m.matrix.copy(f.transform);m.matrixWorldNeedsUpdate=true;content.add(m);}content.updateMatrixWorld(true);
const camera=new PerspectiveCamera();camera.matrixAutoUpdate=false;camera.matrix.fromArray(r.matrices.cameraWorld);camera.updateMatrixWorld(true);camera.projectionMatrix.fromArray(r.matrices.cameraProjection);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
const vis=createStickerVisibility(),buildStart=performance.now();vis.update(content);const bvhBuildMs=performance.now()-buildStart,rows=[];
for(let i=0;i<10;i++){
 const wear=i<5?.2+i*.1:.6,rotationDeg=i<5?0:(i-4)*.5;
 const start=performance.now(),g=createStickerSurfaceGeometry(art,{stickerId:art.id,surface:'back',x:.027,y:.017,width:.35,rotationDeg},shell.rear,wrap),geometryMs=performance.now()-start;
 const print=new Mesh(g,material);print.matrixAutoUpdate=false;print.matrix.copy(content.matrixWorld);print.matrixWorldNeedsUpdate=true;
 const alphaStart=performance.now();stickerAlphaContours(field,wear);const alphaMs=performance.now()-alphaStart;
 const outputs={},timings={};
 for(const mode of i%2?['cached','baseline']:['baseline','cached']){
  let samples=0;const begin=performance.now();let query;
  if(mode==='cached')query=stickerVisibilityQuery(vis,content,camera);
  else{vis.update(content);query=(world)=>{const cameraPoint=content.worldToLocal(camera.getWorldPosition(new Vector3()));return vis.visible(cameraPoint,content.worldToLocal(world.clone()));};}
  outputs[mode]=projectStickerContourField(print,camera,r.rect,field,wear,p=>{samples++;return query(p);});
  timings[mode]={ms:performance.now()-begin,samples,revision:vis.revision};
 }
 if(JSON.stringify(outputs.baseline)!==JSON.stringify(outputs.cached))throw Error('Projection mismatch '+i);
 rows.push({i,wear,rotationDeg,geometryMs,alphaMs,...timings});g.dispose();
}
const result={scope:'Counterfactual exact old closure vs current hoisted helper; isolated Bun, not browser. Actual source rear/front/glass/wheel/select subset and captured desktop-side matrices. Alpha warmed equally per pair; alternating order; full output exact equality.',bvhBuildMs,boundaryCandidates:field.boundaryCandidates.length,rows};
await Bun.write(import.meta.dir+'/contour-reviewer.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));vis.dispose();material.dispose();shell.dispose();
