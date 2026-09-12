import { Group, Mesh, type Material, type Object3D } from 'three';
import { deviceAssemblyGeometries, type DeviceAssemblyNode, type DeviceAssemblyMaterialId } from './device-assembly-recipe';
import type { PreparedDevice } from './device-preparation-data';

/** Worker graph from the same recipe rendered by DeviceAssembly. This creates
 * only lightweight wrappers; all dense attributes and materials are borrowed
 * from explicitly admitted owners. IDs bind pose messages without traversal.
 */
export function createDeviceAssemblyGraph(nodes: readonly DeviceAssemblyNode[], prepared: PreparedDevice,
  materials: Readonly<Record<DeviceAssemblyMaterialId, Material>>) {
  const geometries = deviceAssemblyGeometries(prepared);
  const objects = new Map<string, Object3D>();
  const root = new Group();
  const append = (node: DeviceAssemblyNode, parent: Group) => {
    if (objects.has(node.id)) throw new Error(`Duplicate assembly node ${node.id}`);
    if (node.kind === 'group') {
      const group = new Group(); group.name = node.name ?? '';
      if (node.position) group.position.fromArray(node.position);
      objects.set(node.id, group); parent.add(group);
      for (const child of node.children) append(child, group);
      return;
    }
    const geometry = geometries.get(node.geometry);
    if (!geometry) throw new Error(`Missing admitted geometry ${node.geometry}`);
    const mesh = new Mesh(geometry, materials[node.material]); mesh.name = node.name ?? '';
    if (node.position) mesh.position.fromArray(node.position);
    if (node.visible !== undefined) mesh.visible = node.visible;
    if (node.renderOrder !== undefined) mesh.renderOrder = node.renderOrder;
    objects.set(node.id, mesh); parent.add(mesh);
  };
  for (const node of nodes) append(node, root);
  return { root, objects, dispose() { root.clear(); objects.clear(); } };
}
