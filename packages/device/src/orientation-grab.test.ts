import { describe, expect, test } from "bun:test";
import { Object3D } from "three";

import { DEVICE_LAYOUT } from "./layout";
import {
  DEVICE_ORIENTATION_GRAB_BAND,
  acceptsDeviceOrientationHover,
  acceptsDeviceOrientationPointer,
  isDeviceOuterGrabPoint,
  isFirstVisibleDeviceShellHit,
} from "./orientation-grab";

describe("device enclosure orientation grab", () => {
  test("leaves browser gesture suppression to the application touch-action boundary", async () => {
    const source = await Bun.file(new URL("./Device.tsx", import.meta.url)).text();
    const shellPointerDown = source.slice(
      source.indexOf("const onShellPointerDown"),
      source.indexOf("const onShellPointerMove"),
    );

    expect(shellPointerDown).toContain("event.stopPropagation()");
    expect(shellPointerDown).not.toContain("nativeEvent.preventDefault");
  });

  test("accepts primary mouse, pen, and touch without accepting secondary input", () => {
    expect(
      acceptsDeviceOrientationHover({
        isPrimary: true,
        pointerType: "mouse",
      }),
    ).toBe(true);
    expect(
      acceptsDeviceOrientationHover({
        isPrimary: true,
        pointerType: "pen",
      }),
    ).toBe(true);
    expect(
      acceptsDeviceOrientationPointer({
        isPrimary: true,
        pointerType: "mouse",
        button: 0,
      }),
    ).toBe(true);
    expect(
      acceptsDeviceOrientationPointer({
        isPrimary: true,
        pointerType: "pen",
        button: 0,
      }),
    ).toBe(true);
    expect(
      acceptsDeviceOrientationPointer({
        isPrimary: true,
        pointerType: "touch",
        button: -1,
      }),
    ).toBe(true);
    expect(
      acceptsDeviceOrientationPointer({
        isPrimary: false,
        pointerType: "touch",
        button: -1,
      }),
    ).toBe(false);
    expect(
      acceptsDeviceOrientationPointer({
        isPrimary: true,
        pointerType: "mouse",
        button: 2,
      }),
    ).toBe(false);
  });

  test("admits the physical perimeter and corners, never face controls", () => {
    const { body, screen, wheel } = DEVICE_LAYOUT;
    const cornerComponent = body.cornerR / Math.sqrt(2);
    const cornerX = body.width / 2 - body.cornerR + cornerComponent;
    const cornerY = body.height / 2 - body.cornerR + cornerComponent;

    expect(DEVICE_ORIENTATION_GRAB_BAND).toBe(18);
    expect(isDeviceOuterGrabPoint(body.width / 2, 0)).toBe(true);
    expect(isDeviceOuterGrabPoint(0, body.height / 2)).toBe(true);
    expect(isDeviceOuterGrabPoint(cornerX, cornerY)).toBe(true);
    expect(isDeviceOuterGrabPoint(0, 0)).toBe(false);
    expect(isDeviceOuterGrabPoint(screen.centerX, screen.centerY)).toBe(false);
    expect(isDeviceOuterGrabPoint(wheel.centerX, wheel.centerY)).toBe(false);
    expect(
      isDeviceOuterGrabPoint(
        screen.centerX + screen.width / 2,
        screen.centerY + screen.height / 2,
      ),
    ).toBe(false);
  });

  test("rejects a shell behind the LCD, wheel, or Select ray hit", () => {
    const shell = new Object3D();
    const screen = new Object3D();
    const wheel = new Object3D();
    const select = new Object3D();

    expect(isFirstVisibleDeviceShellHit(shell, [{ object: shell }])).toBe(true);
    expect(
      isFirstVisibleDeviceShellHit(shell, [
        { object: screen },
        { object: shell },
      ]),
    ).toBe(false);
    expect(
      isFirstVisibleDeviceShellHit(shell, [
        { object: wheel },
        { object: shell },
      ]),
    ).toBe(false);
    expect(
      isFirstVisibleDeviceShellHit(shell, [
        { object: select },
        { object: shell },
      ]),
    ).toBe(false);
  });
});
