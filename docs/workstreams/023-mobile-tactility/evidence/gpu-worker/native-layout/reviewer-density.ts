import { strict as assert } from 'node:assert';
import { observeNativeCanvasMeasurement, type NativeCanvasMeasurement } from '../../../../../../packages/composite/src/native-canvas-measurement';
import { writeFileSync } from 'node:fs';
import { GlobalRegistrator } from '../../../../../../packages/composite/node_modules/@happy-dom/global-registrator/lib/index.js';
GlobalRegistrator.register();
const canvas = document.createElement('canvas');
const Rect = DOMRect;

class Events {
  listeners = new Map<string, Set<() => void>>();
  addEventListener(type: string, listener: () => void) { const set = this.listeners.get(type) ?? new Set(); set.add(listener); this.listeners.set(type, set); }
  removeEventListener(type: string, listener: () => void) { this.listeners.get(type)?.delete(listener); }
  emit(type: string) { for (const listener of [...this.listeners.get(type) ?? []]) listener(); }
  get count() { return [...this.listeners.values()].reduce((sum, set) => sum + set.size, 0); }
}
const frames = new Map<number, FrameRequestCallback>(); let nextFrame = 0;
const viewport = new Events(), doc = Object.assign(new Events(), { hidden: false });
const media: Events[] = [];
const win = Object.assign(new Events(), {devicePixelRatio: 1, visualViewport: viewport,
  requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++nextFrame, callback); return nextFrame; },
  cancelAnimationFrame(id: number) { frames.delete(id); },
  matchMedia() { const value = new Events(); media.push(value); return value; }});
class Observer {
  static all: Observer[] = [];
  target: Element | null = null;
  disconnected = false;
  constructor(readonly callback: (entries: ResizeObserverEntry[]) => void) { Observer.all.push(this); }
  observe(target: Element) { this.target = target; }
  disconnect() { this.disconnected = true; }
  emit(width: number, height: number, density = win.devicePixelRatio) {
    assert(this.target);
    this.callback([{target: this.target, contentRect: {width, height, x: 0, y: 0, top: 0, left: 0, bottom: height, right: width, toJSON() { return {}; }},
      devicePixelContentBoxSize: [{inlineSize: width * density, blockSize: height * density}], borderBoxSize: [], contentBoxSize: []}]);
  }
}
Object.defineProperties(globalThis, {window: {value: win, configurable: true}, document: {value: doc, configurable: true}, ResizeObserver: {value: Observer, configurable: true}});
let width = 440, height = 888, reads = 0;
canvas.getBoundingClientRect = () => { reads++; return new Rect(0, 0, width, height); };
const flush = () => { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(100); };
const values: NativeCanvasMeasurement[] = [];
const stop = observeNativeCanvasMeasurement(canvas, undefined, value => values.push(value));
assert.equal(values.length, 1); assert.equal(values[0]?.rasterWidth, 320);
const observer = Observer.all.at(-1); assert(observer);
for (let index = 0; index < 12; index++) observer.emit(width, height);
assert.equal(frames.size, 1); flush(); assert.equal(values.length, 1); assert.equal(reads, 1);
width = 390; height = 844; observer.emit(width, height); observer.emit(width, height); flush();
assert.equal(values.at(-1)?.cssWidth, 390); assert.equal(values.length, 2);
win.devicePixelRatio = 3; media.at(-1)?.emit('change'); viewport.emit('resize'); win.emit('resize');
assert.equal(frames.size, 1); flush(); assert.equal(values.length, 3);
assert.equal(values.at(-1)?.backingWidth, 1170); assert.equal(values.at(-1)?.rasterWidth, 960); assert.equal(values.at(-1)?.rasterHeight, 720);
win.devicePixelRatio = 1; media.at(-1)?.emit('change'); flush();
observer.emit(width, height, 1.5); flush(); assert.equal(values.at(-1)?.pixelRatio, 1.5); assert.equal(values.at(-1)?.backingWidth, 585);
const beforeDuplicate=values.at(-1);win.emit('resize');flush();const afterDuplicate=values.at(-1);
observer.emit(width,height,1.75);win.emit('resize');flush();const coalescedPhysical=values.at(-1);
stop();
writeFileSync(new URL('./reviewer-density.json',import.meta.url),JSON.stringify({method:'Actual measurement owner and controlled browser observations from existing retained lifecycle fixture; same CSS dimensions/native DPR, duplicate resize after physical-box observation.',beforeDuplicate,afterDuplicate,changed:beforeDuplicate?.pixelRatio!==afterDuplicate?.pixelRatio,coalescedPhysical,coalescedCorrect:coalescedPhysical?.pixelRatio===1.75},null,2)+'\n');
console.log({beforeDuplicate,afterDuplicate,coalescedPhysical,coalescedCorrect:coalescedPhysical?.pixelRatio===1.75});
