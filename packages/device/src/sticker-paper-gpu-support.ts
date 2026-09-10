import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { WebGLRenderer } from 'three';
import { PAPER_GPU_GLSL, gpuPaperSupported } from './sticker-paper-gpu';

/** Driver capability gate, shared by all paper surfaces on one renderer. */
function createSupport(renderer: WebGLRenderer) {
  let ready = false, owners = 0, generation = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let releaseProgram = () => {};
  const listeners = new Set<() => void>();
  const publish = (next: boolean) => { if (ready === next) return; ready = next; for (const listener of listeners) listener(); };
  const stop = () => { generation++; clearTimeout(timer); timer = undefined; releaseProgram(); releaseProgram = () => {}; };
  const prepare = () => {
    stop(); publish(false);
    if (!gpuPaperSupported(renderer)) return;
    const gl = renderer.getContext(), expected = generation;
    const vertex = gl.createShader(gl.VERTEX_SHADER), fragment = gl.createShader(gl.FRAGMENT_SHADER), program = gl.createProgram();
    releaseProgram = () => { if (program) gl.deleteProgram(program); if (vertex) gl.deleteShader(vertex); if (fragment) gl.deleteShader(fragment); };
    if (!vertex || !fragment || !program) { stop(); return; }
    gl.shaderSource(vertex,`#version 300 es\nprecision highp float; in vec3 paperVertex; ${PAPER_GPU_GLSL}\nvoid main(){gl_Position=vec4(paperPoint(paperVertex)+paperNormal(paperVertex.xy)*0.001,1.);}`);
    gl.shaderSource(fragment,'#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1.);}');
    gl.compileShader(vertex); gl.compileShader(fragment); gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    const extension: { COMPLETION_STATUS_KHR: number } | null = gl.getExtension('KHR_parallel_shader_compile');
    const deadline = performance.now() + 5000;
    const poll = () => {
      if (expected !== generation || owners === 0) return;
      if (gl.isContextLost() || performance.now() > deadline) { stop(); return; }
      if (extension && !gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR)) { timer = setTimeout(poll, 10); return; }
      const valid = gl.getProgramParameter(program, gl.LINK_STATUS) === true;
      stop(); publish(valid);
    };
    // Keep synchronous driver status queries off mounting/interaction callbacks.
    timer = setTimeout(poll, 0);
  };
  const lost = () => { stop(); publish(false); };
  return {
    getSnapshot: () => ready,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    acquire() {
      if (owners++ === 0) { renderer.domElement.addEventListener('webglcontextlost', lost); renderer.domElement.addEventListener('webglcontextrestored', prepare); prepare(); }
      return () => { if (--owners === 0) { stop(); publish(false); renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', prepare); } };
    },
  };
}
const supportByRenderer = new WeakMap<WebGLRenderer, ReturnType<typeof createSupport>>();
export function useGpuPaperReady(renderer: WebGLRenderer): boolean {
  const support = useMemo(() => {
    let value = supportByRenderer.get(renderer); if (!value) { value = createSupport(renderer); supportByRenderer.set(renderer, value); } return value;
  }, [renderer]);
  const ready = useSyncExternalStore(support.subscribe, support.getSnapshot, () => false);
  useEffect(() => support.acquire(), [support]);
  return ready;
}

/** Validate the actual stock-material programs, not only the deformation GLSL.
 * Kept behind the CPU visual until every linked program is usable. */
interface PaperPreparationRenderer {
  compile(root: import('three').Object3D, camera: import('three').Camera, scene: import('three').Scene): unknown;
  properties: { get(material: import('three').Material): unknown };
  getContext(): { isContextLost(): boolean; getExtension(name: 'KHR_parallel_shader_compile'): { COMPLETION_STATUS_KHR: number } | null; getProgramParameter(program: WebGLProgram, parameter: number): unknown; readonly LINK_STATUS: number };
}
export function createGpuPaperMaterialPreparation(renderer: PaperPreparationRenderer, build: () => { root: import('three').Object3D; materials: readonly import('three').Material[] }, camera: import('three').Camera, scene: import('three').Scene) {
  let ready = false;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => ready,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    mount() {
      let disposed = false, timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (value: boolean) => { if (disposed || ready === value) return; ready = value; for (const listener of listeners) listener(); };
      try {
        const { root, materials } = build(), gl = renderer.getContext();
        renderer.compile(root, camera, scene); root.clear();
        const handles = materials.map(material => {
          const properties: unknown = renderer.properties.get(material);
          if (!properties || typeof properties !== 'object' || !('currentProgram' in properties)) throw Error('Missing material program');
          const value = properties.currentProgram;
          if (!value || typeof value !== 'object' || !('program' in value) || !(value.program instanceof WebGLProgram)) throw Error('Unsupported material program');
          return value.program;
        });
        const extension: { COMPLETION_STATUS_KHR: number } | null = gl.getExtension('KHR_parallel_shader_compile');
        const deadline = performance.now() + 5000;
        const poll = () => {
          if (disposed || gl.isContextLost() || performance.now() > deadline) return;
          if (extension && handles.some(program => !gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR))) { timer = setTimeout(poll, 10); return; }
          finish(handles.every(program => gl.getProgramParameter(program, gl.LINK_STATUS) === true));
        };
        timer = setTimeout(poll, 0);
      } catch { finish(false); }
      return () => { disposed = true; clearTimeout(timer); ready = false; };
    },
  };
}
