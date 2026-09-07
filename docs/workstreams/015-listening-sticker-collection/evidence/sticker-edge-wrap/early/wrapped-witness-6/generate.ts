import {isDeviceOuterGrabPoint,DEVICE_ORIENTATION_GRAB_BAND} from '/Users/vinicius/code/webPod/packages/device/src/orientation-grab';
import { Matrix4, PerspectiveCamera, Object3D, Vector2, Vector3, Mesh, MeshBasicMaterial, FrontSide, DoubleSide, Raycaster } from '/Users/vinicius/code/webPod/packages/device/node_modules/three/build/three.module.js';
import {actualShell} from '../wrapped-witness-4/source-shell';
import {pngAlpha} from '../wrapped-witness-4/png-alpha';
import {createStickerDamageField,stickerPixelSurvives} from '/Users/vinicius/code/webPod/packages/device/src/sticker-alpha';
import {createStickerWrapSurface} from '/Users/vinicius/code/webPod/packages/device/src/sticker-wrap';
import {createStickerSurfaceGeometry,createRearStickerPeelGeometry,stickerRearTransportWeight,sampleStickerSurfaceGrid,stickerVisibleAspect} from '/Users/vinicius/code/webPod/packages/device/src/sticker-surface';
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
 const old=(await Bun.file(import.meta.dir+'/../wrapped-witness-5/candidates.json').json()).results.find(r=>r.viewport.width===viewport&&r.face===face);
 const pickupPoint=old.chosen.pickup.point;
 content.add(mesh);content.updateMatrixWorld(true);
 const worldRay=new Raycaster();worldRay.setFromCamera(new Vector2(2*(pickupPoint.x-rect.left)/rect.width-1,1-2*(pickupPoint.y-rect.top)/rect.height),camera);
 const actualHit=worldRay.intersectObject(mesh,false).find(h=>h.uv&&effective(h.uv.x,h.uv.y)>.99);if(!actualHit?.uv||!actualHit.face)throw Error('Original pixel no longer hits painted ink');
 const local=actualHit.point.clone().applyMatrix4(world.clone().invert()),direction=local.clone().sub(origin).normalize(),shellHit=collider.castSegment(origin,origin.clone().addScaledVector(direction,4000));
 if(!shellHit||shellHit.distance<origin.distanceTo(local)-.001)throw Error('Pickup occluded');
 const pickup={point:pickupPoint,uv:actualHit.uv.toArray(),effectiveAlpha:effective(actualHit.uv.x,actualHit.uv.y),stickerDistance:origin.distanceTo(local),shellDistance:shellHit.distance,local:local.toArray(),shellPoint:shellHit.point.toArray(),shellSource:shellHit.source,face:{a:actualHit.face.a,b:actualHit.face.b,c:actualHit.face.c},world:actualHit.point.toArray()};
 const grab=captureStickerSurfaceGrab(placement,art,actualHit,pickup.point,content,camera,{getBoundingClientRect:()=>rect},()=>true);if(!grab)throw Error('Actual affine capture failed');
 let release=old.chosen.release;
 if(face==='front'){
  const target=viewport===1280?{x:.20,y:.15}:{x:.35,y:.15};
  const column=(dx,dy)=>{const plus=grab.projectCenter(pickup.point.x+dx,pickup.point.y+dy);if(plus)return{x:plus.x-placement.x,y:plus.y-placement.y};const minus=grab.projectCenter(pickup.point.x-dx,pickup.point.y-dy);if(!minus)throw Error('No affine column');return{x:placement.x-minus.x,y:placement.y-minus.y};};
  const ax=column(1,0),ay=column(0,1),det=ax.x*ay.y-ay.x*ax.y,dx=target.x-placement.x,dy=target.y-placement.y;
  release={x:pickup.point.x+(dx*ay.y-dy*ay.x)/det,y:pickup.point.y+(dy*ax.x-dx*ax.y)/det};
 }
 const distance=Math.hypot(release.x-pickup.point.x,release.y-pickup.point.y);if(distance<=64||release.x<0||release.x>rect.width||release.y<0||release.y>rect.height)throw Error('Release not in viewport');
 const partial={x:pickup.point.x+(release.x-pickup.point.x)*partialDistance/distance,y:pickup.point.y+(release.y-pickup.point.y)*partialDistance/distance};
 let maximumDistance=0;
 const sample=(from,to,count)=>Array.from({length:count},(_,i)=>{const t=(i+1)/count,point={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t},admitted=(maximumDistance=Math.max(maximumDistance,Math.hypot(point.x-pickup.point.x,point.y-pickup.point.y)))>64,start=performance.now(),center=admitted?grab.projectCenter(point.x,point.y):null,solveMs=performance.now()-start;
   let fullMesh=null;if(center){const targetGeometry=createStickerSurfaceGeometry(art,{...placement,...center},shell.rear,wrap);if(![...targetGeometry.getAttribute('position').array].every(Number.isFinite))throw Error('Nonfinite full target');fullMesh={vertices:targetGeometry.getAttribute('position').count,indices:targetGeometry.index.count,positionSha256:hash(targetGeometry.getAttribute('position').array)};targetGeometry.dispose();}return{point,admitted,center,solveMs:admitted?solveMs:null,fullMesh};});
 const trajectory=[...sample(pickup.point,partial,8),...sample(partial,release,24)];if(trajectory.some(t=>t.admitted&&!t.center))throw Error('Positive path leaves target domain');
 const invalid=face==='front'?{point:old.chosen.release,result:grab.projectCenter(old.chosen.release.x,old.chosen.release.y),mapping:'captured-triangle-affine'}:null;
 if(invalid&&invalid.result!==null)throw Error('Historical front endpoint is not invalid under actual affine frame');
 const toInvalid=invalid?sample(release,invalid.point,12):[],reentry=invalid?sample(invalid.point,release,12):[];
 const chosen={pickup,partial,release,expectedCenter:trajectory.at(-1).center,trajectory,invalid,negativeTrajectory:[...trajectory,...toInvalid],reentryTrajectory:[...trajectory,...toInvalid,...reentry]};
 content.remove(mesh);mesh.updateMatrixWorld(true);
 // Keep the exact existing shell-flick coordinate; verify its current first source hit.
 const oldHiddenPoint=old.hidden.point,ndc=new Vector3(2*(oldHiddenPoint.x-rect.left)/rect.width-1,1-2*(oldHiddenPoint.y-rect.top)/rect.height,.5).applyMatrix4(combined.clone().invert()),hd=ndc.sub(origin).normalize(),hh=collider.castSegment(origin,origin.clone().addScaledVector(hd,4000));
 if(!hh||!isDeviceOuterGrabPoint(hh.point.x,hh.point.y,10))throw Error('Existing hidden point lost shell admission');
 ray.set(origin,hd);const fg=ray.intersectObject(mesh,false).find(h=>h.uv&&effective(h.uv.x,h.uv.y)>.9);if(fg&&fg.distance<hh.distance-.0001)throw Error('Foreground painted ink at hidden witness');
 mesh.material.side=DoubleSide;const hiddenInk=ray.intersectObject(mesh,false).find(h=>h.distance>hh.distance+.01&&h.uv&&effective(h.uv.x,h.uv.y)>.9);mesh.material.side=FrontSide;
 if(!hiddenInk?.uv)throw Error('Existing hidden pixel no longer crosses painted material');
 const qx=Math.abs(hh.point.x)-139,qy=Math.abs(hh.point.y)-250,sdf=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)-26;
 const retainedHidden={point:oldHiddenPoint,uv:hiddenInk.uv.toArray(),effectiveAlpha:effective(hiddenInk.uv.x,hiddenInk.uv.y),stickerDistance:hiddenInk.distance,shellDistance:hh.distance,local:hiddenInk.point.toArray(),shellPoint:hh.point.toArray(),shellSource:hh.source,orientation:{eligible:true,signedBoundaryDistance:sdf,band:DEVICE_ORIENTATION_GRAB_BAND,diagnosticMarginBand:10,foregroundInkDistance:fg?.distance??null,predicate:'packages/device/src/orientation-grab.ts:isDeviceOuterGrabPoint',actualFirstShellPoint:hh.point.toArray()}};

 const frontier=partialDistance/64/.8,attached=visible.filter(v=>v.row>frontier+1/96&&v.row<.75).sort((a,b)=>b.facing-a.facing)[0];
 if(!attached)throw Error('No visible attached material row');
 const peeled=createRearStickerPeelGeometry(art,placement,shell.rear,partialDistance/64,g,frontier),pp=peeled.getAttribute('position');
 const attachedIndex=Math.round(attached.row*96)*97+Math.round(attached.col*96),sourcePoint=new Vector3().fromBufferAttribute(p,attachedIndex),peelPoint=new Vector3().fromBufferAttribute(pp,attachedIndex);
 const attachment={vertexIndex:attachedIndex,sourceUV:[uv.getX(attachedIndex),uv.getY(attachedIndex)],exactGridVertex:Number.isInteger(attached.row*96)&&Number.isInteger(attached.col*96)&&uv.getX(attachedIndex)===attached.uv[0]&&uv.getY(attachedIndex)===attached.uv[1],frontier,row:attached.row,gridRow:attached.row*96,frontGridRow:frontier*96,rowMargin:attached.row-frontier,sourcePosition:sourcePoint.toArray(),peelPosition:peelPoint.toArray(),maxPositionError:Math.max(...sourcePoint.toArray().map((v,i)=>Math.abs(v-peelPoint.toArray()[i]))),transportWeight:stickerRearTransportWeight(attached.row,frontier,0)};
 if(!attachment.exactGridVertex||attachment.maxPositionError!==0||attachment.transportWeight!==0)throw Error('Attached material moved');peeled.dispose();
 results.push({viewport:capture.viewport,face,pose:capture.pose,build:capture.build,bufferHashes,drawIds:candidates.map(c=>c.draw.id),matrices:{cameraWorld:cameraWorld.toArray(),cameraProjection:projection.toArray(),contentWorld:world.toArray()},chosen,visibleCount:visible.length,hiddenCount:hidden.length,hidden:retainedHidden,attached:{...attached,attachment},visible:visible,capturePath:path,captureSha256:hash(await Bun.file(path).text()),rect,shellDrawCorrelation:faceBuffers.map(f=>({...f,draws:capture.submitted.recentDraws.filter(d=>d.bindings.position?.fnv1a===f.position.fnv1a&&d.bindings.position?.byteLength===f.position.byteLength).map(d=>({id:d.id,pass:d.pass,modelMatrix:d.matrices.modelMatrix,modelViewMatrix:d.matrices.modelViewMatrix,position:d.bindings.position}))}))});mesh.material.dispose();
 console.log(viewport,face,visible.length,hidden.length,chosen?JSON.stringify({pickup:chosen.pickup.point,release:chosen.release,target:chosen.expectedCenter}):'NO SOLVABLE RELEASE');
}
await Bun.write(out+'candidates.json',JSON.stringify({scope:'Actual captured equipped buffers/matrices. Shell witness uses exact source rear/front/glass/wheel/select fixture; missing hardware is not claimed full assembly.',bufferHashes,results,failures},null,2));collider.dispose();g.dispose();shell.dispose();
