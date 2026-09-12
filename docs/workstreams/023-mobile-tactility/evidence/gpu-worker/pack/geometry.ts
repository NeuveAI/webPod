import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, symlinkSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PlaneGeometry, type BufferGeometry } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { prepareStickerPackGeometry, stickerPackGeometryBuffers } from '../../../../../../packages/device/src/sticker-pack-resource-data';
import { transferShell } from '../../../../../../packages/device/src/immutable-shell-transfer';
import { drainSteps, yieldSteps } from '../../../../../../packages/device/src/sticker-computation-steps';
import type { StickerPackGeometryInput } from '../../../../../../packages/device/src/sticker-pack-recipe';
const baseline='789c8f096741c530b8e17307c8f120f8e302afbd',temporary=mkdtempSync(join(tmpdir(),'pack-geometry-'));
execFileSync('tar',['-x','-C',temporary],{input:execFileSync('git',['archive',baseline,'packages/device/src'],{maxBuffer:32*1024*1024})});
symlinkSync(resolve('packages/device/node_modules'),join(temporary,'packages/device/node_modules'));
const sleeve:typeof import('../../../../../../packages/device/src/sticker-sleeve')=await import(join(temporary,'packages/device/src/sticker-sleeve.ts'));
const paper:typeof import('../../../../../../packages/device/src/sticker-paper-gpu')=await import(join(temporary,'packages/device/src/sticker-paper-gpu.ts'));
const sheet:typeof import('../../../../../../packages/device/src/sticker-paper')=await import(join(temporary,'packages/device/src/sticker-paper.ts'));
const surface:typeof import('../../../../../../packages/device/src/sticker-surface')=await import(join(temporary,'packages/device/src/sticker-surface.ts'));
const archive=readFileSync(new URL('./StickerPackScene.before.txt',import.meta.url),'utf8');assert(archive.includes('const PARKED_STICKER_SEGMENTS = 24;'));
const results:{kind:string;bytes:number;parts:number}[]=[];
try{
 for(const pixel of [.6,1,2.4])for(const width of [220,390]){
  const size={width,height:width*1.25,pixel};
  const art={id:'pack-proof',url:'proof',width:96,height:128,visibleBounds:[4,8,92,120] as const};
  const inputs:StickerPackGeometryInput[]=[{kind:'sleeve',...size},{kind:'gpu-paper',...size,liner:false},{kind:'gpu-paper',...size,liner:true},{kind:'parked-print',art,width:width*.2},{kind:'parked-print',art,width:width*.2,bow:{pixel,paperWidth:width,seatX:.2}},{kind:'plane',width:pixel*7,height:size.height-pixel*2}];
  for(const input of inputs){
   let original:Record<string,BufferGeometry>;
   if(input.kind==='gpu-paper')original=paper.createGpuPaperGeometry(input);
   else if(input.kind==='sleeve')original={geometry:sleeve.createStickerSleeveGeometry(input.width,input.height,input.pixel)};
   else if(input.kind==='plane')original={geometry:new PlaneGeometry(input.width,input.height)};
   else original={geometry:sheet.conformStickerToPaper(surface.createStickerPeelGeometry(input.art,input.width,0,24),input.bow?.paperWidth??1,input.bow?.pixel??0,input.bow?.seatX??.5)};
   const expected:ReturnType<typeof drainSteps<ReturnType<typeof prepareStickerPackGeometry> extends Generator<void,infer R,void>?R:never>>={parts:{}};
   const parts:Record<string,ReturnType<typeof transferShell>>={};
   for(const [id,geometry]of Object.entries(original)){geometry.computeBoundingBox();if(!geometry.boundingSphere)geometry.computeBoundingSphere();parts[id]=transferShell(geometry);}
   Object.assign(expected,{parts});
   const value=drainSteps(prepareStickerPackGeometry(input));assert.deepEqual(value,expected);assert.deepEqual(await yieldSteps(prepareStickerPackGeometry(input),new AbortController().signal),expected);
   const bytes=stickerPackGeometryBuffers(value).reduce((sum,buffer)=>sum+buffer.byteLength,0);assert(bytes*2<=4*1024*1024);
   results.push({kind:input.kind,bytes,parts:Object.keys(value.parts).length});for(const geometry of Object.values(original))geometry.dispose();
  }
 }
}finally{rmSync(temporary,{recursive:true,force:true});}
console.log(JSON.stringify({baseline,exact:true,cases:results.length,workerAndMainCopiesWithinReservation:true,results,scope:'Exact attributes, indices, groups, drawRange and computed bounds. No browser or GPU timing claim.'},null,2));
