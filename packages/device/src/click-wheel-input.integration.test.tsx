import { describe, expect, test } from "bun:test";
import {
  act,
  createRoot,
  events,
  extend,
  type ReconcilerRoot,
  type RootStore,
} from "@react-three/fiber";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import * as THREE from "three";

import {
  ClickWheelInputSurface,
  type ClickWheelArcEnd,
  type ClickWheelArcSample,
} from "./click-wheel-input";
import { DeviceCanvasFaceContext } from "./DeviceCanvas";
import { DEVICE_LAYOUT } from "./layout";

const WIDTH = DEVICE_LAYOUT.body.width;
const HEIGHT = DEVICE_LAYOUT.body.height;

GlobalRegistrator.register();
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true });
extend({
  Mesh: THREE.Mesh,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  RingGeometry: THREE.RingGeometry,
});

type MountedSurface = {
  readonly canvas: HTMLCanvasElement;
  readonly root: ReconcilerRoot<HTMLCanvasElement>;
  readonly store: RootStore;
  readonly starts: Array<ClickWheelArcSample>;
  readonly moves: Array<ClickWheelArcSample>;
  readonly ends: Array<ClickWheelArcEnd>;
  readonly restoreAnimationFrame: () => void;
};

function installAnimationFrameStub(): () => void {
  const previous = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 1;
  return () => {
    if (previous === undefined) {
      Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    } else {
      globalThis.requestAnimationFrame = previous;
    }
  };
}

async function mountSurface(
  face: "front" | "back" = "front",
): Promise<MountedSurface> {
  const canvas = document.createElement("canvas");
  const camera = new THREE.OrthographicCamera(
    -WIDTH / 2,
    WIDTH / 2,
    HEIGHT / 2,
    -HEIGHT / 2,
    1,
    2000,
  );
  camera.position.z = 1000;
  camera.updateProjectionMatrix();
  const root = createRoot(canvas);
  const renderer = {
    domElement: canvas,
    render: () => undefined,
    setPixelRatio: () => undefined,
    setSize: () => undefined,
  };
  await root.configure({
    camera,
    events,
    frameloop: "never",
    gl: renderer,
    size: { width: WIDTH, height: HEIGHT, top: 0, left: 0 },
  });

  const starts: Array<ClickWheelArcSample> = [];
  const moves: Array<ClickWheelArcSample> = [];
  const ends: Array<ClickWheelArcEnd> = [];
  const mountedStore: { current: RootStore | null } = { current: null };
  const restoreAnimationFrame = installAnimationFrameStub();
  await act(async () => {
    mountedStore.current = root.render(
      <DeviceCanvasFaceContext.Provider value={face}>
        <ClickWheelInputSurface
          onArcStart={(sample) => starts.push(sample)}
          onArcMove={(sample) => moves.push(sample)}
          onArcEnd={(end) => ends.push(end)}
        />
      </DeviceCanvasFaceContext.Provider>,
    );
    await Promise.resolve();
  });
  const store = mountedStore.current;
  if (store === null) throw new Error("R3F surface did not mount");
  store.getState().camera.updateMatrixWorld(true);
  store.getState().scene.updateMatrixWorld(true);
  return {
    canvas,
    root,
    store,
    starts,
    moves,
    ends,
    restoreAnimationFrame,
  };
}

function wheelViewportPoint(localX: number, localY: number) {
  return {
    x: WIDTH / 2 + DEVICE_LAYOUT.wheel.centerX + localX,
    y: HEIGHT / 2 - DEVICE_LAYOUT.wheel.centerY - localY,
  };
}

function pointerEvent(
  type: string,
  pointerId: number,
  localX: number,
  localY: number,
  init: { readonly pointerType?: string; readonly button?: number } = {},
): PointerEvent {
  const point = wheelViewportPoint(localX, localY);
  const event = new PointerEvent(type, {
    bubbles: true,
    button: init.button ?? 0,
    isPrimary: true,
    pointerId,
    pointerType: init.pointerType ?? "mouse",
  });
  Object.defineProperties(event, {
    offsetX: { configurable: true, value: point.x },
    offsetY: { configurable: true, value: point.y },
  });
  return event;
}

async function dispatch(
  mounted: MountedSurface,
  event: PointerEvent,
): Promise<void> {
  await act(async () => {
    mounted.canvas.dispatchEvent(event);
    await Promise.resolve();
  });
}

async function unmount(mounted: MountedSurface): Promise<void> {
  await act(async () => {
    mounted.root.unmount();
    await Promise.resolve();
  });
  mounted.restoreAnimationFrame();
}

describe("click-wheel mounted R3F event seam", () => {
  test("routes captured down, outside move and up through production handlers", async () => {
    const mounted = await mountSurface();
    const pointerId = 31;
    try {
      await dispatch(mounted, pointerEvent("pointerdown", pointerId, 80, 0));
      expect(mounted.canvas.hasPointerCapture(pointerId)).toBeTrue();
      expect(mounted.starts).toHaveLength(1);
      expect(mounted.starts[0]?.angleDeg).toBeCloseTo(0, 8);

      // Radius 145 is outside the 115px annulus. Fiber's captured event must
      // still reach production, which recomputes the angle from the live ray.
      await dispatch(mounted, pointerEvent("pointermove", pointerId, 0, -145));
      expect(mounted.moves).toHaveLength(1);
      expect(mounted.moves[0]?.angleDeg).toBeCloseTo(90, 8);

      await dispatch(mounted, pointerEvent("pointerup", pointerId, 0, -145));
      expect(mounted.ends.map((end) => end.reason)).toEqual(["release"]);
      expect(mounted.canvas.hasPointerCapture(pointerId)).toBeFalse();
    } finally {
      await unmount(mounted);
    }
  });

  test("native cancel and following lost capture terminate exactly once", async () => {
    const mounted = await mountSurface();
    const pointerId = 32;
    try {
      await dispatch(
        mounted,
        pointerEvent("pointerdown", pointerId, 80, 0, { pointerType: "touch" }),
      );
      await dispatch(
        mounted,
        pointerEvent("pointercancel", pointerId, 80, 0, { pointerType: "touch" }),
      );
      await dispatch(
        mounted,
        pointerEvent("lostpointercapture", pointerId, 80, 0, { pointerType: "touch" }),
      );
      expect(mounted.ends.map((end) => end.reason)).toEqual(["cancel"]);
    } finally {
      await unmount(mounted);
    }
  });

  test("unexpected native lost capture reaches the component listener", async () => {
    const mounted = await mountSurface();
    const pointerId = 33;
    try {
      await dispatch(mounted, pointerEvent("pointerdown", pointerId, 80, 0));
      await dispatch(
        mounted,
        pointerEvent("lostpointercapture", pointerId, 80, 0),
      );
      expect(mounted.ends.map((end) => end.reason)).toEqual(["lost-capture"]);
    } finally {
      await unmount(mounted);
    }
  });

  test("reconciler unmount cancels and releases an active pointer", async () => {
    const mounted = await mountSurface();
    const pointerId = 34;
    await dispatch(mounted, pointerEvent("pointerdown", pointerId, 80, 0));
    expect(mounted.canvas.hasPointerCapture(pointerId)).toBeTrue();
    await unmount(mounted);
    expect(mounted.ends.map((end) => end.reason)).toEqual(["cancel"]);
    expect(mounted.canvas.hasPointerCapture(pointerId)).toBeFalse();
  });

  test("a back-facing DeviceCanvas context contains no raycastable annulus", async () => {
    const mounted = await mountSurface("back");
    try {
      expect(
        mounted.store.getState().scene.getObjectByName("click-wheel-input"),
      ).toBeUndefined();
      await dispatch(mounted, pointerEvent("pointerdown", 35, 80, 0));
      expect(mounted.starts).toHaveLength(0);
    } finally {
      await unmount(mounted);
    }
  });
});
