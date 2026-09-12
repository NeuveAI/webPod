import { AmbientLight, Color, DataTexture, DirectionalLight, DoubleSide, Mesh, NoColorSpace, PerspectiveCamera, PlaneGeometry, RectAreaLight, RGBAFormat, Scene, SRGBColorSpace } from 'three';
import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial, RectAreaLightNode, WebGPURenderer } from 'three/webgpu';
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js';
import { createPolycarbonateNodeMaterial, createCoverGlassNodeMaterial } from '../physical-material-nodes';
import { createGpuPaperGeometry } from '../sticker-paper-gpu';
import { installPaperNodes } from '../sticker-paper-nodes';
import { applyStickerWearNodes, installStickerSeatNodes, StickerPhysicalNodeMaterial } from '../sticker-wear-nodes';
import { createLcdNodeMaterial } from '../../../composite/src/lcd-material-nodes';
import { createRenderBackendOwner, createBackendStudioMaps } from '../render-backend-services';

/** Execute only through the lead's existing Chrome MCP page. No app state/DOM
 * mutation: isolated OffscreenCanvas, bounded backend lifetime, owned disposal.
 */
export async function runMaterialCompileProbe(phase = 'init') {
  const started = globalThis.performance.now(), stages = [];
  const mark = name => stages.push({ name, elapsedMs: globalThis.performance.now() - started });
  const canvas = new globalThis.OffscreenCanvas(64, 64);
  const renderer = new WebGPURenderer({ canvas, antialias: true });
  const owner = createRenderBackendOwner({ kind: 'webgpu', renderer });
  const abort = new globalThis.AbortController();
  const deadline = globalThis.setTimeout(() => abort.abort(new Error('Whole material probe timed out')), 60000);
  const geometries = [], materials = [], textures = [], controllers = [], variants = [];
  let maps;
  try {
    mark('initialization-start');
    await owner.initialize(abort.signal, 10000);
    mark('initialization-ready');
    if (phase === 'init') return { ok: true, phase, stages, coreFeatures: renderer.hasFeature('core-features-and-limits') };
    RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init());
    const scene = new Scene(), camera = new PerspectiveCamera(40, 1, .1, 20);
    camera.position.z = 4;
    const key = new RectAreaLight(0xffffff, 3, 2, 3), second = new RectAreaLight(0xffffff, 2, 2, 1);
    key.position.set(1, 2, 3); key.lookAt(0, 0, 0); second.position.set(-2, 1, 2); second.lookAt(0, 0, 0);
    const directional = new DirectionalLight(0xffffff, 1); directional.position.set(2, 1, 3);
    scene.add(key, second, directional, new AmbientLight(0xffffff, .2));
    const geometry = new PlaneGeometry(1, 1); geometries.push(geometry);
    const map = new DataTexture(new Uint8Array([200, 100, 50, 255, 20, 100, 200, 0, 255, 255, 255, 255, 0, 0, 0, 255]), 2, 2, RGBAFormat);
    map.colorSpace = SRGBColorSpace; map.needsUpdate = true; textures.push(map);
    async function check(name, material, shape = geometry) {
      materials.push(material); const mesh = new Mesh(shape, material); mesh.frustumCulled = false; scene.add(mesh);
      try { mark(`${name}:compile-start`); await owner.compile(scene, camera, scene, abort.signal, 10000); mark(`${name}:compile-ready`); renderer.render(scene, camera); mark(`${name}:render-submitted`); variants.push({ name, compiled: true }); }
      finally { scene.remove(mesh); }
    }
    await check('polycarbonate-subsurface-directional-and-rectangle', createPolycarbonateNodeMaterial({ color: '#c6c6c6', roughness: .3, clearcoat: .2, subsurfaceColor: '#ffffff', subsurfaceDistortion: .2, subsurfaceAttenuation: .8, subsurfacePower: 2, subsurfaceScale: .5 }, null));
    if (phase === 'one') return { ok: true, phase, stages, variants };
    await check('glass-authored-rectangle-cards', createCoverGlassNodeMaterial({ color: '#ffffff', roughness: .1, clearcoat: 1, transmission: .3, thickness: .1, ior: 1.5 }, null, { key, aligned: [key, second] }));
    for (const backing of [false, true]) {
      const material = new StickerPhysicalNodeMaterial({ map, transparent: true, clearcoat: .5, roughness: .4 });
      const wear = applyStickerWearNodes(material, 'material-probe', backing); wear.set(.8); controllers.push(wear);
      await check(`wear-${backing ? 'backing' : 'front'}`, material);
    }
    for (const appearance of ['locked', 'placed']) {
      const material = new StickerPhysicalNodeMaterial({ map, transparent: true, clearcoat: .5, roughness: .4 });
      installStickerSeatNodes(material, appearance, map); await check(`seat-${appearance}`, material);
    }
    for (const liner of [false, true]) {
      const input = { width: 1, height: 1.2, pixel: .005, liner }, paper = createGpuPaperGeometry(input);
      geometries.push(paper.front, paper.back, paper.edge);
      for (const part of ['front', 'back', 'edge']) {
        const material = part === 'edge' ? new MeshBasicNodeMaterial({ color: new Color('#ddd') }) : new MeshPhysicalNodeMaterial({ map, side: DoubleSide, bumpMap: map, bumpScale: .01, clearcoat: .3 });
        installPaperNodes(material, input, part === 'edge').setCurl(.65);
        await check(`paper-${liner ? 'liner' : 'sticker'}-${part}-96-grid`, material, paper[part]);
      }
    }
    const raw = map.clone(); raw.colorSpace = NoColorSpace; raw.needsUpdate = true; textures.push(raw);
    await check('lcd-native-unorm-single-EOTF', createLcdNodeMaterial(raw, 'unorm-srgb'));
    await check('lcd-tagged-sRGB-single-EOTF', createLcdNodeMaterial(map, 'srgb-tagged'));
    maps = createBackendStudioMaps({ kind: 'webgpu', renderer }, .04);
    await check('authored-studio-PMREM', createPolycarbonateNodeMaterial({ color: '#c6c6c6', roughness: .14, metalness: 1 }, maps.texture));
    return { ok: true, phase, stages, variants, canvas: { width: canvas.width, height: canvas.height }, backend: 'WebGPURenderer', version: 'three 0.185.1', limitation: 'Compilation/render submission only; no screenshot or numerical parity assertion.' };
  } catch (error) { return { ok: false, phase, stages, variants, error: String(error), stack: error instanceof Error ? error.stack : null }; }
  finally { globalThis.clearTimeout(deadline); abort.abort(); maps?.dispose(); for (const controller of controllers) controller.dispose(); for (const material of materials) material.dispose(); for (const geometry of geometries) geometry.dispose(); for (const texture of textures) texture.dispose(); owner.dispose(); }
}
