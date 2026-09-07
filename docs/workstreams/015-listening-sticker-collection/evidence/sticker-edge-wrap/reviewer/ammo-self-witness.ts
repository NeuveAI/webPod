import { Vector3,Triangle,Ray } from '/Users/vinicius/code/webPod/packages/device/node_modules/three';
const dir='/Users/vinicius/code/webPod/docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/early/ammo';
const data=await Bun.file(dir+'/c03-partial-150-mesh.json').json(),audit=await Bun.file(dir+'/c03-partial-150-audit.json').json();
const vertices=data.finalNodes.map(n=>new Vector3(...n.position));
const output=[];
for(const pair of audit.selfIntersections.filter(p=>!p.sharedVertex)){
 const ids=[pair.a,pair.b].map(t=>data.indices.slice(t*3,t*3+3));const ps=ids.map(ii=>ii.map(i=>vertices[i]));const hits=[];
 for(const [f,t]of[[0,1],[1,0]])for(let edge=0;edge<3;edge++){
  const a=ps[f][edge],b=ps[f][(edge+1)%3],delta=b.clone().sub(a),length=delta.length();
  const hit=new Ray(a,delta.multiplyScalar(1/length)).intersectTriangle(...ps[t],false,new Vector3());
  if(hit&&a.distanceTo(hit)<=length){const bary=new Triangle(...ps[t]).getBarycoord(hit,new Vector3());hits.push({from:f,edge,fraction:a.distanceTo(hit)/length,bary:bary.toArray(),point:hit.toArray()});}
 }
 output.push({pair,ids,hits});
}
console.log(JSON.stringify(output,null,2));
