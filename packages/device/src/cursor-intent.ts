import type { DeviceOrientationGrabStart } from "./orientation-grab";

export type DeviceCursorHost = EventTarget & { readonly dataset: DOMStringMap };

type ActiveGrab = {
  readonly host: EventTarget;
  readonly onPointerUp: EventListener;
  readonly onPointerCancel: EventListener;
  readonly onLostPointerCapture: EventListener;
};

/** Reflects accepted orientation drag state on the canvas cursor affordance. */
export class DeviceCursorIntentController {
  private canvas: DeviceCursorHost | null = null;
  private grabbable = false;
  private active: ActiveGrab | null = null;

  bind(canvas: DeviceCursorHost): void {
    if (this.canvas === canvas) return;
    this.clearActive();
    this.clearCanvas();
    this.canvas = canvas;
    this.reflect();
  }

  setGrabbable(grabbable: boolean): void {
    this.grabbable = grabbable;
    this.reflect();
  }

  begin(
    start: DeviceOrientationGrabStart,
    accept: ((start: DeviceOrientationGrabStart) => boolean) | undefined,
  ): boolean {
    if (this.active !== null || accept?.(start) !== true) return false;
    const finish = (event: Event) => {
      if (pointerIdOf(event) !== start.pointerId) return;
      this.clearActive();
      if (event.type !== "pointerup") this.grabbable = false;
      this.reflect();
    };
    this.active = {
      host: start.host,
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
    };
    start.host.addEventListener("pointerup", finish);
    start.host.addEventListener("pointercancel", finish);
    start.host.addEventListener("lostpointercapture", finish);
    this.reflect();
    return true;
  }

  dispose(): void {
    this.clearActive();
    this.clearCanvas();
    this.canvas = null;
    this.grabbable = false;
  }

  private reflect(): void {
    if (this.canvas === null) return;
    if (this.active !== null) this.canvas.dataset["wpCursorOrientation"] = "grabbing";
    else if (this.grabbable) this.canvas.dataset["wpCursorOrientation"] = "grab";
    else delete this.canvas.dataset["wpCursorOrientation"];
  }

  private clearActive(): void {
    const active = this.active;
    if (active === null) return;
    this.active = null;
    active.host.removeEventListener("pointerup", active.onPointerUp);
    active.host.removeEventListener("pointercancel", active.onPointerCancel);
    active.host.removeEventListener("lostpointercapture", active.onLostPointerCapture);
  }

  private clearCanvas(): void {
    if (this.canvas !== null) delete this.canvas.dataset["wpCursorOrientation"];
  }
}

/** Marks a ray-confirmed wheel control without implying device movement. */
export function setDeviceControlCursor(canvas: HTMLCanvasElement, interactive: boolean): void {
  if (interactive) canvas.dataset["wpCursorControl"] = "true";
  else delete canvas.dataset["wpCursorControl"];
}

function pointerIdOf(event: Event): number | null {
  if (!("pointerId" in event)) return null;
  const pointerId = Reflect.get(event, "pointerId");
  return typeof pointerId === "number" ? pointerId : null;
}
