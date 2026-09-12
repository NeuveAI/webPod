import { readFileSync, writeFileSync } from 'node:fs';
import { Group, Mesh, MeshPhysicalMaterial, PlaneGeometry, PerspectiveCamera, Scene, Texture, type Material } from '../../../../../../packages/device/node_modules/three/build/three.module.js';
import { prepareStickerPrograms } from '../../../../../../packages/device/src/sticker-program-preparation';
import { createStickerWarmupReadiness } from '../../../../../../packages/device/src/sticker-warmup-readiness';
const source = readFileSync(new URL('../../../../../../packages/device/src/StickerPackScene.tsx', import.meta.url), 'utf8');
const body = source.split('const PrepareStickerAsset =')[1]?.split('  useEffect(() => {')[1]?.split('\n  }, [art.id,')[0];
if (!body) throw new Error('Actual parent effect extraction failed');
const js = new Bun.Transpiler({ loader: 'ts' }).transformSync(`function run(){${body}\n}`, 'ts');
const install = new Function('surfaces','report','onError','art','failed','texture','group','gl','camera','scene','prepareStickerAlpha','prepareStickerPrograms', `${js};return run();`);
const pause = () => new Promise(resolve => setTimeout(resolve, 30));
function harness() {
 const root = new Group(), geometry = new PlaneGeometry(), texture = new Texture(), surfaces = createStickerWarmupReadiness(), events = new EventTarget();
 const publications: boolean[] = [], clones: Material[] = []; let errors = 0, calls = 0, disposed = 0, shaderReady = true, reject = false, lost = false;
 const gl = { domElement: events, getContext: () => ({ isContextLost: () => lost }), initTexture() {}, properties: { get: () => ({currentProgram: {isReady: () => shaderReady}}) }, compile(object: Group) { calls++; const all = new Set<Material>(); object.traverse(node => { if(node instanceof Mesh) for(const material of Array.isArray(node.material)?node.material:[node.material]) all.add(material); }); if(all.size !== 6) throw new Error('Incomplete authored group compiled'); for(const material of all){ clones.push(material); material.addEventListener('dispose',()=>disposed++); } if(reject) throw new Error('Rejected shader'); return all; } };
 const mount = (variant: 'earned'|'locked'|'placed') => { for(let i=0;i<2;i++){const material=new MeshPhysicalMaterial(); material.customProgramCacheKey=()=>`${variant}-${i}`;root.add(new Mesh(geometry,material));} surfaces[variant](); };
 const start = () => install(surfaces, (_: string,value: boolean)=>publications.push(value),()=>errors++,{id:'PW-A01'},false,texture,{current:root},gl,new PerspectiveCamera(),new Scene(),()=>{},prepareStickerPrograms) as ()=>void;
 const release = () => {root.traverse(node=>{if(node instanceof Mesh)node.material.dispose();});geometry.dispose();texture.dispose();};
 return {surfaces,mount,start,release,publications,events, counts:()=>({calls,errors,disposed,clones:clones.length}),pending:()=>{shaderReady=false;},ready:()=>{shaderReady=true;},reject:(value:boolean)=>{reject=value;},lost:(value:boolean)=>{lost=value;}};
}
const results: string[]=[];
function check(value: boolean, name: string){if(!value)throw new Error(name);results.push(name);}
{
 const h=harness(), cleanup=h.start(); h.mount('placed');h.mount('earned'); await pause();check(h.counts().calls===0,'No compile before last variant');h.mount('locked');await pause();check(h.counts().calls===1&&h.publications.at(-1)===true,'Out-of-order six meshes compile once');h.surfaces.locked();check(h.counts().calls===1,'Duplicate readiness does not compile');cleanup();check(h.counts().disposed===6,'Ready program clones released once');h.release();
}
{
 const h=harness();h.mount('locked');h.mount('placed');h.mount('earned');const cleanup=h.start();await pause();check(h.counts().calls===1&&h.publications.at(-1)===true,'Child layout readiness before parent effect is retained');h.lost(true);h.events.dispatchEvent(new Event('webglcontextlost'));h.lost(false);h.events.dispatchEvent(new Event('webglcontextrestored'));await pause();check(h.counts().calls===2&&h.publications.at(-1)===true,'Context restoration compiles one fresh generation');cleanup();check(h.counts().disposed===12,'Restored program clones released once');h.release();
}
{
 const h=harness();h.pending();const cleanup=h.start();h.mount('earned');h.mount('placed');h.mount('locked');cleanup();h.ready();await pause();check(!h.publications.includes(true)&&h.counts().errors===0&&h.counts().disposed===6,'Disposed pending generation cannot publish or report late abort');h.release();
}
{
 const h=harness();h.reject(true);let cleanup=h.start();h.mount('earned');h.mount('placed');h.mount('locked');await pause();check(h.counts().errors===1&&!h.publications.includes(true),'Compile rejection reports one current error');cleanup();h.reject(false);cleanup=h.start();await pause();check(h.counts().calls===2&&h.publications.at(-1)===true,'Explicit retry compiles complete group successfully');cleanup();h.release();
}
{
 const h=harness();const cleanup=h.start();cleanup();h.mount('earned');h.mount('placed');h.mount('locked');await pause();check(h.counts().calls===0&&!h.publications.includes(true),'Late child readiness after disposal is ignored');h.release();
}
writeFileSync(new URL('./readiness.json',import.meta.url),JSON.stringify({checks:results.length,results,scope:'Actual extracted GL parent effect, actual Three meshes and preparation helper; controlled GPU compilation boundary'},null,2)+'\n');
