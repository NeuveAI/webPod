import type { PreparedDevice, PreparedDeviceData } from './device-preparation-data';
import type { DeviceFormParams } from './form';
import type { HardwareMaterial } from './hardware-geometry';
import { resolveFrontAssemblyDepths } from './front-surface';
import { DEVICE_LAYOUT } from './layout';
import { DEVICE_SURFACE_LAYOUT } from './surface-layout';
import { WHEEL_LABEL_DECAL_NAME } from './probe-raycast';
import type { BufferGeometry } from 'three';

export type DeviceAssemblyMaterialId = 'steel' | 'mask' | 'body' | 'well' | 'gap' | 'wheel' | 'label' | 'select' | 'screen' | 'glass' | 'orientation' | `hardware/${HardwareMaterial}`;
export type DeviceAssemblyGeometryId = 'front' | 'back' | keyof PreparedDeviceData['inserts'] | `hardware/${string}`;
interface AssemblyNodeBase {
  readonly id: string;
  readonly name?: string;
  readonly position?: readonly [number, number, number];
}
export type DeviceAssemblyNode = AssemblyNodeBase & (
  | { readonly kind: 'group'; readonly children: readonly DeviceAssemblyNode[] }
  | { readonly kind: 'mesh'; readonly geometry: DeviceAssemblyGeometryId; readonly material: DeviceAssemblyMaterialId;
      readonly visible?: boolean; readonly renderOrder?: number }
);

/** One authored static scene recipe for Fiber, worker rendering and the query
 * view. Order and local rest frames match Device's original JSX, including the
 * separate Select rest parent: semantic rerenders must not overwrite its child
 * axial travel. No Three objects, DOM, lights or runtime state cross this wire.
 */
export function createDeviceAssemblyRecipe(form: DeviceFormParams, hardware: readonly Pick<PreparedDeviceData['hardware'][number], 'name' | 'material'>[]): readonly DeviceAssemblyNode[] {
  const { wheel, screen } = DEVICE_LAYOUT;
  const { glass, mask } = DEVICE_SURFACE_LAYOUT.front;
  const depth = resolveFrontAssemblyDepths(form);
  return [
    { kind: 'mesh', id: 'rear-input', name: 'device-steel-back-orientation-input', geometry: 'back', material: 'orientation', visible: false },
    { kind: 'mesh', id: 'rear', name: 'device-steel-back', geometry: 'back', material: 'steel' },
    { kind: 'mesh', id: 'mask', name: 'device-display-mask', geometry: 'displayMaskGeometry', material: 'mask', position: [mask.centerX, mask.centerY, depth.screenFrontZ + .1] },
    { kind: 'group', id: 'hardware', name: 'device-hardware', children: hardware.map(part => ({ kind: 'mesh', id: `hardware/${part.name}`, name: part.name, geometry: `hardware/${part.name}`, material: `hardware/${part.material}` })) },
    { kind: 'mesh', id: 'front-input', name: 'device-body-orientation-input', geometry: 'front', material: 'orientation', visible: false },
    { kind: 'mesh', id: 'front', name: 'device-body', geometry: 'front', material: 'body' },
    { kind: 'mesh', id: 'well', name: 'device-display-well', geometry: 'displayWellGeometry', material: 'well', position: [glass.centerX, glass.centerY, depth.displayReferenceZ] },
    { kind: 'group', id: 'gap-floor', name: 'device-wheel-gap-floor', children: [
      { kind: 'mesh', id: 'select-seam', name: 'device-select-seam-floor', geometry: 'selectSeamGeometry', material: 'gap', position: [wheel.centerX, wheel.centerY, depth.wheelGapFloorBaseZ] },
      { kind: 'mesh', id: 'outer-seam', name: 'device-outer-seam-floor', geometry: 'outerSeamGeometry', material: 'gap', position: [wheel.centerX, wheel.centerY, depth.wheelGapFloorBaseZ] },
    ] },
    { kind: 'group', id: 'wheel-assembly', name: 'device-wheel-assembly', position: [wheel.centerX, wheel.centerY, depth.wheelTopAtCenterZ], children: [
      { kind: 'mesh', id: 'wheel', name: 'device-wheel', geometry: 'ringGeometry', material: 'wheel', position: [0, 0, depth.wheelSurfaceBaseZ - depth.wheelTopAtCenterZ] },
      { kind: 'mesh', id: 'label', name: WHEEL_LABEL_DECAL_NAME, geometry: 'ringGeometry', material: 'label', position: [0, 0, depth.wheelSurfaceBaseZ - depth.wheelTopAtCenterZ + .08], renderOrder: 2 },
    ] },
    { kind: 'group', id: 'select-rest', name: 'device-select-rest-frame', position: [wheel.centerX, wheel.centerY, depth.wheelSurfaceBaseZ], children: [
      { kind: 'mesh', id: 'select', name: 'device-select', geometry: 'selectGeometry', material: 'select' },
    ] },
    { kind: 'mesh', id: 'screen', geometry: 'screenGeometry', material: 'screen', position: [screen.centerX, screen.centerY, depth.screenFrontZ] },
    { kind: 'mesh', id: 'glass', geometry: 'glassGeometry', material: 'glass', position: [glass.centerX, glass.centerY, depth.glassFrontZ] },
  ];
}

/** Geometry wrappers borrow the one preparation lease. Neither graph owns
 * disposal; rebuilding materials or moving the model must not detach buffers. */
export function deviceAssemblyGeometries(prepared: PreparedDevice): ReadonlyMap<DeviceAssemblyGeometryId, BufferGeometry> {
  const values = new Map<DeviceAssemblyGeometryId, BufferGeometry>([['front', prepared.front], ['back', prepared.back]]);
  for (const key of Object.keys(prepared.inserts) as (keyof PreparedDevice['inserts'])[]) values.set(key, prepared.inserts[key]);
  for (const part of prepared.hardware) values.set(`hardware/${part.name}`, part.geometry);
  return values;
}
