import { type Ref } from 'react';
import { type ThreeEvent } from '@react-three/fiber';
import { Group, Mesh, type Material } from 'three';
import type { DeviceAssemblyNode, DeviceAssemblyGeometryId, DeviceAssemblyMaterialId } from './device-assembly-recipe';
import type { BufferGeometry } from 'three';

export interface DeviceAssemblyBindings {
  readonly wheel: Ref<Group>;
  readonly select: Ref<Mesh>;
  readonly screen: Ref<Mesh>;
  readonly frontRaycast: Mesh['raycast']; readonly backRaycast: Mesh['raycast'];
  readonly frontInputRaycast: Mesh['raycast']; readonly backInputRaycast: Mesh['raycast'];
  readonly onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  readonly onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
  readonly onPointerOut?: () => void;
}

/** Fiber consumes the same immutable node recipe as the worker. All geometry
 * and materials are prop-owned by explicit leases/factories; primitive material
 * children are not needed and cannot acquire a second disposal owner. */
export function DeviceAssembly({ nodes, geometries, materials, bindings }: {
  readonly nodes: readonly DeviceAssemblyNode[];
  readonly geometries: ReadonlyMap<DeviceAssemblyGeometryId, BufferGeometry>;
  readonly materials: Readonly<Record<DeviceAssemblyMaterialId, Material>>;
  readonly bindings: DeviceAssemblyBindings;
}) {
  return <>{nodes.map(node => {
    if (node.kind === 'group') return <group key={node.id} name={node.name} position={node.position}
      ref={node.id === 'wheel-assembly' ? bindings.wheel : undefined}>
      <DeviceAssembly nodes={node.children} geometries={geometries} materials={materials} bindings={bindings} />
    </group>;
    const geometry = geometries.get(node.geometry);
    if (!geometry) throw new Error(`Missing admitted geometry ${node.geometry}`);
    const input = node.id === 'front-input' || node.id === 'rear-input';
    const raycast = node.id === 'front-input' ? bindings.frontInputRaycast : node.id === 'rear-input' ? bindings.backInputRaycast
      : node.id === 'front' ? bindings.frontRaycast : node.id === 'rear' ? bindings.backRaycast : undefined;
    return <mesh key={node.id} name={node.name} geometry={geometry} material={materials[node.material]}
      position={node.position} visible={node.visible} renderOrder={node.renderOrder} raycast={raycast}
      ref={node.id === 'screen' ? bindings.screen : node.id === 'select' ? bindings.select : undefined}
      onPointerDown={input ? bindings.onPointerDown : undefined}
      onPointerMove={input ? bindings.onPointerMove : undefined}
      onPointerOut={input ? bindings.onPointerOut : undefined} />;
  })}</>;
}
