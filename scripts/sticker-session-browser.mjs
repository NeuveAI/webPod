/* global URL, fetch, window, console */
// Run against the development server: bun scripts/sticker-session-browser.mjs
// Synthetic authentication and isolated cookies: never touches a real collection.
import { chromium, expect } from '@playwright/test'
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-blink-features=CanvasDrawElement']})
try {
const page=await browser.newPage()
let authorized=false, imports=0
const stickerRequests=[]
let releaseImport
let importGate
const inventory={stickerIds:['PW-A01'],packs:[{id:'starter',stickerIds:['PW-A01'],source:'starter',earnedAt:1,openedAt:2}],placements:[{stickerId:'PW-A01',surface:'back',x:.5,y:.5,width:.25,rotationDeg:0}],placementRevision:7,importStatus:'complete',progress:["metal","pop","rock","hip-hop","rnb","electronic","indie","jazz","classical","country","reggae","latin"].map(genre=>({genre,listenedMs:0,nextThresholdMs:300000}))}
await page.route('**/api/stickers**',async route=>{
 const req=route.request();stickerRequests.push(req.method());const path=new URL(req.url()).pathname
 if(req.method()==='DELETE') {authorized=false;return route.fulfill({json:{}})}
 if(path.endsWith('/device')) return route.fulfill({json:{ready:true}})
 if(path.endsWith('/session')) { imports++; await importGate; authorized=true;return route.fulfill({json:inventory}) }
 return route.fulfill({status:authorized?200:401,json:authorized?inventory:{error:'unauthorized'}})
})
page.setDefaultTimeout(10000)
await page.goto('http://localhost:3000/')

await page.getByRole('button',{name:/Sign in to play/}).waitFor()
assert.deepEqual(stickerRequests, [], 'Signed-out landing must make no sticker requests')
await page.evaluate(async()=>{
 const source=await (await fetch('/src/browser-welcome.tsx')).text(); const url=source.match(/from "([^"]*music-runtime[^"]*)"/)[1]; window.testRuntimeUrl=url; const r=await import(url); const p=r.musicRuntime.getSnapshot().provider
 let session=null;const callbacks=new Set()
 Object.defineProperty(p,'session',{configurable:true,get:()=>session})
 Object.assign(p,{configure:async()=>{},authorize:async()=>{session={status:'authorized',provider:'apple',storefront:'us',userIdentifier:null};for(const c of callbacks)c(session);return session},unauthorize:async()=>{session=null;for(const c of callbacks)c(null)},onSessionChange:c=>{callbacks.add(c);return()=>callbacks.delete(c)},withMusicAuthorization:async c=>c('synthetic'),libraryList:async()=>({items:[],next:null}),stationsList:async()=>[],supports:()=>false})
 await r.selectMusicRuntime('apple')
})

assert.deepEqual(stickerRequests, [], 'Unauthenticated session configuration must make no sticker requests')
for(let cycle=0;cycle<2;cycle++) {
 importGate=new Promise(resolve=>{releaseImport=resolve})
 await page.getByRole('button',{name:/Sign in to play/}).click()
await page.waitForURL('**/webpod')
 const region=page.getByRole('region')
 await region.press('Home')
 await page.waitForTimeout(1000)
 for(let i=0;i<15;i++) await region.press('Shift+ArrowRight')
 await expect(page.getByRole('status')).toHaveText('Restoring your saved stickers…')
 releaseImport()
 await expect.poll(()=>page.evaluate(async()=>{
   const source=await (await fetch('/src/sticker-runtime.ts')).text()
   const stateUrl=source.match(/from "([^"]*packages\/state[^"]*)"/)[1]
   const s=await import(stateUrl)
   return s.deviceStore.get(s.stickerInventoryAtom)?.placements ?? null
 })).toEqual(inventory.placements)
 await expect(page.getByRole('button',{name:/Edit Night Shift/})).toHaveCount(1)
 if(cycle===1) {
   await page.evaluate(async()=>{
     const r=await import(window.testRuntimeUrl)
     const provider=r.musicRuntime.getSnapshot().provider
     const original=provider.libraryList
     let release
     const gate=new Promise(resolve=>{release=resolve})
     provider.libraryList=async()=>{await gate;return {items:[],next:null}}
     window.finishLibrary=()=>{provider.libraryList=original;release()}
     void r.selectMusicRuntime('apple')
   })
   await page.getByRole('button',{name:'Settings',exact:true}).click()
   await expect(page.getByRole('button',{name:'Sign out of Apple Music',exact:true})).toBeVisible()
   await page.evaluate(()=>window.finishLibrary())
   console.log('Sign out stays visible while the authorized library is loading')
 }
 assert.equal(imports,cycle+1)
 console.log(`Sign-in cycle ${cycle+1}: saved placement restored`)
 if(cycle===0){await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('button',{name:'Sign out of Apple Music',exact:true}).click();await page.waitForURL('http://localhost:3000/')}
}
await expect.poll(()=>page.evaluate(async()=>{const r=await import(window.testRuntimeUrl);return r.musicRuntime.getSnapshot().phase})).toBe('authorized')
const runtimeFile=new URL('../apps/web/src/music-runtime.ts',import.meta.url)
const originalSource=await readFile(runtimeFile,'utf8')
await page.evaluate(async()=>{
  const r=await import(window.testRuntimeUrl)
  window.beforeHotProvider=r.musicRuntime.getSnapshot().provider
  window.beforeHotSource=r.musicRuntime.getSnapshot().source
})
try {
  await writeFile(runtimeFile,originalSource+'\n// Runtime HMR regression probe\n')
  await expect.poll(()=>page.evaluate(async()=>{
    const source=await (await fetch('/src/browser-welcome.tsx')).text()
    const url=source.match(/from "([^"]*music-runtime[^"]*)"/)[1]
    if(url===window.testRuntimeUrl) return { changed: false }
    const r=await import(url)
    return {changed:true,provider:r.musicRuntime.getSnapshot().provider===window.beforeHotProvider,source:r.musicRuntime.getSnapshot().source===window.beforeHotSource,phase:r.musicRuntime.getSnapshot().phase}
  })).toEqual({changed:true,provider:true,source:true,phase:'authorized'})
  console.log('Hot reload preserves the authenticated provider and loaded library')
} finally { await writeFile(runtimeFile,originalSource) }
} finally { await browser.close() }
