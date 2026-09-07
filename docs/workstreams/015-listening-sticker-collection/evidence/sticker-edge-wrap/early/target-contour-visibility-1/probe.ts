import {Group,Mesh,MeshBasicMaterial,PerspectiveCamera,Vector3} from '/Users/vinicius/code/webPod/packages/device/node_modules/three/build/three.module.js';
import {actualShell} from '../wrapped-witness-4/source-shell';
import {pngAlpha} from '../wrapped-witness-4/png-alpha';
import {createStickerDamageField} from '/Users/vinicius/code/webPod/packages/device/src/sticker-alpha';
import {createStickerWrapSurface} from '/Users/vinicius/code/webPod/packages/device/src/sticker-wrap';
import {createStickerSurfaceGeometry} from '/Users/vinicius/code/webPod/packages/device/src/sticker-surface';
import {createStickerVisibility} from '/Users/vinicius/code/webPod/packages/device/src/sticker-visibility';
import {createStickerTargetContourSlot} from '/Users/vinicius/code/webPod/packages/device/src/sticker-target-contour';
import {projectStickerContourField} from '/Users/vinicius/code/webPod/packages/device/src/sticker-contour';
import {DEFAULT_DEVICE_FORM} from '/Users/vinicius/code/webPod/packages/device/src/form';
import {getSticker} from '/Users/vinicius/code/webPod/packages/stickers/src/catalogue';
const shell=actualShell(),faces=shell.faces.filter(f=>f.source!=='top cap and outer bevel candidate support'),front=faces.filter(f=>!f.source.includes('rear')).map(f=>({geometry:f.geometry,offset:f.transform?[f.transform.elements[12],f.transform.elements[13],f.transform.elements[14]]:undefined})),wrap=createStickerWrapSurface(DEFAULT_DEVICE_FORM,front),art=getSticker('PW-C03')!,field=createStickerDamageField(await pngAlpha('/Users/vinicius/code/webPod/assets/stickers/playworn/rock/pw-c03-last-encore.png'),art.id),source={stickerId:art.id,surface:'back' as const,x:.027,y:.017,width:.35,rotationDeg:0,wear:1};
const data=await Bun.file(import.meta.dir+'/../wrapped-witness-7/candidates.json').json(),output=[];
for(const r of data.results){
 const content=new Group();content.matrixAutoUpdate=false;content.matrix.fromArray(r.matrices.contentWorld);const material=new MeshBasicMaterial();
 for(const f of faces){const m=new Mesh(f.geometry,material);m.name=f.source;m.matrixAutoUpdate=false;if(f.transform)m.matrix.copy(f.transform);content.add(m);}content.updateMatrixWorld(true);
 const camera=new PerspectiveCamera();camera.matrixAutoUpdate=false;camera.matrix.fromArray(r.matrices.cameraWorld);camera.updateMatrixWorld(true);camera.projectionMatrix.fromArray(r.matrices.cameraProjection);camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
 const visibility=createStickerVisibility();visibility.update(content);const cameraPoint=content.worldToLocal(camera.getWorldPosition(new Vector3()));
 const placement={...source,...r.chosen.expectedCenter},geometry=createStickerSurfaceGeometry(art,placement,shell.rear,wrap),slot=createStickerTargetContourSlot(),release=slot.publish(placement,geometry,field),prepared=slot.read(placement,placement)!;
 prepared.setWorldMatrix(content.matrixWorld);let tested=0,visible=0;
 const predicate=(world:Vector3)=>{tested++;const result=visibility.visible(cameraPoint,content.worldToLocal(world.clone()));if(result)visible++;return result;};
 const raw=projectStickerContourField(prepared.mesh,camera,r.rect,field,1),actual=projectStickerContourField(prepared.mesh,camera,r.rect,field,1,predicate);
 output.push({name:r.viewport.width+'-'+r.face,target:placement,centerPosition:new Vector3().fromBufferAttribute(geometry.getAttribute('position'),4704).toArray(),meshWorld:prepared.mesh.matrixWorld.toArray(),contentWorld:content.matrixWorld.toArray(),sourceCapture:r.capturePath,sourceCaptureSHA:r.captureSha256,build:r.build,unoccludedPaths:raw?.paths.length??0,visiblePaths:actual?.paths.length??0,visibleSamples:visible,testedSamples:tested,contour:actual,scope:'Actual source rear/front/glass/wheel/select scene subset. Zero visibility with this subset also proves zero after adding omitted opaque assembly surfaces; nonzero subset visibility requires native full-scene confirmation.'});
 release();geometry.dispose();visibility.dispose();material.dispose();
}
await Bun.write(import.meta.dir+'/result.json',JSON.stringify(output,null,2));console.log(output.map(({contour,...r})=>r));shell.dispose();
