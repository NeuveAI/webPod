import { describe, expect, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

import { DeviceCursorIntentController, setDeviceControlCursor } from "./cursor-intent";
import type { DeviceOrientationGrabStart } from "./orientation-grab";

if (typeof document === "undefined") GlobalRegistrator.register();

function grabStart(host: HTMLCanvasElement, pointerId = 7): DeviceOrientationGrabStart {
  return {
    pointerId,
    pointerType: "mouse",
    clientX: 10,
    clientY: 20,
    timestampMs: 30,
    rollMode: false,
    host,
    capture: {
      hasPointerCapture: () => true,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
    },
  };
}

describe("native device cursor intent", () => {
  test("moves from idle to grab and accepted grabbing", () => {
    const canvas = document.createElement("canvas");
    const controller = new DeviceCursorIntentController();
    controller.bind(canvas);
    expect(canvas.dataset["wpCursorOrientation"]).toBeUndefined();

    controller.setGrabbable(true);
    expect(canvas.dataset["wpCursorOrientation"]).toBe("grab");
    expect(controller.begin(grabStart(canvas), () => true)).toBe(true);
    expect(canvas.dataset["wpCursorOrientation"]).toBe("grabbing");

    canvas.dispatchEvent(new PointerEvent("pointerup", { pointerId: 7 }));
    expect(canvas.dataset["wpCursorOrientation"]).toBe("grab");
  });

  test("does not claim grabbing when the orientation owner rejects the drag", () => {
    const canvas = document.createElement("canvas");
    const controller = new DeviceCursorIntentController();
    controller.bind(canvas);
    controller.setGrabbable(true);
    expect(controller.begin(grabStart(canvas), () => false)).toBe(false);
    expect(canvas.dataset["wpCursorOrientation"]).toBe("grab");
  });

  test("cancel, lost capture, and disposal clear active cursor state", () => {
    for (const type of ["pointercancel", "lostpointercapture"] as const) {
      const canvas = document.createElement("canvas");
      const controller = new DeviceCursorIntentController();
      controller.bind(canvas);
      controller.setGrabbable(true);
      controller.begin(grabStart(canvas), () => true);
      canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7 }));
      expect(canvas.dataset["wpCursorOrientation"]).toBeUndefined();
    }

    const canvas = document.createElement("canvas");
    const controller = new DeviceCursorIntentController();
    controller.bind(canvas);
    controller.begin(grabStart(canvas), () => true);
    controller.dispose();
    expect(canvas.dataset["wpCursorOrientation"]).toBeUndefined();
  });

  test("wheel controls use pointer intent without changing orientation intent", () => {
    const canvas = document.createElement("canvas");
    setDeviceControlCursor(canvas, true);
    expect(canvas.dataset["wpCursorControl"]).toBe("true");
    expect(canvas.dataset["wpCursorOrientation"]).toBeUndefined();
    setDeviceControlCursor(canvas, false);
    expect(canvas.dataset["wpCursorControl"]).toBeUndefined();
  });
});
