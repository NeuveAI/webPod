import {Vector3} from '/Users/vinicius/code/webPod/node_modules/.bun/three@0.185.1/node_modules/three/build/three.module.js';
import {stickerSheetTriangleMetric} from '/Users/vinicius/code/webPod/packages/device/src/sticker-sheet-metric';
function run(loads){
 const nx=12,ny=4,W=40,H=12,R=26.18,angle=Math.PI/6,N=(nx+1)*(ny+1),C=2*(nx+1)+6;
 const rest=Array.from({length:N},(_,i)=>({x:(i%(nx+1)/nx-.5)*W,y:(Math.floor(i/(nx+1))/ny-.5)*H}));
 const ps=rest.map(p=>new Vector3(p.x*Math.cos(angle)-p.y*Math.sin(angle),p.x*Math.sin(angle)+p.y*Math.cos(angle),R));
 const triangles=[],edges=[],keys=new Set();for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x;triangles.push([a,a+1,a+nx+1],[a+nx+2,a+nx+1,a+1]);}
 for(const ids of triangles)for(let k=0;k<3;k++){const a=ids[k],b=ids[(k+1)%3],key=[a,b].sort((a,b)=>a-b).join(',');if(!keys.has(key)){keys.add(key);edges.push([a,b,Math.hypot(rest[b].x-rest[a].x,rest[b].y-rest[a].y)]);}}
 const weight=i=>i===C?0:1,frames=[],start=performance.now(),perLoad=[];
 function measure(){let min=Infinity,max=0,penetration=0,maxGap=0;for(const ids of triangles){const metric=stickerSheetTriangleMetric(ids.map(i=>rest[i]),ids.map(i=>ps[i]));min=Math.min(min,metric?.minimumStretch??0);max=Math.max(max,metric?.maximumStretch??Infinity);}for(const[a,b]of edges){const p=ps[a],q=ps[b],dx=q.x-p.x,dz=q.z-p.z,den=dx*dx+dz*dz,t=den<1e-12?0:Math.max(0,Math.min(1,-(p.x*dx+p.z*dz)/den));penetration=Math.max(penetration,R-Math.hypot(p.x+t*dx,p.z+t*dz));}for(const p of ps)maxGap=Math.max(maxGap,Math.hypot(p.x,p.z)-R);return{min,max,penetration,maxGap};}
 frames.push({load:0,phase:'known-exterior-flat',...measure()});
 for(let load=1;load<=loads;load++){
 const t0=performance.now(),active=Math.hypot(W,H)/2*Math.min(1,2*load/loads);
 // Incremental compliant load. No hard2unit snap;2 remains final acceptance target.
 for(let i=0;i<N;i++)if(weight(i)&&Math.hypot(rest[i].x,rest[i].y)<=active){const p=ps[i],radius=Math.hypot(p.x,p.z),step=Math.min(.4,(radius-R)*.12);if(step>0){p.x*=1-step/radius;p.z*=1-step/radius;}}
 for(let iteration=0;iteration<8;iteration++){
 for(const[a,b,l]of edges){const d=ps[b].clone().sub(ps[a]),len=d.length(),den=weight(a)+weight(b);if(den&&len){d.multiplyScalar((len-l)/(len*den));ps[a].addScaledVector(d,weight(a));ps[b].addScaledVector(d,-weight(b));}}
 if(iteration===7)frames.push({load,phase:'mesh-edge-metric',...measure()});
 // Local tangent orientation at the center, with no remote point pins.
 const tangentY=new Vector3(-Math.sin(angle),Math.cos(angle),0);ps[C+1].addScaledVector(tangentY,-ps[C+1].clone().sub(ps[C]).dot(tangentY));
 // Hard cylinder contact includes every rendered edge. Under this <pi angular span,
 // the projected triangle cannot enclose the axis: minimum radius is on an edge.
 for(const[a,b]of edges){const p=ps[a],q=ps[b],dx=q.x-p.x,dz=q.z-p.z,L=dx*dx+dz*dz;if(L<1e-15)continue;const t=Math.max(0,Math.min(1,-(p.x*dx+p.z*dz)/L)),x=p.x+t*dx,z=p.z+t*dz,r=Math.hypot(x,z);if(r>=R)continue;const wa=1-t,wb=t,den=weight(a)*wa*wa+weight(b)*wb*wb;if(den<1e-12)continue;const correction=(R-r)/den;ps[a].x+=x/r*correction*wa*weight(a);ps[a].z+=z/r*correction*wa*weight(a);ps[b].x+=x/r*correction*wb*weight(b);ps[b].z+=z/r*correction*wb*weight(b);}
 }
 frames.push({load,phase:'contact',...measure()});perLoad.push(performance.now()-t0);
 }
 const summary={loads,...measure(),ms:performance.now()-start,maxLoadMs:Math.max(...perLoad),meanLoadMs:perLoad.reduce((a,b)=>a+b,0)/loads};console.log(summary);return{summary,frames,rest,positions:ps.map(p=>p.toArray())};
}
await Bun.write('/Users/vinicius/code/webPod/docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/reviewer/strip-causal.json',JSON.stringify([run(20),run(40),run(50)]));
