/** Evidence-only scalar transcription of pinned Three 0.185.1 + castSegment.
 * Borrows snapshot; preserves arithmetic/traversal order. No production imports altered. */
import { Vector3 } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import type { StickerCollisionSnapshot, StickerCollisionHit } from '../../../../../../packages/device/src/sticker-collision';
export function scalarCollider(snapshot: StickerCollisionSnapshot) {
 const {coordinates: c, provenance, metadata, root: tree}=snapshot;
 const stack:number[]=[];
 let ax=0,ay=0,az=0,bx=0,by=0,bz=0,cx=0,cy=0,cz=0;
 let nx=0,ny=0,nz=0,px=0,py=0,pz=0;
 const read=(id:number)=>{const o=id*9;ax=c[o]??NaN;ay=c[o+1]??NaN;az=c[o+2]??NaN;bx=c[o+3]??NaN;by=c[o+4]??NaN;bz=c[o+5]??NaN;cx=c[o+6]??NaN;cy=c[o+7]??NaN;cz=c[o+8]??NaN;};
 const normal=()=>{const x=cx-bx,y=cy-by,z=cz-bz,u=ax-bx,v=ay-by,w=az-bz;nx=y*w-z*v;ny=z*u-x*w;nz=x*v-y*u;const sq=nx*nx+ny*ny+nz*nz;if(sq>0){const k=1/Math.sqrt(sq);nx*=k;ny*=k;nz*=k;}else{nx=0;ny=0;nz=0;}};
 let calls=0,nodes=0,triangles=0,fallbackHits=0;
 return {
 stats:()=>({calls,nodes,triangles,fallbackHits,retainedScratchArrays:1}),
 castSegment(start:Vector3,end:Vector3,count=false):StickerCollisionHit|null {
  const sx=start.x,sy=start.y,sz=start.z;
  if(!Number.isFinite(sx)||!Number.isFinite(sy)||!Number.isFinite(sz)||!Number.isFinite(end.x)||!Number.isFinite(end.y)||!Number.isFinite(end.z))throw Error('Nonfinite collision segment');
  let dx=end.x-sx,dy=end.y-sy,dz=end.z-sz;
  const length=Math.sqrt(dx*dx+dy*dy+dz*dz);if(length<1e-7)return null;
  const reciprocal=1/length;dx*=reciprocal;dy*=reciprocal;dz*=reciprocal;
  const startLength=Math.sqrt(sx*sx+sy*sy+sz*sz);
  let bestDistance=Infinity,bestId=-1,bestX=0,bestY=0,bestZ=0;
  stack.length=0;stack.push(0);if(count)calls++;
  while(stack.length){
   const node=stack.pop();if(node===undefined)break;if(count)nodes++;
   const o=node*6,minx=tree.bounds[o]??NaN,miny=tree.bounds[o+1]??NaN,minz=tree.bounds[o+2]??NaN,maxx=tree.bounds[o+3]??NaN,maxy=tree.bounds[o+4]??NaN,maxz=tree.bounds[o+5]??NaN;
   const ix=1/dx,iy=1/dy,iz=1/dz;
   let tmin=ix>=0?(minx-sx)*ix:(maxx-sx)*ix,tmax=ix>=0?(maxx-sx)*ix:(minx-sx)*ix;
   const tymin=iy>=0?(miny-sy)*iy:(maxy-sy)*iy,tymax=iy>=0?(maxy-sy)*iy:(miny-sy)*iy;
   if(tmin>tymax||tymin>tmax)continue;
   if(tymin>tmin||Number.isNaN(tmin))tmin=tymin;
   if(tymax<tmax||Number.isNaN(tmax))tmax=tymax;
   const tzmin=iz>=0?(minz-sz)*iz:(maxz-sz)*iz,tzmax=iz>=0?(maxz-sz)*iz:(minz-sz)*iz;
   if(tmin>tzmax||tzmin>tmax)continue;
   if(tzmin>tmin||tmin!==tmin)tmin=tzmin;
   if(tzmax<tmax||tmax!==tmax)tmax=tzmax;
   if(tmax<0)continue;
   const t=tmin>=0?tmin:tmax;
   px=sx+dx*t;py=sy+dy*t;pz=sz+dz*t;
   const limit=Math.min(bestDistance,length)+1e-7;
   const inside=!(sx<minx||sx>maxx||sy<miny||sy>maxy||sz<minz||sz>maxz);
   const qx=px-sx,qy=py-sy,qz=pz-sz;
   if(!inside&&qx*qx+qy*qy+qz*qz>limit*limit)continue;
   for(let cursor=tree.links[node*4+2]??0,last=cursor+(tree.links[node*4+3]??0);cursor<last;cursor++){
    const id=tree.triangles[cursor]??0;read(id);if(count)triangles++;
    // Ray.intersectTriangle: normal cross(b-a,c-a), original sign and dot order.
    const e1x=bx-ax,e1y=by-ay,e1z=bz-az,e2x=cx-ax,e2y=cy-ay,e2z=cz-az;
    const tx=e1y*e2z-e1z*e2y,ty=e1z*e2x-e1x*e2z,tz=e1x*e2y-e1y*e2x;
    let ddn=dx*tx+dy*ty+dz*tz,sign=0,hit=false;
    if(ddn>0)sign=1;else if(ddn<0){sign=-1;ddn=-ddn;}
    if(sign!==0){
     const fx=sx-ax,fy=sy-ay,fz=sz-az;
     const q1=sign*(dx*(fy*e2z-fz*e2y)+dy*(fz*e2x-fx*e2z)+dz*(fx*e2y-fy*e2x));
     if(!(q1<0)){
      const q2=sign*(dx*(e1y*fz-e1z*fy)+dy*(e1z*fx-e1x*fz)+dz*(e1x*fy-e1y*fx));
      if(!(q2<0)&&!(q1+q2>ddn)){
       const qn=-sign*(fx*tx+fy*ty+fz*tz);
       if(!(qn<0)){const along=qn/ddn;px=sx+dx*along;py=sy+dy*along;pz=sz+dz*along;hit=true;}
      }
     }
    }
    if(!hit){
     normal();const denominator=nx*dx+ny*dy+nz*dz;
     if(Math.abs(denominator)>Number.EPSILON*128){
      const along=(nx*(ax-sx)+ny*(ay-sy)+nz*(az-sz))/denominator;
      if(along>=0&&along<=length){
       px=sx+dx*along;py=sy+dy*along;pz=sz+dz*along;
       const scale=Math.max(1,length,startLength,Math.sqrt(ax*ax+ay*ay+az*az),Math.sqrt(bx*bx+by*by+bz*bz),Math.sqrt(cx*cx+cy*cy+cz*cz));
       const tolerance=Number.EPSILON*128*scale;
       for(let edge=0;edge<3;edge++){
        const ux=edge===0?ax:edge===1?bx:cx,uy=edge===0?ay:edge===1?by:cy,uz=edge===0?az:edge===1?bz:cz;
        const vx=edge===0?bx:edge===1?cx:ax,vy=edge===0?by:edge===1?cy:ay,vz=edge===0?bz:edge===1?cz:az;
        const ex=vx-ux,ey=vy-uy,ez=vz-uz,squared=ex*ex+ey*ey+ez*ez;if(squared===0)continue;
        const fraction=Math.max(0,Math.min(1,((px-ux)*ex+(py-uy)*ey+(pz-uz)*ez)/squared));
        const xx=ux+ex*fraction-px,yy=uy+ey*fraction-py,zz=uz+ez*fraction-pz;
        if(xx*xx+yy*yy+zz*zz<=tolerance*tolerance){hit=true;if(count)fallbackHits++;break;}
       }
      }
     }
    }
    if(!hit)continue;
    const xx=px-sx,yy=py-sy,zz=pz-sz,distance=Math.sqrt(xx*xx+yy*yy+zz*zz);
    if(distance>length+1e-7||distance>=bestDistance)continue;
    bestDistance=distance;bestId=id;bestX=px;bestY=py;bestZ=pz;
   }
   const right=(tree.links[node*4+1]??0)-1,left=(tree.links[node*4]??0)-1;
   if(right>=0)stack.push(right);if(left>=0)stack.push(left);
  }
  if(bestId<0)return null;
  const owner=metadata[provenance[bestId]??-1];if(!owner)throw Error('Missing collision provenance');
  read(bestId);normal();
  return {point:new Vector3(bestX,bestY,bestZ),normal:new Vector3(nx,ny,nz),distance:bestDistance,...owner};
 }
 };
}
