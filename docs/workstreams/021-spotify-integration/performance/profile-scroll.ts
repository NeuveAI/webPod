import { chromium } from '@playwright/test'
const browser = await chromium.connectOverCDP('ws://127.0.0.1:9222/devtools/browser/c5a0fdb2-af0b-4055-8047-a0af70810358')
const page = browser.contexts().flatMap(c => c.pages()).find(p => p.url() === 'http://127.0.0.1:3000/webpod')!
const cdp = await page.context().newCDPSession(page)
await page.locator('[role="application"]').focus()
if (await page.locator('[role="listbox"]').first().getAttribute('aria-label') === 'Music categories') await page.keyboard.press('Enter')
console.log(await page.locator('[role="listbox"]').first().getAttribute('aria-label'))
const box = await page.locator('[role="application"]').boundingBox()
await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
const label = process.argv[2] ?? 'baseline'
for (const [speed, interval, delta] of [['slow',120,30],['medium',40,60],['fast',8,120]] as const) {
 await page.evaluate(() => {
  const target = window as any
  target.profileLongTasks = []
  target.profileGaps = []
  target.profileObserver = new PerformanceObserver(list => { for (const e of list.getEntries()) target.profileLongTasks.push(e.duration) })
  target.profileObserver.observe({type:'longtask',buffered:false})
  let previous = performance.now()
  const token = (target.profileToken ?? 0) + 1
  target.profileToken = token
  target.profileRunning = true
  const frame = (now: number) => { if (!target.profileRunning || target.profileToken !== token) return; target.profileGaps.push(now - previous); previous = now; requestAnimationFrame(frame) }
  requestAnimationFrame(frame)
 })
 await cdp.send('Profiler.enable')
 await cdp.send('Profiler.setSamplingInterval',{interval:1000})
 await cdp.send('Profiler.start')
 for (let i=0;i<36;i++) { await page.mouse.wheel(0,i<18?delta:-delta); await new Promise(r=>setTimeout(r,interval)) }
 await new Promise(r=>setTimeout(r,250))
 const {profile} = await cdp.send('Profiler.stop')
 await Bun.write(`docs/workstreams/021-spotify-integration/performance/${label}-${speed}.cpuprofile`,JSON.stringify(profile))
 const metrics = await page.evaluate(() => {
  const t=window as any;t.profileRunning=false;t.profileObserver.disconnect()
  const gaps=t.profileGaps.sort((a:number,b:number)=>a-b)
  return {longTasks:t.profileLongTasks,frames:gaps.length,p95FrameGap:gaps[Math.floor(gaps.length*.95)],maxFrameGap:gaps.at(-1)}
 })
 const times=new Map<number,number>();profile.samples?.forEach((id:number,i:number)=>times.set(id,(times.get(id)??0)+(profile.timeDeltas?.[i]??0)))
 const top=profile.nodes.map((n:any)=>({fn:n.callFrame.functionName,url:n.callFrame.url.replace(/\?.*/,''),ms:Math.round((times.get(n.id)??0)/1000)})).sort((a:any,b:any)=>b.ms-a.ms).slice(0,18)
 console.log(JSON.stringify({label,speed,metrics,top}))
}
await cdp.detach()
// Disconnect from the user's browser without closing its tabs.
process.exit(0)
