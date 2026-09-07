import { expect } from 'bun:test'
import { expect as browserExpect, type Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { StickerInventory, StickerPlacement } from '@webpod/stickers'
import { verifyBuild, type BuildProvenance } from './sticker-edge-provenance'
import { readStickerMatrixCapture } from './sticker-matrix-recorder'
import { readStickerFrameObserver, summarizeStickerFrames } from './sticker-frame-observer'

export const WRAPPED_SEED: readonly StickerPlacement[] = [
  { stickerId: 'PW-C03', surface: 'back', x: .027, y: .017, width: .35, rotationDeg: 0, wear: 1 },
  { stickerId: 'PW-F01', surface: 'back', x: .65, y: .72, width: .25, rotationDeg: 0, wear: .6 },
]
const sha256 = (value: string) => new Bun.CryptoHasher('sha256').update(value).digest('hex')
export const wrappedBuildIdentity = (build: Pick<BuildProvenance, 'sourceAfter' | 'artifacts'>) => ({ source: sha256(JSON.stringify(build.sourceAfter)), artifacts: sha256(JSON.stringify(build.artifacts)) })

interface MaterialWitness {
  readonly point: { readonly x: number; readonly y: number }
  readonly uv: readonly [number, number]
  readonly effectiveAlpha: number
  readonly stickerDistance: number
  readonly shellDistance: number
}
/** External diagnostic output, bound to the immutable native fixture and build. */
export interface WrappedEvidence {
  readonly version: 1
  readonly build: ReturnType<typeof wrappedBuildIdentity>
  readonly sampler: { readonly path: string; readonly sha256: string }
  readonly seed: readonly StickerPlacement[]
  readonly viewport: WrappedWitness['viewport']
  readonly pose: { readonly face: WrappedWitness['face']; readonly rightStepsFromRear: number }
  readonly cameraWorld: readonly number[]
  readonly cameraProjection: readonly number[]
  readonly contentWorld: readonly number[]
  readonly pickup: MaterialWitness
  readonly occluded: MaterialWitness
  readonly invalid?: { readonly point: WrappedWitness['pickup']; readonly result: null; readonly mapping: 'captured-triangle-affine' }
  readonly attached: { readonly uv: readonly [number, number]; readonly partialPointer: WrappedWitness['partial'] }
}
export function validateWrappedEvidence(value: unknown, witness: WrappedWitness, build: Pick<BuildProvenance, 'sourceAfter' | 'artifacts'>): asserts value is WrappedEvidence {
  const proof = value as WrappedEvidence
  expect(proof.version).toBe(1)
  expect(proof.build).toEqual(wrappedBuildIdentity(build))
  expect(proof.seed).toEqual(WRAPPED_SEED)
  expect(proof.viewport).toEqual(witness.viewport)
  expect(proof.pose).toEqual({ face: witness.face, rightStepsFromRear: witness.rightStepsFromRear })
  expect(proof.sampler.path.startsWith('packages/device/src/')).toBe(true)
  expect(proof.sampler.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(build.sourceAfter[proof.sampler.path]).toBe(proof.sampler.sha256)
  for (const matrix of [proof.cameraWorld, proof.cameraProjection, proof.contentWorld]) { expect(matrix).toHaveLength(16); expect(matrix.every(Number.isFinite)).toBe(true) }
  for (const hit of [proof.pickup, proof.occluded]) {
    expect(hit.uv).toHaveLength(2); expect(hit.uv.every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true)
    expect(hit.effectiveAlpha).toBeGreaterThan(.9); expect(hit.effectiveAlpha).toBeLessThanOrEqual(1)
    expect(Number.isFinite(hit.stickerDistance) && hit.stickerDistance >= 0).toBe(true)
    expect(Number.isFinite(hit.shellDistance) && hit.shellDistance >= 0).toBe(true)
  }
  expect(proof.pickup.point).toEqual(witness.pickup)
  expect(proof.pickup.stickerDistance).toBeLessThanOrEqual(proof.pickup.shellDistance)
  expect(proof.occluded.point).toEqual(witness.occluded)
  expect(proof.occluded.stickerDistance - proof.occluded.shellDistance).toBeGreaterThan(.001)
  expect(proof.attached.uv).toHaveLength(2); expect(proof.attached.uv.every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true)
  expect(proof.attached.partialPointer).toEqual(witness.partial)
  if (witness.face === 'front') {
    if (witness.invalid === undefined) throw new Error('Missing front invalid witness')
    expect(proof.invalid).toEqual({ point: witness.invalid, result: null, mapping: 'captured-triangle-affine' })
  }
}

/** Off-rear idle UI is legitimately absent; a mounted carry is never neutral. */
export const wrappedCarryIsNeutral = (states: readonly { readonly stage: string | null; readonly peel: string | null }[]) => states.length === 0 || states.length === 1 && states[0]?.peel === '0' && ['hidden', 'tease', 'open'].includes(states[0]?.stage ?? '')
export function assertWrappedRelocation(placed: StickerPlacement | undefined, expectedCenter: WrappedWitness['expectedCenter'], saveDelta: number): void {
  expect(saveDelta).toBe(1)
  expect(placed).toBeDefined()
  expect(Math.max(Math.abs(expectedCenter.x - .027), Math.abs(expectedCenter.y - .017))).toBeGreaterThan(.075)
  expect(Math.max(Math.abs((placed?.x ?? .027) - .027), Math.abs((placed?.y ?? .017) - .017))).toBeGreaterThan(.05)
  expect(Math.abs((placed?.x ?? -1) - expectedCenter.x)).toBeLessThan(.025)
  expect(Math.abs((placed?.y ?? -1) - expectedCenter.y)).toBeLessThan(.025)
}

interface WrappedWitness {
  readonly name: string
  readonly viewport: { readonly width: number; readonly height: number }
  readonly face: 'side' | 'front'
  readonly rightStepsFromRear: number
  readonly pickup: { readonly x: number; readonly y: number }
  readonly partial: { readonly x: number; readonly y: number }
  readonly release: { readonly x: number; readonly y: number }
  readonly expectedCenter: { readonly x: number; readonly y: number }
  readonly occluded: { readonly x: number; readonly y: number }
  readonly flickEnd: { readonly x: number; readonly y: number }
  readonly invalid?: { readonly x: number; readonly y: number }
  /** Durable device diagnostics: painted UV, shell depth order and attached UV. */
  readonly evidence: string
}

/** Missing or malformed geometry witnesses are a failure, never an implicit skip. */
export function wrappedWitnesses(value: unknown): readonly WrappedWitness[] {
  if (!Array.isArray(value) || value.length !== 4) throw new Error('Wrapped interaction requires four device-generated witnesses: side/front at 1280/375')
  const keys = new Set<string>()
  const names = new Set<string>()
  for (const item of value) {
    if (item === null || typeof item !== 'object') throw new Error('Invalid wrapped witness')
    const w = item as WrappedWitness
    if (typeof w.name !== 'string' || !/^[a-z0-9-]+$/.test(w.name) || typeof w.evidence !== 'string' || w.evidence.length === 0 || !['side', 'front'].includes(w.face) || ![1280, 375].includes(w.viewport?.width) || !Number.isFinite(w.viewport.height) || w.viewport.height <= 0 || !Number.isInteger(w.rightStepsFromRear) || w.rightStepsFromRear <= 0 || w.rightStepsFromRear > 29) throw new Error('Invalid wrapped witness metadata')
    if (w.face === 'front' && w.invalid === undefined) throw new Error('Front witness requires an affine-proved invalid target')
    for (const point of [w.pickup, w.partial, w.release, w.occluded, w.flickEnd, ...(w.invalid === undefined ? [] : [w.invalid])]) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y) || point.x < 0 || point.x >= w.viewport.width || point.y < 0 || point.y >= w.viewport.height) throw new Error('Invalid wrapped screen witness')
    }
    if (!Number.isFinite(w.expectedCenter?.x) || !Number.isFinite(w.expectedCenter?.y) || w.expectedCenter.x < 0 || w.expectedCenter.x > 1 || w.expectedCenter.y < 0 || w.expectedCenter.y > 1) throw new Error('Missing expected rear center')
    if (Math.max(Math.abs(w.expectedCenter.x - .027), Math.abs(w.expectedCenter.y - .017)) <= .075) throw new Error('Wrapped relocation target must differ meaningfully from its seed')
    keys.add(`${w.viewport.width}-${w.face}`)
    names.add(w.name)
  }
  if (keys.size !== 4 || names.size !== 4) throw new Error('Duplicate or missing wrapped viewport/face witness')
  return value as WrappedWitness[]
}

async function verifyWrappedPickup({ page, evidence, read, save, rear }: Parameters<typeof verifyStickerEdgeWrap>[0]): Promise<void> {
  const manifest = process.env.WEBPOD_STICKER_EDGE_WITNESSES
  if (manifest === undefined) throw new Error('Pending geometry evidence: WEBPOD_STICKER_EDGE_WITNESSES is required for wrapped interaction mode')
  const manifestText = await Bun.file(manifest).text()
  const witnesses = wrappedWitnesses(JSON.parse(manifestText))
  const buildPath = process.env.WEBPOD_STICKER_EDGE_BUILD_PROVENANCE
  if (buildPath === undefined) throw new Error('Wrapped witnesses require verified build provenance')
  const build = await Bun.file(buildPath).json() as BuildProvenance
  verifyBuild(build)
  const stage = page.locator('.webpod-device-preview__stage')
  const overlay = page.locator('[data-sticker-stage]')
  const neutral = async () => browserExpect.poll(async () => wrappedCarryIsNeutral(await overlay.evaluateAll(elements => elements.map(el => ({ stage: el.getAttribute('data-sticker-stage'), peel: el.getAttribute('data-sticker-peel') }))))).toBe(true)
  const inputs: unknown[] = []
  let saves = 0
  const onRequest = (request: import('@playwright/test').Request) => { if (request.method() === 'PUT' && request.url().endsWith('/api/stickers/placements')) saves++ }
  page.on('request', onRequest)
  const outcomes: unknown[] = []
  const frames: { witness: string; phase: string; expectedAdmission: boolean; report: ReturnType<typeof summarizeStickerFrames> }[] = []
  try {
    for (const w of witnesses) {
      const captureFrames = async (phase: string, expectedAdmission: boolean, dispose = false) => { frames.push({ witness: w.name, phase, expectedAdmission, report: summarizeStickerFrames(await readStickerFrameObserver(page, dispose)) }) }
      if (!(await Bun.file(w.evidence).exists())) throw new Error(`Missing device witness evidence: ${w.evidence}`)
      const proofText = await Bun.file(w.evidence).text()
      const proof: unknown = JSON.parse(proofText)
      validateWrappedEvidence(proof, w, build)
      inputs.push({ witness: w, proof, proofText, evidenceSHA256: sha256(proofText) })
      const pose = async () => {
        await rear(); await stage.focus()
        for (let n = 0; n < w.rightStepsFromRear; n++) await page.keyboard.press('Shift+ArrowRight')
      }
      await page.setViewportSize(w.viewport)
      await save(WRAPPED_SEED); await page.reload(); await pose()
      const before = await read(), beforeSaves = saves
      await page.screenshot({ path: resolve(evidence, `${w.name}-attached.png`) })
      // Native mouse first; touch uses the same browser input dispatch as the edge suite.
      const cdp = w.viewport.width === 375 ? await page.context().newCDPSession(page) : null
      const pointerTrace: { phase: string; x: number; y: number; driverTimeMs: number }[] = []
      const down = async (p: WrappedWitness['pickup']) => { if (cdp !== null) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [p] }); else { await page.mouse.move(p.x, p.y); await page.mouse.down() } }
      const move = async (p: WrappedWitness['pickup']) => { if (cdp !== null) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] }); else await page.mouse.move(p.x, p.y) }
      const traceMove = async (from: WrappedWitness['pickup'], to: WrappedWitness['pickup'], phase: string, steps: number) => {
        for (let index = 1; index <= steps; index++) {
          const point = { x: from.x + (to.x - from.x) * index / steps, y: from.y + (to.y - from.y) * index / steps }
          await move(point)
          pointerTrace.push({ phase, ...point, driverTimeMs: performance.now() })
        }
      }
      const up = async (cancel = false) => { if (cdp !== null) await cdp.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] }); else { if (cancel) await page.keyboard.press('Escape'); await page.mouse.up() } }
      try {
        await down(w.pickup); await traceMove(w.pickup, w.partial, 'partial-peel-before-cancel', 8)
        await browserExpect(overlay).toHaveAttribute('data-sticker-stage', 'peeling')
        const partialPeel = Number(await overlay.getAttribute('data-sticker-peel'))
        expect(partialPeel).toBeGreaterThan(0); expect(partialPeel).toBeLessThan(1)
        await browserExpect(overlay).toHaveAttribute('data-sticker-landing', '0')
        await browserExpect(stage).not.toHaveAttribute('data-orientation-grab', 'active')
        await page.screenshot({ path: resolve(evidence, `${w.name}-partial-peel.png`) })
        await up(true)
        await neutral()
        expect(saves).toBe(beforeSaves); expect(await read()).toEqual(before)
        await captureFrames('partial-peel-cancel', true)
        await page.reload(); await pose(); expect(await read()).toEqual(before)

        // The occluded print must yield the input lane to the real visible shell.
        await down(w.occluded); await traceMove(w.occluded, w.flickEnd, 'occluded-shell-flick', 12)
        await browserExpect(stage).toHaveAttribute('data-orientation-grab', 'active')
        await browserExpect(page.locator('[data-sticker-editor]')).toHaveCount(0)
        await neutral()
        await page.screenshot({ path: resolve(evidence, `${w.name}-occluded-shell-flick.png`) })
        await up(); expect(saves).toBe(beforeSaves); expect(await read()).toEqual(before)
        await captureFrames('hidden-shell-flick', false)

        if (w.invalid !== undefined) {
          await page.reload(); await pose()
          await down(w.pickup); await traceMove(w.pickup, w.partial, 'invalid-release-lift', 8); await traceMove(w.partial, w.release, 'invalid-release-valid-carry', 24)
          await browserExpect(overlay).toHaveAttribute('data-sticker-stage', 'placing')
          await browserExpect(page.locator('[data-sticker-landing-contour], [data-sticker-contour], [data-hud-handle], [data-hud-wear]')).toHaveCount(0)
          await traceMove(w.release, w.invalid, 'invalid-release-exit', 12)
          await browserExpect(overlay).toHaveAttribute('data-sticker-stage', 'peeling')
          await browserExpect(overlay).toHaveAttribute('data-sticker-landing', '0')
          await browserExpect(page.locator('[data-sticker-landing-contour], [data-sticker-contour], [data-hud-handle], [data-hud-wear]')).toHaveCount(0)
          expect(saves).toBe(beforeSaves)
          await page.screenshot({ path: resolve(evidence, `${w.name}-invalid-held.png`) })
          await up(); await neutral()
          expect(saves).toBe(beforeSaves); expect(await read()).toEqual(before)
          await captureFrames('valid-to-invalid-release-return', true)
        }

        await page.reload(); await pose()
        await down(w.pickup); await traceMove(w.pickup, w.partial, 'relocation-lift', 8); await traceMove(w.partial, w.release, 'relocation-carry', 24)
        await browserExpect(overlay).toHaveAttribute('data-sticker-stage', 'placing')
        await browserExpect(overlay).toHaveAttribute('data-sticker-landing', '0')
        await browserExpect(page.locator('[data-sticker-landing-contour], [data-sticker-contour], [data-hud-handle], [data-hud-wear]')).toHaveCount(0)
        if (w.invalid !== undefined) {
          await traceMove(w.release, w.invalid, 'relocation-invalid-exit', 12)
          await browserExpect(overlay).toHaveAttribute('data-sticker-stage', 'peeling')
          await browserExpect(overlay).toHaveAttribute('data-sticker-landing', '0')
          await browserExpect(page.locator('[data-sticker-landing-contour], [data-sticker-contour], [data-hud-handle], [data-hud-wear]')).toHaveCount(0)
          expect(saves).toBe(beforeSaves)
          await traceMove(w.invalid, w.release, 'relocation-valid-reentry', 12)
          await browserExpect(overlay).toHaveAttribute('data-sticker-stage', 'placing')
          await browserExpect(overlay).toHaveAttribute('data-sticker-landing', '0')
          await browserExpect(page.locator('[data-sticker-landing-contour], [data-sticker-contour], [data-hud-handle], [data-hud-wear]')).toHaveCount(0)
        }
        await page.screenshot({ path: resolve(evidence, `${w.name}-held-target.png`) })
        const response = page.waitForResponse(r => r.url().endsWith('/api/stickers/placements') && r.request().method() === 'PUT')
        await up(); expect((await response).status()).toBe(200)
        const after = await read()
        expect(after.placementRevision).toBe(before.placementRevision + 1)
        expect(after.placements.find(p => p.stickerId === 'PW-F01')).toEqual(before.placements.find(p => p.stickerId === 'PW-F01'))
        const placed = after.placements.find(p => p.stickerId === 'PW-C03')
        expect(placed?.width).toBe(.35); expect(placed?.rotationDeg).toBe(0); expect(placed?.wear).toBe(1)
        await neutral()
        await browserExpect(page.locator('[data-sticker-landing-contour], [data-sticker-contour], [data-hud-handle], [data-hud-wear]')).toHaveCount(0)
        assertWrappedRelocation(placed, w.expectedCenter, saves - beforeSaves)
        await captureFrames('uninterrupted-lift-carry-release', true)
        await page.screenshot({ path: resolve(evidence, `${w.name}-relocated.png`) })
        await page.reload(); await rear()
        expect((await read()).placements.find(p => p.stickerId === 'PW-C03')).toEqual(placed)
        assertWrappedRelocation(placed, w.expectedCenter, saves - beforeSaves)
        outcomes.push({ witness: w, partialPeel, placed, interactionAssertionsPassed: true, attachedContactVisualReview: 'pending: compare attached and partial-peel originals against material witness' })
      } finally {
        await up(true); await cdp?.detach()
        await captureFrames('final-cleanup', false, true)
        await writeFile(resolve(evidence, `${w.name}-pointer-trace.json`), JSON.stringify({ input: cdp === null ? 'native mouse' : 'native CDP touch', samples: pointerTrace, timing: 'driver event completion timestamps; not render latency', source: w.evidence }, null, 2))
      }
    }
    for (const frame of frames.filter(frame => frame.expectedAdmission)) {
      const admitted = frame.report.windows.filter(window => window.observedAdmission)
      expect(admitted.length, `${frame.witness}/${frame.phase}: admission must be observed for frame evidence`).toBeGreaterThan(0)
      for (const window of admitted) expect(window.status, `${frame.witness}/${frame.phase}: declared host-qualified gross-stall budget`).toBe('within-gross-stall-budget')
    }
  } finally {
    page.off('request', onRequest)
    await writeFile(resolve(evidence, 'wrapped-pickup-verification.json'), JSON.stringify({ manifestText, manifestSHA256: sha256(manifestText), build: wrappedBuildIdentity(build), inputs, witnesses, outcomes, attachedContactAcceptance: 'pending independent visual review' }, null, 2))
    await writeFile(resolve(evidence, 'wrapped-frame-observation.json'), JSON.stringify({ build: wrappedBuildIdentity(build), frames, matrixRecorderEnabled: false, scope: 'Passive browser rAF/long-task observation; raw intervals retained, distinct from native driver completion traces. Functional failure may leave incomplete phases.' }, null, 2))
  }
}

/** Temporary candidate inspection on the same earned route; no interaction acceptance claim. */
async function verifyPeelPhaseStrip({ page, evidence, read, save, rear }: Parameters<typeof verifyStickerEdgeWrap>[0]): Promise<void> {
  const inputPath = process.env.WEBPOD_STICKER_EDGE_PHASE_INPUT
  const buildPath = process.env.WEBPOD_STICKER_EDGE_BUILD_PROVENANCE
  if (inputPath === undefined || buildPath === undefined) throw new Error('Phase diagnostic requires explicit input and build provenance')
  const inputText = await Bun.file(inputPath).text(), build = await Bun.file(buildPath).json() as BuildProvenance
  verifyBuild(build)
  const inputs = (JSON.parse(inputText) as WrappedWitness[]).filter(w => w.viewport.width === 1280)
  if (inputs.length !== 2 || new Set(inputs.map(w => w.face)).size !== 2) throw new Error('Phase diagnostic needs desktop side/front inputs')
  const records: unknown[] = []
  const overlay = page.locator('[data-sticker-stage]')
  const stage = page.locator('.webpod-device-preview__stage')
  let writes = 0
  const onRequest = (r: import('@playwright/test').Request) => { if (r.method() === 'PUT' && r.url().endsWith('/api/stickers/placements')) writes++ }
  page.on('request', onRequest)
  const marker = async (origin: WrappedWitness['pickup'], pointer: WrappedWitness['pickup'], distance: number) => page.evaluate(({ origin, pointer, distance }) => {
    document.querySelector('[data-phase-diagnostic-marker]')?.remove()
    const host = document.createElement('div'); host.setAttribute('data-phase-diagnostic-marker', ''); host.setAttribute('aria-hidden', 'true')
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647'
    for (const [point, color, label] of [[origin, '#49c8ff', 'Original pickup'], [pointer, '#ff9c42', `Pointer ${distance}px`]] as const) {
      const dot = document.createElement('span'); dot.style.cssText = `position:absolute;left:${point.x - 5}px;top:${point.y - 5}px;width:10px;height:10px;border:2px solid ${color};border-radius:50%;box-sizing:border-box`
      const text = document.createElement('span'); text.textContent = label; text.style.cssText = `position:absolute;left:${point.x + 10}px;top:${point.y + (label === 'Original pickup' ? -20 : 8)}px;color:${color};background:#101820;font:11px monospace;padding:2px`
      host.append(dot, text)
    }
    document.body.append(host)
  }, { origin, pointer, distance })
  try {
    for (const w of inputs) {
      const distance = Math.hypot(w.partial.x - w.pickup.x, w.partial.y - w.pickup.y)
      if (!Number.isFinite(distance) || distance <= 0 || !Number.isInteger(w.rightStepsFromRear) || w.rightStepsFromRear <= 0 || w.rightStepsFromRear > 29) throw new Error('Invalid phase direction or pose')
      for (const point of [w.pickup, w.partial]) if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x >= w.viewport.width || point.y < 0 || point.y >= w.viewport.height) throw new Error('Invalid phase point')
      await page.setViewportSize(w.viewport); await save(WRAPPED_SEED); await page.reload(); await rear(); await stage.focus()
      for (let n = 0; n < w.rightStepsFromRear; n++) await page.keyboard.press('Shift+ArrowRight')
      const before = await read(), beforeWrites = writes
      await page.screenshot({ path: resolve(evidence, `phase-${w.face}-attached.png`) })
      await page.mouse.move(w.pickup.x, w.pickup.y); await page.mouse.down()
      for (const travel of [16, 32, 51.2, 57.6, 64]) {
        const point = { x: w.pickup.x + (w.partial.x - w.pickup.x) / distance * travel, y: w.pickup.y + (w.partial.y - w.pickup.y) / distance * travel }
        await page.mouse.move(point.x, point.y)
        await browserExpect(overlay).toHaveAttribute('data-sticker-stage', /^(peeling|placing)$/)
        await browserExpect(overlay).toHaveAttribute('data-sticker-landing', '0')
        const state = await overlay.evaluate(el => Object.fromEntries(Array.from(el.attributes).filter(a => a.name.startsWith('data-sticker-')).map(a => [a.name, a.value])))
        await page.screenshot({ path: resolve(evidence, `phase-${w.face}-${travel}.png`) })
        await marker(w.pickup, point, travel)
        await page.screenshot({ path: resolve(evidence, `phase-${w.face}-${travel}-marked.png`) })
        await page.evaluate(() => document.querySelector('[data-phase-diagnostic-marker]')?.remove())
        records.push({ face: w.face, travel, pointer: point, originalPickup: w.pickup, state })
      }
      await page.keyboard.press('Escape'); await page.mouse.up()
      await browserExpect.poll(async () => wrappedCarryIsNeutral(await overlay.evaluateAll(elements => elements.map(el => ({ stage: el.getAttribute('data-sticker-stage'), peel: el.getAttribute('data-sticker-peel') }))))).toBe(true)
      expect(writes).toBe(beforeWrites); expect(await read()).toEqual(before)
      await page.screenshot({ path: resolve(evidence, `phase-${w.face}-returned.png`) })
    }
  } finally {
    await page.keyboard.press('Escape').catch(() => {}); await page.mouse.up().catch(() => {}); page.off('request', onRequest)
    await page.evaluate(() => document.querySelector('[data-phase-diagnostic-marker]')?.remove()).catch(() => {})
    await writeFile(resolve(evidence, 'phase-strip.json'), JSON.stringify({ build: wrappedBuildIdentity(build), inputText, inputSHA256: sha256(inputText), seed: WRAPPED_SEED, records, scope: 'Candidate phase inspection, desktop mouse only. Original pickup reference is fixed, not the moving material UV. Coordinates inherited from prior witnesses; actual current carry admission checked. Screenshots/markers add timing overhead; not performance or full interaction acceptance.' }, null, 2))
  }
}

/** Bounded spatial samples. Reload publishes public endpoint writes; this is not a live drag. */
export const WRAPPED_GEOMETRY_SWEEP = [
  { name: 'rear', modelX: 100, modelY: 200, side: false },
  { name: 'right-edge', modelX: 156.09, modelY: 200, side: false },
  { name: 'corner-entry', modelX: 156.09, modelY: 249.99, side: true },
  { name: 'corner', modelX: 156.09, modelY: 266.616, side: true },
  { name: 'top-edge', modelX: 100, modelY: 266.616, side: false },
] as const

async function verifyGeometrySweep({ page, evidence, read, save, rear }: Parameters<typeof verifyStickerEdgeWrap>[0]): Promise<void> {
  const stage = page.locator('.webpod-device-preview__stage')
  const frames: unknown[] = []
  await page.setViewportSize({ width: 1280, height: 900 })
  const capture = async (name: string, modelX: number, modelY: number, rotationDeg: number, side: boolean) => {
    const placement: StickerPlacement = { ...WRAPPED_SEED[0] as StickerPlacement, x: .5 - modelX / 330, y: .5 - modelY / 552, rotationDeg }
    const companion = WRAPPED_SEED[1]
    if (companion === undefined) throw new Error('Missing sweep companion')
    await save([placement, companion]); await page.reload(); await rear()
    expect((await read()).placements.find(p => p.stickerId === placement.stickerId)).toEqual(placement)
    await page.screenshot({ path: resolve(evidence, `sweep-${rotationDeg}-${name}-rear.png`) })
    if (side) {
      await stage.focus(); for (let n = 0; n < 5; n++) await page.keyboard.press('Shift+ArrowRight')
      await page.screenshot({ path: resolve(evidence, `sweep-${rotationDeg}-${name}-side.png`) })
    }
    frames.push({ name, placement, modelX, modelY, cameras: side ? ['rear', 'rear-plus-five-right-steps'] : ['rear'], publication: 'public revisioned PUT then reload', artwork: { id: placement.stickerId, wear: placement.wear, width: placement.width } })
  }
  try {
    for (const angle of [0, 45, 90]) for (const point of WRAPPED_GEOMETRY_SWEEP) await capture(point.name, point.modelX, point.modelY, angle, point.side)
    // Opposite sides of each chart-axis boundary at fixed edge depth, no center singularity.
    for (const sign of [-1, 1]) {
      await capture(`top-axis-${sign < 0 ? 'negative' : 'positive'}`, sign * .01, 266.616, 0, false)
      await capture(`right-axis-${sign < 0 ? 'negative' : 'positive'}`, 156.09, sign * .01, 0, false)
    }
  } finally {
    await writeFile(resolve(evidence, 'geometry-sweep-frames.json'), JSON.stringify({ kind: 'spatial geometry samples through public endpoint and reload', frames, continuityGate: 'pending dense numerical path and uninterrupted direct-grab native run; reload frames do not prove temporal continuity', sourceIdentity: 'full source/artifact manifests recorded by enclosing native provenance' }, null, 2))
  }
}

async function captureMatrixWitnessInputs({ page, evidence, read, save, rear }: Parameters<typeof verifyStickerEdgeWrap>[0]): Promise<void> {
  const buildPath = process.env.WEBPOD_STICKER_EDGE_BUILD_PROVENANCE
  if (buildPath === undefined) throw new Error('Matrix capture requires stable build provenance')
  const build = await Bun.file(buildPath).json() as BuildProvenance
  verifyBuild(build)
  const stage = page.locator('.webpod-device-preview__stage')
  for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport); await save(WRAPPED_SEED); await page.reload(); await rear()
    for (const [face, steps, rightStepsFromRear] of [['rear', 0, 0], ['side', 5, 5], ['front', 10, 15]] as const) {
      await stage.focus(); for (let n = 0; n < steps; n++) await page.keyboard.press('Shift+ArrowRight')
      await page.screenshot({ path: resolve(evidence, `matrix-${viewport.width}-${face}.png`) })
      const submitted = await readStickerMatrixCapture(page)
      expect((await read()).placements).toEqual(WRAPPED_SEED)
      await writeFile(resolve(evidence, `matrix-${viewport.width}-${face}.json`), JSON.stringify({ build: wrappedBuildIdentity(build), seed: WRAPPED_SEED, viewport, pose: { face, rightStepsFromRear }, submitted }, null, 2))
    }
  }
}

/** Test driver only: real pointer gestures, public HTTP persistence, and public view keys. */
export async function verifyStickerEdgeWrap({ page, evidence, read, save, rear }: {
  page: Page; evidence: string; read: () => Promise<StickerInventory>;
  save: (placements: readonly StickerPlacement[]) => Promise<void>; rear: () => Promise<void>;
}): Promise<void> {
  if (process.env.WEBPOD_STICKER_EDGE_PHASES === '1') { await verifyPeelPhaseStrip({ page, evidence, read, save, rear }); return }
  if (process.env.WEBPOD_STICKER_MATRIX_CAPTURE === '1') { await captureMatrixWitnessInputs({ page, evidence, read, save, rear }); return }
  if (process.env.WEBPOD_STICKER_EDGE_SWEEP === '1') { await verifyGeometrySweep({ page, evidence, read, save, rear }); return }
  if (process.env.WEBPOD_STICKER_EDGE_INTERACTION === '1') { await verifyWrappedPickup({ page, evidence, read, save, rear }); return }
  const point = async (id: string) => {
    const box = await page.locator(`[data-sticker-placed="${id}"]`).boundingBox()
    if (box === null) throw new Error(`Missing projected sticker ${id}`)
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  }
  const stage = page.locator('.webpod-device-preview__stage')
  const snapshots: unknown[] = []
  const seed: StickerPlacement[] = [
    { stickerId: 'PW-C01', surface: 'back', x: .4, y: .4, width: .25, rotationDeg: 0, wear: .8 },
    { stickerId: 'PW-F01', surface: 'back', x: .65, y: .72, width: .25, rotationDeg: 0, wear: .6 },
  ]
  const stripOnly = process.env.WEBPOD_STICKER_EDGE_STRIP === '1'
  const cornerCageOnly = process.env.WEBPOD_STICKER_EDGE_CORNER_CAGE === '1'
  const stripWidth = process.env.WEBPOD_STICKER_EDGE_STRIP_MAX === '1' ? .35 : .20
  const targets = [
    ['left', .005, .5], ['right', .995, .5], ['top', .5, .005], ['bottom', .5, .995],
    ['top-left', .027, .017], ['top-right', .973, .017], ['bottom-left', .027, .983], ['bottom-right', .973, .983],
  ] as const
  for (const viewport of process.env.WEBPOD_STICKER_EDGE_STATIC === '1' ? [] : [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport)
    for (const [edge, x, y] of targets) {
      await save(seed); await page.reload(); await rear()
      const first = await point('PW-C01'), second = await point('PW-F01')
      // Calibrate from two actual body-space DOM projections at the rear-facing view.
      const width = (second.x - first.x) / .25, height = (second.y - first.y) / .32
      const target = { x: first.x + (x - .4) * width, y: first.y + (y - .4) * height }
      const response = page.waitForResponse(r => r.url().endsWith('/api/stickers/placements') && r.request().method() === 'PUT', { timeout: 10000 })
      if (viewport.width === 375) {
        const cdp = await page.context().newCDPSession(page)
        try {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [first] })
          for (let n = 1; n <= 20; n++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: first.x + (target.x - first.x) * n / 20, y: first.y + (target.y - first.y) * n / 20 }] })
          await page.screenshot({ path: resolve(evidence, `${viewport.width}-${edge}-held.png`) })
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        } finally { await cdp.detach() }
      } else {
        await page.mouse.move(first.x, first.y); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 20 })
        await page.screenshot({ path: resolve(evidence, `${viewport.width}-${edge}-held.png`) }); await page.mouse.up()
      }
      expect((await response).status()).toBe(200)
      const actual = (await read()).placements.find(p => p.stickerId === 'PW-C01')
      expect(actual).toBeDefined(); expect(Math.abs((actual?.x ?? -1) - x)).toBeLessThan(.025); expect(Math.abs((actual?.y ?? -1) - y)).toBeLessThan(.025)
      expect(actual?.wear).toBe(.8)
      await browserExpect(page.locator('[data-sticker-stage]')).not.toHaveAttribute('data-sticker-stage', 'placing')
      await page.screenshot({ path: resolve(evidence, `${viewport.width}-${edge}-rear.png`) })
      await stage.focus(); for (let n = 0; n < 3; n++) await page.keyboard.press('Shift+ArrowRight')
      await page.screenshot({ path: resolve(evidence, `${viewport.width}-${edge}-oblique.png`) })
      await page.reload(); await rear(); expect((await read()).placements.find(p => p.stickerId === 'PW-C01')).toEqual(actual)
      snapshots.push({ viewport, edge, target, actual })
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  for (const stickerId of (cornerCageOnly ? ['PW-C03'] : stripOnly ? ['PW-F01'] : ['PW-C03', 'PW-F01']) as readonly ('PW-C03' | 'PW-F01')[]) for (const rotationDeg of stripOnly || cornerCageOnly ? [0] : [0, 45, 137]) {
    const largest: StickerPlacement = { stickerId, surface: 'back', x: stripOnly ? 0 : stickerId === 'PW-C03' ? .027 : .005, y: stickerId === 'PW-C03' ? .017 : .5, width: stripOnly ? stripWidth : .35, rotationDeg, wear: 1 }
    await save([largest, { stickerId: stickerId === 'PW-F01' ? 'PW-C01' : 'PW-F01', surface: 'back', x: .65, y: .72, width: .25, rotationDeg: 0, wear: .6 }]); await page.reload(); await rear()
    await page.screenshot({ path: resolve(evidence, `max-${stickerId}-${rotationDeg}-rear.png`) })
    await stage.focus()
    for (let n = 0; n < 5; n++) await page.keyboard.press('Shift+ArrowRight')
    await page.screenshot({ path: resolve(evidence, `max-${stickerId}-${rotationDeg}-side.png`) })
    for (let n = 0; n < 10; n++) await page.keyboard.press('Shift+ArrowRight')
    await page.screenshot({ path: resolve(evidence, `max-${stickerId}-${rotationDeg}-front.png`) })
    expect((await read()).placements.find(p => p.stickerId === stickerId)).toEqual(largest)
  }
  await writeFile(resolve(evidence, 'edge-wrap-gestures.json'), JSON.stringify(snapshots, null, 2))
}
