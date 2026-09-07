import {readFileSync,writeFileSync} from 'node:fs';
const root='/Users/vinicius/code/webPod/packages/device/src/';
function absolute(s:string){return s.replace(/from 'three'/g,"from '/Users/vinicius/code/webPod/packages/device/node_modules/three'").replace(/from '\.\/([^']+)'/g,(_,p)=>`from '${root}${p}'`)}
let cage=readFileSync(root+'sticker-corner-cage.ts','utf8');
cage=cage.replace('return { point: position,','return { debug(dx:number,dy:number) { const direction=tangentD.clone().multiplyScalar(dx*nx+dy*ny).addScaledVector(tangentT,-dx*ny+dy*nx); const a=direction.dot(rootX),b=direction.dot(rootY); const px=(a*yy-b*xy)/determinant,py=(b*xx-a*xy)/determinant,q=chartDelta(px,py);return {dx,dy,px,py,Q:q,L:{depth:px*depthX+py*depthY,arc:px*arcX+py*arcY},origin,frontEnd,rootGram:{xx,xy,yy},N:[nx,ny]}; }, point: position,');
writeFileSync('/tmp/cage-debug.ts',absolute(cage));
let wrapSource=absolute(readFileSync(root+'sticker-wrap.ts','utf8')).replace(root+'sticker-corner-cage','/tmp/cage-debug');writeFileSync('/tmp/wrap-debug.ts',wrapSource);
const {actualShell}=await import('/tmp/webpod-fermi-shell');const {createStickerWrapSurface}=await import('/tmp/wrap-debug');const {DEFAULT_DEVICE_FORM}=await import(root+'form');
const shell=actualShell(),faces=shell.faces.filter(f=>f.source!=='top cap and outer bevel candidate support').filter(f=>!f.source.includes('rear')).map(f=>({geometry:f.geometry,offset:f.transform?[f.transform.elements[12],f.transform.elements[13],f.transform.elements[14]]:undefined}));const wrap=createStickerWrapSurface(DEFAULT_DEVICE_FORM,faces),c=wrap.cornerCage(156.09,266.616,128);console.log(JSON.stringify([[-45,90],[0,90],[45,90],[-45,50],[0,50],[45,50],[0,0]].map(([x,y])=>c.debug(x,y)),null,2));shell.dispose();
