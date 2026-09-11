/// <reference types="@webgpu/types" />

import { LinearFilter, NoColorSpace, RGBAFormat, UnsignedByteType } from 'three';
import { StorageTexture, WebGPUBackend, type WebGPURenderer } from 'three/webgpu';

/** Chrome 152 CanvasDrawElement IDL. These experimental additions are absent
 * from lib.dom and @webgpu/types; standard GPU objects keep their canonical
 * types. An image belongs to the canvas that captured it, including after that
 * canvas transfers to its worker. A detached staging canvas is not equivalent.
 */
export interface NativeElementImage {
  readonly width: number;
  readonly height: number;
  close(): void;
}
export interface NativePaintCanvas extends HTMLCanvasElement {
  requestPaint(): void;
  captureElementImage(element: Element): NativeElementImage;
}
export function supportsNativePaintCanvas(canvas: HTMLCanvasElement): canvas is NativePaintCanvas {
  return typeof Reflect.get(canvas, 'requestPaint') === 'function' &&
    typeof Reflect.get(canvas, 'captureElementImage') === 'function' &&
    typeof canvas.transferControlToOffscreen === 'function';
}

/** ElementImage is [Transferable] in Chrome's IDL but missing from TypeScript's
 * Transferable union. Keep this single checked native boundary rather than
 * claiming the snapshot is an ImageBitmap or serializing it into pixel bytes.
 * Successful post transfers ownership; on synchronous failure caller still
 * owns every item and must close/dispose it.
 */
export function postNativeTransfer(port: Worker | MessagePort, message: unknown,
  transfer: readonly (Transferable | NativeElementImage)[]): void {
  const post: unknown = Reflect.get(port, 'postMessage');
  if (typeof post !== 'function') throw new Error('Native transfer port is unavailable');
  post.call(port, message, [...transfer]);
}

interface NativeElementQueue extends GPUQueue {
  copyElementImageToTexture(source: { source: NativeElementImage }, destination: {
    destination: GPUImageCopyTextureTagged; width: number; height: number;
  }): void;
}
function supportsNativeElementQueue(queue: GPUQueue): queue is NativeElementQueue {
  return typeof Reflect.get(queue, 'copyElementImageToTexture') === 'function';
}

/** Three185 owns allocation, bindings and disposal. Its Backend DataMap#get
 * and WebGPUBackend.device are real installed methods/properties omitted by
 * the pinned @types/three declaration. Validate them instead of replacing the
 * texture allocation or asserting a WebGL renderer interface.
 */
function getNativeTexture(renderer: WebGPURenderer, texture: StorageTexture): GPUTexture {
  const backend = renderer.backend;
  if (!(backend instanceof WebGPUBackend)) throw new Error('Native screen requires the WebGPU backend');
  const get: unknown = Reflect.get(backend, 'get');
  if (typeof get !== 'function') throw new Error('Installed backend texture lookup is unavailable');
  const record: unknown = get.call(backend, texture);
  const value: unknown = typeof record === 'object' && record !== null ? Reflect.get(record, 'texture') : null;
  if (!(value instanceof GPUTexture)) throw new Error('Native screen allocation is unavailable');
  return value;
}

/** One raster-generation allocation. Raw rgba8unorm stores the captured sRGB
 * values; the authored LCD node material performs its one explicit EOTF. Paint
 * updates copy directly into the existing allocation without needsUpdate,
 * readback, mipmaps, or a per-paint texture/material replacement.
 */
export function createNativeScreenTexture(renderer: WebGPURenderer, width: number, height: number) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error('Native screen raster dimensions must be positive integers');
  }
  const backend = renderer.backend;
  const device: unknown = Reflect.get(backend, 'device');
  if (!(backend instanceof WebGPUBackend) || !(device instanceof GPUDevice) || !supportsNativeElementQueue(device.queue)) {
    throw new Error('Native element WebGPU upload is unavailable');
  }
  const queue = device.queue;
  const texture = new StorageTexture(width, height);
  texture.name = 'webpod-native-screen';
  texture.format = RGBAFormat; texture.type = UnsignedByteType; texture.colorSpace = NoColorSpace;
  texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; texture.generateMipmaps = false;
  texture.flipY = false; texture.premultiplyAlpha = false;
  // Installed WebGPU HTMLTexture performs a GPU Y-flip after native upload.
  // Apply the identical UV reflection in its authored sampler instead of an
  // extra full-texture copy. Native captures have a top-left origin.
  texture.repeat.y = -1; texture.offset.y = 1;
  let disposed = false;
  let target: GPUTexture;
  try {
    renderer.initTexture(texture);
    target = getNativeTexture(renderer, texture);
    if (target.width !== width || target.height !== height || target.format !== 'rgba8unorm') {
      throw new Error('Native screen allocation differs from its raster contract');
    }
  } catch (error) { texture.dispose(); throw error; }
  return {
    texture,
    upload(image: NativeElementImage): void {
      try {
        if (disposed) throw new Error('Native screen raster generation has retired');
        if (!(image.width > 0 && image.height > 0)) throw new Error('Native paint is empty');
        queue.copyElementImageToTexture({ source: image }, {
          destination: { texture: target, colorSpace: 'srgb', premultipliedAlpha: false }, width, height,
        });
      } finally { image.close(); }
    },
    dispose() { if (disposed) return; disposed = true; texture.dispose(); },
  };
}
