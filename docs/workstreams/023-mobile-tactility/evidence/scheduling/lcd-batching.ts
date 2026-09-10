// Bounded lifecycle experiment with the production source and pinned Three; no GPU timing claim.
import { GlobalRegistrator } from '../../../../../packages/composite/node_modules/@happy-dom/global-registrator'
import { Matrix4, PerspectiveCamera, Scene } from '../../../../../packages/composite/node_modules/three'
import { HtmlInCanvasPixelSource } from '../../../../../packages/composite/src/html-in-canvas'
import { strict as assert } from 'node:assert'
GlobalRegistrator.register()
let next = 0
const frames = new Map<number, FrameRequestCallback>()
Reflect.set(globalThis, 'requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++next, callback); return next })
Reflect.set(globalThis, 'cancelAnimationFrame', (id: number) => frames.delete(id))
const resize: (() => void)[] = [], mutate: ((records: { target: Node; attributeName: string | null }[]) => void)[] = []
class Resize { constructor(callback: () => void) { resize.push(callback) } observe() {} disconnect() {} }
class Mutation { constructor(callback: (records: { target: Node; attributeName: string | null }[]) => void) { mutate.push(callback) } observe() {} disconnect() {} }
Reflect.set(globalThis, 'ResizeObserver', Resize); Reflect.set(globalThis, 'MutationObserver', Mutation)
const canvas = document.createElement('canvas'), panel = document.createElement('div'), content = document.createElement('div')
panel.append(content); document.body.append(canvas)
let reads = 0, paints = 0, invalidations = 0, width = 272
Object.defineProperties(content, { scrollWidth: { get: () => { reads++; return width } }, scrollHeight: { get: () => { reads++; return 204 } } })
Reflect.set(canvas, 'requestPaint', () => { paints++ })
const transform = { worldMatrix: new Matrix4(), viewport: { corners: { topLeft: { x: 0, y: 0 }, topRight: { x: 272, y: 0 }, bottomLeft: { x: 0, y: 204 }, bottomRight: { x: 272, y: 204 } } } }
const screen = { size: { width: 1, height: 1 }, panel: { width: 272, height: 204, scale: .85 }, readTransform: () => transform, onTransformChange: () => () => {}, invalidate: () => { invalidations++ }, setMaterial: () => {} }
const source = new HtmlInCanvasPixelSource('dark')
Reflect.apply(source.attach, source, [{ kind: 'webgl', renderer: { domElement: canvas, getPixelRatio: () => 1 }, camera: new PerspectiveCamera(), scene: new Scene(), panelElement: panel, screen }])
assert.equal(reads, 2, 'first attach measures synchronously')
const flush = () => { const batch = [...frames.values()]; frames.clear(); for (const callback of batch) callback(0) }
resize[0]?.(); resize[0]?.(); mutate[0]?.([{ target: content, attributeName: 'class' }])
assert.equal(frames.size, 1, 'observer burst shares one frame')
const before = { reads, paints }; flush()
assert.equal(reads - before.reads, 2); assert.equal(paints - before.paints, 1)
const beforePaint = { reads, invalidations }
canvas.dispatchEvent(new Event('paint'))
assert.equal(reads, beforePaint.reads, 'received paint does not remeasure')
assert.equal(invalidations, beforePaint.invalidations + 1, 'received paint invalidates immediately')
width = 340; resize[0]?.(); flush()
assert.equal(canvas.dataset.wpRasterPixelWidth, '400', 'resize updates raster size')
resize[0]?.(); Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'))
assert.equal(frames.size, 0, 'hidden cancels scheduled frame')
Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange'))
assert.equal(frames.size, 1, 'foreground schedules dirty content once')
source.detach(); assert.equal(frames.size, 0, 'detach cancels pending frame')
console.log(JSON.stringify({ firstAttachSynchronous: true, observerBurstFrames: 1, observerBurstMeasurementReads: 2, observerBurstPaintRequests: 1, receivedPaintMeasurementReads: 0, receivedPaintInvalidationImmediate: true, resizedRasterWidth: 400, hiddenAndDisposeCancel: true }))
await GlobalRegistrator.unregister()
