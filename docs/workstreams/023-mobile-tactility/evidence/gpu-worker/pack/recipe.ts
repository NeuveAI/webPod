import assert from 'node:assert/strict';
import { readFileSync,mkdtempSync,writeFileSync,symlinkSync,rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { isValidElement,type ReactNode } from '../../../../../../packages/device/node_modules/react';
import { Group } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { createStickerPackRecipe,stickerPackPaperMaterials,stickerPackSleeveMaterials,type StickerPackNode } from '../../../../../../packages/device/src/sticker-pack-recipe';
import { createStickerPackGraph,stickerPackLeafSlots } from '../../../../../../packages/device/src/sticker-pack-graph';
import type { DeviceStickerScene,StickerPackVisual } from '../../../../../../packages/device/src/sticker-contract';
const source=readFileSync(new URL('./StickerPackScene.before.txt',import.meta.url),'utf8');
const baseline=JSON.parse(readFileSync(new URL('./baseline.json',import.meta.url),'utf8')) as {commit:string;sceneSha256:string};assert.equal(createHash('sha256').update(source).digest('hex'),baseline.sceneSha256);
const start=source.indexOf('  const visible = viewport.getCurrentViewport'),end=source.indexOf('/** Release stock bows',start);
const coverStart=source.indexOf('function CoverPrint('),coverEnd=source.indexOf('\nfunction PeelingPrint(',coverStart);
const temp=mkdtempSync(join(tmpdir(),'pack-recipe-'));symlinkSync(resolve('packages/device/node_modules'),join(temp,'node_modules'));
const root=resolve('packages/device/src');
const code=`import {Vector3} from '${resolve('packages/device/node_modules/three/build/three.module.js')}';
import {stickerPackViewportLayout,STICKER_PACK_LAYOUT,STICKER_PACK_MOTION,stickerPackPresentation,STICKER_SHEET_SLOTS,STICKER_SHEET_PRINT_WIDTH,isStickerCarried} from '${root}/sticker-contract';
import {stickerVisibleAspect} from '${root}/sticker-surface';import {stickerPaperCurlProgress} from '${root}/sticker-paper';
const PACK={depth:130};const PackPaper=()=>null,SleevePocket=()=>null,SheetPrint=()=>null,PeelingPrint=()=>null;
${source.slice(coverStart,coverEnd)}
export {CoverPrint as cover};export let capturedLayout;
export function render({stickerScene,size,visibleSize}) {const pack=stickerScene.pack,viewport={getCurrentViewport:()=>visibleSize},camera={},packRoot={current:null},visibility={},roughness={};
${source.slice(start,end).replace('  return <group ref={packRoot}', '  capturedLayout={width,height,pixel,x,y,workspaceLowering}; return <group ref={packRoot}')}`;
writeFileSync(join(temp,'original.tsx'),code);
type Input={stickerScene:DeviceStickerScene;size:{width:number;height:number};visibleSize:{width:number;height:number}};
const original:{render(input:Input):ReactNode;cover(props:Record<string,unknown>):ReactNode;capturedLayout:{width:number;height:number;pixel:number;x:number;y:number;workspaceLowering:number}}=await import(join(temp,'original.tsx'));
type Tree={kind:string;name?:unknown;position?:unknown;rotation?:unknown;visible?:unknown;children?:Tree[];[key:string]:unknown};
function oldNodes(value:ReactNode):Tree[]{
 if(Array.isArray(value))return value.flatMap(oldNodes);if(!isValidElement<Record<string,unknown>>(value))return[];
 const props=value.props,type=typeof value.type==='string'?value.type:typeof value.type==='function'?value.type.name:'';
 if(type==='CoverPrint')return oldNodes(original.cover(props));
 if(type==='PeelingPrint')return[];
 if(type==='group')return[{kind:'group',name:props.name,position:props.position,rotation:props.rotation,visible:props.visible??true,children:oldNodes(props.children as ReactNode)}];
 if(type==='PackPaper')return[{kind:'paper',width:props.width,height:props.height,pixel:props.pixel,ink:props.ink,liner:props.liner??false,curl:props.curlProgress??1,epoch:props.epoch}];
 if(type==='SleevePocket')return[{kind:'sleeve',width:props.width,height:props.height,pixel:props.pixel,ink:props.ink}];
 if(type==='SheetPrint'){const art=props.art as {id:string};return[{kind:'print',artId:art.id,width:props.width,appearance:props.appearance,bow:props.bow}];}
 throw Error(`Unknown archived leaf ${type}`);
}
function current(node:StickerPackNode):Tree{
 if(node.kind==='group')return{kind:'group',name:node.name,position:node.position,rotation:node.rotation,visible:node.visible??true,children:node.children.map(current)};
 if(node.kind==='paper')return{kind:'paper',...node.size,ink:node.ink,liner:node.liner,curl:node.curl,epoch:node.epoch};
 if(node.kind==='sleeve')return{kind:'sleeve',...node.size,ink:node.ink};
 return{kind:'print',artId:node.artId,width:node.width,appearance:node.appearance,bow:node.bow};
}
let cases=0,slots=0;
try{
 for(const size of [{width:390,height:844},{width:440,height:956},{width:1200,height:800}])for(const progress of [0,.3,1])for(const reveal of [0,.02,.7,1])for(const turn of [0,.45,1]){
  const assets=Array.from({length:5},(_,i)=>({id:`art-${i}`,url:'proof',width:80+i*7,height:100+i*11,visibleBounds:[0,0,80+i*7,100+i*11] as const}));
  const pack:StickerPackVisual={progress,peel:.2,stickerId:'art-0',placement:null,landing:0,presence:.8,tuck:.3,workspaceLowering:.7,turn,computationEpoch:7,sheet:{reveal,ink:'#123456',neighbors:[{stickerId:'art-1',ink:'#abcdef'},{stickerId:'art-2',ink:'#fedcba'}],slots:assets.map((art,i)=>({stickerId:art.id,state:(['earned','placed','locked','sealed','earned'] as const)[i]??'earned'}))}};
  const stickerScene:DeviceStickerScene={assets,placements:[],pack,appearances:[{stickerId:'art-0',wear:.37}]};
  const expected=oldNodes(original.render({stickerScene,size,visibleSize:{width:780,height:size.height*780/size.width}}));
  const recipe=createStickerPackRecipe(stickerScene,pack,original.capturedLayout,true);assert.deepEqual([current(recipe)],expected);
  const graph=createStickerPackGraph(recipe,()=>new Group());graph.updateMatrixWorld(true);
  const leaves=stickerPackLeafSlots(recipe);slots+=leaves.length;
  const graphLeaves:Group[]=[];graph.traverse(object=>{if(object.children.length===0&&object instanceof Group)graphLeaves.push(object);});
  assert.deepEqual(leaves.map(leaf=>leaf.world),graphLeaves.map(object=>object.matrixWorld.toArray()));cases++;
 }
 assert.equal(stickerPackPaperMaterials({width:300,height:400,pixel:2},'#abcdef',true).front.bumpScale,.4);
 assert.equal(stickerPackSleeveMaterials(2,'#123456').cut.color,'#bca787');
}finally{rmSync(temp,{recursive:true,force:true});}
console.log(JSON.stringify({baseline,cases,leafMatrixComparisons:slots,exactHierarchy:true,method:'Executes archived original JSX render tail and CoverPrint, compares every group/leaf value and graph world matrix. No browser or timing claim.'},null,2));
