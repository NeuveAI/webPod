import {Group,PerspectiveCamera,Vector2,Matrix4} from '/Users/vinicius/code/webPod/packages/device/node_modules/three';
import {isStickerRearCenter} from '/Users/vinicius/code/webPod/packages/stickers/src/index';
import {actualShell} from '../wrapped-witness-4/source-shell';
import {createStickerWrapSurface} from '/Users/vinicius/code/webPod/packages/device/src/sticker-wrap';
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
 const failed=(await Bun.file(import.meta.dir+'/inverse-path.json').json()).find(q=>q.name===r.viewport.width+'-'+r.face).path.filter(t=>t.admitted&&!t.center);
 for(const t of failed){const target={x:t.point.x-offset.x,y:t.point.y-offset.y};let seeds=[];for(let row=0;row<=20;row++)for(let col=0;col<=40;col++){const x=col/40,y=row/20,p=screen(x,y);if(p)seeds.push({x,y,error:Math.hypot(p.x-target.x,p.y-target.y)});}seeds.sort((a,b)=>a.error-b.error);let best=seeds[0],solutions=[];
 for(const seed of seeds.slice(0,12)){let{x,y}=seed;for(let it=0;it<16;it++){const p=screen(x,y);if(!p)break;const error=Math.hypot(p.x-target.x,p.y-target.y);if(error<best.error)best={x,y,error};if(error<.1){solutions.push({x,y,error});break;}const e=.0001,qx=screen(x+e,y),qy=screen(x,y+e);if(!qx||!qy)break;const a=(qx.x-p.x)/e,b=(qy.x-p.x)/e,c=(qx.y-p.y)/e,d=(qy.y-p.y)/e,det=a*d-b*c;if(Math.abs(det)<1e-8)break;const ex=target.x-p.x,ey=target.y-p.y,dx=(ex*d-ey*b)/det,dy=(ey*a-ex*c)/det;let accepted=false;for(let k=0;k<8;k++){const scale=Math.pow(.5,k),nx=x+dx*scale,ny=y+dy*scale,np=screen(nx,ny);if(np&&Math.hypot(np.x-target.x,np.y-target.y)<error){x=nx;y=ny;accepted=true;break;}}if(!accepted)break;}}
 results.push({name:r.viewport.width+'-'+r.face,point:t.point,best,solutions,scope:'Bounded offline existence diagnosis only:41x21 global seeds then12best seeds/16iterations. Never used in production or witness selection.'});
 }
}
await Bun.write(import.meta.dir+'/reachability.json',JSON.stringify(results,null,2));console.log(results);shell.dispose();
