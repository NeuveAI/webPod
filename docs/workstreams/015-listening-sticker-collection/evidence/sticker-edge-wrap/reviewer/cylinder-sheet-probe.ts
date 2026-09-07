import {stickerSheetTriangleMetric} from '/Users/vinicius/code/webPod/packages/device/src/sticker-sheet-metric';
import {Vector3} from '/Users/vinicius/code/webPod/node_modules/.bun/three@0.185.1/node_modules/three/build/three.module.js';
for(const n of [16,32,64]){
 const radius=26,lift=.18,R=radius+lift,W=100,H=80,N=(n+1)**2,C=n/2*(n+1)+n/2;
 // Deliberately perturbed isometric seed, not an analytic solved output.
 const ps=Array.from({length:N},(_,i)=>{const u=(i%(n+1)/n-.5)*W,v=(Math.floor(i/(n+1))/n-.5)*H;return new Vector3(R*Math.sin(u/R)*1.05,v,R*Math.cos(u/R)+.3*Math.abs(u/W));});
 const edges=[];for(let y=0;y<=n;y++)for(let x=0;x<=n;x++){const a=y*(n+1)+x;if(x<n)edges.push([a,a+1,W/n]);if(y<n)edges.push([a,a+n+1,H/n]);if(x<n&&y<n)edges.push([a,a+n+2,Math.hypot(W,H)/n],[a+1,a+n+1,Math.hypot(W,H)/n]);}
 const mass=i=>i===C?0:1;const start=performance.now();
 for(let iter=0;iter<500;iter++){
 for(const[a,b,rest]of edges){const d=ps[b].clone().sub(ps[a]),len=d.length(),weights=mass(a)+mass(b);if(!weights||len<1e-10)continue;d.multiplyScalar((len-rest)/(len*weights));ps[a].addScaledVector(d,mass(a));ps[b].addScaledVector(d,-mass(b));}
 // Soft unilateral attraction; hard outward contact follows and never pulls through the shell.
 for(let i=0;i<N;i++)if(mass(i)){const p=ps[i],r=Math.hypot(p.x,p.z);if(r>R){const shift=(R-r)*.03/r;p.x+=p.x*shift;p.z+=p.z*shift;}else if(r<R){p.x*=R/r;p.z*=R/r;}}
 for(const[a,b]of edges){const p=ps[a],q=ps[b],dx=q.x-p.x,dz=q.z-p.z,L=dx*dx+dz*dz;if(L<1e-15)continue;const t=Math.max(0,Math.min(1,-(p.x*dx+p.z*dz)/L)),x=p.x+t*dx,z=p.z+t*dz,r=Math.hypot(x,z);if(r>=R)continue;const wa=1-t,wb=t,den=mass(a)*wa*wa+mass(b)*wb*wb;if(den<1e-12)continue;const correction=(R-r)/den;ps[a].x+=x/r*correction*wa*mass(a);ps[a].z+=z/r*correction*wa*mass(a);ps[b].x+=x/r*correction*wb*mass(b);ps[b].z+=z/r*correction*wb*mass(b);}
 }
 let min=Infinity,max=0,angleError=0,maxGap=0,penetration=0;for(const[a,b,l]of edges){const d=ps[a].distanceTo(ps[b])/l;min=Math.min(min,d);max=Math.max(max,d);const p=ps[a],q=ps[b],dx=q.x-p.x,dz=q.z-p.z,den=dx*dx+dz*dz,t=den<1e-12?0:Math.max(0,Math.min(1,-(p.x*dx+p.z*dz)/den));penetration=Math.max(penetration,R-Math.hypot(p.x+t*dx,p.z+t*dz));}
 for(let i=0;i<N;i++){const u=(i%(n+1)/n-.5)*W;angleError=Math.max(angleError,Math.abs(Math.atan2(ps[i].x,ps[i].z)-u/R));maxGap=Math.max(maxGap,Math.hypot(ps[i].x,ps[i].z)-R);}
 let minimumStretch=Infinity,maximumStretch=0;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=y*(n+1)+x;for(const ids of [[a,a+1,a+n+1],[a+n+2,a+n+1,a+1]]){const material=ids.map(i=>({x:(i%(n+1)/n-.5)*W,y:(Math.floor(i/(n+1))/n-.5)*H}));const m=stickerSheetTriangleMetric(material,ids.map(i=>ps[i]));if(!m)throw new Error('Degenerate cylinder triangle');minimumStretch=Math.min(minimumStretch,m.minimumStretch);maximumStretch=Math.max(maximumStretch,m.maximumStretch);}}console.log({n,min,max,minimumStretch,maximumStretch,angleError,maxGap,penetration,ms:performance.now()-start});
}
