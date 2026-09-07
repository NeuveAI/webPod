import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, sep } from 'node:path'
import { chromium, expect as browserExpect } from '@playwright/test'
import { createLiveStickerServer } from '@webpod/server-core/stickers'
import { isStickerInventory, type StickerInventory } from '@webpod/stickers'
import { fingerprintBrowserSources } from '../../../scripts/browser-source-fingerprint'
import { beginEdgeProvenance } from './sticker-edge-provenance'
import { installStickerMatrixRecorder } from './sticker-matrix-recorder'
import { verifyStickerEditorPerformance } from './sticker-editor-performance'
import { installStickerFrameObserver } from './sticker-frame-observer'
import { verifyStickerEdgeWrap, wrappedWitnesses, wrappedCarryIsNeutral, assertWrappedRelocation, validateWrappedEvidence, wrappedBuildIdentity, WRAPPED_SEED } from './sticker-edge-wrap-driver'
import { installDeterministicAppleMusic } from '../tests/deterministic-apple-music'

const edgeWrap = process.env.WEBPOD_STICKER_EDGE_WRAP === '1'
const largeMaterial = process.env.WEBPOD_CONTOUR_LARGE === '1'
const evidence = process.env.WEBPOD_STICKER_EDGE_WRAP_EVIDENCE_DIR ?? process.env.WEBPOD_STICKER_CONTOUR_EVIDENCE_DIR ?? process.env.WEBPOD_STICKER_HUD_EVIDENCE_DIR ?? resolve(import.meta.dirname, '../../../docs/workstreams/015-listening-sticker-collection/evidence/sticker-contour/final')

test('wrapped witness admission rejects missing faces and unsafe screen coordinates', () => {
  const point = { x: 100, y: 100 }
  const witnesses = [1280, 375].flatMap(width => ['side', 'front'].map(face => ({ name: `${width}-${face}`, viewport: { width, height: 900 }, face, rightStepsFromRear: face === 'side' ? 5 : 15, pickup: point, partial: point, release: point, occluded: point, flickEnd: point, ...(face === 'front' ? { invalid: { x: 200, y: 100 } } : {}), expectedCenter: { x: .1, y: .1 }, evidence: '/tmp/device-witness.json' })))
  expect(wrappedWitnesses(witnesses)).toHaveLength(4)
  expect(() => wrappedWitnesses(witnesses.map(w => ({ ...w, invalid: undefined })))).toThrow()
  expect(() => wrappedWitnesses(witnesses.map(w => ({ ...w, invalid: { x: NaN, y: 100 } })))).toThrow()
  expect(() => wrappedWitnesses(undefined)).toThrow()
  expect(() => wrappedWitnesses(witnesses.slice(1))).toThrow()
  expect(() => wrappedWitnesses([...witnesses.slice(0, 3), witnesses[0]])).toThrow()
  expect(() => wrappedWitnesses(witnesses.map(w => ({ ...w, pickup: { x: 2000, y: 100 } })))).toThrow()
  expect(() => wrappedWitnesses(witnesses.map(w => ({ ...w, expectedCenter: { x: NaN, y: .5 } })))).toThrow()
  expect(() => wrappedWitnesses(witnesses.map(w => ({ ...w, expectedCenter: { x: .03, y: .02 } })))).toThrow()
})

test('wrapped cancellation and save gates accept absent idle UI but reject active or duplicate work', () => {
  expect(wrappedCarryIsNeutral([])).toBe(true)
  expect(wrappedCarryIsNeutral([{ stage: 'open', peel: '0' }])).toBe(true)
  expect(wrappedCarryIsNeutral([{ stage: 'peeling', peel: '0' }])).toBe(false)
  expect(wrappedCarryIsNeutral([{ stage: 'open', peel: '.2' }])).toBe(false)
  const source = WRAPPED_SEED[0]
  if (source === undefined) throw new Error('Missing wrapped seed')
  const placed = { ...source, x: .2, y: .2 }
  expect(() => assertWrappedRelocation(placed, { x: .2, y: .2 }, 1)).not.toThrow()
  for (const count of [0, 2]) expect(() => assertWrappedRelocation(placed, { x: .2, y: .2 }, count)).toThrow()
  expect(() => assertWrappedRelocation(WRAPPED_SEED[0], { x: .03, y: .02 }, 1)).toThrow()
  expect(() => assertWrappedRelocation(WRAPPED_SEED[0], { x: .2, y: .2 }, 1)).toThrow()
})

test('wrapped evidence rejects stale build pose UV and false visibility witnesses', () => {
  const hash = 'a'.repeat(64), build = { sourceAfter: { 'packages/device/src/sticker-corner-cage.ts': hash }, artifacts: { 'apps/web/dist/server/server.js': 'b'.repeat(64) } }
  const point = { x: 100, y: 100 }
  const witness = { name: '1280-side', viewport: { width: 1280, height: 900 }, face: 'side' as const, rightStepsFromRear: 5, pickup: point, partial: point, release: point, occluded: { x: 120, y: 100 }, flickEnd: point, expectedCenter: { x: .2, y: .2 }, evidence: '/tmp/proof.json' }
  const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  const proof = { version: 1, build: wrappedBuildIdentity(build), sampler: { path: 'packages/device/src/sticker-corner-cage.ts', sha256: hash }, seed: WRAPPED_SEED, viewport: witness.viewport, pose: { face: witness.face, rightStepsFromRear: 5 }, cameraWorld: matrix, cameraProjection: matrix, contentWorld: matrix, pickup: { point, uv: [.5, .5], effectiveAlpha: 1, stickerDistance: 10, shellDistance: 11 }, occluded: { point: witness.occluded, uv: [.5, .5], effectiveAlpha: 1, stickerDistance: 11, shellDistance: 10 }, attached: { uv: [.4, .4], partialPointer: point } }
  expect(() => validateWrappedEvidence(proof, witness, build)).not.toThrow()
  const invalid = [
    {}, { ...proof, build: { ...proof.build, artifacts: hash } }, { ...proof, seed: [] },
    { ...proof, viewport: { width: 375, height: 900 } }, { ...proof, pose: { face: 'front', rightStepsFromRear: 15 } },
    { ...proof, sampler: { ...proof.sampler, sha256: 'c'.repeat(64) } },
    { ...proof, pickup: { ...proof.pickup, uv: [-1, .5] } }, { ...proof, pickup: { ...proof.pickup, effectiveAlpha: 0 } },
    { ...proof, pickup: { ...proof.pickup, point: witness.occluded } }, { ...proof, pickup: { ...proof.pickup, stickerDistance: 12 } },
    { ...proof, occluded: { ...proof.occluded, shellDistance: 12 } },
  ]
  const front = { ...witness, face: 'front' as const, invalid: { x: 200, y: 100 } }
  const frontProof = { ...proof, pose: { ...proof.pose, face: 'front' }, invalid: { point: front.invalid, result: null, mapping: 'captured-triangle-affine' } }
  expect(() => validateWrappedEvidence(frontProof, front, build)).not.toThrow()
  expect(() => validateWrappedEvidence({ ...frontProof, invalid: undefined }, front, build)).toThrow()
  expect(() => validateWrappedEvidence({ ...frontProof, invalid: { ...frontProof.invalid, point: { x: 201, y: 100 } } }, front, build)).toThrow()
  expect(() => validateWrappedEvidence({ ...frontProof, invalid: { ...frontProof.invalid, result: { x: .2, y: .3 } } }, front, build)).toThrow()
  for (const stale of invalid) expect(() => validateWrappedEvidence(stale, witness, build)).toThrow()
})

/** Actual built Start route, native cookies and SQLite; only trusted Apple/signing
 * dependencies are synthetic. No intercepted browser inventory/session endpoints. */
test('Contour rotations, wear, reset, tooltips and recovery use actual route and artwork', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'webpod-sticker-editor-'))
  const cleanup: (() => Promise<unknown>)[] = [() => rm(directory, { recursive: true, force: true })]
  const fault: { status: number; gate: Promise<void> | null; release: (() => void) | null } = { status: 0, gate: null, release: null }
  try {
    const source = fingerprintBrowserSources()
    const provenancePath = process.env.WEBPOD_STICKER_EDGE_BUILD_PROVENANCE
    if (edgeWrap && provenancePath === undefined) throw new Error('Edge native requires WEBPOD_STICKER_EDGE_BUILD_PROVENANCE from the verified build wrapper')
    const edgeProvenance = edgeWrap && provenancePath !== undefined ? beginEdgeProvenance(provenancePath, evidence) : null
    if (edgeProvenance !== null) cleanup.push(async () => edgeProvenance.finish())
    await mkdir(evidence, { recursive: true })
    let now = Date.now()
    const service = createLiveStickerServer({ databasePath: resolve(directory, 'collection.sqlite'), now: () => now, developerToken: async () => 'synthetic-developer', fetch: async (input) => {
      const path = new URL(String(input)).pathname
      if (path.endsWith('/storefront')) return Response.json({ data: [{ id: 'us' }] })
      if (path.includes('/library/')) {
        return Response.json({ data: [{ attributes: { playParams: { catalogId: '123' }, durationInMillis: edgeWrap ? 4_000_000 : 240000, genreNames: largeMaterial ? ['Metal'] : ['Rock'] } }, { attributes: { playParams: { catalogId: '124' }, durationInMillis: 240000, genreNames: ['Electronic'] } }] })
      }
      return Response.json({ data: [] })
    } })
    cleanup.push(() => service.dispose())
    await service.ready()
    const clientRoot = resolve(import.meta.dirname, '../dist/client')
    const { default: entry } = await import(resolve(import.meta.dirname, '../dist/server/server.js')) as { default: { fetch(request: Request, options: { context: Record<string, unknown> }): Promise<Response> } }
    const requests: { path: string; method: string; status: number }[] = []
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, async fetch(request) {
      const path = new URL(request.url).pathname
      if (path === '/api/stickers/placements' && request.method === 'PUT') {
        if (fault.gate !== null) await fault.gate
        if (fault.status !== 0) { const status = fault.status; fault.status = 0; requests.push({ path, method: request.method, status }); return new Response('{}', { status }) }
      }
      const filePath = resolve(clientRoot, '.' + decodeURIComponent(path))
      if (request.method === 'GET' && filePath.startsWith(clientRoot + sep) && !path.split('/').some((part) => part.startsWith('.'))) {
        if ((await stat(filePath).catch(() => null))?.isFile()) return new Response(Bun.file(filePath))
      }
      const response = await entry.fetch(request, { context: { stickerServer: service, appleTokenOptions: {
        env: { APPLE_TEAM_ID: 'ABCDE12345', APPLE_MUSICKIT_KEY_ID: 'ABCDE12345', APPLE_MUSICKIT_KEY_PATH: '/synthetic/no-key-read.p8' }, signer: { async sign() { return new Uint8Array(64) } },
      } } })
      requests.push({ path, method: request.method, status: response.status })
      return response
    } })
    cleanup.push(async () => server.stop(true))
    const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-blink-features=CanvasDrawElement'] })
    cleanup.push(() => browser.close())
    const context = await browser.newContext({ viewport: largeMaterial ? {width:2000,height:2400} : { width: 1280, height: 900 }, recordVideo: { dir: resolve(evidence, 'video'), size: { width: 1280, height: 900 } } })
    const origin = server.url.origin
    const headers = { origin }
    const read = async (): Promise<StickerInventory> => {
      const response = await context.request.get(origin + '/api/stickers')
      expect(response.status()).toBe(200)
      const value: unknown = await response.json()
      if (!isStickerInventory(value)) throw new Error('Invalid native inventory')
      return value
    }
    expect((await context.request.post(origin + '/api/stickers/device', { headers })).status()).toBe(200)
    expect((await context.request.post(origin + '/api/stickers/session', { headers, data: { musicUserToken: 'synthetic-user' } })).status()).toBe(200)
    if (edgeWrap) {
      // Earn the third Rock print through the same bounded listening endpoint;
      // advance only the isolated trusted clock, never production ownership state.
      for (let sequence = 0; sequence <= 360; sequence++) {
        now += 10_000
        expect((await context.request.post(origin + '/api/stickers/listening', { headers, data: {
          eventId: `edge-${sequence}`, streamId: 'edge-fixture', sequence, catalogId: '123', positionMs: sequence * 10_000, playing: true,
        } })).status()).toBe(200)
      }
      expect((await read()).stickerIds).toContain('PW-C03')
    }
    const earned = await read(), packId = earned.packs[0]?.id
    if (packId === undefined) throw new Error('Seed pack missing')
    expect((await context.request.post(origin + '/api/stickers/packs/open', { headers, data: { packId } })).status()).toBe(200)
    const placement = { stickerId: largeMaterial ? 'PW-A01' : 'PW-C01', surface: 'back', x: .4, y: largeMaterial ? .32 : .4, width: largeMaterial ? .35 : .25, rotationDeg: 0 }
    expect((await context.request.put(origin + '/api/stickers/placements', { headers, data: { revision: 0, placements: [placement, { stickerId: 'PW-F01', surface: 'back', x: largeMaterial ? .60 : .65, y: largeMaterial ? .68 : .72, width: largeMaterial ? .35 : .25, rotationDeg: 0 }] } })).status()).toBe(200)
    const page = await context.newPage()
    // Test-owned instrumentation installed before WebGL contexts/programs exist.
    // Counts every standard WebGL draw entry point without a product testing API.
    if (process.env.WEBPOD_STICKER_MATRIX_CAPTURE === '1') await installStickerMatrixRecorder(page)
    if ((process.env.WEBPOD_STICKER_EDGE_INTERACTION === '1' || process.env.WEBPOD_STICKER_EDITOR_PERF === '1') && process.env.WEBPOD_STICKER_MATRIX_CAPTURE !== '1') await installStickerFrameObserver(page, process.env.WEBPOD_STICKER_EDITOR_PERF === '1')
    await page.addInitScript(() => {
      const target = window as Window & { __hudDrawProbe?: { calls: number; methods: string[] } }
      const probe = { calls: 0, methods: [] as string[] }; target.__hudDrawProbe = probe
      const wrap = (prototype: object, label: string, name: string): void => {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
        const original: unknown = descriptor?.value
        if (descriptor === undefined || typeof original !== 'function') return
        Object.defineProperty(prototype, name, { ...descriptor, value: function(this: WebGLRenderingContext | WebGL2RenderingContext, ...args: unknown[]) { probe.calls++; return Reflect.apply(original, this, args) } })
        probe.methods.push(`${label}.${name}`)
      }
      for (const name of ['drawArrays', 'drawElements']) wrap(WebGLRenderingContext.prototype, 'WebGL', name)
      if (typeof WebGL2RenderingContext !== 'undefined') for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) wrap(WebGL2RenderingContext.prototype, 'WebGL2', name)
    })
    let placementStarts=0
    page.on('request',request=>{if(request.method()==='PUT'&&request.url().endsWith('/api/stickers/placements'))placementStarts++})
    const consoleErrors: string[] = []
    page.on('console', (message) => { if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text()) })
    page.on('pageerror', (error) => consoleErrors.push(error.message))
    await installDeterministicAppleMusic(page, { authorized: true, mockDeveloperToken: false })
    const rear = async () => {
      await browserExpect(page.locator('.webpod-device-preview__device')).toHaveAttribute('data-composite-tier', 'T1', { timeout: 30000 })
      await page.locator('.webpod-device-preview__stage').focus(); await page.keyboard.press('Home')
      for (let i = 0; i < 15; i++) await page.keyboard.press('Shift+ArrowRight')
      await browserExpect(page.locator('[data-sticker-placed]')).toHaveCount(2)
    }
    const shot = async (name: string, expectedId = 'PW-C01') => {
      const png = await page.screenshot({ path: resolve(evidence, name) })
      expect(consoleErrors.filter((error) => /WebGLProgram|SHADER|VALIDATE_STATUS|ReferenceError/.test(error))).toEqual([])
      const id = await page.locator('[data-sticker-editor]').count() > 0 ? await page.locator('[data-sticker-editor]').getAttribute('data-sticker-editor') : expectedId
      const p = await point(id ?? expectedId)
      const colored = await page.evaluate(async ({ png, point, monochrome }) => {
        const image = new Image(); image.src = `data:image/png;base64,${png}`; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = 70; canvas.height = 70
        const ctx = canvas.getContext('2d'); if (ctx === null) return 0
        ctx.drawImage(image, point.x - 35, point.y - 35, 70, 70, 0, 0, 70, 70)
        const pixels = ctx.getImageData(0, 0, 70, 70).data; let count = 0
        for (let i = 0; i < pixels.length; i += 4) { const r = pixels[i] ?? 0, g = pixels[i+1] ?? 0, b = pixels[i+2] ?? 0; if (Math.max(r,g,b) - Math.min(r,g,b) > 35 && Math.max(r,g,b) > 90) count++ }
        if(monochrome){let edges=0;for(let y=1;y<69;y++)for(let x=1;x<69;x++){const i=(y*70+x)*4;if(Math.abs((pixels[i]??0)-(pixels[i-4]??0))>25)edges++}return edges}
        return count
      }, { monochrome:id==='PW-A01',png: png.toString('base64'), point: p })
      expect(colored).toBeGreaterThan(70)
      return png
    }
    const point = async (id: string) => {
      const box = await page.locator(`[data-sticker-placed="${id}"]`).boundingBox()
      if (box === null) throw new Error('Missing actual sticker projection')
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }
    const response = () => page.waitForResponse(r => r.url().endsWith('/api/stickers/placements') && r.request().method() === 'PUT',{timeout:10000}).catch(async(error:unknown)=>{await page.screenshot({path:resolve(evidence,'response-timeout.png')});await writeFile(resolve(evidence,'response-timeout.json'),JSON.stringify({requests,inventory:await read(),editor:await page.locator('[data-sticker-editor]').evaluateAll(elements=>elements.map(e=>({phase:e.getAttribute('data-editor-phase'),id:e.getAttribute('data-sticker-editor'),text:e.textContent}))),consoleErrors},null,2));throw error})
    const currentPlacement = async (id = 'PW-C01') => { const p = (await read()).placements.find(p => p.stickerId === id); if (p === undefined) throw new Error('Missing saved placement'); return p }
    const center = async (selector: string) => { const box = await page.locator(selector).boundingBox(); if (box === null) throw new Error('Missing control'); return { x: box.x + box.width / 2, y: box.y + box.height / 2 } }
    const select = async (id: string) => { const p = await point(id); await page.mouse.click(p.x, p.y); await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-sticker-editor', id); await page.waitForTimeout(350) }
    await page.goto(origin)
    await rear()
    if (process.env.WEBPOD_STICKER_EDITOR_PERF === '1') {
      if (!edgeWrap || process.env.WEBPOD_STICKER_MATRIX_CAPTURE === '1') throw new Error('Editor performance requires provenance and recorder off')
      await verifyStickerEditorPerformance({ page, evidence, read, rear, save: async placements => {
        const inventory = await read()
        expect((await context.request.put(origin + '/api/stickers/placements', { headers, data: { revision: inventory.placementRevision, placements } })).status()).toBe(200)
      } })
      expect(consoleErrors.filter(error => /WebGLProgram|SHADER|ReferenceError|exceeds rear surface/.test(error))).toEqual([])
      return
    }
    if (edgeWrap) {
      await verifyStickerEdgeWrap({ page, evidence, read, rear, save: async (placements) => {
        const inventory = await read()
        expect((await context.request.put(origin + '/api/stickers/placements', { headers, data: { revision: inventory.placementRevision, placements } })).status()).toBe(200)
      } })
      // Full source/artifact manifests are checked in cleanup, including failures.
      // Exact approved external post-build deltas are disclosed, never claimed tested.
      expect(consoleErrors.filter(error => /WebGLProgram|SHADER|ReferenceError|exceeds rear surface/.test(error))).toEqual([])
      await writeFile(resolve(evidence, 'edge-wrap-verification.json'), JSON.stringify({ source, requests, consoleErrors }, null, 2))
      return
    }
    if(largeMaterial) {
      for(const id of ['PW-A01','PW-F01']) {
        for(const wear of [0,.5,1]) {
          await select(id)
          const range=await page.getByRole('slider',{name:'Sticker wear'}).boundingBox();if(range===null)throw new Error('Missing wear scrubber')
          if(wear>0){const save=response();if(wear===1)await page.getByRole('slider',{name:'Sticker wear'}).press('End');else await page.mouse.click(range.x+range.width/2,range.y+range.height/2);await save;await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase','editing')}
          if(id==='PW-F01'&&wear===0){await page.locator('[data-contour-corner="0"]').focus();for(let i=0;i<35;i++){await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase','editing');const save=response();await page.keyboard.press('ArrowRight');await save;await browserExpect(page.locator('[data-contour-corner="0"]')).toBeFocused()}}
          await page.waitForTimeout(300);await shot(`${id}-large-wear-${wear}-selected.png`,id)
          const bounds=await page.locator('[data-sticker-contour] path').first().evaluate(e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})
          await writeFile(resolve(evidence,`${id}-large-wear-${wear}-bounds.json`),JSON.stringify(bounds))
          await page.mouse.click(1850,1200);await page.waitForTimeout(450);await shot(`${id}-large-wear-${wear}.png`,id)
          const p=await point(id);await page.screenshot({path:resolve(evidence,`${id}-large-wear-${wear}-close.png`),clip:{x:p.x-300,y:p.y-300,width:600,height:600}})
        }
        if(id==='PW-A01') {
          const p=await point(id);await select(id);const returned=response();await page.getByRole('button',{name:'Return to pack',exact:true}).click();await returned;await browserExpect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage','open',{timeout:10000});await page.getByRole('button',{name:'Put pack away',exact:true}).click();await page.waitForTimeout(700)
          const png=await page.screenshot({path:resolve(evidence,'night-shift-blank-negative.png')})
          const edges=await page.evaluate(async({png,p})=>{const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();const c=document.createElement('canvas');c.width=70;c.height=70;const ctx=c.getContext('2d');if(ctx===null)throw new Error('No canvas');ctx.drawImage(image,p.x-35,p.y-35,70,70,0,0,70,70);const d=ctx.getImageData(0,0,70,70).data;let edges=0;for(let y=1;y<69;y++)for(let x=1;x<69;x++){const i=(y*70+x)*4;if(Math.abs((d[i]??0)-(d[i-4]??0))>25)edges++}return edges},{png:png.toString('base64'),p})
          expect(edges).toBeLessThan(70);await writeFile(resolve(evidence,'night-shift-negative-control.json'),JSON.stringify({point:p,edges,threshold:70,removed:(await read()).placements.every(p=>p.stickerId!=='PW-A01')}))
        }
      }
      const body=await point('PW-F01');await page.mouse.move(body.x,body.y);await page.mouse.down();await page.mouse.move(body.x,body.y-55,{steps:8});await page.screenshot({path:resolve(evidence,'large-pulse-adhesive.png')});await page.keyboard.press('Escape');await page.mouse.up()
      expect(fingerprintBrowserSources()).toEqual(source);await writeFile(resolve(evidence,'large-material-verification.json'),JSON.stringify({source,consoleErrors,inventory:await read()},null,2));return
    }
    const selected = await point('PW-C01')
    await page.mouse.click(selected.x, selected.y)
    await browserExpect(page.locator('[data-hud-handle="rotate"]').first()).toBeVisible()
    await shot('desktop-enter.png')
    await page.waitForTimeout(500)
    await shot('desktop-selected.png')
    if(process.env.WEBPOD_CONTOUR_TOOLTIP==='1') {
      await page.evaluate(()=>{const target=window as Window&{__tipEvents?:unknown[]};target.__tipEvents=[];for(const name of ['pointerenter','focusin','focusout','keydown','keyup'])document.addEventListener(name,event=>{const e=event.target as HTMLElement;target.__tipEvents?.push({type:name,key:'key'in event?event.key:null,label:e.getAttribute('aria-label'),id:e.id,tooltip:document.querySelector('[role=tooltip]')?.textContent})},true)})
      await page.locator('.webpod-device-preview__stage').focus();await page.locator('[data-contour-corner="0"]').hover();await page.keyboard.press('Escape');await browserExpect(page.getByRole('tooltip')).toHaveCount(0)
      await page.mouse.move(1100,100);const trigger=await page.locator('[data-contour-corner="1"]').boundingBox();if(trigger===null)throw new Error('Missing trigger')
      await page.mouse.move(trigger.x+22,trigger.y+22);await page.mouse.move(trigger.x+28,trigger.y+25);await page.keyboard.press('Escape');await browserExpect(page.getByRole('tooltip')).toHaveCount(0);await page.waitForTimeout(120);await browserExpect(page.getByRole('tooltip')).toHaveCount(0)
      await page.mouse.move(trigger.x+32,trigger.y+25);await browserExpect(page.getByRole('tooltip')).toBeVisible();await page.keyboard.press('Escape')
      const outcomes=[]
      for(const selector of ['[data-contour-corner="0"]','[data-contour-corner="1"]','[data-contour-corner="2"]','[data-contour-corner="3"]','[data-hud-wear] input','[data-hud-tools] button:first-child','[data-hud-tools] button:last-child']) {
        await page.mouse.move(1100,100);await page.locator(selector).hover();await page.getByRole('tooltip').hover();await page.waitForTimeout(160);await page.locator(selector).focus();await page.keyboard.press('Escape');await page.waitForTimeout(200)
        outcomes.push({selector,tooltip:await page.getByRole('tooltip').allTextContents()});await browserExpect(page.getByRole('tooltip')).toHaveCount(0)
      }
      await writeFile(resolve(evidence,'tooltip-outcomes.json'),JSON.stringify(outcomes,null,2))
      await writeFile(resolve(evidence,'tooltip-events.json'),JSON.stringify(await page.evaluate(()=>({events:(window as Window&{__tipEvents?:unknown[]}).__tipEvents,tooltip:document.querySelector('[role=tooltip]')?.textContent,active:document.activeElement?.getAttribute('aria-label')})),null,2));await page.screenshot({path:resolve(evidence,'tooltip-after-escape.png')});return
    }
    const beforeTransformDraws = await page.evaluate(() => (window as Window & { __hudDrawProbe?: { calls: number } }).__hudDrawProbe?.calls ?? -1)
    const grip = await page.locator('[data-hud-handle="rotate"]').first().boundingBox()
    if (grip === null) throw new Error('No rotation grip')
    await page.mouse.move(grip.x + 22, grip.y + 22); await page.mouse.down()
    await page.mouse.move(grip.x + 65, grip.y + 50, { steps: 8 })
    await shot('desktop-rotate-active.png')
    const activeTransformDraws = await page.evaluate(() => (window as Window & { __hudDrawProbe?: { calls: number } }).__hudDrawProbe?.calls ?? -1)
    expect(beforeTransformDraws).toBeGreaterThan(0); expect(activeTransformDraws).toBeGreaterThan(beforeTransformDraws)
    const saved = page.waitForResponse(r => r.url().endsWith('/api/stickers/placements') && r.request().method() === 'PUT')
    await page.mouse.up(); await saved
    await shot('desktop-release.png')
    expect(Math.abs((await currentPlacement()).rotationDeg)).toBeGreaterThan(5)
    await page.waitForTimeout(80); await shot('desktop-release-mid.png')
    const other = await point('PW-F01'); await page.mouse.click(other.x, other.y)
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-sticker-editor', 'PW-F01')
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-hud-release', '1')
    await shot('desktop-rapid-retarget.png', 'PW-F01')
    await select('PW-C01')
    await page.waitForTimeout(500); await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-hud-release', '1')
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-hud-presence', '1.000')
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase', 'editing')
    const idle = await page.evaluate(async () => {
      const probe = (window as Window & { __hudDrawProbe?: { calls: number; methods: string[] } }).__hudDrawProbe
      if (probe === undefined) throw new Error('Draw instrumentation missing')
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const before = probe.calls, started = performance.now()
      await new Promise(resolve => setTimeout(resolve, 3000))
      return { methods: probe.methods, before, after: probe.calls, elapsedMs: performance.now() - started, hudCount: document.querySelectorAll('[data-sticker-editor]').length, presence: document.querySelector('[data-sticker-editor]')?.getAttribute('data-hud-presence') }
    })
    await writeFile(resolve(evidence, 'settled-hud-idle.json'), JSON.stringify({ source, beforeTransformDraws, activeTransformDraws, ...idle }, null, 2))
    expect(idle.methods).toContain('WebGL2.drawElements'); expect(idle.elapsedMs).toBeGreaterThanOrEqual(2990)
    expect(idle.hudCount).toBe(1); expect(idle.presence).toBe('1.000'); expect(idle.after).toBe(idle.before)
    const undoSaved = response(); await page.getByRole('button', { name: 'Reset wear and straighten' }).click(); await undoSaved
    expect((await currentPlacement()).rotationDeg).toBe(0)
    // Each actual visible corner rotates, across the angle branch cut, with fixed size.
    for(let corner=0;corner<4;corner++) {
      const selector=`[data-contour-corner="${corner}"]`, svg=await page.locator(`${selector} svg`).boundingBox(), pivot=await point('PW-C01'),before=await currentPlacement()
      if(svg===null)throw new Error('Missing painted corner')
      const p={x:svg.x+svg.width/2,y:svg.y+svg.height/2}
      await page.mouse.move(p.x,p.y);await page.mouse.down()
      await shot(`desktop-corner-${corner}-press.png`)
      for(let step=1;step<=10;step++){const angle=step*Math.PI/24,dx=p.x-pivot.x,dy=p.y-pivot.y;await page.mouse.move(pivot.x+dx*Math.cos(angle)-dy*Math.sin(angle),pivot.y+dx*Math.sin(angle)+dy*Math.cos(angle))}
      await shot(`desktop-corner-${corner}-held.png`)
      const save=response();await page.mouse.up();await save
      expect((await currentPlacement()).width).toBe(before.width);expect((await currentPlacement()).rotationDeg).not.toBe(before.rotationDeg)
      await page.waitForTimeout(400)
    }
    const resetSave=response();await page.getByRole('button',{name:'Reset wear and straighten'}).click();await resetSave
    expect((await currentPlacement()).rotationDeg).toBe(0)
    // Real hover/focus tooltips are persistent, hoverable and Escape-dismissible.
    await page.locator('.webpod-device-preview__stage').focus();await page.locator('[data-contour-corner="0"]').hover();await browserExpect(page.getByRole('tooltip')).toBeVisible();await page.keyboard.press('Escape');await browserExpect(page.getByRole('tooltip')).toHaveCount(0);await browserExpect(page.locator('[data-sticker-editor]')).toHaveCount(1)
    for(const selector of ['[data-contour-corner="0"]','[data-contour-corner="1"]','[data-contour-corner="2"]','[data-contour-corner="3"]','[data-hud-wear] input','[data-hud-tools] button:first-child','[data-hud-tools] button:last-child']) {
      await page.mouse.move(1100,100);await page.locator(selector).hover();await browserExpect(page.getByRole('tooltip')).toBeVisible()
      await page.getByRole('tooltip').hover();await page.waitForTimeout(160);await browserExpect(page.getByRole('tooltip')).toBeVisible()
      await page.locator(selector).focus();await page.keyboard.press('Escape');await browserExpect(page.getByRole('tooltip')).toHaveCount(0);await browserExpect(page.locator('[data-sticker-editor]')).toHaveCount(1)
    }
    await page.mouse.move(1100,100);await page.locator('[data-contour-corner="1"]').hover();await page.getByRole('tooltip').hover()
    const hoverPoint=await page.getByRole('tooltip').boundingBox();if(hoverPoint===null)throw new Error('Missing hoverable tooltip')
    await page.locator('[data-contour-corner="1"]').focus();await page.keyboard.press('Escape');await browserExpect(page.getByRole('tooltip')).toHaveCount(0)
    await page.mouse.move(hoverPoint.x+hoverPoint.width/2+4,hoverPoint.y+hoverPoint.height/2);await browserExpect(page.getByRole('tooltip')).toContainText('Adjust wear')
    await page.keyboard.press('Escape');await page.mouse.move(1100,100)
    await shot('desktop-tooltip-dismissed.png')
    // Large rotation preserves the actual captured grip under each pointer sample.
    const start = await center('[data-contour-corner="0"]'), pivot = await point('PW-C01')
    const beforeHandleCancel = requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length
    await page.mouse.move(start.x, start.y); await page.mouse.down()
    for (let i=1; i<=12; i++) {
      const angle = i * Math.PI / 24, dx = start.x-pivot.x, dy = start.y-pivot.y
      const p = { x: pivot.x+dx*Math.cos(angle)-dy*Math.sin(angle), y: pivot.y+dx*Math.sin(angle)+dy*Math.cos(angle) }
      await page.mouse.move(p.x, p.y)
      const actual = await center('[data-contour-corner="0"]'); expect(Math.hypot(actual.x-p.x, actual.y-p.y)).toBeLessThan(2)
    }
    await shot('desktop-quarter-turn-active.png')
    await page.keyboard.press('Escape'); await page.mouse.up()
    expect((await currentPlacement()).rotationDeg).toBe(0)
    expect(requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length).toBe(beforeHandleCancel)
    // Native keyboard uses the same gesture commit and guarded failure recovery.
    fault.status = 503
    await page.locator('[data-hud-handle="rotate"]').first().focus()
    const failed = response(); await page.keyboard.press('ArrowRight'); expect((await failed).status()).toBe(503)
    await browserExpect(page.getByRole('alert')).toContainText('Couldn’t save')
    expect((await currentPlacement()).rotationDeg).toBe(0)
    await shot('desktop-save-failure.png')
    const retried = response(); await page.getByRole('button', { name: 'Retry', exact: true }).click(); await retried
    expect((await currentPlacement()).rotationDeg).toBe(1)
    fault.status = 409
    await page.locator('[data-hud-handle="rotate"]').first().focus(); const conflicted = response(); await page.keyboard.press('ArrowRight'); expect((await conflicted).status()).toBe(409)
    await browserExpect(page.getByRole('alert')).toContainText('Changed elsewhere')
    expect((await currentPlacement()).rotationDeg).toBe(1)
    // An unknown outcome remains locked through dismissal and re-selection.
    fault.gate = new Promise<void>(resolve => { fault.release = resolve })
    await page.locator('[data-hud-handle="rotate"]').first().focus(); await page.keyboard.press('ArrowRight')
    await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase', 'saving')
    const startsWhilePending=placementStarts
    await page.keyboard.press('ArrowRight')
    await page.getByRole('slider',{name:'Sticker wear'}).focus();await page.keyboard.press('End')
    expect(await page.getByRole('slider',{name:'Sticker wear'}).inputValue()).toBe('0')
    const pendingWear=await page.getByRole('slider',{name:'Sticker wear'}).boundingBox();if(pendingWear===null)throw new Error('Missing pending range');await page.mouse.click(pendingWear.x+pendingWear.width*.7,pendingWear.y+pendingWear.height/2)
    expect(await page.getByRole('slider',{name:'Sticker wear'}).inputValue()).toBe('0');expect(placementStarts).toBe(startsWhilePending)
    await page.mouse.click(1050,400);await page.waitForTimeout(500);await browserExpect(page.locator('[data-sticker-editor]')).toHaveCount(0);await select('PW-C01')
    await browserExpect(page.locator('[data-hud-handle="rotate"]').first()).toBeDisabled()
    const delayed = response(); fault.release?.(); fault.gate = null; await delayed
    await browserExpect(page.locator('[data-hud-handle="rotate"]').first()).toBeEnabled()
    // Surface wear is one native range gesture and persists independently of placement.
    const worn = response(); await page.getByRole('slider',{name:'Sticker wear'}).press('End'); await worn
    expect((await currentPlacement()).wear).toBe(1)
    await shot('desktop-worn.png')
    await page.locator('[data-contour-corner="0"]').focus()
    for(let i=0;i<20;i++){await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase','editing');const save=response();await page.keyboard.press(']');await save}
    await shot('desktop-soundcheck-max-wear-contour.png');await page.mouse.click(1050,400);await page.waitForTimeout(450);await shot('desktop-soundcheck-max-wear.png')
    const lift=await point('PW-C01');await page.mouse.move(lift.x,lift.y);await page.mouse.down();await page.mouse.move(lift.x,lift.y-55,{steps:8});await page.screenshot({path:resolve(evidence,'desktop-soundcheck-max-adhesive.png')});await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(600);await select('PW-C01')
    const rangeBox = await page.getByRole('slider',{name:'Sticker wear'}).boundingBox()
    if (rangeBox === null) throw new Error('Missing wear range')
    const beforeCancel = requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length
    await page.mouse.move(rangeBox.x+rangeBox.width*.8, rangeBox.y+rangeBox.height/2); await page.mouse.down()
    await page.mouse.move(rangeBox.x+rangeBox.width*.3, rangeBox.y+rangeBox.height/2)
    await page.keyboard.press('Escape')
    await page.mouse.move(rangeBox.x+rangeBox.width*.5, rangeBox.y+rangeBox.height/2); await page.mouse.up()
    await page.waitForTimeout(100)
    expect(requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length).toBe(beforeCancel)
    expect((await currentPlacement()).wear).toBe(1)
    await page.mouse.click(1050,400); await shot('desktop-exit.png'); await page.waitForTimeout(500); await browserExpect(page.locator('[data-sticker-editor]')).toHaveCount(0); await shot('desktop-dismissed.png')
    await page.setViewportSize({ width: 375, height: 812 })
    await page.waitForTimeout(500)
    const mobile = await point('PW-F01'); await page.mouse.click(mobile.x, mobile.y)
    await browserExpect(page.locator('[data-hud-handle="rotate"]').first()).toBeVisible()
    await page.waitForTimeout(500)
    await shot('mobile-selected.png', 'PW-F01')
    const touch = await context.newCDPSession(page)
    // All four visible corner grips rotate on touch; none is a resize affordance.
    for (let corner=0;corner<4;corner++) {
      const selector=`[data-contour-corner="${corner}"]`, target=await center(selector), pivot=await point('PW-F01'), before=await currentPlacement('PW-F01')
      await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[target]})
      const angle=.12, dx=target.x-pivot.x,dy=target.y-pivot.y, next={x:pivot.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:pivot.y+dx*Math.sin(angle)+dy*Math.cos(angle)}
      await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[next]})
      const active=await center(selector);expect(Math.hypot(active.x-next.x,active.y-next.y)).toBeLessThan(2)
      const saved=response();await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await saved
      expect((await currentPlacement('PW-F01')).width).toBe(before.width)
      expect((await currentPlacement('PW-F01')).rotationDeg).not.toBe(before.rotationDeg)
      await page.waitForTimeout(350)
    }
    await page.locator('[data-contour-corner="0"]').focus()
    for(let i=0;i<34;i++) { await browserExpect(page.locator('[data-sticker-editor]')).toHaveAttribute('data-editor-phase','editing'); const saved=response();await page.keyboard.press('[');await saved }
    expect((await currentPlacement('PW-F01')).width).toBeCloseTo(.08)
    await page.waitForTimeout(500); await shot('mobile-small-sticker.png','PW-F01')
    const targets = await page.locator('[data-hud-handle], [data-hud-tools] button').evaluateAll(elements => elements.map(e => { const r=e.getBoundingClientRect(); return { left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height } }))
    for (const r of targets) { expect(r.width).toBeGreaterThanOrEqual(43.9); expect(r.height).toBeGreaterThanOrEqual(43.9); expect(r.left).toBeGreaterThanOrEqual(0); expect(r.right).toBeLessThanOrEqual(375) }
    for (let i=0;i<4;i++) for (let j=i+1;j<targets.length;j++) { const a=targets[i],b=targets[j]; if (a===undefined||b===undefined) throw new Error('Missing target'); expect(a.right<=b.left || b.right<=a.left || a.bottom<=b.top || b.bottom<=a.top).toBe(true) }
    // Painted glyph bounds and actual hit routing stay inside each44px target.
    const containment=await page.locator('[data-contour-corner]').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect(),svg=e.querySelector('svg')?.getBoundingClientRect();if(svg===undefined)throw new Error('Missing glyph');const hit=document.elementFromPoint(svg.x+svg.width/2,svg.y+svg.height/2);return {inside:svg.left>=r.left&&svg.right<=r.right&&svg.top>=r.top&&svg.bottom<=r.bottom,hit:hit===e||e.contains(hit)}}))
    expect(containment).toHaveLength(4);for(const result of containment){expect(result.inside).toBe(true);expect(result.hit).toBe(true)}
    await touch.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-transparency',value:'reduce'},{name:'prefers-contrast',value:'more'},{name:'prefers-reduced-motion',value:'reduce'}]})
    expect(await page.evaluate(()=>matchMedia('(prefers-reduced-transparency: reduce)').matches)).toBe(true)
    const glass=await page.locator('[data-hud-tools]').evaluate(e=>({background:getComputedStyle(e).backgroundColor,blur:getComputedStyle(e).backdropFilter}))
    expect(glass.background).toBe('rgb(255, 255, 255)');expect(glass.blur).toBe('none')
    await shot('mobile-glass-fallback.png','PW-F01')
    await touch.send('Emulation.setEmulatedMedia',{features:[]})
    // Actual native pointercancel followed by a new keyboard wear gesture remains usable.
    const wearBox = await page.getByRole('slider',{name:'Sticker wear'}).boundingBox()
    if (wearBox === null) throw new Error('Missing touch wear range')
    const beforePointerCancel = requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: wearBox.x+wearBox.width*.7, y: wearBox.y+wearBox.height/2 }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
    expect(requests.filter(r => r.path.endsWith('/placements') && r.method === 'PUT').length).toBe(beforePointerCancel)
    await page.getByRole('slider',{name:'Sticker wear'}).focus(); const afterCancelSave = response(); await page.keyboard.press('ArrowRight'); await afterCancelSave
    expect((await currentPlacement('PW-F01')).wear).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
    await select('PW-F01')
    const body = await point('PW-F01'), beforeBody = await currentPlacement('PW-F01')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: body.x, y: body.y }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: body.x, y: body.y-9 }] })
    await browserExpect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'peeling')
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: body.x, y: body.y-88 }] })
    await page.screenshot({ path: resolve(evidence, 'mobile-selected-body-carry.png') })
    const moved = response(); await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await moved
    expect((await currentPlacement('PW-F01')).y).toBeLessThan(beforeBody.y)
    expect((await currentPlacement('PW-F01')).wear).toBe(beforeBody.wear)
    await page.waitForTimeout(650)
    await select('PW-C01')
    const returned = response(); await page.getByRole('button', { name: 'Return to pack', exact: true }).click(); await returned
    await browserExpect(page.locator('[data-sticker-stage]')).toHaveAttribute('data-sticker-stage', 'open', { timeout: 10000 })
    const returnedInventory = await read(); expect(returnedInventory.placements.some(p => p.stickerId === 'PW-C01')).toBe(false)
    expect(returnedInventory.appearances?.find(a => a.stickerId === 'PW-C01')?.wear).toBe(1)
    await page.screenshot({ path: resolve(evidence, 'mobile-returned-worn-sheet.png') })
    await page.locator('[data-sticker-slot="PW-C01"]').focus(); await page.keyboard.press('ArrowUp'); await page.keyboard.press('ArrowLeft')
    const restuck = response(); await page.keyboard.press('Enter'); await restuck
    expect((await currentPlacement()).wear).toBe(1)
    await page.getByRole('button', { name: 'Put pack away', exact: true }).click(); await page.waitForTimeout(650)
    await shot('mobile-restuck-worn.png')
    await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
    await page.keyboard.press('Escape'); await select('PW-C01'); await shot('mobile-reduced-motion.png')
    await page.emulateMedia({ reducedMotion: 'no-preference', contrast: 'no-preference' })
    await page.reload(); await rear(); expect((await currentPlacement()).wear).toBe(1)
    await shot('mobile-reloaded-wear.png')
    await touch.detach()
    expect(fingerprintBrowserSources()).toEqual(source)
    expect(consoleErrors.filter(e => /WebGLProgram|SHADER|ReferenceError/.test(e))).toEqual([])
    await writeFile(resolve(evidence, 'native-verification.json'), JSON.stringify({ source, requests, consoleErrors, idle, passed: true }, null, 2))
  } finally {
    fault.release?.()
    const outcomes = []
    for (const dispose of cleanup.reverse()) outcomes.push(await Promise.allSettled([Promise.resolve().then(dispose)]))
    expect(outcomes.flat().filter((outcome) => outcome.status === 'rejected')).toEqual([])
  }
}, 120000)
