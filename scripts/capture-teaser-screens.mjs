// Regenerate against bun run dev: bun scripts/capture-teaser-screens.mjs
// Captures the actual Panel with public fixture data; never an Apple account.
import { chromium } from '@playwright/test'
import { fileURLToPath, URL } from 'node:url'
import { log } from 'node:console'
/* global document */
const projectRoot = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '')
const root = '/@fs' + projectRoot
const browser = await chromium.launch({channel:'chrome',headless:true})
const context = await browser.newContext()
const page = await context.newPage()
page.setDefaultTimeout(15000)
page.on('pageerror', error => log('PAGE ERROR', error.message))
try {
await page.goto('http://localhost:3000/')
await page.setViewportSize({width:1200,height:900})
await page.bringToFront()
await page.evaluate(async (root) => {
 const {default: {createElement}} = await import('/node_modules/.vite/deps/react.js')
 const {default: {createRoot}} = await import('/node_modules/.vite/deps/react-dom_client.js')
 const {Panel} = await import(`${root}/packages/panel/src/Panel.tsx`)
 const {fixtureProvider,fixtureNavigationSource} = await import(`${root}/packages/panel/src/fixtures.ts`)
 await fixtureProvider.authorize()
 const host=document.createElement('div')
 host.id='teaser-capture'
 host.style.cssText='position:fixed;left:0;top:0;z-index:2147483647;width:272px;height:204px;transform:scale(3);transform-origin:top left;--wp-raster-scale:1'
 document.body.append(host)
 createRoot(host).render(createElement(Panel,{provider:fixtureProvider,navigationSource:fixtureNavigationSource,colourway:'dark',artworkTone:null}))
}, root)
await page.locator('#teaser-capture .wp-list-row').first().waitFor()
for(let i=0;i<4;i++) {
 await page.evaluate(async ({root, index}) => {
  const state = await import(`${root}/packages/state/src/index.ts`)
  const {mainMenuFrame} = await import(`${root}/packages/panel/src/fixtures.ts`)
  state.deviceStore.set(state.resetStackActionAtom,[{...mainMenuFrame(),highlightIndex:index+1}])
 },{root,index:i})
 await page.waitForTimeout(150)
 await capture('menu-'+i)
}
await page.evaluate(async (root) => {
 const {fixtureProvider} = await import(`${root}/packages/panel/src/fixtures.ts`)
 const tracks = fixtureProvider.catalog.tracks.map((track) => ({...track, artwork:{kind:'fixed',sizes:[{url:root+'/packages/panel/src/assets/now-playing-art.png',w:320,h:320}]}}))
 await fixtureProvider.play({kind:'tracks',tracks,startIndex:0})
 const {showNowPlayingScreen} = await import(`${root}/packages/panel/src/Panel.tsx`)
 showNowPlayingScreen()
}, root)
await page.waitForTimeout(500)
for(let i=0;i<8;i++) {
 await page.evaluate(async ({root, position}) => {
  const {fixtureProvider} = await import(`${root}/packages/panel/src/fixtures.ts`)
  await fixtureProvider.seek(position)
 },{root,position:30000+i*4000})
 await page.waitForTimeout(150)
 await capture('playing-'+i)
}
async function capture(name) {
 // Fixtures do not serve album URLs. Supply the bundled sample cover while
 // retaining the actual Panel's artwork element, border and sizing.
 await page.evaluate(async (root) => {
  const art = document.querySelector('#teaser-capture .wp-art')
  const image = art?.querySelector('img')
  if (image) {
   image.src = root + '/packages/panel/src/assets/now-playing-art.png'
   await image.decode()
   art.style.backgroundImage = 'none'
  }
 }, root)
 await page.locator('#teaser-capture').screenshot({path:projectRoot+'/apps/web/public/teaser/'+name+'.png',scale:'css'})
 log('Captured',name)
}
} finally {await page.close();await browser.close()}
