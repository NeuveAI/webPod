import { Group, Matrix4, Mesh, MeshBasicMaterial, type Object3D } from 'three';
import { createDeviceAssemblyRecipe, deviceAssemblyGeometries, type DeviceAssemblyNode, type DeviceAssemblyMaterialId } from './device-assembly-recipe';
import type { PreparedDevice } from './device-preparation-data';
import type { DeviceFormParams } from './form';
import { resolveFrontAssemblyDepths } from './front-surface';
import { DEVICE_LAYOUT } from './layout';
import { DEVICE_SURFACE_LAYOUT } from './surface-layout';
import type { DeviceMaterials } from './materials';
import { completeDeviceEnvelope } from './device-envelope';
import { createShellPicking } from './shell-picking';
import { registerStickerAssembly, markStickerAssemblyChanged } from './sticker-assembly-revision';
import { bindStickerWrapSurface, createStickerWrapSurface } from './sticker-wrap';
import type { RenderPose } from './device-render-protocol';

/** Main interaction-only view: flattened prepared query meshes and explicit
 * scalar transforms. No renderer, texture upload, React scene or lighting tree.
 * Native event/visibility/placement consumers share these same admitted query
 * buffers. Every per-pose update is bounded by authored query objects, with no
 * geometry/vertex/material traversal or reconstruction.
 */
export function createDeviceQueryView(prepared: PreparedDevice, form: DeviceFormParams, materials: DeviceMaterials, isBlack=true) {
  const scene=new Group();
  const model = new Group(), content = new Group(), wheel = new Group(), selectRestFrame = new Group();
  scene.add(model);
  model.name = 'device-model'; content.name = 'device-model-content'; wheel.name = 'device-wheel-assembly';
  const envelope = completeDeviceEnvelope(form);
  content.position.set(-envelope.center[0], -envelope.center[1], -envelope.center[2]); content.updateMatrix(); model.add(content);
  const geometries = deviceAssemblyGeometries(prepared), recipe = createDeviceAssemblyRecipe(form, prepared.hardware);
  const nodes = new Map<string, Object3D>([['device-model', model], ['device-model-content', content], ['wheel-assembly', wheel]]);
  const rest = new Map<string, Matrix4>(), transforms = new Map<string, Matrix4>();
  const queries: { mesh: Mesh; chain: readonly string[] }[] = [];
  const owned: MeshBasicMaterial[] = [];
  const materialOwners:{id:DeviceAssemblyMaterialId;material:MeshBasicMaterial}[]=[];
  const opacityFor=(id:DeviceAssemblyMaterialId,params:DeviceMaterials,black:boolean)=>{
    const surface=id==='body'?(black?params.bodyBlack:params.bodyWhite):id==='wheel'?(black?params.wheelRingBlack:params.wheelRingWhite):id==='select'?(black?params.selectBlack:params.selectWhite):id==='gap'?(black?params.wheelWellBlack:params.wheelWellWhite):id==='steel'?params.steelBack:id==='glass'?params.coverGlass:id==='mask'||id==='well'?params.screenReveal:null;
    return {opacity:surface&&'opacity' in surface?surface.opacity??1:1,transparent:surface&&'transparent' in surface?surface.transparent??false:id==='label'};
  };
  const append = (node: DeviceAssemblyNode, chain: readonly string[]) => {
    const matrix = new Matrix4(); if (node.position) matrix.makeTranslation(...node.position);
    rest.set(node.id, matrix); transforms.set(node.id, matrix.clone());
    if (node.kind === 'group') { for (const child of node.children) append(child, [...chain, node.id]); return; }
    if (node.visible === false) return; // input shell proxies are ray broadphase only, never visual occluders.
    const geometry = geometries.get(node.geometry); if (!geometry) throw new Error(`Missing query geometry ${node.geometry}`);
    // Raycasting/visibility use side, opacity and visibility. All authored
    // chassis materials are FrontSide; no shader/lighting parameters are needed.
    const material = new MeshBasicMaterial(opacityFor(node.material,materials,isBlack)); owned.push(material);materialOwners.push({id:node.material,material});
    const mesh = new Mesh(geometry, material); mesh.name = node.name ?? ''; mesh.matrixAutoUpdate = false;
    nodes.set(node.id, mesh); content.add(mesh); queries.push({ mesh, chain: [...chain, node.id] });
  };
  for (const node of recipe) append(node, []);
  const wheelRest = rest.get('wheel-assembly'); if (!wheelRest) throw new Error('Missing wheel query rest');
  wheel.matrix.copy(wheelRest); wheel.matrix.decompose(wheel.position, wheel.quaternion, wheel.scale);
  const front = nodes.get('front'), rear = nodes.get('rear'), selectQuery = nodes.get('select');
  if (!(front instanceof Mesh) || !(rear instanceof Mesh) || !(selectQuery instanceof Mesh)) throw new Error('Incomplete chassis query resources');
  // Physics owns the authored Select child-local frame, not the flattened
  // query mesh whose matrix already includes its separate rest translation.
  const select = new Mesh(selectQuery.geometry, selectQuery.material);
  select.visible = false; select.name = 'device-select-control-frame';
  const selectRest = rest.get('select-rest'); if (!selectRest) throw new Error('Missing Select query rest');
  selectRestFrame.matrixAutoUpdate = false; selectRestFrame.matrix.copy(selectRest);
  selectRestFrame.add(select); content.add(selectRestFrame, wheel);
  const frontPicking = createShellPicking(), rearPicking = createShellPicking();
  front.raycast = frontPicking.raycast; rear.raycast = rearPicking.raycast;
  const releaseFront = frontPicking.prepare(front.geometry), releaseRear = rearPicking.prepare(rear.geometry);
  const unregister = registerStickerAssembly(content);
  const depth = resolveFrontAssemblyDepths(form), {glass} = DEVICE_SURFACE_LAYOUT.front, {wheel: wheelLayout} = DEVICE_LAYOUT;
  const unbindWrap = bindStickerWrapSurface(rear.geometry, createStickerWrapSurface(form, [
    {geometry: prepared.front},
    {geometry: prepared.inserts.glassGeometry, offset: [glass.centerX, glass.centerY, depth.glassFrontZ]},
    {geometry: prepared.inserts.ringGeometry, offset: [wheelLayout.centerX, wheelLayout.centerY, depth.wheelSurfaceBaseZ]},
    {geometry: prepared.inserts.selectGeometry, offset: [wheelLayout.centerX, wheelLayout.centerY, depth.wheelSurfaceBaseZ]},
  ]));
  let disposed = false;
  const publishMatrices = () => {
    model.updateWorldMatrix(true, false); content.updateWorldMatrix(false, false);
    for (const query of queries) {
      query.mesh.matrix.identity();
      for (const id of query.chain) { const local = transforms.get(id); if (!local) throw new Error(`Missing query transform ${id}`); query.mesh.matrix.multiply(local); }
      query.mesh.matrixWorld.multiplyMatrices(content.matrixWorld, query.mesh.matrix);
    }
    wheel.matrixWorld.multiplyMatrices(content.matrixWorld, wheel.matrix);
    selectRestFrame.updateWorldMatrix(false, true);
    content.getObjectByName('device-equipped-stickers')?.updateWorldMatrix(false,true);
  };
  publishMatrices();
  return {
    scene,model, content, wheel, select, front, rear, nodes,
    eventMeshes: new Set<Mesh>([front, rear]),
    updateMaterials(params:DeviceMaterials,black:boolean){
      if(disposed)return;let changed=false;
      for(const item of materialOwners){const next=opacityFor(item.id,params,black);if(item.material.opacity!==next.opacity||item.material.transparent!==next.transparent){item.material.opacity=next.opacity;item.material.transparent=next.transparent;changed=true;}}
      if(changed)markStickerAssemblyChanged(content);
    },
    applyPose(pose: RenderPose) {
      if (disposed) return;
      for (const node of pose.nodes) {
        if (node.id === 'device-model') { model.matrixAutoUpdate = false; model.matrix.fromArray(node.matrix); model.matrixWorldNeedsUpdate = true; }
        else if (node.id === 'device-model-content') { content.matrixAutoUpdate = false; content.matrix.fromArray(node.matrix); content.matrixWorldNeedsUpdate = true; }
        else if (transforms.has(node.id)) {
          const transform = transforms.get(node.id); if (transform) transform.fromArray(node.matrix);
          if (node.id === 'select') { select.matrix.fromArray(node.matrix); select.matrix.decompose(select.position, select.quaternion, select.scale); }
          if (node.id === 'select-rest') selectRestFrame.matrix.fromArray(node.matrix);
          if (node.id === 'wheel-assembly') { wheel.matrix.fromArray(node.matrix); wheel.matrix.decompose(wheel.position, wheel.quaternion, wheel.scale); }
        }
      }
      publishMatrices();
    },
    /** Called by the one main physical control owner after immediate contact.
     * Only its scalar local transforms change; registered visibility invalidation
     * rebuilds the exact collider when a later query needs the changed assembly.
     */
    controlsChanged() { if (!disposed) { transforms.get('wheel-assembly')?.copy(wheel.matrix); transforms.get('select')?.copy(select.matrix); markStickerAssemblyChanged(content); publishMatrices(); } },
    dispose() { if (disposed) return; disposed = true; releaseFront(); releaseRear(); unregister(); unbindWrap(); content.clear(); model.clear();scene.clear(); nodes.clear(); for (const material of owned) material.dispose(); },
  };
}
