import { chromium } from '/Users/vinicius/code/webPod/apps/web/node_modules/@playwright/test'
const directory = '/Users/vinicius/code/webPod/docs/workstreams/015-listening-sticker-collection/evidence/sticker-edge-wrap/early/editor-performance-diagnostic-1'
const hash = (s: string) => new Bun.CryptoHasher('sha256').update(s).digest('hex')
const preloadSHA256 = hash(await Bun.file(import.meta.filename).text())
const driver = '/Users/vinicius/code/webPod/apps/web/scripts/sticker-editor-performance.ts'
await Bun.write(directory + '/preload-installed.json', JSON.stringify({ preloadSHA256, driverSHA256: hash(await Bun.file(driver).text()), installedAt: new Date().toISOString(), instrumentation: 'Passive capture/bubble delivered events, DOM angle and next-rAF; numeric PUT placements only. CPU/scheduler trace confined to desktop wear; diagnostic overhead and existing video encoding present.' }, null, 2))
const launch = chromium.launch.bind(chromium)
chromium.launch = async options => {
  const marker = await Bun.file(directory + '/preload-installed.json').json()
  if (marker.preloadSHA256 !== preloadSHA256) throw new Error('Preload installation mismatch')
  await Bun.write(directory + '/preload-browser-entry.json', JSON.stringify({ preloadSHA256, at: new Date().toISOString() }))
  const browser = await launch(options), newContext = browser.newContext.bind(browser)
  browser.newContext = async options => {
    const context = await newContext(options), newPage = context.newPage.bind(context), close = context.close.bind(context)
    const pages: any[] = [], documents: unknown[] = [], puts: unknown[] = []
    const flush = async (page: any, reason: string) => {
      const value = await page.evaluate(() => (window as any).__editorEventDiagnostic ?? null).catch(() => null)
      if (value) documents.push({ reason, ...value })
      await Bun.write(directory + '/delivered-events.json', JSON.stringify({ preloadSHA256, videoEncodingPresent: options?.recordVideo != null, documents, puts }, null, 2))
    }
    context.newPage = async () => {
      const page = await newPage(); pages.push(page)
      await page.addInitScript(() => {
        const data = { events: [] as unknown[], overflow: false, viewport: { width: innerWidth, height: innerHeight }, timeOrigin: performance.timeOrigin }
        ;(window as any).__editorEventDiagnostic = data
        const read = () => ({ angle: document.querySelector('[data-contour-corner="0"] g')?.getAttribute('transform') ?? null, wear: (document.querySelector('[aria-label="Sticker wear"]') as HTMLInputElement | null)?.value ?? null, editor: document.querySelector('[data-sticker-editor]')?.getAttribute('data-editor-phase') ?? null })
        let sequence = 0
        const push = (value: unknown) => { if (data.events.length < 4000) data.events.push(value); else data.overflow = true }
        for (const capture of [true, false]) for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) document.addEventListener(name, event => {
          const e = event as PointerEvent, id = ++sequence
          const record = { id, name, phase: capture ? 'capture' : 'bubble', now: performance.now(), eventTimeStamp: e.timeStamp, x: e.clientX, y: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, buttons: e.buttons, defaultPrevented: e.defaultPrevented, targetCorner: (e.target as Element | null)?.closest?.('[data-contour-corner]')?.getAttribute('data-contour-corner') ?? null, ...read() }
          push(record)
          if (capture) requestAnimationFrame(frameTime => push({ afterEvent: id, phase: 'next-rAF', now: performance.now(), frameTime, ...read() }))
        }, { capture, passive: true })
      })
      page.on('request', request => {
        if (request.method() !== 'PUT' || !request.url().endsWith('/api/stickers/placements')) return
        const body = request.postDataJSON()
        puts.push({ driverTime: performance.now(), placements: body.placements?.map((p: any) => ({ stickerId: p.stickerId, rotationDeg: p.rotationDeg, wear: p.wear, x: p.x, y: p.y })) })
      })
      const reload = page.reload.bind(page); page.reload = async options => { await flush(page, 'before-reload'); return reload(options) }
      let session: any = null
      const stopTrace = async () => {
        if (!session) return
        const { profile } = await session.send('Profiler.stop')
        await Bun.write(directory + '/desktop-wear.cpuprofile', JSON.stringify(profile))
        const completed = new Promise<any>(resolve => session.once('Tracing.tracingComplete', resolve))
        await session.send('Tracing.end'); const { stream } = await completed
        let trace = ''
        while (true) { const chunk = await session.send('IO.read', { handle: stream }); trace += chunk.data; if (chunk.eof) break }
        await session.send('IO.close', { handle: stream }); await Bun.write(directory + '/desktop-wear-trace.json', trace)
        await session.detach(); session = null
      }
      const screenshot = page.screenshot.bind(page)
      page.screenshot = async options => {
        if (String(options?.path).endsWith('1280-wear-settled.png')) await stopTrace()
        const result = await screenshot(options)
        if (String(options?.path).endsWith('1280-rotation-settled.png')) {
          session = await context.newCDPSession(page)
          await session.send('Profiler.enable'); await session.send('Profiler.start')
          await session.send('Tracing.start', { transferMode: 'ReturnAsStream', traceConfig: { includedCategories: ['toplevel', 'renderer.scheduler', 'cc', 'disabled-by-default-v8.cpu_profiler'], excludedCategories: ['netlog', 'disabled-by-default-devtools.screenshot'] } })
        }
        return result
      }
      ;(page as any).__finishEditorDiagnostic = async () => { await stopTrace(); await flush(page, 'fixture-close') }
      return page
    }
    context.close = async options => { for (const page of pages) await page.__finishEditorDiagnostic?.().catch(() => {}); await close(options) }
    const browserClose = browser.close.bind(browser)
    browser.close = async options => { for (const page of pages) await page.__finishEditorDiagnostic?.().catch(() => {}); await browserClose(options) }
    return context
  }
  return browser
}
