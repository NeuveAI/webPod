import { chromium } from '../../../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from '../../../../../apps/web/tests/deterministic-apple-music'
import { resolve } from 'node:path'
import { writeFile,readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const dir=import.meta.dirname
const files=['packages/device/src/Device.tsx','packages/device/src/layout.ts','packages/device/src/surface-layout.ts','packages/device/src/screen-geometry.ts','packages/device/src/materials.ts']
const hashes=Object.fromEntries(await Promise.all(files.map(async p=>[p,createHash('sha256').update(await readFile(p)).digest('hex')])));
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-blink-features=CanvasDrawElement']})
const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:3})
await installDeterministicAppleMusic(page);await page.goto('http://localhost:3000/_spike/device?capture=');await page.waitForSelector('.wp-panel');await page.waitForTimeout(600)
const metadata=[]
for(const pose of ['front']){
 await page.evaluate(p=>window.__webpodDevicePreview!.setOrientation(p==='front'?{pitchDeg:0,yawDeg:0,rollDeg:0}:{pitchDeg:10,yawDeg:-48,rollDeg:-2}),pose);await page.waitForTimeout(200)
 const info=await page.evaluate(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name);const fiber=await import(urls.find(n=>n.includes('/@react-three_fiber.js'))!);const {Vector3}=await import(urls.find(n=>n.includes('/three.js?'))!);const state=[...fiber._roots.values()][0].store.getState()
  let lcd:any;const glass:any[]=[];const original=new Map();state.scene.traverse((o:any)=>{original.set(o,o.visible);if(o.material?.name?.startsWith('webpod-lcd-'))lcd=o;if(o.material?.transparent&&o.material?.transmission===0)glass.push(o)})
  Reflect.set(window,'__isolation',{state,original,glass});const c=state.gl.domElement.getBoundingClientRect();const points=[]
  for(const x of [-166,166])for(const y of [-126,152]){const v=new Vector3(x,y,.1).applyMatrix4(lcd.matrixWorld).project(state.camera);points.push({x:c.x+(v.x+1)*c.width/2,y:c.y+(1-v.y)*c.height/2})}
  const x=Math.floor(Math.min(...points.map(p=>p.x))),y=Math.floor(Math.min(...points.map(p=>p.y)));return{clip:{x,y,width:Math.ceil(Math.max(...points.map(p=>p.x)))-x,height:Math.ceil(Math.max(...points.map(p=>p.y)))-y},glass:glass.map(o=>({material:o.material.type,opacity:o.material.opacity,z:o.position.z}))}
 });metadata.push({pose,...info})
 for(const hide of ['device-steel-back']){
  await page.evaluate(name=>{const {state,original,glass}=Reflect.get(window,'__isolation');original.forEach((visible:boolean,o:any)=>o.visible=visible);if(name==='glass')glass.forEach((o:any)=>o.visible=false);else if(name!=='none')state.scene.getObjectByName(name).visible=false;state.invalidate()},hide);await page.waitForTimeout(120);await page.screenshot({path:resolve(dir,`${pose}-${hide}.png`),clip:info.clip})
 }
 await page.evaluate(()=>{const {state,original}=Reflect.get(window,'__isolation');original.forEach((visible:boolean,o:any)=>o.visible=visible);state.invalidate()})
}
const rays=await page.evaluate(async()=>{const {state}=Reflect.get(window,'__isolation');const urls=performance.getEntriesByType('resource').map(e=>e.name);const {Vector3,Raycaster}=await import(urls.find(n=>n.includes('/three.js?'))!);let lcd:any;state.scene.traverse((o:any)=>{if(o.material?.name?.startsWith('webpod-lcd-'))lcd=o});const origin=state.camera.getWorldPosition(new Vector3());return [6,6.6,6.75,6.9,7.1,7.5,8].map(inset=>{const target=new Vector3(136+inset,0,.1).applyMatrix4(lcd.matrixWorld);const ray=new Raycaster(origin,target.clone().sub(origin).normalize());return{inset,hits:ray.intersectObjects(state.scene.children,true).filter((h:any)=>h.object.visible).map((h:any)=>({name:h.object.name,material:h.object.material?.type,transparent:h.object.material?.transparent,distance:h.distance}))}})});await writeFile(resolve(dir,'ring-rays.json'),JSON.stringify(rays,null,2));await browser.close();await writeFile(resolve(dir,'rear-isolation-metadata.json'),JSON.stringify({hashes,metadata},null,2))
