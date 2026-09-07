import { expect, type Page, type Request } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { StickerInventory, StickerPlacement } from '@webpod/stickers'
import { readStickerFrameObserver, summarizeStickerFrames } from './sticker-frame-observer'

type Point = { x: number; y: number }
/** Existing public inventory route and native pointer input; no product diagnostics. */
export async function verifyStickerEditorPerformance({ page, evidence, read, save, rear }: {
  page: Page; evidence: string; read(): Promise<StickerInventory>; save(placements: readonly StickerPlacement[]): Promise<void>; rear(): Promise<void>
}) {
  const outcomes: unknown[] = [], reports: { name: string; report: ReturnType<typeof summarizeStickerFrames> }[] = []
  let writes = 0
  const request = (request: Request) => { if (request.method() === 'PUT' && request.url().endsWith('/api/stickers/placements')) writes++ }
  page.on('request', request)
  const seed: StickerPlacement[] = [{ stickerId: 'PW-C01', surface: 'back', x: .4, y: .4, width: .25, rotationDeg: 0, wear: 0 }, { stickerId: 'PW-F01', surface: 'back', x: .65, y: .72, width: .25, rotationDeg: 0, wear: 0 }]
  const midpoint = async (selector: string): Promise<Point> => { const box = await page.locator(selector).boundingBox(); if (box === null) throw new Error(`Missing native control ${selector}`); return { x: box.x + box.width / 2, y: box.y + box.height / 2 } }
  const capture = async (name: string) => { reports.push({ name, report: summarizeStickerFrames(await readStickerFrameObserver(page)) }) }
  // Two rAF boundaries give the final native move a rendering opportunity; input
  // observation remains active, and none of the 24 intermediate moves await UI.
  const presented = () => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const settled = async () => { await expect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase', 'editing'); await expect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-hud-release', '1') }
  try {
    for (const width of [1280, 375]) {
      await page.setViewportSize({ width, height: 900 }); await save(seed); await page.reload(); await rear()
      const cdp = width === 375 ? await page.context().newCDPSession(page) : null
      const trace: { event: string; point?: Point; completion: number }[] = []
      const down = async (p: Point) => { if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...p, id: 1 }] }); else { await page.mouse.move(p.x, p.y); await page.mouse.down() }; trace.push({ event: 'down', point: p, completion: performance.now() }) }
      const move = async (p: Point) => { if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...p, id: 1 }] }); else await page.mouse.move(p.x, p.y); trace.push({ event: 'move', point: p, completion: performance.now() }) }
      const up = async () => { if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up(); trace.push({ event: 'up', completion: performance.now() }) }
      const line = async (from: Point, to: Point) => { for (let i = 1; i <= 24; i++) await move({ x: from.x + (to.x - from.x) * i / 24, y: from.y + (to.y - from.y) * i / 24 }) }
      const saved = async () => { const value = (await read()).placements.find(p => p.stickerId === 'PW-C01'); if (value === undefined) throw new Error('Missing saved C01'); return value }
      try {
        // No screenshot, sleep or preselection query warms the first contour.
        const pickup = await midpoint('[data-sticker-placed="PW-C01"]')
        await down(pickup); await up()
        await expect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-sticker-editor', 'PW-C01')
        await expect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-hud-presence', '1.000')
        await capture(`${width}-cold-selection`)
        const grip = await midpoint('[data-contour-corner="0"]'), beforeRotate = writes
        await down(grip); await line(grip, { x: grip.x + 43, y: grip.y + 28 }); await presented()
        const angleText = await page.locator('[data-contour-corner="0"] g').getAttribute('transform')
        const angle = Number(/^rotate\(([-\d.e+]+)/.exec(angleText ?? '')?.[1]); expect(Number.isFinite(angle)).toBe(true); expect(Math.abs(angle)).toBeGreaterThan(5)
        const rotationSave = page.waitForResponse(r => r.url().endsWith('/api/stickers/placements') && r.request().method() === 'PUT')
        await up(); expect((await rotationSave).status()).toBe(200); await settled(); await capture(`${width}-rotation`)
        const rotated = await saved(); expect(rotated.rotationDeg).toBeCloseTo(angle, 6); expect(writes).toBe(beforeRotate + 1)
        await page.screenshot({ path: resolve(evidence, `${width}-rotation-settled.png`) })
        const rail = await page.getByRole('slider', { name: 'Sticker wear' }).boundingBox(); if (rail === null) throw new Error('Missing wear rail')
        const from = { x: rail.x + 10, y: rail.y + rail.height / 2 }, to = { x: rail.x + rail.width * .8, y: from.y }, beforeWear = writes
        await down(from); await line(from, to); await presented()
        const wear = Number(await page.getByRole('slider', { name: 'Sticker wear' }).inputValue()); expect(wear).toBeGreaterThan(.5)
        const wearSave = page.waitForResponse(r => r.url().endsWith('/api/stickers/placements') && r.request().method() === 'PUT')
        await up(); expect((await wearSave).status()).toBe(200); await settled(); await capture(`${width}-wear`)
        const worn = await saved(); expect(worn.wear).toBe(wear); expect(worn.rotationDeg).toBe(rotated.rotationDeg); expect(writes).toBe(beforeWear + 1)
        await page.screenshot({ path: resolve(evidence, `${width}-wear-settled.png`) })
        await page.reload(); await rear(); expect(await saved()).toEqual(worn)
        const beforeCancel = writes, body = await midpoint('[data-sticker-placed="PW-C01"]')
        await down(body); await line(body, { x: body.x + 32, y: body.y })
        await expect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
        await expect(page.locator('[data-sticker-contour], [data-sticker-landing-contour], [data-hud-handle], [data-hud-wear]')).toHaveCount(0)
        await page.keyboard.press('Escape'); await up()
        await expect.poll(async () => page.locator('[data-sticker-stage]').evaluateAll(elements => elements.every(e => !['peeling', 'placing', 'settling'].includes(e.getAttribute('data-sticker-stage') ?? '')))).toBe(true)
        await capture(`${width}-move-cancel`); expect(writes).toBe(beforeCancel); expect(await saved()).toEqual(worn)
        outcomes.push({ width, pointer: cdp ? 'native touch' : 'native mouse', angle, wear, final: worn, trace })
      } finally { if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }).catch(() => {}); else await page.mouse.up().catch(() => {}); await cdp?.detach(); await capture(`${width}-cleanup`).catch(() => {}); await writeFile(resolve(evidence, `${width}-editor-pointer-trace.json`), JSON.stringify({ width, trace }, null, 2)) }
    }
    for (const item of reports.filter(item => /-(cold-selection|rotation|wear)$/.test(item.name))) {
      const release = item.report.windows.filter(w => w.kind === 'release-to-settled')
      expect(release, `${item.name}: distinct release window`).toHaveLength(1)
      expect(release[0]?.reason).toBe('awaited-settlement')
      expect(['within-gross-stall-budget', 'completed-short-window'], `${item.name}: release/setup scheduling`).toContain(release[0]?.status)
      if (!item.name.endsWith('-cold-selection')) {
        const input = item.report.windows.find(w => w.kind === 'input'); expect(input?.observedEditing).toBe(true)
        expect(input?.status, `${item.name}: admitted input scheduling`).toBe('within-gross-stall-budget')
      }
    }
  } finally {
    page.off('request', request)
    const final = await readStickerFrameObserver(page, true).catch(() => null)
    await writeFile(resolve(evidence, 'editor-frame-observation.json'), JSON.stringify({ outcomes, reports, final, matrixRecorderEnabled: false, scope: 'Cold selection and 24 native moves per appearance gesture. rAF execution/longtasks are scheduling proxies, not pointer-to-paint. Raw rAF intervals permit comparison with 16.7ms; no 60fps promise. Short cold-selection input may be insufficient; its release-to-presence window captures setup. Only after the final move, two rAF boundaries precede the DOM-value sample while input observation continues; this adds a final presentation opportunity, not intermediate throttling or photon measurement. No profiler overhead. Driver completion timeline uses a separate process clock.' }, null, 2))
  }
}
