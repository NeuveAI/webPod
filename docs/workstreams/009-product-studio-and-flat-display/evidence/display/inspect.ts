import { chromium } from '../../../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from '../../../../../apps/web/tests/deterministic-apple-music'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-blink-features=CanvasDrawElement']})
const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:3})
await installDeterministicAppleMusic(page)
await page.goto('http://localhost:3000/_spike/device?capture=')
await page.waitForSelector('.wp-panel')
await page.waitForTimeout(1000)
const info=await page.evaluate(()=>({ resources:performance.getEntriesByType('resource').map(e=>e.name).filter(n=>/fiber|three/.test(n)),canvases:[...document.querySelectorAll('canvas')].map(e=>({keys:Object.keys(e),attrs:[...e.attributes].map(x=>[x.name,x.value])}))}))
console.log(JSON.stringify(info))
const sceneInfo = await page.evaluate(async () => {
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/@react-three_fiber.js'))
  if (!url) throw new Error('fiber module absent')
  const mod=await import(url)
  const roots=mod._roots
  const state=[...roots.values()][0].store.getState()
  Reflect.set(window,'__displayDiagnosisScene',state)
  const visibility=new Map();state.scene.traverse((o: {uuid:string;visible:boolean})=>visibility.set(o.uuid,o.visible));Reflect.set(window,'__displayDiagnosisVisibility',visibility)
  const result: unknown[]=[]
  state.scene.traverse((o: {isMesh?:boolean;name:string;material?:{name?:string;transparent?:boolean};geometry?:{getAttribute:(n:string)=>{count:number;getZ:(i:number)=>number}}})=>{
    if(o.isMesh)result.push({name:o.name,material:o.material?.name,transparent:o.material?.transparent})
  })
  return result
})
console.log(JSON.stringify(sceneInfo))
const rays=await page.evaluate(async()=>{
  const state=Reflect.get(window,'__displayDiagnosisScene')
  const url=performance.getEntriesByType('resource').map(e=>e.name).find(n=>n.includes('/three.js?'))
  if(!url)throw new Error('Three module absent')
  const {Vector3,Raycaster}=await import(url)
  let lcd: typeof state.scene=null
  state.scene.traverse((object: typeof state.scene)=>{if(object.material?.name==='webpod-lcd-dark')lcd=object})
  const body=state.scene.getObjectByName('device-body')
  const positions=lcd.geometry.getAttribute('position')
  const zs=new Set<number>();for(let i=0;i<positions.count;i++)zs.add(positions.getZ(i))
  const results=[]
  const origin=state.camera.getWorldPosition(new Vector3())
  for(const x of [-120,-80,0,80,120])for(const belowTop of [.25,.5,1,1.5,2,3]){
    const target=new Vector3(x,102-belowTop,.1).applyMatrix4(lcd.matrixWorld)
    const ray=new Raycaster(origin,target.clone().sub(origin).normalize())
    const hit=ray.intersectObject(body)[0]
    results.push({x,belowTop,bodyOccludes:hit!==undefined&&hit.distance<target.distanceTo(origin),nearerBy:hit?target.distanceTo(origin)-hit.distance:null})
  }
  return {camera:origin.toArray(),lcdZPlanes:[...zs],results}
})
await writeFile(resolve(import.meta.dirname,'live-perspective-rays.json'),JSON.stringify(rays,null,2))
await page.screenshot({path:resolve(import.meta.dirname,'before-front.png')})
const box=await page.locator('.wp-panel').boundingBox()
if(box) await page.screenshot({path:resolve(import.meta.dirname,'before-lcd-close.png'),clip:{x:box.x-8,y:box.y-8,width:box.width+16,height:box.height+16}})
for (const hide of ['device-body','device-display-well','device-display-mask','glass']) {
  await page.evaluate((name)=>{
    const state=Reflect.get(window,'__displayDiagnosisScene')
    const original=Reflect.get(window,'__displayDiagnosisVisibility')
    state.scene.traverse((o: {uuid:string;visible:boolean})=>{o.visible=original.get(o.uuid)})
    state.scene.traverse((o: {isMesh?:boolean;name:string;visible:boolean;material?:{transmission?:number;name?:string;transparent?:boolean}})=>{
      if(o.isMesh && (o.name===name || (name==='glass' && o.material?.transparent && o.material?.transmission===0)))o.visible=false
    })
    state.invalidate()
  },hide)
  await page.waitForTimeout(120)
  if(box) await page.screenshot({path:resolve(import.meta.dirname,`without-${hide}.png`),clip:{x:box.x-8,y:box.y-8,width:box.width+16,height:box.height+16}})
}
await page.reload()
await page.waitForSelector('.wp-panel')
await page.evaluate(()=>window.__webpodDevicePreview?.setOrientation({pitchDeg:10,yawDeg:-48,rollDeg:-2}))
await page.waitForTimeout(400)
await page.screenshot({path:resolve(import.meta.dirname,'before-quarter.png')})
await browser.close()
