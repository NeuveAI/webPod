import type { Page } from '@playwright/test'

export interface FrameSample { time: number; rafTime?: number; stage: string | null; editorPhase?: string | null; distance: number }
export interface FrameWindow { kind: 'input' | 'release-to-settled'; start: number; end: number; reason: string; pointerType: string; samples: FrameSample[]; longTasks: { start: number; duration: number }[]; overflow: boolean }
export interface FrameReport { windows: FrameWindow[]; longTaskSupport: string; droppedWindows: number; disposed: boolean }
interface FrameHost {
  document: Document; performance: Pick<Performance, 'now'>; PerformanceObserver?: typeof PerformanceObserver
  requestAnimationFrame(callback: FrameRequestCallback): number; cancelAnimationFrame(id: number): void
  setTimeout(callback: () => void, delay: number): number; clearTimeout(id: number): void
  addEventListener: Window['addEventListener']; removeEventListener: Window['removeEventListener']
  __stickerFrameProbe?: { read(clear?: boolean, settled?: boolean): FrameReport; dispose(): FrameReport }
}

/** Self-contained so Playwright serializes the exact tested observer into each document. */
export function createStickerFrameObserver(host: FrameHost = window, editing = false): void {
  host.__stickerFrameProbe?.dispose()
  const windows: FrameWindow[] = []
  let active: (FrameWindow & { id: number; x: number; y: number; distance: number }) | null = null
  let raf: number | null = null, timer: number | null = null, disposed = false, droppedWindows = 0
  let longTaskSupport = 'unavailable', observer: PerformanceObserver | null = null
  const recordTasks = (entries: readonly PerformanceEntry[]) => {
    for (const entry of entries) for (const w of windows) {
      if (entry.startTime <= (w === active ? host.performance.now() : w.end) && entry.startTime + entry.duration >= w.start) {
        if (w.longTasks.length < 256) w.longTasks.push({ start: entry.startTime, duration: entry.duration }); else w.overflow = true
      }
    }
  }
  if (host.PerformanceObserver?.supportedEntryTypes.includes('longtask')) {
    try { observer = new host.PerformanceObserver(list => recordTasks(list.getEntries())); observer.observe({ type: 'longtask' }); longTaskSupport = 'available' } catch { longTaskSupport = 'observe-failed'; observer?.disconnect(); observer = null }
  }
  const sample = (time: number, rafTime?: number) => {
    if (active === null) return
    if (active.samples.length >= 2048) { active.overflow = true; return }
    active.samples.push({ time, ...(rafTime === undefined ? {} : { rafTime }), stage: host.document.querySelector('[data-sticker-stage]')?.getAttribute('data-sticker-stage') ?? null, ...(editing ? { editorPhase: host.document.querySelector('[data-sticker-editor]')?.getAttribute('data-editor-phase') ?? null } : {}), distance: active.distance })
  }
  const finish = (reason: string) => {
    if (active === null) return
    active.end = host.performance.now(); active.reason = reason; sample(active.end)
    active = null
    if (raf !== null) host.cancelAnimationFrame(raf)
    if (timer !== null) host.clearTimeout(timer)
    raf = timer = null
    if (observer !== null) recordTasks(observer.takeRecords())
  }
  const frame = (time: number) => { raf = null; if (active === null || disposed) return; sample(host.performance.now(), time); raf = host.requestAnimationFrame(frame) }
  const begin = (kind: FrameWindow['kind'], e: Pick<PointerEvent, 'pointerType' | 'pointerId' | 'clientX' | 'clientY'>, start = host.performance.now()) => {
    if (windows.length >= 16) { windows.shift(); droppedWindows++ }
    active = { kind, start, end: 0, reason: 'active', pointerType: e.pointerType, samples: [], longTasks: [], overflow: false, id: e.pointerId, x: e.clientX, y: e.clientY, distance: 0 }
    windows.push(active); sample(start)
    raf = host.requestAnimationFrame(frame); timer = host.setTimeout(() => finish('time-cap'), 10_000)
  }
  const down: EventListener = raw => {
    const e = raw as PointerEvent
    if (!e.isPrimary || e.button !== 0 || disposed) return
    finish('superseded')
    begin('input', e)
  }
  const move: EventListener = raw => { const e = raw as PointerEvent; if (active?.kind === 'input' && active.id === e.pointerId) active.distance = Math.hypot(e.clientX - active.x, e.clientY - active.y) }
  const end: EventListener = raw => {
    const e = raw as PointerEvent
    if (active?.kind !== 'input' || active.id !== e.pointerId) return
    const start = host.performance.now(), admitted = active.samples.some(s => s.stage === 'peeling' || s.stage === 'placing')
    finish(e.type)
    // Capture runs before the product's release handler. The driver closes this
    // separate window only after its existing neutral/settled assertion resolves.
    if ((admitted || editing) && e.type !== 'lostpointercapture') begin('release-to-settled', e, start)
  }
  const escape: EventListener = raw => {
    if ((raw as KeyboardEvent).key !== 'Escape' || active?.kind !== 'input') return
    const previous = active, start = host.performance.now(), admitted = previous.samples.some(s => s.stage === 'peeling' || s.stage === 'placing')
    finish('Escape')
    if (admitted) begin('release-to-settled', { pointerId: previous.id, pointerType: previous.pointerType, clientX: previous.x, clientY: previous.y }, start)
  }
  const bindings = [['pointerdown', down], ['pointermove', move], ['pointerup', end], ['pointercancel', end], ['lostpointercapture', end], ['keydown', escape]] as const
  for (const [name, handler] of bindings) host.document.addEventListener(name, handler, { capture: true, passive: true })
  const read = (clear = false, settled = false): FrameReport => {
    if (settled && active?.kind === 'release-to-settled') finish('awaited-settlement')
    if (observer !== null) recordTasks(observer.takeRecords())
    const result = { windows: windows.map(w => ({ kind: w.kind, start: w.start, end: w === active ? host.performance.now() : w.end, reason: w.reason, pointerType: w.pointerType, samples: w.samples.slice(), longTasks: w.longTasks.slice(), overflow: w.overflow })), longTaskSupport, droppedWindows, disposed }
    if (clear && active === null) { windows.length = 0; droppedWindows = 0 }
    return result
  }
  const dispose = () => {
    if (!disposed) { finish('disposed'); if (observer !== null) { recordTasks(observer.takeRecords()); observer.disconnect() }; disposed = true; for (const [name, handler] of bindings) host.document.removeEventListener(name, handler, true); host.removeEventListener('pagehide', dispose) }
    return read()
  }
  host.addEventListener('pagehide', dispose)
  host.__stickerFrameProbe = { read, dispose }
}

export function summarizeStickerFrames(report: FrameReport) {
  const windows = report.windows.map(w => {
    const samples = w.samples
    const gaps = samples.slice(1).flatMap((sample, i) => { const previous = samples[i]; return previous === undefined ? [] : [{ from: previous.time, to: sample.time, ms: sample.time - previous.time, admitted: ['peeling', 'placing'].includes(sample.stage ?? '') || ['peeling', 'placing'].includes(previous.stage ?? '') }] })
    const frameTimes = samples.flatMap(s => s.rafTime === undefined ? [] : [s.rafTime])
    const frameIntervalsMs = frameTimes.slice(1).map((time, i) => time - (frameTimes[i] ?? time))
    const sortedFrames = [...frameIntervalsMs].sort((a, b) => a - b), sortedGaps = gaps.map(g => g.ms).sort((a, b) => a - b)
    const admitted = gaps.filter(g => g.admitted), values = admitted.map(g => g.ms).sort((a, b) => a - b)
    const rafCount = Math.max(0, samples.length - 2), observedAdmission = samples.some(s => s.stage === 'peeling' || s.stage === 'placing')
    const validBoundaries = Number.isFinite(w.start) && Number.isFinite(w.end) && w.end >= w.start && samples[0]?.time === w.start && samples.at(-1)?.time === w.end
    const invalidClock = !validBoundaries || gaps.some(g => !Number.isFinite(g.ms) || g.ms < 0)
    const shortCompleted = w.kind === 'release-to-settled' && w.reason === 'awaited-settlement' && w.end - w.start < 50 && !invalidClock && !w.overflow && !report.droppedWindows
    // Include complete down→up boundaries. Stage attribution within a long gap is uncertain.
    const gross = gaps.some(g => g.ms > 250) || gaps.filter(g => g.ms > 100).length >= 2
    return { ...w, gaps, frameIntervalsMs, frameP95Ms: sortedFrames.length ? sortedFrames[Math.ceil(sortedFrames.length * .95) - 1] : null, frameIntervalsOver16_7: frameIntervalsMs.filter(ms => ms > 16.7).length, allGapP95Ms: sortedGaps.length ? sortedGaps[Math.ceil(sortedGaps.length * .95) - 1] : null, observedEditing: samples.some(s => s.editorPhase != null), rafCount, observedAdmission, firstCallbackMs: rafCount ? (samples[1]?.time ?? w.start) - w.start : null, finalTailMs: w.end - (rafCount ? samples.at(-2)?.time ?? w.start : w.start), maxGapMs: Math.max(0, ...gaps.map(g => g.ms)), admittedMaxGapMs: Math.max(0, ...values), admittedP95Ms: values.length ? values[Math.ceil(values.length * .95) - 1] : null, gapsOver50: gaps.filter(g => g.ms > 50).length, gapsOver100: gaps.filter(g => g.ms > 100).length, cadenceAvailable: rafCount >= 2, status: w.overflow || report.droppedWindows || invalidClock || w.reason === 'time-cap' || w.kind === 'release-to-settled' && w.reason !== 'awaited-settlement' ? 'insufficient' : rafCount < 2 ? shortCompleted ? 'completed-short-window' : 'insufficient' : gross ? 'gross-stall' : 'within-gross-stall-budget' }
  })
  return { ...report, windows, criterion: 'Host-qualified scheduling proxy in each input or release-to-settled window: any gap >250ms or at least two >100ms is a gross stall; insufficient/overflow cannot pass. A semantically completed release shorter than50ms with valid event boundaries may be completed-short-window; its frame cadence is unavailable. Endpoint stages only bound admission; within-gap attribution is uncertain.', limitation: 'Execution timestamps use performance.now for callback/event boundaries; supplied rAF timestamps and their intervals are retained separately. Callback scheduling is not photon or pointer-to-paint latency. Release-to-settled starts before the product release handler and ends after the existing driver neutral assertion. Long tasks overlap windows, not attributed to an individual source function. Input distance <=64 is lift and >64 carry; renderer stages are sampled. Driver completion timestamps remain separate.' }
}
export async function installStickerFrameObserver(page: Page, editing = false): Promise<void> { await page.addInitScript({ content: `(${createStickerFrameObserver.toString()})(window, ${JSON.stringify(editing)})` }) }
export async function readStickerFrameObserver(page: Page, dispose = false): Promise<FrameReport> {
  return page.evaluate(dispose => { const probe = (window as unknown as FrameHost).__stickerFrameProbe; if (!probe) throw new Error('Missing test-only frame observer'); return dispose ? probe.dispose() : probe.read(true, true) }, dispose)
}
