import {deviceStore} from '@webpod/state';
import {bindAgentControlPhysics} from './agent-controls';
import { createDeviceNativeInput } from '../../device/src/device-native-input';
import type { ClickWheelInputSurfaceProps } from '../../device/src/click-wheel-input-core';
import { useLayoutEffect, useRef } from 'react';
import { Euler, Matrix4, PerspectiveCamera } from 'three';
import type { DeviceCanvasProps } from '../../device/src/DeviceCanvas';
import { DEFAULT_DEVICE_FORM } from '../../device/src/form';
import { DEFAULT_DEVICE_MATERIALS } from '../../device/src/materials';
import { DEFAULT_LIGHT_RIG } from '../../device/src/light-rig';
import { FRONT_DEVICE_ORIENTATION, deviceOrientationToRotation } from '../../device/src/orientation';
import { completeDeviceEnvelope, deviceEnvelopeBounds } from '../../device/src/device-envelope';
import { fitPerspectiveCameraToRotationalEnvelope, applyDeviceCameraFit, DEFAULT_DEVICE_CAMERA_SAFE_MARGIN_RATIO } from '../../device/src/camera-fit';
import { createDeviceAssemblyRecipe } from '../../device/src/device-assembly-recipe';
import { createDeviceRenderHost } from './device-render-host';
import { observeNativeCanvasMeasurement, type NativeCanvasMeasurement } from './native-canvas-measurement';
import type { RenderLayout, RenderNodePose, RenderPose } from '../../device/src/device-render-protocol';

/** Native generation under the same product input boundary and stable Panel
 * portal. No hidden counterpart renders behind this canvas. Failure requests a
 * fresh complete GL generation from the parent, which owns persistent state.
 */
export function WorkerDeviceCanvas(props: DeviceCanvasProps & { readonly panel: HTMLElement; readonly inputCallbacks: ClickWheelInputSurfaceProps; readonly onFailure: (error: unknown) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const owner = useRef<ReturnType<typeof createDeviceRenderHost> | null>(null);
  useLayoutEffect(() => { latest.current = props; owner.current?.updateStickerScene(props.stickerScene); }, [props]);
  useLayoutEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const initial = latest.current, form = initial.form ?? DEFAULT_DEVICE_FORM;
    const camera = new PerspectiveCamera(), envelope = completeDeviceEnvelope(form);
    let currentLayout: RenderLayout | null = null;
    let revision = 0, disposed = false, host: ReturnType<typeof createDeviceRenderHost> | null = null;
    const measure = (measurement: NativeCanvasMeasurement): RenderLayout => {
      const rect = { width: measurement.cssWidth, height: measurement.cssHeight };
      const compact = initial.cameraMobileFraming && initial.cameraDistance === undefined && (rect.width <= 520 || rect.width <= 960 && rect.height <= 520);
      const fov = compact ? 12 : initial.cameraFov ?? 30;
      const viewport = { width: rect.width, height: rect.height, safePadding: compact ? 8 : initial.cameraSafePadding ?? 28, safeMarginRatio: compact ? .04 : DEFAULT_DEVICE_CAMERA_SAFE_MARGIN_RATIO };
      const measured = fitPerspectiveCameraToRotationalEnvelope(deviceEnvelopeBounds(envelope), viewport, fov);
      const fit = initial.cameraDistance === undefined ? measured : { ...measured, distance: initial.cameraDistance,
        near: Math.max(.1, (initial.cameraDistance - envelope.boundingRadius) * .5), far: initial.cameraDistance + envelope.boundingRadius * 2 };
      applyDeviceCameraFit(camera, fit, viewport, fov);
      return { revision: ++revision, cssWidth: rect.width, cssHeight: rect.height,
        backingWidth: measurement.backingWidth, backingHeight: measurement.backingHeight, pixelRatio: measurement.pixelRatio,
        cameraWorld: camera.matrixWorld.toArray(), cameraProjection: camera.projectionMatrix.toArray() };
    };
    const start = (layout: RenderLayout, rasterWidth: number, rasterHeight: number) => {
      const orientation = initial.motionAuthority?.readIntent().orientation ?? initial.orientation ?? FRONT_DEVICE_ORIENTATION;
      const rotation = deviceOrientationToRotation(orientation);
      const nodes: RenderNodePose[] = [{ id: 'device-model', matrix: new Matrix4().makeRotationFromEuler(new Euler(...rotation)).toArray() }];
      const recipe = createDeviceAssemblyRecipe(form, []);
      for (const id of ['wheel-assembly', 'select-rest']) {
        const node = recipe.find(item => item.id === id); if (!node?.position) throw new Error(`Missing rest frame ${id}`);
        nodes.push({ id, matrix: new Matrix4().makeTranslation(...node.position).toArray() });
      }
      nodes.push({ id: 'select', matrix: new Matrix4().toArray() });
      const pose: RenderPose = { sequence: 0, motionEpoch: 0, lastAcceptedCommand: 0, layoutRevision: layout.revision, sceneRevision: 1, resourceRevision: 1, nodes, orientation, reveal: initial.motionAuthority?.readIntent().reveal ?? null };
      canvas.dataset['wpRenderWarm'] = 'pending'; canvas.dataset['wpRenderBackend'] = 'worker-webgpu';
      host = createDeviceRenderHost({ canvas, panel: initial.panel, form, materials: initial.materials ?? DEFAULT_DEVICE_MATERIALS,
        lightRig: initial.lightRig ?? DEFAULT_LIGHT_RIG, isBlack: initial.colourway !== 'white', layout, pose, rasterWidth, rasterHeight,
        stickerScene: initial.stickerScene, studio: { sigma: initial.studioEnvironment?.sigma ?? .04, intensity: initial.studioEnvironment?.intensity ?? .2 }, authority: initial.motionAuthority,
        onProjection: () => {}, onReady: (binding, query) => {
          canvas.dataset['wpRenderWarm'] = 'ready';
          const nativeInput=createDeviceNativeInput({canvas, query, binding, form, layout: () => currentLayout ?? layout,
            callbacks: () => latest.current.inputCallbacks, onOrientationGrabStart: initial.onOrientationGrabStart,onOrientationGrabHoverChange:initial.onOrientationGrabHoverChange});
          const unbindAgent=bindAgentControlPhysics(deviceStore,nativeInput.controlPhysics);
          return()=>{unbindAgent();nativeInput();};
        },
        onFailure: error => { canvas.dataset['wpRenderWarm'] = 'failed'; if (!disposed) initial.onFailure(error); } });
      owner.current = host;
    };
    const stopMeasurement = observeNativeCanvasMeasurement(canvas, typeof initial.dpr === 'number' ? initial.dpr : undefined, measurement => {
      if (disposed) return;
      const layout = measure(measurement); currentLayout = layout;
      try {
        if (!host) start(layout, measurement.rasterWidth, measurement.rasterHeight);
        else host.updateLayout(layout, { width: measurement.rasterWidth, height: measurement.rasterHeight });
      } catch (error) { if (!disposed) initial.onFailure(error); }
    });
    return () => { disposed = true; stopMeasurement(); host?.dispose(); owner.current = null; };
  }, []);
  return <canvas ref={ref} className={props.className} style={{ display: 'block', width: '100%', height: '100%' }} />;
}
