import { chromium } from '@playwright/test'
import { installDeterministicAppleMusic } from '../../../../../apps/web/tests/deterministic-apple-music'
const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-blink-features=CanvasDrawElement'] })
const context = await browser.newContext({ hasTouch: true })
const page = await context.newPage()
await installDeterministicAppleMusic(page)
// Reproduce previous camera/stage settings through the browser response only.
await page.route('**/src/device-page.tsx*', async route => {
 const response = await route.fetch()
 const body = (await response.text()).replaceAll('cameraMobileFraming: !capture', 'cameraMobileFraming: false').replaceAll('"data-mobile-framing": capture ? undefined : "true"', '"data-mobile-framing": undefined')
 await route.fulfill({response,body})
})
const results = []
for (const [width, height] of [[390,844]]) {
 await page.setViewportSize({width,height})
 await page.goto('http://127.0.0.1:4338/webpod')
 await page.waitForFunction(() => window.__webpodDevicePreview !== undefined, {timeout: 30000}).catch(async e => { console.log(page.url(), await page.locator("body").innerText()); await page.screenshot({path:`${import.meta.dirname}/blocked.png`}); throw e })
 await page.waitForFunction(() => document.querySelector('[data-device-reveal="complete"]'))
 await page.waitForTimeout(2000)
 await page.evaluate(() => window.__webpodDevicePreview!.setOrientation({pitchDeg:0,yawDeg:0,rollDeg:0}))
 await page.waitForTimeout(500)
 const metrics = await page.locator('.webpod-device-preview canvas').evaluate((canvas: HTMLCanvasElement) => {
  const rect = canvas.getBoundingClientRect(), data = canvas.dataset
  const width = Number(data.wpProjectedWidth)*rect.width/2, height=Number(data.wpProjectedHeight)*rect.height/2
  return { width,height,left:rect.x+(rect.width-width)/2,top:rect.y+(rect.height-height)/2, canvas: {width:rect.width,height:rect.height},distance:data.wpCameraFitDistance,padding:data.wpCameraFitPadding }
 })
 await page.screenshot({path:`${import.meta.dirname}/before-${width}x${height}.png`})
 const client = await context.newCDPSession(page)
 const probes = []
 for (const [name,x,y] of [['edge35',metrics.left+35,metrics.top+metrics.height*.5],['lcd',width/2,metrics.top+metrics.height*.2],['wheel',width/2+metrics.width*.2,metrics.top+metrics.height*.71],['select',width/2,metrics.top+metrics.height*.71]] as const) {
  await page.evaluate(() => window.__webpodDevicePreview!.setOrientation({pitchDeg:0,yawDeg:0,rollDeg:0}))
  await page.waitForTimeout(100)
  await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
  const active = await page.locator('.webpod-device-preview__stage').getAttribute('data-orientation-grab')
  await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+35,y:y+10}]})
  await client.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]})
  probes.push({name,active,orientation:await page.evaluate(() => window.__webpodDevicePreview!.get().orientation)})
 }
 await page.evaluate(() => window.__webpodDevicePreview!.setOrientation({pitchDeg:45,yawDeg:45,rollDeg:0}))
 await page.waitForTimeout(100)
 await page.screenshot({path:`${import.meta.dirname}/before-${width}x${height}-rotated.png`})
 const rotated = await page.locator('.webpod-device-preview canvas').evaluate((c:HTMLCanvasElement)=>({x:c.dataset.wpProjectedExtentX,y:c.dataset.wpProjectedExtentY,distance:c.dataset.wpCameraFitDistance}))
 results.push({viewport:{width,height},metrics,probes,rotated})
 await client.detach()
}
await Bun.write(`${import.meta.dirname}/before-measurements.json`,JSON.stringify(results,null,2))
console.log(JSON.stringify(results,null,2))
await browser.close()
