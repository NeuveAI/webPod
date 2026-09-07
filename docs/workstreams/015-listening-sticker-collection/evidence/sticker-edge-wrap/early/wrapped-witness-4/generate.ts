import {isDeviceOuterGrabPoint,DEVICE_ORIENTATION_GRAB_BAND} from '/Users/vinicius/code/webPod/packages/device/src/orientation-grab';
import { Matrix4, PerspectiveCamera, Object3D, Vector2, Vector3, Mesh, MeshBasicMaterial, FrontSide, Raycaster } from '/Users/vinicius/code/webPod/packages/device/node_modules/three';
import {actualShell} from './source-shell';
import {pngAlpha} from './png-alpha';
import {createStickerDamageField,stickerPixelSurvives} from '/Users/vinicius/code/webPod/packages/device/src/sticker-alpha';
import {createStickerWrapSurface} from '/Users/vinicius/code/webPod/packages/device/src/sticker-wrap';
import {createStickerSurfaceGeometry,sampleStickerSurfaceGrid,stickerVisibleAspect} from '/Users/vinicius/code/webPod/packages/device/src/sticker-surface';
import {createStickerCollision} from '/Users/vinicius/code/webPod/packages/device/src/sticker-collision';
import {captureStickerSurfaceGrab} from '/Users/vinicius/code/webPod/packages/device/src/sticker-surface-grab';
import {DEFAULT_DEVICE_FORM} from '/Users/vinicius/code/webPod/packages/device/src/form';
import {getSticker} from '/Users/vinicius/code/webPod/packages/stickers/src/catalogue';
const root='/Users/vinicius/code/webPod/',dir=(process.argv[2]??root+'docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/early/front-residual-1-native/').replace(/\/?$/, '/'),out=(process.argv[3]??root+'docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/early/wrapped-witness-1/').replace(/\/?$/, '/');
const hash=(a:ArrayBufferView|string)=>new Bun.CryptoHasher('sha256').update(typeof a==='string'?a:new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const shell=actualShell(),faces=shell.faces.filter(f=>f.source!=='top cap and outer bevel candidate support'),front=faces.filter(f=>!f.source.includes('rear')).map(f=>({geometry:f.geometry,offset:f.transform?[f.transform.elements[12],f.transform.elements[13],f.transform.elements[14]]:undefined})),wrap=createStickerWrapSurface(DEFAULT_DEVICE_FORM,front),collider=createStickerCollision(faces),art=getSticker('PW-C03'),placement={stickerId:'PW-C03',surface:'back' as const,x:.027,y:.017,width:.35,rotationDeg:0,wear:1},g=createStickerSurfaceGeometry(art,placement,shell.rear,wrap),p=g.getAttribute('position'),uv=g.getAttribute('uv'),ix=g.index!,normal=g.getAttribute('normal');
const bufferHashes={position:hash(p.array),uv:hash(uv.array),index:hash(ix.array)},mask=await pngAlpha(root+'assets/stickers/playworn/rock/pw-c03-last-encore.png'),field=createStickerDamageField(mask,'PW-C03');
const effective=(u:number,v:number)=>{const x=Math.min(mask.width-1,Math.max(0,Math.floor(u*mask.width))),y=Math.min(mask.height-1,Math.max(0,Math.floor((1-v)*mask.height)));return stickerPixelSurvives(field,x,y,1)?(mask.pixels[y*mask.width+x]??0)/255:0};
const fingerprint=(a:ArrayBufferView)=>{let h=2166136261;for(const byte of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^byte,16777619);return(h>>>0).toString(16).padStart(8,'0')};
const faceBuffers=faces.map(f=>({source:f.source,position:{fnv1a:fingerprint(f.geometry.getAttribute('position').array),sha256:hash(f.geometry.getAttribute('position').array),byteLength:f.geometry.getAttribute('position').array.byteLength},transform:(f.transform??new Matrix4()).toArray()}));
const results=[]; const failures=[];for(const viewport of[1280,375])for(const face of['side','front']){
 const path=dir+`matrix-${viewport}-${face}.json`,capture=await Bun.file(path).json(),candidates=capture.submitted.candidates.filter(c=>c.rawBuffers.every(b=>bufferHashes[b.role]===b.sha256));if(candidates.length!==2)throw Error('Actual equipped buffers do not match source');
 const draw=candidates[0].draw,world=new Matrix4().fromArray(draw.matrices.modelMatrix),view=new Matrix4().fromArray(draw.matrices.viewMatrix),projection=new Matrix4().fromArray(draw.matrices.projectionMatrix),cameraWorld=view.clone().invert(),originWorld=new Vector3().setFromMatrixPosition(cameraWorld),origin=originWorld.clone().applyMatrix4(world.clone().invert()),combined=projection.clone().multiply(view).multiply(world),rect=draw.canvasRect;
 const screen=(point:Vector3)=>{const ndc=point.clone().applyMatrix4(combined);return{x:rect.left+(ndc.x+1)*rect.width/2,y:rect.top+(1-ndc.y)*rect.height/2}};
 const partialDistance=face==='side'?32:20;
 const mesh=new Mesh(g,new MeshBasicMaterial({side:FrontSide}));mesh.updateMatrixWorld();const ray=new Raycaster();const visible=[],hidden=[];
 for(let row=1;row<96;row+=2)for(let col=1;col<96;col+=2){const index=row*97+col,point=new Vector3().fromBufferAttribute(p,index),u=uv.getX(index),v=uv.getY(index),alpha=effective(u,v);if(alpha<=.99)continue;const pointer=screen(point);if(pointer.x<20||pointer.x>capture.viewport.width-20||pointer.y<20||pointer.y>capture.viewport.height-60)continue;const direction=point.clone().sub(origin).normalize(),distance=origin.distanceTo(point),hit=collider.castSegment(origin,origin.clone().addScaledVector(direction,4000));if(!hit)continue;
 const item={point:pointer,uv:[u,v],effectiveAlpha:alpha,stickerDistance:distance,shellDistance:hit.distance,local:point.toArray(),shellPoint:hit.point.toArray(),shellSource:hit.source,row:row/96,col:col/96,facing:new Vector3().fromBufferAttribute(normal,index).dot(direction.clone().negate())};
 if(distance>hit.distance+.01){
  if(!['actual cut rear','actual crowned front collision only'].includes(hit.source)||!isDeviceOuterGrabPoint(hit.point.x,hit.point.y,10))continue;
  ray.set(origin,direction);const foreground=ray.intersectObject(mesh,false).find(h=>h.uv&&effective(h.uv.x,h.uv.y)>.9);
  if(foreground&&foreground.distance<hit.distance-.0001)continue;
  const qx=Math.abs(hit.point.x)-139,qy=Math.abs(hit.point.y)-250,sdf=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-26;
  hidden.push({...item,orientation:{eligible:isDeviceOuterGrabPoint(hit.point.x,hit.point.y),signedBoundaryDistance:sdf,band:DEVICE_ORIENTATION_GRAB_BAND,diagnosticMarginBand:10,foregroundInkDistance:foreground?.distance??null,predicate:'packages/device/src/orientation-grab.ts:isDeviceOuterGrabPoint'}});continue;
 }if(item.facing<.15||hit.distance-distance>.5)continue;
 ray.set(origin,direction);const ink=ray.intersectObject(mesh,false).find(h=>h.uv&&effective(h.uv.x,h.uv.y)>.9);if(!ink||Math.abs(ink.distance-distance)>.01)continue;
 // Prefer broad interior ink, away from authored narrow lightning tail.
 const neighboring=[[-2,0],[2,0],[0,-2],[0,2]].every(([dx,dy])=>{const j=(row+dy)*97+col+dx;return j>=0&&j<p.count&&effective(uv.getX(j),uv.getY(j))>.99});if(!neighboring)continue;
 visible.push(item);
 }
 visible.sort((a,b)=>b.facing-a.facing);hidden.sort((a,b)=>(b.stickerDistance-b.shellDistance)-(a.stickerDistance-a.shellDistance));
 const camera=new PerspectiveCamera();camera.matrixAutoUpdate=false;camera.matrix.copy(cameraWorld);camera.matrixWorld.copy(cameraWorld);camera.matrixWorldInverse.copy(view);camera.projectionMatrix.copy(projection);camera.projectionMatrixInverse.copy(projection).invert();const content=new Object3D();content.matrixAutoUpdate=false;content.matrix.copy(world);content.updateMatrixWorld(true);
 let chosen=null;
 for(const pickup of visible){
 const [left,top,right,bottom]=art.visibleBounds,gu=(pickup.uv[0]*art.width-left)/(right-left),gv=((1-pickup.uv[1])*art.height-top)/(bottom-top),width=.35*330,height=width*stickerVisibleAspect(art),half=Math.hypot(width,height)/2;
 for(const target of[{x:.35,y:.15},{x:.027,y:.35},{x:.35,y:.017},{x:.22,y:.25},{x:.25,y:.22},{x:.4,y:.2}]){
 const cage=wrap.cornerCage((.5-target.x)*330,(.5-target.y)*552,half),release=screen(sampleStickerSurfaceGrid(cage.point,width,height,0,gu,gv));if(release.x<20||release.x>capture.viewport.width-20||release.y<20||release.y>capture.viewport.height-60)continue;if(Math.hypot(release.x-pickup.point.x,release.y-pickup.point.y)<70)continue;
 const dx=release.x-pickup.point.x,dy=release.y-pickup.point.y,length=Math.hypot(dx,dy),partial={x:pickup.point.x+dx/length*partialDistance,y:pickup.point.y+dy/length*partialDistance};const grab=captureStickerSurfaceGrab(placement,art,new Vector2(...pickup.uv),pickup.point,content,camera,{getBoundingClientRect:()=>rect},wrap,()=>true);if(!grab)continue;
 let answer=null;const trajectory=[];for(const [from,to,count] of [[pickup.point,partial,8],[partial,release,24]] as const)for(let step=1;step<=count;step++){const t=step/count,point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};const admitted=Math.hypot(point.x-pickup.point.x,point.y-pickup.point.y)>64; const solveStart=performance.now(); answer=admitted?grab.projectCenter(point.x,point.y):null;const solveMs=performance.now()-solveStart;trajectory.push({point,admitted,center:answer,solveMs:admitted?solveMs:null});}
 if(!answer||Math.abs(answer.x-target.x)>.02||Math.abs(answer.y-target.y)>.02){if(failures.length<12)failures.push({viewport,face,pickup,target,release,trajectory});continue;}
 chosen={pickup,partial,release,expectedCenter:target,trajectory};break;
 }if(chosen)break;
 }
 results.push({viewport:capture.viewport,face,pose:capture.pose,build:capture.build,bufferHashes,drawIds:candidates.map(c=>c.draw.id),matrices:{cameraWorld:cameraWorld.toArray(),cameraProjection:projection.toArray(),contentWorld:world.toArray()},chosen,visibleCount:visible.length,hiddenCount:hidden.length,hidden:hidden[0],attached:visible.filter(v=>v.row>partialDistance/64/.8+.03&&v.row<.75).sort((a,b)=>b.facing-a.facing)[0],visible:visible.slice(0,10),capturePath:path,captureSha256:hash(await Bun.file(path).text()),rect,shellDrawCorrelation:faceBuffers.map(f=>({...f,draws:capture.submitted.recentDraws.filter(d=>d.bindings.position?.fnv1a===f.position.fnv1a&&d.bindings.position?.byteLength===f.position.byteLength).map(d=>({id:d.id,pass:d.pass,modelMatrix:d.matrices.modelMatrix,modelViewMatrix:d.matrices.modelViewMatrix,position:d.bindings.position}))}))});mesh.material.dispose();
 console.log(viewport,face,visible.length,hidden.length,chosen?JSON.stringify({pickup:chosen.pickup.point,release:chosen.release,target:chosen.expectedCenter}):'NO SOLVABLE RELEASE');
}
await Bun.write(out+'candidates.json',JSON.stringify({scope:'Actual captured equipped buffers/matrices. Shell witness uses exact source rear/front/glass/wheel/select fixture; missing hardware is not claimed full assembly.',bufferHashes,results,failures},null,2));collider.dispose();g.dispose();shell.dispose();
