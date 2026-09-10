// Run against a local dev server: WEBPOD_SMOKE_URL=http://127.0.0.1:4338 bun docs/workstreams/023-mobile-tactility/evidence/haptics/browser-smoke.ts
import { chromium } from '../../../../../packages/panel/node_modules/@playwright/test/index.mjs'
import { installDeterministicAppleMusic } from '../../../../../apps/web/tests/deterministic-apple-music.ts'
import { DEVICE_LAYOUT } from '../../../../../packages/device/src/layout.ts'
const browser = await chromium.launch({channel:'chrome',args:['--enable-blink-features=CanvasDrawElement']})
const results = []
for (const supported of [true,false]) {
 const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true})
 const pulses: string[] = [], errors: string[] = []
 page.on('console',message=>{if(message.text().startsWith('HAPTIC:'))pulses.push(message.text())})
 page.on('pageerror',error=>errors.push(error.message))
 await page.addInitScript(supported=>{Object.defineProperty(navigator,'vibrate',{configurable:true,value:supported?(pattern: number|number[])=>{console.log('HAPTIC:'+JSON.stringify(pattern));return true}:undefined})},supported)
 await installDeterministicAppleMusic(page)
 await page.goto(`${process.env['WEBPOD_SMOKE_URL'] ?? 'http://127.0.0.1:4338'}/_spike/device?capture=&view=front&colourway=black`,{waitUntil:'domcontentloaded'})
 await page.locator('[data-composite-tier="T1"]').waitFor()
 const canvas=page.locator('canvas').first(), box=await canvas.boundingBox()
 if(!box)throw new Error('Canvas missing')
 // Explicit capture framing fits against the narrower viewport dimension.
 const height=Math.min(box.height-68,(box.width-68)*DEVICE_LAYOUT.body.height/DEVICE_LAYOUT.body.width)
 const wheel={x:box.x+box.width/2,y:box.y+box.height/2-DEVICE_LAYOUT.wheel.centerY*height/DEVICE_LAYOUT.body.height}
 await page.waitForTimeout(1200)
 await page.touchscreen.tap(195,521)
 await page.waitForTimeout(100)
 await page.touchscreen.tap(195,450)
 const cdp=await page.context().newCDPSession(page)
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:245,y:470}]})
 for(const [x,y] of [[257,482],[265,497],[267,520],[260,540],[245,560]]) {
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]})
  await page.waitForTimeout(65)
 }
 await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]})
 await page.waitForTimeout(150)
 await page.screenshot({path:`${import.meta.dir}/${supported?'native-spy':'unsupported'}.png`})
 results.push({supported,box,wheel,actualTouches:{center:[195,521],menu:[195,450],arc:[[245,470],[257,482],[265,497],[267,520],[260,540],[245,560]],terminal:'touchCancel'},pulses,errors,hiddenSwitches:await page.locator('input[switch]').count()})
 if (errors.length > 0) throw new Error(`Browser errors: ${errors.join('; ')}`)
 if (supported && (!pulses.includes('HAPTIC:[17,3,3,1]') || !pulses.includes('HAPTIC:[4,4]') || !pulses.includes('HAPTIC:0'))) throw new Error('Missing button, detent or cancellation feedback')
 if (!supported && (pulses.length > 0 || await page.locator('input[switch]').count() > 0)) throw new Error('Unsupported browser allocated feedback')
 await page.close()
}
await Bun.write(`${import.meta.dir}/browser-smoke.json`,JSON.stringify(results,null,2))
console.log(JSON.stringify(results,null,2))
await browser.close()
