import { chromium } from '../../../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from '../../../../../apps/web/tests/deterministic-apple-music'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
const dir=import.meta.dirname
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-blink-features=CanvasDrawElement']})
const page=await browser.newPage({viewport:{width:1200,height:900},deviceScaleFactor:3})
await installDeterministicAppleMusic(page)
await page.goto('http://localhost:3000/_spike/device?capture=')
await page.waitForSelector('.wp-panel')
await page.waitForTimeout(1000)
const metadata=await page.evaluate(async()=>{
 const urls=performance.getEntriesByType('resource').map(e=>e.name)
 const fiber=await import(urls.find(n=>n.includes('/@react-three_fiber.js'))!)
 const three=await import(urls.find(n=>n.includes('/three.js?'))!)
 const state=[...fiber._roots.values()][0].store.getState()
 const original={toneMapping:state.gl.toneMapping,exposure:state.gl.toneMappingExposure}
 const glass:any[]=[];const materials:any[]=[]
 state.scene.traverse((o:any)=>{if(o.material?.name==='webpod-lcd-dark')materials.push({name:o.material.name,toneMapped:o.material.toneMapped,type:o.material.type,map:o.material.map?.type});if(o.material?.transparent&&o.material?.transmission===0)glass.push(o)})
 Reflect.set(window,'__parity',{state,three,original,glass})
 return {original,AgXToneMapping:three.AgXToneMapping,NoToneMapping:three.NoToneMapping,materials,glassCount:glass.length}
})
const box=await page.locator('.wp-panel').boundingBox()
if(!box)throw new Error('panel absent')
for(const glass of [false,true])for(const mode of ['NoToneMapping','AgXToneMapping']){
 await page.evaluate(({glass,mode})=>{const s=Reflect.get(window,'__parity');s.glass.forEach((o:any)=>o.visible=glass);s.state.gl.toneMapping=s.three[mode];s.state.invalidate()}, {glass,mode})
 await page.waitForTimeout(200)
 await page.screenshot({path:resolve(dir,`lcd-${glass?'glass':'bare'}-${mode}.png`),clip:box})
}
await page.evaluate(()=>{const s=Reflect.get(window,'__parity');s.glass.forEach((o:any)=>o.visible=true);s.state.gl.toneMapping=s.original.toneMapping;s.state.invalidate()})
await writeFile(resolve(dir,'tone-mapping-parity.json'),JSON.stringify({metadata,box},null,2))
await browser.close()
