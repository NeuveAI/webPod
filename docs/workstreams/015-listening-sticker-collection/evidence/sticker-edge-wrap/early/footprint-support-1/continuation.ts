import {Group,PerspectiveCamera,Vector2,Matrix4} from '/Users/vinicius/code/webPod/packages/device/node_modules/three';
import {isStickerRearCenter} from '/Users/vinicius/code/webPod/packages/stickers/src/index';
import {actualShell} from '../wrapped-witness-4/source-shell';
import {createStickerWrapSurface} from './instrumented-wrap';
import {createStickerSurfaceGeometry,sampleStickerSurfaceGrid,stickerVisibleAspect} from '/Users/vinicius/code/webPod/packages/device/src/sticker-surface';
import {captureStickerSurfaceGrab} from '/Users/vinicius/code/webPod/packages/device/src/sticker-surface-grab';
import {DEFAULT_DEVICE_FORM} from '/Users/vinicius/code/webPod/packages/device/src/form';
import {getSticker} from '/Users/vinicius/code/webPod/packages/stickers/src/catalogue';
const shell=actualShell(),faces=shell.faces.filter(f=>f.source!=='top cap and outer bevel candidate support'&&!f.source.includes('rear')).map(f=>({geometry:f.geometry,offset:f.transform?[f.transform.elements[12],f.transform.elements[13],f.transform.elements[14]]:undefined})),wrap=createStickerWrapSurface(DEFAULT_DEVICE_FORM,faces),art=getSticker('PW-C03')!,placement={stickerId:art.id,surface:'back' as const,x:.027,y:.017,width:.35,rotationDeg:0,wear:1};
const correspondence=await Bun.file(import.meta.dir+'/pickup-correspondence.json').json();
const old=await Bun.file(import.meta.dir+'/../wrapped-witness-5/candidates.json').json(),results=[];
for(const r of old.results.filter(r=>r.face==='front')){
 const c=correspondence.results.find(q=>q.name===r.viewport.width+'-'+r.face),uv=c.newUV,[left,top,right,bottom]=art.visibleBounds,u=(uv[0]*art.width-left)/(right-left),v=((1-uv[1])*art.height-top)/(bottom-top),width=115.5,height=width*stickerVisibleAspect(art),matrix=new Matrix4().fromArray(r.matrices.cameraProjection).multiply(new Matrix4().fromArray(r.matrices.cameraWorld).invert()).multiply(new Matrix4().fromArray(r.matrices.contentWorld));
 const screen=(x:number,y:number)=>{if(!isStickerRearCenter(x,y))return null;try{const cage=wrap.cornerCage((.5-x)*330,(.5-y)*552,{width,height,angle:0}),p=sampleStickerSurfaceGrid(cage.point,width,height,0,u,v).applyMatrix4(matrix);return{x:r.rect.left+(p.x+1)*r.rect.width/2,y:r.rect.top+(1-p.y)*r.rect.height/2};}catch{return null;}};
 const source=screen(.027,.017)!,offset={x:r.chosen.pickup.point.x-source.x,y:r.chosen.pickup.point.y-source.y};
 const path=(await Bun.file(import.meta.dir+'/inverse-path.json').json()).find(q=>q.name===r.viewport.width+'-'+r.face).path;const first=path.findIndex(t=>t.admitted&&!t.center),previous=path[first-1],targetStep=path[first];let{x,y}=previous.center;const trace=[];
 for(let step=0;step<=64;step++){const f=step/64,pointer={x:previous.point.x+(targetStep.point.x-previous.point.x)*f,y:previous.point.y+(targetStep.point.y-previous.point.y)*f},target={x:pointer.x-offset.x,y:pointer.y-offset.y};let determinant=0,error=Infinity,done=false;
 for(let it=0;it<16;it++){const p=screen(x,y);if(!p)break;error=Math.hypot(p.x-target.x,p.y-target.y);const e=.00001,qx=screen(x+e,y),qy=screen(x,y+e);if(!qx||!qy)break;const a=(qx.x-p.x)/e,b=(qy.x-p.x)/e,c=(qx.y-p.y)/e,d=(qy.y-p.y)/e;determinant=a*d-b*c;if(error<.0001){done=true;break;}if(Math.abs(determinant)<1e-8)break;const ex=target.x-p.x,ey=target.y-p.y,dx=(ex*d-ey*b)/determinant,dy=(ey*a-ex*c)/determinant;let accepted=false;for(let k=0;k<12;k++){const scale=Math.min(1,1/Math.hypot(dx*330,dy*552))*Math.pow(.5,k),nx=x+dx*scale,ny=y+dy*scale,np=screen(nx,ny);if(np&&Math.hypot(np.x-target.x,np.y-target.y)<error){x=nx;y=ny;accepted=true;break;}}if(!accepted)break;}
 const cage=wrap.cornerCage((.5-x)*330,(.5-y)*552,{width,height,angle:0});sampleStickerSurfaceGrid(cage.point,width,height,0,u,v);trace.push({step,pointer,center:{x,y},error,determinant,done,N:cage.diagnostics.worstDirection?.N});if(!done)break;
 }
 results.push({name:r.viewport.width+'-'+r.face,trace,scope:'64substeps over first failed production interval, localNewton max1modelunit/iteration,16iterations,12backtracks, no distantseed. Diagnostic only.'});
}
await Bun.write(import.meta.dir+'/continuation.json',JSON.stringify(results,null,2));console.log(results);shell.dispose();
