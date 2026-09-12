import { StorageBufferAttribute, WebGPURenderer } from 'three/webgpu';
import { Fn, instanceIndex, storage, vec2, vec3, vec4 } from 'three/tsl';
import { createPaperNodes } from '../sticker-paper-nodes';
import { createStickerPaperGeometry } from '../sticker-paper';
import { createRenderBackendOwner } from '../render-backend-services';

/** Actual WGSL compute/readback compared against the existing full CPU factory.
 * Invoked only by lead on existing Chrome; no app scene/state mutation. */
export async function runPaperNodeMathProbe() {
  const renderer = new WebGPURenderer({ canvas: new globalThis.OffscreenCanvas(4, 4) });
  const owner = createRenderBackendOwner({ kind: 'webgpu', renderer });
  const abort = new globalThis.AbortController();
  const deadline = globalThis.setTimeout(() => { abort.abort(new Error('Paper math deadline')); owner.dispose(); }, 30000);
  const results = [];
  try {
    await owner.initialize(abort.signal);
    for (const liner of [false, true]) {
      const input = { width: 1.1, height: 1.4, pixel: .006, liner };
      const nodes = createPaperNodes(input), count = 97 * 97;
      const positions = new StorageBufferAttribute(count * 2, 4), normals = new StorageBufferAttribute(count, 4);
      const output = storage(positions, 'vec4', count * 2), normalOutput = storage(normals, 'vec4', count);
      const compute = Fn(() => {
        const grid = vec2(instanceIndex.mod(97), instanceIndex.div(97));
        output.element(instanceIndex).assign(vec4(nodes.point(vec3(grid, 0)), 1));
        output.element(instanceIndex.add(count)).assign(vec4(nodes.point(vec3(grid, 1)), 1));
        normalOutput.element(instanceIndex).assign(vec4(nodes.normal(grid), 0));
      })().compute(count);
      for (const curl of [0, .0001, .65, 1]) {
        abort.signal.throwIfAborted(); nodes.curl.value = curl;
        await renderer.computeAsync(compute);
        const gpu = new Float32Array(await renderer.getArrayBufferAsync(positions));
        const gpuNormal = new Float32Array(await renderer.getArrayBufferAsync(normals));
        const reference = createStickerPaperGeometry(input.width, input.height, input.pixel, liner, curl);
        try {
          let maxPositionError = 0, maxNormalError = 0;
          for (let i = 0; i < count; i++) for (let axis = 0; axis < 3; axis++) {
            const front = reference.front.getAttribute('position').array[i * 3 + axis], back = reference.back.getAttribute('position').array[i * 3 + axis], normal = reference.front.getAttribute('normal').array[i * 3 + axis];
            maxPositionError = Math.max(maxPositionError, Math.abs(gpu[i * 4 + axis] - front), Math.abs(gpu[(i + count) * 4 + axis] - back));
            maxNormalError = Math.max(maxNormalError, Math.abs(gpuNormal[i * 4 + axis] - normal));
          }
          results.push({ liner, curl, vertices: count * 2, maxPositionError, maxNormalError });
        } finally { reference.front.dispose(); reference.back.dispose(); reference.edge.dispose(); }
      }
      compute.dispose();
    }
    return { ok: results.every(row => row.maxPositionError < .00005 && row.maxNormalError < .0005), results, limits: { worldPosition: .00005, localNormal: .0005 }, provenance: 'Actual WGSL compute readback versus existing Three full96-grid CPU geometry, not visual parity' };
  } catch (error) { return { ok: false, results, error: String(error), stack: error instanceof Error ? error.stack : null }; }
  finally { globalThis.clearTimeout(deadline); owner.dispose(); }
}
