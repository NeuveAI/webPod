import { Vector3, type Camera, type Object3D, type Intersection } from 'three';
import { DEVICE_LAYOUT } from './layout';
import { DEVICE_SURFACE_LAYOUT } from './surface-layout';
import { acceptsDeviceOrientationPointer, isFirstVisibleDeviceShellHit, isDeviceOuterGrabPoint, type DeviceOrientationGrabStart, type DeviceOrientationPointerCapture } from './orientation-grab';
const { body, wheel } = DEVICE_LAYOUT;
const { glass } = DEVICE_SURFACE_LAYOUT.front;
/** Actual native sample plus exact admitted query intersections. Fiber's event
 * satisfies this interface; a native host supplies it without a Fiber cast. */
export interface DeviceOrientationPointerEvent {
  readonly pointerId: number; readonly pointerType: string; readonly isPrimary: boolean; readonly button: number;
  readonly clientX: number; readonly clientY: number; readonly timeStamp: number; readonly altKey: boolean;
  readonly object: Object3D; readonly point: Vector3; readonly face?: Intersection['face'];
  readonly intersections: readonly Intersection[]; readonly target: EventTarget | null;
  readonly nativeEvent: { readonly currentTarget: EventTarget | null };
}

function isOrientationGrabHit(
  event: DeviceOrientationPointerEvent,
  view: { readonly camera: Camera; readonly width: number; readonly height: number },
): boolean {
  if (
    !acceptsDeviceOrientationPointer(event) ||
    !isFirstVisibleDeviceShellHit(event.object, event.intersections)
  ) {
    return false;
  }
  const localPoint = event.object.worldToLocal(event.point.clone());
  if (event.pointerType !== "touch") return isDeviceOuterGrabPoint(localPoint.x, localPoint.y);
  // Preserve front controls even when their glass or decal is not an event
  // target. Sticker meshes retain first-visible-hit ownership above the shell.
  const front = event.face !== null && event.face !== undefined && event.face.normal.z > 0;
  if (front && (
    (Math.abs(localPoint.x - glass.centerX) <= glass.width / 2 &&
      Math.abs(localPoint.y - glass.centerY) <= glass.height / 2) ||
    Math.hypot(localPoint.x - wheel.centerX, localPoint.y - wheel.centerY) <= wheel.outerR
  )) return false;
  const project = (point: Vector3) => {
    point.applyMatrix4(event.object.matrixWorld).project(view.camera);
    return point.set(point.x * view.width / 2, point.y * view.height / 2, 0);
  };
  const origin = project(localPoint.clone());
  const scaleX = project(localPoint.clone().add(new Vector3(1, 0, 0))).distanceTo(origin);
  const scaleY = project(localPoint.clone().add(new Vector3(0, 1, 0))).distanceTo(origin);
  // Size in CSS pixels, bounded at a quarter of the face when viewed edge-on.
  const band = Math.min(body.width / 4, 44 / Math.max(0.01, Math.min(scaleX, scaleY)));
  return isDeviceOuterGrabPoint(localPoint.x, localPoint.y, band);
}

export function orientationGrabStart(
  event: DeviceOrientationPointerEvent,
  view: { readonly camera: Camera; readonly width: number; readonly height: number },
): DeviceOrientationGrabStart | null {
  if (!isOrientationGrabHit(event, view)) return null;
  const host = event.nativeEvent.currentTarget;
  const capture = orientationPointerCapture(event.target);
  const pointerType = orientationPointerType(event.pointerType);
  if (host === null || capture === null || pointerType === null) return null;
  return {
    pointerId: event.pointerId,
    pointerType,
    clientX: event.clientX,
    clientY: event.clientY,
    timestampMs: event.timeStamp,
    rollMode: event.altKey,
    host,
    capture,
  };
}

function orientationPointerType(
  value: string,
): DeviceOrientationGrabStart["pointerType"] | null {
  if (value === "mouse" || value === "pen" || value === "touch") return value;
  return null;
}

function orientationPointerCapture(
  target: EventTarget | null,
): DeviceOrientationPointerCapture | null {
  if (
    target === null ||
    !("hasPointerCapture" in target) ||
    !("setPointerCapture" in target) ||
    !("releasePointerCapture" in target) ||
    typeof target.hasPointerCapture !== "function" ||
    typeof target.setPointerCapture !== "function" ||
    typeof target.releasePointerCapture !== "function"
  ) {
    return null;
  }
  const hasPointerCapture = target.hasPointerCapture;
  const setPointerCapture = target.setPointerCapture;
  const releasePointerCapture = target.releasePointerCapture;
  return {
    hasPointerCapture: (pointerId) =>
      Reflect.apply(hasPointerCapture, target, [pointerId]) === true,
    setPointerCapture: (pointerId) => {
      Reflect.apply(setPointerCapture, target, [pointerId]);
    },
    releasePointerCapture: (pointerId) => {
      Reflect.apply(releasePointerCapture, target, [pointerId]);
    },
  };
}
