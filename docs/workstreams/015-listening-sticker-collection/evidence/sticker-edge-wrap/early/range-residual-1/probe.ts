import {Vector3} from '/Users/vinicius/code/webPod/packages/device/node_modules/three';
import {actualShell} from '../wrapped-witness-4/source-shell';
import {createStickerWrapSurface} from './instrumented-wrap';
import {createStickerSurfaceGeometry} from '/Users/vinicius/code/webPod/packages/device/src/sticker-surface';
import {DEFAULT_DEVICE_FORM} from '/Users/vinicius/code/webPod/packages/device/src/form';
import {STICKER_CATALOGUE} from '/Users/vinicius/code/webPod/packages/stickers/src/catalogue';
import {isStickerRearCenter} from '/Users/vinicius/code/webPod/packages/stickers/src/index';
const shell=actualShell(),faces=shell.faces.filter(f=>f.source!=='top cap and outer bevel candidate support').filter(f=>!f.source.includes('rear')).map(f=>({geometry:f.geometry,offset:f.transform?[f.transform.elements[12],f.transform.elements[13],f.transform.elements[14]]:undefined})),wrap=createStickerWrapSurface(DEFAULT_DEVICE_FORM,faces);
const aspect=(a:typeof STICKER_CATALOGUE[number])=>(a.visibleBounds[3]-a.visibleBounds[1])/(a.visibleBounds[2]-a.visibleBounds[0]);
const sorted=[...STICKER_CATALOGUE].sort((a,b)=>aspect(a)-aspect(b)),square=[...sorted].sort((a,b)=>Math.abs(aspect(a)-1)-Math.abs(aspect(b)-1))[0]!,arts=[sorted[0]!,square,sorted.at(-1)!];
const centers:{name:string;x:number;y:number}[]=[{name:'center',x:0,y:0}];
for(const sx of[-1,1])for(const sy of[-1,1]){
 for(const angle of[Math.PI/8,Math.PI/4,3*Math.PI/8])centers.push({name:`corner-${sx}-${sy}-${angle}`,x:sx*(139+26*Math.cos(angle)),y:sy*(250+26*Math.sin(angle))});
 centers.push({name:`interior-${sx}-${sy}`,x:sx*100,y:sy*200});
 for(const e of[-.01,.01]){centers.push({name:`top-tangent-${sx}-${sy}-${e}`,x:sx*(139+e),y:sy*275});centers.push({name:`side-tangent-${sx}-${sy}-${e}`,x:sx*164,y:sy*(250+e)});}
}
for(const sign of[-1,1])for(const e of[-.01,0,.01]){centers.push({name:`top-axis-${sign}-${e}`,x:e,y:sign*276});centers.push({name:`side-axis-${sign}-${e}`,x:sign*165,y:e});}
const rows:any[]=[],refinements:any[]=[],start=performance.now(),n=8;
try{for(const center of centers)for(const art of arts)for(const width of[.08,.35])for(const rotation of[-137,0,27,45,90,173]){
 const placement={stickerId:art.id,surface:'back' as const,x:.5-center.x/330,y:.5-center.y/552,width,rotationDeg:rotation},base={center,art:art.id,aspect:aspect(art),width,rotation,normalized:{x:placement.x,y:placement.y}};
 if(!isStickerRearCenter(placement.x,placement.y)){rows.push({...base,invalidFixture:true});continue;}
 try{const w=330*width,h=w*aspect(art),angle=rotation*Math.PI/180,cos=Math.cos(angle),sin=Math.sin(angle),cage=wrap.cornerCage(center.x,center.y,Math.hypot(w,h)/2),points:Vector3[]=[],material:{x:number;y:number}[]=[];let finite=true,zero=0,opposed=0,minArea=Infinity;
 for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){const px=(x/n-.5)*w,py=(y/n-.5)*h,m={x:-(px*cos-py*sin),y:-(px*sin+py*cos)};material.push(m);const p=cage.point(m.x,m.y);points.push(p);finite&&=[p.x,p.y,p.z].every(Number.isFinite);}
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=y*(n+1)+x,b=a+1,c=a+n+1;for(const ids of[[a,c,b],[b,c,c+1]]){const [i,j,k]=ids as[number,number,number],cross=points[j]!.clone().sub(points[i]!).cross(points[k]!.clone().sub(points[i]!)),area=cross.length()/2;minArea=Math.min(minArea,area);if(area<1e-10)zero++;const mid={x:(material[i]!.x+material[j]!.x+material[k]!.x)/3,y:(material[i]!.y+material[j]!.y+material[k]!.y)/3};if(cross.dot(cage.sample(mid.x,mid.y,0).normal)<0)opposed++;}}
 const root=cage.point(0,0);rows.push({...base,finite,zero,coarseOpposed:opposed,minArea,rootXYError:Math.hypot(root.x-center.x,root.y-center.y),...cage.diagnostics});
 if((zero||opposed)&&refinements.length<12){const g=createStickerSurfaceGeometry(art,placement,shell.rear,wrap),p=g.getAttribute('position'),normal=g.getAttribute('normal'),ix=g.index!;let reversed=0,collapsed=0;for(let i=0;i<ix.count;i+=3){const ids=[ix.getX(i),ix.getX(i+1),ix.getX(i+2)],q=ids.map(j=>new Vector3().fromBufferAttribute(p,j)),cross=q[1]!.clone().sub(q[0]!).cross(q[2]!.clone().sub(q[0]!)),nn=ids.reduce((v,j)=>v.add(new Vector3().fromBufferAttribute(normal,j)),new Vector3());if(cross.length()<1e-10)collapsed++;if(cross.dot(nn)<0)reversed++;}refinements.push({...base,segments:96,reversed,collapsed});g.dispose();}
 }catch(error){rows.push({...base,error:String(error)});}
}
const valid=rows.filter(r=>r.finite),worst=(key:string,ascending=false)=>[...valid].sort((a,b)=>ascending?a[key]-b[key]:b[key]-a[key])[0];
await Bun.write(import.meta.dir+'/result.json',JSON.stringify({scope:'Bounded catalogue aspect extrema and near-square; min/max widths, all quadrants, axis/tangency neighbors and six angles.8grid coarse orientation flags require96refinement; this is not full collision or full catalogue visual acceptance.',elapsedMs:performance.now()-start,cases:rows.length,arts:arts.map(a=>({id:a.id,aspect:aspect(a)})),failures:rows.filter(r=>r.error||r.invalidFixture||!r.finite||r.zero),coarseOrientationFlags:rows.filter(r=>r.coarseOpposed>0).length,worstEquation:worst('maxEquationResidual'),worstNegative:worst('minDepthResidual',true),worstDirection:worst('minReachedDot',true),refinements,rows},null,2));
}finally{shell.dispose();}
