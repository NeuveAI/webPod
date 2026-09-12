import { BufferGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Raycaster, Vector2, type Intersection } from 'three';
import { createClickWheelEventController } from './click-wheel-event-controller';
import { clickWheelInputPosition, raycastWheelRing, raycastWheelSelect, wheelPointFromRay, type ClickWheelInputSurfaceProps, type ClickWheelPointerEvent } from './click-wheel-input-core';
import { ControlPhysicsController } from './control-physics';
import { deviceScreenIsInteractable } from './orientation';
import {setDeviceControlCursor} from './cursor-intent';
import {acceptsDeviceOrientationHover,isDeviceOuterGrabPoint,isFirstVisibleDeviceShellHit} from './orientation-grab';
import { orientationGrabStart } from './device-orientation-events';
import type { DeviceOrientationGrabStart } from './orientation-grab';
import type { DeviceMotionBinding } from './device-motion-authority';
import type { DeviceFormParams } from './form';
import type { createDeviceQueryView } from './device-query-view';
import type { RenderLayout } from './device-render-protocol';

/** Native adapter for the same physical input state machine used by Fiber.
 * Only exact query/camera matrices and real browser samples enter this seam. */
export function createDeviceNativeInput(input: {
  readonly canvas: HTMLCanvasElement; readonly query: ReturnType<typeof createDeviceQueryView>; readonly form: DeviceFormParams;
  readonly binding: DeviceMotionBinding; readonly layout: () => RenderLayout;
  readonly callbacks: () => ClickWheelInputSurfaceProps;
  readonly onOrientationGrabHoverChange?: (grabbable:boolean)=>void;
  readonly onOrientationGrabStart?: (start: DeviceOrientationGrabStart) => boolean;
}) {
  const {canvas, query, binding} = input;
  let disposed = false, applyingRemote = false;
  const physicsBinding: DeviceMotionBinding = {...binding, subscribe: listener => binding.subscribe(response => {
    applyingRemote = response.type==='projection'||response.type==='command-settled'&&response.outcome==='settled';
    try { listener(response); } finally { applyingRemote = false; }
  })};
  const physics = new ControlPhysicsController({now: () => performance.now(), requestFrame: callback => globalThis.requestAnimationFrame(callback), cancelFrame: handle => globalThis.cancelAnimationFrame(handle),
    invalidate: () => {
      if (disposed) return;
      query.controlsChanged();
      // A submitted remote control frame updates main query matrices but does
      // not become a new input sample or trigger another worker render.
      if (applyingRemote) return;
      const pose = binding.read();
      binding.sendPose({...pose, nodes: pose.nodes.map(node => node.id === 'wheel-assembly' ? {...node, matrix: query.wheel.matrix.toArray()}
        : node.id === 'select' ? {...node, matrix: query.select.matrix.toArray()} : node)});
    }});
  const detachWheel = physics.attachWheel(query.wheel), detachSelect = physics.attachSelect(query.select), detachMotion = physics.attachMotion(physicsBinding);
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const syncReducedMotion = () => physics.setReducedMotion(reducedMotion.matches);
  syncReducedMotion(); reducedMotion.addEventListener('change', syncReducedMotion);
  const geometry = new BufferGeometry(), material = new MeshBasicMaterial({opacity: 0, transparent: true, depthWrite: false, colorWrite: false});
  const wheel = new Mesh(geometry, material), select = new Mesh(geometry, material);
  wheel.name = 'click-wheel-input'; select.name = 'click-wheel-select-input';
  for (const mesh of [wheel, select]) { mesh.position.fromArray(clickWheelInputPosition(input.form)); mesh.userData['wheelSurfaceForm'] = input.form; query.content.add(mesh); }
  wheel.raycast = raycastWheelRing; select.raycast = raycastWheelSelect;
  const camera = new PerspectiveCamera(), raycaster = new Raycaster(), ndc = new Vector2();
  const active = new Map<number, 'wheel' | 'select'>();
  const events = createClickWheelEventController({controlPhysics: physics, callbacks: input.callbacks, point: event => wheelPointFromRay(wheel, event.ray)});
  let detachKeyboard:(()=>void)|null=null,frontAdmission:boolean|null=null;
  const syncFront=()=>{const front=deviceScreenIsInteractable(binding.read().orientation);if(front===frontAdmission)return;frontAdmission=front;detachKeyboard?.();detachKeyboard=null;if(front)detachKeyboard=events.attachKeyboard(()=>{syncFront();return frontAdmission===true;});else{events.dispose();active.clear();setDeviceControlCursor(canvas,false);}};
  syncFront();const detachFront=binding.subscribe(syncFront);
  const sample = (event: PointerEvent): ClickWheelPointerEvent => {
    const layout = input.layout(), rect = canvas.getBoundingClientRect();
    camera.matrixAutoUpdate = false; camera.matrix.fromArray(layout.cameraWorld); camera.matrixWorld.copy(camera.matrix); camera.matrixWorldInverse.copy(camera.matrix).invert();
    camera.projectionMatrix.fromArray(layout.cameraProjection); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    ndc.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return {pointerId: event.pointerId, pointerType: event.pointerType, isPrimary: event.isPrimary, button: event.button, timeStamp: event.timeStamp,
      ray: raycaster.ray, target: canvas, nativeEvent: {currentTarget: canvas}, stopPropagation: () => event.stopPropagation()};
  };
  const down = (event: PointerEvent) => {
    syncFront();
    const pointer = sample(event), hits: Intersection[] = [];
    query.content.updateWorldMatrix(true, true);
    // Match Fiber's registered event targets. Physical meshes without handlers
    // remain collision/visibility queries, not phantom event occluders.
    raycaster.intersectObjects([...query.eventMeshes, wheel, select], false, hits);
    const admitted = hits.filter(hit => hit.object !== query.select && hit.object.visible && hit.object.name !== 'device-select-control-frame');
    const first = admitted[0]; if (!first) return;
    if ((first.object === wheel || first.object === select) && deviceScreenIsInteractable(binding.read().orientation)) {
      const channel = first.object === wheel ? 'wheel' : 'select';
      events[channel].down(pointer); if (canvas.hasPointerCapture(event.pointerId)) active.set(event.pointerId, channel);
      return;
    }
    if (first.object !== query.front && first.object !== query.rear) return;
    const start = orientationGrabStart({...pointer, clientX: event.clientX, clientY: event.clientY, altKey: event.altKey,
      object: first.object, point: first.point, face: first.face, intersections: admitted}, {camera, width: input.layout().cssWidth, height: input.layout().cssHeight});
    if (start && input.onOrientationGrabStart?.(start)) event.stopPropagation();
  };
  const hoverOut=()=>{setDeviceControlCursor(canvas,false);input.onOrientationGrabHoverChange?.(false);};
  const move = (event: PointerEvent) => {
   syncFront();
   const channel=active.get(event.pointerId);if(channel){events[channel].move(sample(event));return;}
   if(!acceptsDeviceOrientationHover(event))return;sample(event);query.content.updateWorldMatrix(true,true);
   const hits=raycaster.intersectObjects([...query.eventMeshes,wheel,select],false),first=hits.find(hit=>hit.object.visible);
   const control=!!first&&(first.object===wheel||first.object===select)&&deviceScreenIsInteractable(binding.read().orientation);setDeviceControlCursor(canvas,control);
   if(first&&(first.object===query.front||first.object===query.rear)&&isFirstVisibleDeviceShellHit(first.object,hits)){const local=first.object.worldToLocal(first.point.clone());input.onOrientationGrabHoverChange?.(isDeviceOuterGrabPoint(local.x,local.y));}else input.onOrientationGrabHoverChange?.(false);
  };
  const up = (event: PointerEvent) => { syncFront(); const channel = active.get(event.pointerId); active.delete(event.pointerId); if (channel) events[channel].up(sample(event)); };
  const cancel = (event: PointerEvent) => { active.delete(event.pointerId); };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointerleave',hoverOut);
  canvas.addEventListener('pointercancel', cancel); canvas.addEventListener('lostpointercapture', cancel);
  const dispose = () => {
    if (disposed) return; disposed = true;
    canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('lostpointercapture', cancel);
    canvas.removeEventListener('pointerleave',hoverOut);hoverOut();detachFront();
    events.dispose(); detachKeyboard?.(); active.clear(); reducedMotion.removeEventListener('change', syncReducedMotion); detachMotion(); detachWheel(); detachSelect(); physics.dispose();
    wheel.removeFromParent(); select.removeFromParent(); geometry.dispose(); material.dispose();
  };
  return Object.assign(dispose,{controlPhysics:physics});
}
