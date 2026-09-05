import { chromium } from '../../../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from '../../../../../apps/web/tests/deterministic-apple-music'
import { resolve } from 'node:path'
import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
const dir=import.meta.dirname
const sourceFiles=['packages/device/src/screen-aperture.ts','packages/device/src/screen-geometry.ts','packages/device/src/Device.tsx','packages/device/src/front-surface.ts','packages/device/src/curved-shell.ts','packages/device/src/light-rig.ts','packages/device/src/materials.ts','packages/device/src/renderer-defaults.ts','packages/composite/src/html-in-canvas.ts']
async function hashes(){return Object.fromEntries(await Promise.all(sourceFiles.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])))}
const before=await hashes()
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-blink-features=CanvasDrawElement']})
const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:3})
await installDeterministicAppleMusic(page)
await page.goto('http://localhost:3000/_spike/device?capture=')
await page.waitForSelector('.wp-panel')
await page.waitForTimeout(1000)
const frames=[]
for(const colourway of ['black','white'] as const)for(const pose of ['front','quarter'] as const){
 await page.evaluate(({colourway,pose})=>{window.__webpodDevicePreview!.setColourway(colourway);window.__webpodDevicePreview!.setOrientation(pose==='front'?{pitchDeg:0,yawDeg:0,rollDeg:0}:{pitchDeg:10,yawDeg:-48,rollDeg:-2})},{colourway,pose})
 await page.waitForTimeout(400)
 const clip=await page.evaluate(async()=>{
  const urls=performance.getEntriesByType('resource').map(e=>e.name)
  const fiber=await import(urls.find(n=>n.includes('/@react-three_fiber.js'))!)
  const {Vector3}=await import(urls.find(n=>n.includes('/three.js?'))!)
  const state=[...fiber._roots.values()][0].store.getState();let lcd:any
  state.scene.traverse((o:any)=>{if(o.material?.name?.startsWith('webpod-lcd-'))lcd=o})
  lcd.geometry.computeBoundingBox();const b=lcd.geometry.boundingBox
  const canvas=state.gl.domElement.getBoundingClientRect()
  const points=[]
  for(const x of [b.min.x-25,b.max.x+25])for(const y of [b.min.y-25,b.max.y+65]){
   const p=new Vector3(x,y,b.max.z).applyMatrix4(lcd.matrixWorld).project(state.camera)
   points.push({x:canvas.x+(p.x+1)*canvas.width/2,y:canvas.y+(1-p.y)*canvas.height/2})
  }
  const x=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))))
  const y=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))))
  return {x,y,width:Math.min(innerWidth-x,Math.ceil(Math.max(...points.map(p=>p.x)))-x),height:Math.min(innerHeight-y,Math.ceil(Math.max(...points.map(p=>p.y)))-y)}
 })
 const stem=`${colourway}-${pose}`
 await page.screenshot({path:resolve(dir,`${stem}-full.png`)})
 await page.screenshot({path:resolve(dir,`${stem}-lcd-bezel.png`),clip})
 const box=await page.locator('.wp-panel').boundingBox()
 if(pose==='front'&&box)await page.screenshot({path:resolve(dir,`${stem}-lcd-matched.png`),clip:{x:box.x-8,y:box.y-8,width:box.width+16,height:box.height+16}})
 frames.push({stem,clip,panel:box})
}
await browser.close()
const after=await hashes()
await writeFile(resolve(dir,'capture-metadata.json'),JSON.stringify({timestamp:new Date().toISOString(),viewport:{width:1200,height:900},dpr:3,route:'http://localhost:3000/_spike/device?capture=',frames,sourcesStable:JSON.stringify(before)===JSON.stringify(after),before,after},null,2))
