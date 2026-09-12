import assert from 'node:assert/strict';
import { readFileSync,mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { MeshStandardMaterial,MeshPhysicalMaterial,type Material } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { stickerPackPaperMaterials,stickerPackSleeveMaterials } from '../../../../../../packages/device/src/sticker-pack-recipe';
const source=readFileSync(new URL('./StickerPackScene.before.txt',import.meta.url),'utf8');
const start=source.indexOf('    const back = new MeshStandardMaterial'),end=source.indexOf('  }, [input, curl',start);assert(start>=0&&end>start);
const constants=source.match(/const PACK = Object.freeze\([^\n]+/);assert(constants);
const temp=mkdtempSync(join(tmpdir(),'pack-materials-')),root=resolve('packages/device/src');
writeFileSync(join(temp,'original.ts'),`import {MeshStandardMaterial,MeshPhysicalMaterial,BackSide,DoubleSide,FrontSide} from '${resolve('packages/device/node_modules/three/build/three.module.js')}';import {STICKER_PACK_MATERIAL} from '${root}/materials';import {SLEEVE_LAMINATE} from '${root}/sticker-sleeve';${constants[0]}\nconst installGpuPaperMaterial=()=>{};export function paper({width,height,pixel,ink,liner}){const roughness=null,studio={texture:null},input={width,height,pixel,liner},curl={uniform:{value:0}};${source.slice(start,end)}}`);
const original:{paper(input:{width:number;height:number;pixel:number;ink:string;liner:boolean}):Record<'front'|'back'|'edge',Material>}=await import(join(temp,'original.ts'));
const materialValue=(material:Material)=>Object.fromEntries(Object.entries(material.toJSON()).filter(([key])=>key!=='uuid'));
let checks=0;
try{
 for(const pixel of [.5,1,2.4])for(const liner of [false,true])for(const ink of ['#e9e2d1','#b7aa86','#1a2b3c']){
  const input={width:300,height:420,pixel,ink,liner},expected=original.paper(input),recipe=stickerPackPaperMaterials(input,ink,liner);
  const actual={front:new MeshPhysicalMaterial({...recipe.front,roughnessMap:null,bumpMap:null,envMap:null}),back:new MeshStandardMaterial(recipe.back),edge:new MeshStandardMaterial(recipe.edge)};
  for(const part of ['front','back','edge']as const){assert.deepEqual(materialValue(actual[part]),materialValue(expected[part]));actual[part].dispose();expected[part].dispose();checks++;}
  const sleeve=stickerPackSleeveMaterials(pixel,ink);assert.equal(sleeve.exterior.bumpScale,pixel*.2);assert.equal(sleeve.interior.color,'#b8a88d');assert.equal(sleeve.cut.roughness,.94);
 }
}finally{rmSync(temp,{recursive:true,force:true});}
console.log(JSON.stringify({materialComparisons:checks,exact:true,scope:'Actual archived stock material constructors versus shared recipe values; existing accepted GPU shader factories unchanged.'},null,2));
