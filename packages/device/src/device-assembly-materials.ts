import { Color, MeshBasicMaterial, MeshPhysicalMaterial, type Material, type Texture } from 'three';
import { MeshBasicNodeMaterial, MeshPhysicalNodeMaterial } from 'three/webgpu';
import { createPolycarbonateMaterial, createCoverGlassMaterial } from './physical-materials';
import { createPolycarbonateNodeMaterial, createCoverGlassNodeMaterial, type GlassCardLights } from './physical-material-nodes';
import { BACKPLATE_FINISH } from './backplate-finish';
import { DEFAULT_DEVICE_MATERIALS, type DeviceMaterials, type PhysicalSurfaceParams } from './materials';
import type { PreparedDevice } from './device-preparation-data';
import type { DeviceAssemblyMaterialId } from './device-assembly-recipe';

export interface DeviceAssemblyMaps {
  readonly prepared: PreparedDevice['textures'];
  readonly rearEnvironment: Texture | null;
  readonly studio: Texture | null;
  readonly screenStudio: Texture | null;
  readonly studioIntensity: number;
  readonly label: Texture | null;
  readonly backplate: { readonly roughnessMap: Texture; readonly bumpMap: Texture } | null;
}
export type DeviceAssemblyBackend = { readonly kind: 'webgl' } | { readonly kind: 'webgpu'; readonly cards: GlassCardLights };

/** All material ownership is explicit: returned materials own no source maps.
 * The same table and sampler inputs feed both stock GL and authored node ports.
 * The LCD material is borrowed so enclosure changes cannot reset its live paint.
 */
export function createDeviceAssemblyMaterials(input: {
  readonly backend: DeviceAssemblyBackend; readonly isBlack: boolean;
  readonly params: DeviceMaterials; readonly maps: DeviceAssemblyMaps; readonly screen: Material;
}) {
  const { backend, isBlack, params, maps } = input;
  const basic = (properties: ConstructorParameters<typeof MeshBasicMaterial>[0]) => backend.kind === 'webgl'
    ? new MeshBasicMaterial(properties) : new MeshBasicNodeMaterial(properties);
  const physical = (properties: ConstructorParameters<typeof MeshPhysicalMaterial>[0]) => backend.kind === 'webgl'
    ? new MeshPhysicalMaterial(properties) : new MeshPhysicalNodeMaterial(properties);
  const spread = (p: PhysicalSurfaceParams) => { const { albedoScale = 1, color, ...rest } = p; return { ...rest, color: new Color(color).multiplyScalar(albedoScale) }; };
  const studioParams = (p: PhysicalSurfaceParams) => ({ ...p, envMapIntensity: p.envMapIntensity ?? maps.studioIntensity });
  const polycarbonate = (p: PhysicalSurfaceParams) => backend.kind === 'webgl'
    ? createPolycarbonateMaterial(studioParams(p), maps.studio)
    : createPolycarbonateNodeMaterial(studioParams(p), maps.studio);
  const body = polycarbonate(isBlack ? params.bodyBlack : params.bodyWhite);
  body.roughnessMap = maps.prepared.aluminumRoughness; body.map = maps.prepared.aluminumColor; body.bumpMap = maps.prepared.aluminumHeight;
  body.name = isBlack ? 'body-black' : 'body-white';
  const wheel = polycarbonate(isBlack ? params.wheelRingBlack : params.wheelRingWhite);
  wheel.name = isBlack ? 'wheel-black' : 'wheel-white';
  const glass = backend.kind === 'webgl'
    ? createCoverGlassMaterial(studioParams(params.coverGlass), maps.screenStudio)
    : createCoverGlassNodeMaterial(studioParams(params.coverGlass), maps.screenStudio, backend.cards);
  const steel = physical({ ...spread(params.steelBack), envMap: maps.rearEnvironment,
    roughnessMap: maps.prepared.noise, anisotropyMap: maps.prepared.steel,
    ...(maps.backplate === null ? {} : { roughness: Math.min(1, BACKPLATE_FINISH.etchedRoughness * params.steelBack.roughness / DEFAULT_DEVICE_MATERIALS.steelBack.roughness),
      roughnessMap: maps.backplate.roughnessMap, bumpMap: maps.backplate.bumpMap, bumpScale: BACKPLATE_FINISH.bumpDepth }) });
  steel.name = 'steel-back';
  const gapParams = isBlack ? params.wheelWellBlack : params.wheelWellWhite;
  const gap = physical({ ...spread(gapParams), envMap: maps.studio, envMapIntensity: gapParams.envMapIntensity ?? maps.studioIntensity });
  gap.name = isBlack ? 'wheel-gap-black' : 'wheel-gap-white';
  const selectParams = isBlack ? params.selectBlack : params.selectWhite;
  const select = physical({ ...spread(selectParams), roughnessMap: maps.prepared.aluminumRoughness, map: maps.prepared.aluminumColor, bumpMap: maps.prepared.aluminumHeight,
    envMap: maps.studio, envMapIntensity: selectParams.envMapIntensity ?? maps.studioIntensity });
  select.name = isBlack ? 'select-black' : 'select-white';
  const mask = basic({ ...params.screenReveal }); mask.name = 'display-reveal';
  const well = basic({ ...params.screenReveal }); well.name = 'display-reveal-wall';
  const hardware = (color: string, metalness: number, roughness: number) => physical({ color, metalness, roughness, envMap: maps.studio, envMapIntensity: .3 });
  const materials: Record<DeviceAssemblyMaterialId, Material> = {
    body, wheel, glass, steel, gap, select, mask, well, screen: input.screen,
    orientation: basic({}),
    label: basic({ map: maps.label, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1 }),
    'hardware/metal': hardware('#A8AFB4', .92, .28),
    'hardware/slider': hardware(isBlack ? '#242629' : '#D9D9D2', 0, .48),
    'hardware/insulator': hardware('#24272A', 0, .66),
    'hardware/cavity': basic({ color: '#030405', toneMapped: false }),
    'hardware/orange': hardware('#F67927', 0, .62),
    'hardware/contact': hardware('#AB9259', .75, .35),
  };
  return { materials, dispose() { for (const material of new Set(Object.values(materials))) if (material !== input.screen) material.dispose(); } };
}
