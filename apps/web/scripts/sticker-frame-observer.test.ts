import { expect, test } from 'bun:test'
import { createStickerFrameObserver, installStickerFrameObserver, summarizeStickerFrames, type FrameReport } from './sticker-frame-observer'

function required<T>(value: T | undefined): T { if (value === undefined) throw new Error("Missing fixture value"); return value }
function fixture() {
  let now = 0, next = 0, stage: string | null = null
  const frames = new Map<number, FrameRequestCallback>(), timers = new Map<number, () => void>()
  const document = Object.assign(new EventTarget(), { querySelector: () => stage === null ? null : { getAttribute: () => stage } })
  const host = Object.assign(new EventTarget(), { document, performance: { now: () => now }, requestAnimationFrame: (callback: FrameRequestCallback) => { const id = ++next; frames.set(id, callback); return id }, cancelAnimationFrame: (id: number) => frames.delete(id), setTimeout: (callback: () => void) => { const id = ++next; timers.set(id, callback); return id }, clearTimeout: (id: number) => timers.delete(id) }) as unknown as NonNullable<Parameters<typeof createStickerFrameObserver>[0]>
  createStickerFrameObserver(host)
  return { host, frames, timers, stage: (value: string | null) => { stage = value }, at: (time: number) => { now = time }, tick: (time: number, rafTime = time) => { now = time; const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(rafTime) }, event: (type: string, id = 1) => document.dispatchEvent(Object.assign(new Event(type), { isPrimary: true, button: 0, pointerId: id, pointerType: 'mouse', clientX: 100, clientY: 100 })), read: () => required(host.__stickerFrameProbe).read() }
}
test('observer owns only active gesture frames and cleans up on cancel, dispose and replacement', () => {
  const f = fixture(); expect(f.frames.size).toBe(0)
  f.event('pointerdown'); expect(f.frames.size).toBe(1); expect(f.timers.size).toBe(1)
  f.stage('peeling'); f.tick(16); f.tick(32); f.at(40); f.event('pointerup', 2); expect(f.frames.size).toBe(1)
  f.event('pointercancel'); expect(f.frames.size).toBe(1); expect(f.timers.size).toBe(1)
  expect(f.read().windows[0]?.reason).toBe('pointercancel'); expect(f.read().longTaskSupport).toBe('unavailable')
  required(f.host.__stickerFrameProbe).read(true, true); expect(f.frames.size).toBe(0); expect(f.timers.size).toBe(0)
  f.event('pointerdown'); createStickerFrameObserver(f.host); expect(f.frames.size).toBe(0); expect(f.timers.size).toBe(0)
  f.event('pointerdown'); const result = required(f.host.__stickerFrameProbe).dispose(); expect(result.disposed).toBe(true); expect(f.frames.size).toBe(0); expect(f.timers.size).toBe(0)
  f.event('pointerdown'); expect(f.frames.size).toBe(0); expect(required(f.host.__stickerFrameProbe).dispose()).toEqual(result)
})
test('full-window stall metrics include first callback and final release tail, with declared thresholds', () => {
  const report = (times: number[]): FrameReport => ({ windows: [{ kind: 'input', start: required(times[0]), end: required(times.at(-1)), reason: 'pointerup', pointerType: 'touch', samples: times.map(time => ({ time, stage: 'placing', distance: 80 })), longTasks: [], overflow: false }], longTaskSupport: 'unavailable', droppedWindows: 0, disposed: true })
  const first = required(summarizeStickerFrames(report([0, 260, 276, 292])).windows[0])
  expect(first.firstCallbackMs).toBe(260); expect(first.maxGapMs).toBe(260); expect(first.status).toBe('gross-stall')
  const tail = required(summarizeStickerFrames(report([0, 16, 32, 300])).windows[0])
  expect(tail.finalTailMs).toBe(268); expect(tail.status).toBe('gross-stall')
  expect(summarizeStickerFrames(report([0, 110, 126, 237])).windows[0]?.status).toBe('gross-stall')
  expect(summarizeStickerFrames(report([0, 16, 32, 48])).windows[0]?.status).toBe('within-gross-stall-budget')
  expect(summarizeStickerFrames(report([0, 16])).windows[0]?.status).toBe('insufficient')
  const overflow = report([0, 16, 32, 48]); required(overflow.windows[0]).overflow = true
  expect(summarizeStickerFrames(overflow).windows[0]?.status).toBe('insufficient')
})
test('window and duration caps disclose data loss and stop scheduling', () => {
  const f = fixture()
  for (let i = 0; i < 17; i++) { f.event('pointerdown'); f.at(i + 1); f.event('pointerup') }
  expect(f.read().windows).toHaveLength(16); expect(f.read().droppedWindows).toBe(1)
  f.event('pointerdown'); for (const callback of [...f.timers.values()]) callback()
  expect(f.frames.size).toBe(0); expect(f.timers.size).toBe(0); expect(f.read().windows.at(-1)?.reason).toBe('time-cap')
  required(f.host.__stickerFrameProbe).dispose()
})
test('long tasks use entry interval overlap rather than delivery time, and drain before disconnect', () => {
  const f = fixture(); let disconnected = 0
  const queue: PerformanceEntry[] = []
  class Observer {
    static supportedEntryTypes = ['longtask']
    observe() {}
    takeRecords() { return queue.splice(0) }
    disconnect() { disconnected++ }
  }
  f.host.PerformanceObserver = Observer as unknown as typeof PerformanceObserver
  createStickerFrameObserver(f.host)
  f.event('pointerdown'); f.stage('peeling'); f.tick(16); f.tick(32); f.at(40); f.event('pointerup')
  f.at(150)
  queue.push({ startTime: 10, duration: 60 } as PerformanceEntry, { startTime: 100, duration: 60 } as PerformanceEntry)
  const result = required(f.host.__stickerFrameProbe).dispose()
  expect(result.longTaskSupport).toBe('available'); expect(result.windows[0]?.longTasks).toEqual([{ start: 10, duration: 60 }]); expect(disconnected).toBe(1)
  required(f.host.__stickerFrameProbe).dispose(); expect(disconnected).toBe(1)
})

test("serialized browser initializer has no module closure dependency", async () => {
  const f = fixture(); let source = ""
  await installStickerFrameObserver({ addInitScript: async (script: { content: string }) => { source = script.content } } as unknown as Parameters<typeof installStickerFrameObserver>[0])
  new Function("window", source)(f.host)
  f.event("pointerdown"); expect(f.frames.size).toBe(1); required(f.host.__stickerFrameProbe).dispose(); expect(f.frames.size).toBe(0)
})
test('release and Escape settlement start before product handlers and await semantic completion', () => {
  const f = fixture(); f.event('pointerdown'); f.stage('placing'); f.tick(16); f.tick(32)
  f.host.document.addEventListener('pointerup', () => { expect(f.read().windows.at(-1)?.kind).toBe('release-to-settled'); f.at(320) })
  f.at(40); f.event('pointerup'); f.tick(336); f.tick(352); f.stage('open'); f.at(360)
  const settled = summarizeStickerFrames(required(f.host.__stickerFrameProbe).read(true, true)).windows.at(-1)
  expect(settled?.start).toBe(40); expect(settled?.reason).toBe('awaited-settlement'); expect(settled?.firstCallbackMs).toBe(296); expect(settled?.status).toBe('gross-stall')
  f.event('pointerdown'); f.stage('peeling'); f.tick(376); f.tick(392)
  f.host.document.dispatchEvent(Object.assign(new Event('keydown'), { key: 'Escape' }))
  expect(f.read().windows.at(-1)?.kind).toBe('release-to-settled')
  f.event('pointercancel'); expect(f.read().windows.at(-1)?.reason).toBe('active')
  f.host.__stickerFrameProbe?.dispose(); expect(f.frames.size).toBe(0)
})


test('same-frame rAF stamp before pointerdown remains raw while scheduling uses callback execution', () => {
  const f = fixture(); f.at(100); f.event('pointerdown'); f.stage('placing')
  f.tick(106, 95); f.tick(123, 111.7); f.at(130); f.event('pointerup')
  const window = required(summarizeStickerFrames(f.read()).windows[0])
  expect(window.samples[1]?.time).toBe(106)
  expect(window.samples[1]?.rafTime).toBe(95)
  expect(window.firstCallbackMs).toBe(6)
  expect(window.finalTailMs).toBe(7)
  expect(window.frameIntervalsMs[0]).toBeCloseTo(16.7)
  expect(window.status).toBe('within-gross-stall-budget')
  f.host.__stickerFrameProbe?.dispose()
})


test('editor mode preserves cold release setup and marks editing separately from carry', () => {
  const f = fixture()
  createStickerFrameObserver(f.host, true)
  f.event('pointerdown'); f.at(2); f.event('pointerup')
  expect(f.read().windows.at(-1)?.kind).toBe('release-to-settled')
  f.stage('editing'); f.tick(18); f.tick(34); f.at(40)
  const report = summarizeStickerFrames(required(f.host.__stickerFrameProbe).read(true, true))
  expect(report.windows[0]?.status).toBe('insufficient')
  expect(report.windows[1]?.reason).toBe('awaited-settlement')
  expect(report.windows[1]?.observedEditing).toBe(true)
  expect(report.windows[1]?.observedAdmission).toBe(false)
  expect(report.windows[1]?.status).toBe('within-gross-stall-budget')
  expect(f.frames.size).toBe(0); expect(f.timers.size).toBe(0)
  required(f.host.__stickerFrameProbe).dispose()
})

test('short semantic release retains boundary timing without inventing frame cadence', () => {
  const report = (duration: number): FrameReport => ({ windows: [{ kind: 'release-to-settled', start: 10, end: 10 + duration, reason: 'awaited-settlement', pointerType: 'mouse', samples: [{ time: 10, stage: null, editorPhase: 'saving', distance: 0 }, { time: 10 + duration, stage: null, editorPhase: 'editing', distance: 0 }], longTasks: [], overflow: false }], longTaskSupport: 'available', droppedWindows: 0, disposed: false })
  const short = required(summarizeStickerFrames(report(13.4)).windows[0])
  expect(short.status).toBe('completed-short-window'); expect(short.cadenceAvailable).toBe(false)
  expect(short.maxGapMs).toBeCloseTo(13.4); expect(short.frameP95Ms).toBeNull()
  expect(summarizeStickerFrames(report(200)).windows[0]?.status).toBe('insufficient')
  expect(summarizeStickerFrames(report(50)).windows[0]?.status).toBe('insufficient')
  for (const change of [(w: FrameReport['windows'][number]) => { w.reason = 'disposed' }, (w: FrameReport['windows'][number]) => { w.overflow = true }, (w: FrameReport['windows'][number]) => { w.kind = 'input' }, (w: FrameReport['windows'][number]) => { required(w.samples[0]).time = 11 }, (w: FrameReport['windows'][number]) => { w.end = NaN }]) {
    const r = report(13.4); change(required(r.windows[0])); expect(summarizeStickerFrames(r).windows[0]?.status).toBe('insufficient')
  }
})
