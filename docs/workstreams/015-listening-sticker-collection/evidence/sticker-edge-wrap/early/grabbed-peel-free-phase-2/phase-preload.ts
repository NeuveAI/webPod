// Evidence-only extension of the frozen phase driver; no product or driver source edits.
import { chromium } from '/Users/vinicius/code/webPod/apps/web/node_modules/@playwright/test'
const evidence = '/Users/vinicius/code/webPod/docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/early/grabbed-peel-free-phase-2'
const inputPath = '/Users/vinicius/code/webPod/docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/early/wrapped-witness-7/manifest.json'
const inputText = await Bun.file(inputPath).text(), inputs = JSON.parse(inputText)
const hash = (value: string) => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const preloadText = await Bun.file(import.meta.filename).text()
await Bun.write(evidence + '/preload-installed.json', JSON.stringify({ preloadSHA256: hash(preloadText), inputSHA256: hash(inputText), installedAt: new Date().toISOString(), browserStarted: false }, null, 2))
const records: unknown[] = []
const publish = async () => Bun.write(evidence + '/extra-phases.json', JSON.stringify({ inputText, inputSHA256: hash(inputText), preloadSHA256: hash(preloadText), records, scope: 'Same frozen build plus evidence-only Playwright screenshot interceptor. Original16/32/51.2/57.6/64 preserved, then native80/100/164 before cancel. Front164 turns rightward to remain in viewport. Recorded DOM curl/stage are observed; frontier/transport are derived from the existing phase formula. No autonomous settling, continuous-path or performance claim.' }, null, 2))
const launch = chromium.launch.bind(chromium)
chromium.launch = async options => {
  if (!(await Bun.file(evidence + '/preload-installed.json').exists())) throw new Error('Missing phase preload installation marker')
  await Bun.write(evidence + '/preload-browser-entry.json', JSON.stringify({ preloadSHA256: hash(preloadText), enteredAt: new Date().toISOString() }, null, 2))
  const browser = await launch(options), newContext = browser.newContext.bind(browser)
  browser.newContext = async options => {
    const context = await newContext(options), newPage = context.newPage.bind(context)
    context.newPage = async () => {
      const page = await newPage(), screenshot = page.screenshot.bind(page)
      page.screenshot = async options => {
        const result = await screenshot(options)
        const face = String(options?.path).match(/phase-(side|front)-64-marked\.png$/)?.[1]
        if (!face) return result
        const w = inputs.find((w: any) => w.viewport.width === 1280 && w.face === face)
        if (!w) throw new Error('Missing extension input')
        const length = Math.hypot(w.partial.x - w.pickup.x, w.partial.y - w.pickup.y)
        for (const travel of [80, 100, 164]) {
          const point = face === 'front' && travel === 164 ? { x: w.pickup.x + 164, y: w.pickup.y } : { x: w.pickup.x + (w.partial.x - w.pickup.x) / length * travel, y: w.pickup.y + (w.partial.y - w.pickup.y) / length * travel }
          await page.evaluate(() => document.querySelector('[data-phase-diagnostic-marker]')?.remove())
          await page.mouse.move(point.x, point.y)
          const state = await page.locator('[data-sticker-stage]').evaluate(el => Object.fromEntries(Array.from(el.attributes).filter(a => a.name.startsWith('data-sticker-')).map(a => [a.name, a.value])))
          await screenshot({ path: `${evidence}/phase-${face}-${travel}.png` })
          await page.evaluate(({ point, origin, travel }) => {
            const host = document.createElement('div'); host.setAttribute('data-phase-diagnostic-marker', ''); host.setAttribute('aria-hidden', 'true'); host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647'
            for (const [p, color, label] of [[origin, '#49c8ff', 'Original pickup'], [point, '#ff9c42', `Pointer ${travel}px`]] as const) { const dot = document.createElement('span'); dot.style.cssText = `position:absolute;left:${p.x-5}px;top:${p.y-5}px;width:10px;height:10px;border:2px solid ${color};border-radius:50%;box-sizing:border-box`; const text = document.createElement('span'); text.textContent=label; text.style.cssText=`position:absolute;left:${p.x+10}px;top:${p.y+8}px;color:${color};background:#101820;font:11px monospace;padding:2px`; host.append(dot,text) }; document.body.append(host)
          }, { point, origin: w.pickup, travel })
          await screenshot({ path: `${evidence}/phase-${face}-${travel}-marked.png` })
          records.push({ face, travel, point, originalPickup: w.pickup, directionChange: face === 'front' && travel === 164, state, derived: { sourcePeelFront: 1, detachTransport: 1, expectedCurl: 1 - Math.min(1, (travel - 64) / 100) * .6 }, driverTimeMs: performance.now() })
          await publish()
        }
        await page.evaluate(() => document.querySelector('[data-phase-diagnostic-marker]')?.remove())
        return result
      }
      return page
    }
    return context
  }
  return browser
}
await publish()
