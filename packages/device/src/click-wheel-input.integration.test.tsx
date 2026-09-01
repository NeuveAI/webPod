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
  type ClickWheelSelectEnd,
  type ClickWheelSelectStart,
} from "./click-wheel-input";
import { ControlPhysicsScope } from "./ControlPhysicsScope";
import {
  ControlPhysicsController,
  type ControlPhysicsDependencies,
} from "./control-physics";
import {
  FRONT_DEVICE_ORIENTATION,
  REAR_DEVICE_ORIENTATION,
} from "./orientation";
import { DeviceCanvasOrientationContext } from "./DeviceCanvas";
import { DEVICE_LAYOUT } from "./layout";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import {
  DEFAULT_FRONT_ASSEMBLY_DEPTHS,
  resolveFrontAssemblyDepths,
} from "./front-surface";

const WIDTH = DEVICE_LAYOUT.body.width;
const HEIGHT = DEVICE_LAYOUT.body.height;

GlobalRegistrator.register();
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true });
extend({
  Mesh: THREE.Mesh,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  RingGeometry: THREE.RingGeometry,
  CircleGeometry: THREE.CircleGeometry,
});

type MountedSurface = {
  readonly canvas: HTMLCanvasElement;
  readonly root: ReconcilerRoot<HTMLCanvasElement>;
  readonly store: RootStore;
  readonly starts: Array<ClickWheelArcSample>;
  readonly moves: Array<ClickWheelArcSample>;
  readonly ends: Array<ClickWheelArcEnd>;
  readonly selectStarts: Array<ClickWheelSelectStart>;
  readonly selectEnds: Array<ClickWheelSelectEnd>;
  readonly restoreAnimationFrame: () => void;
  readonly controlPhysics: RecordingControlPhysics;
};

class RecordingControlPhysics extends ControlPhysicsController {
  wheelContacts = 0;
  wheelReleases = 0;
  selectPresses = 0;
  selectReleases = 0;

  constructor() {
    const dependencies: ControlPhysicsDependencies = {
      invalidate: () => undefined,
      now: () => performance.now(),
      requestFrame: () => 1,
      cancelFrame: () => undefined,
    };
    super(dependencies);
  }

  override wheelContact(contact: { readonly x: number; readonly y: number }): void {
    this.wheelContacts += 1;
    super.wheelContact(contact);
  }

  override releaseWheel(): void {
    this.wheelReleases += 1;
    super.releaseWheel();
  }

  override pressSelect(): void {
    this.selectPresses += 1;
    super.pressSelect();
  }

  override releaseSelect(): void {
    this.selectReleases += 1;
    super.releaseSelect();
  }
}

type CallbackPlants = {
  readonly onArcStart?: (sample: ClickWheelArcSample) => void;
  readonly onArcMove?: (sample: ClickWheelArcSample) => void;
  readonly onArcEnd?: (end: ClickWheelArcEnd) => void;
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
  plants: CallbackPlants = {},
  form: DeviceFormParams = DEFAULT_DEVICE_FORM,
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
  const selectStarts: Array<ClickWheelSelectStart> = [];
  const selectEnds: Array<ClickWheelSelectEnd> = [];
  const mountedStore: { current: RootStore | null } = { current: null };
  const controlPhysics = new RecordingControlPhysics();
  const restoreAnimationFrame = installAnimationFrameStub();
  await act(async () => {
    mountedStore.current = root.render(
      <ControlPhysicsScope controller={controlPhysics}>
        <DeviceCanvasOrientationContext.Provider
          value={{
            orientation:
              face === "back" ? REAR_DEVICE_ORIENTATION : FRONT_DEVICE_ORIENTATION,
            visibleFace: face,
            frontInteractive: face === "front",
            form,
          }}
        >
          <ClickWheelInputSurface
            onArcStart={(sample) => {
              starts.push(sample);
              plants.onArcStart?.(sample);
            }}
            onArcMove={(sample) => {
              moves.push(sample);
              plants.onArcMove?.(sample);
            }}
            onArcEnd={(end) => {
              ends.push(end);
              plants.onArcEnd?.(end);
            }}
            onSelectStart={(start) => selectStarts.push(start)}
            onSelectEnd={(end) => selectEnds.push(end)}
          />
        </DeviceCanvasOrientationContext.Provider>
      </ControlPhysicsScope>,
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
    selectStarts,
    selectEnds,
    restoreAnimationFrame,
    controlPhysics,
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
    cancelable: true,
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

async function dispatchExpectingWindowError(
  mounted: MountedSurface,
  event: PointerEvent,
  message: string,
): Promise<void> {
  const reported: { current: Error | null } = { current: null };
  const onError = (error: ErrorEvent): void => {
    if (error.message !== message) return;
    reported.current = error.error instanceof Error ? error.error : new Error(error.message);
    error.preventDefault();
  };
  window.addEventListener("error", onError);
  try {
    await dispatch(mounted, event);
  } finally {
    window.removeEventListener("error", onError);
  }
  expect(reported.current?.message).toBe(message);
}

async function unmount(mounted: MountedSurface): Promise<void> {
  await act(async () => {
    mounted.root.unmount();
    await Promise.resolve();
  });
  mounted.restoreAnimationFrame();
  mounted.controlPhysics.dispose();
}

describe("click-wheel mounted R3F event seam", () => {
  test("an injected form moves the mounted ray plane with the visible wheel", async () => {
    const plantedForm = {
      ...DEFAULT_DEVICE_FORM,
      bodyCrown: 6.2,
      bodyCrossCrown: 6.2,
    };
    expect(plantedForm.bodyCrown).toBe(6.2);
    expect(plantedForm.bodyCrossCrown).toBe(6.2);
    const mounted = await mountSurface("front", {}, plantedForm);
    try {
      const input = mounted.store
        .getState()
        .scene.getObjectByName("click-wheel-input");
      const depths = resolveFrontAssemblyDepths(plantedForm);
      expect(input).toBeDefined();
      expect(input?.position.z).toBeCloseTo(depths.clickWheelInputZ, 12);
      expect(input?.position.z).toBeGreaterThan(
        depths.wheelTopAtCenterZ + 0.25,
      );
      expect(
        Math.abs(
          depths.clickWheelInputZ -
            DEFAULT_FRONT_ASSEMBLY_DEPTHS.clickWheelInputZ,
        ),
      ).toBeGreaterThan(5);
    } finally {
      await unmount(mounted);
    }
  });

  test("routes captured down, outside move and up through production handlers", async () => {
    const mounted = await mountSurface();
    const pointerId = 31;
    try {
      const down = pointerEvent("pointerdown", pointerId, 80, 0);
      let downPreventions = 0;
      const preventDown = down.preventDefault.bind(down);
      Object.defineProperty(down, "preventDefault", {
        value: () => {
          downPreventions += 1;
          preventDown();
        },
      });
      await dispatch(mounted, down);
      expect(downPreventions).toBeGreaterThan(0);
      expect(mounted.canvas.hasPointerCapture(pointerId)).toBeTrue();
      expect(mounted.starts).toHaveLength(1);
      expect(mounted.starts[0]?.angleDeg).toBeCloseTo(0, 8);

      // Radius 145 is outside the 115px annulus. Fiber's captured event must
      // still reach production, which recomputes the angle from the live ray.
      const move = pointerEvent("pointermove", pointerId, 0, -145);
      let movePreventions = 0;
      const preventMove = move.preventDefault.bind(move);
      Object.defineProperty(move, "preventDefault", {
        value: () => {
          movePreventions += 1;
          preventMove();
        },
      });
      await dispatch(mounted, move);
      expect(movePreventions).toBeGreaterThan(0);
      expect(mounted.moves).toHaveLength(1);
      expect(mounted.moves[0]?.angleDeg).toBeCloseTo(90, 8);

      await dispatch(mounted, pointerEvent("pointerup", pointerId, 0, -145));
      expect(mounted.ends.map((end) => end.reason)).toEqual(["release"]);
      expect(mounted.canvas.hasPointerCapture(pointerId)).toBeFalse();
      expect(mounted.controlPhysics.wheelContacts).toBe(2);
      expect(mounted.controlPhysics.wheelReleases).toBe(1);
    } finally {
      await unmount(mounted);
    }
  });

  test("Select captures mouse, touch and pen and never enters the arc runtime", async () => {
    const mounted = await mountSurface();
    try {
      for (const [index, pointerType] of ["mouse", "touch", "pen"].entries()) {
        const pointerId = 70 + index;
        await dispatch(
          mounted,
          pointerEvent("pointerdown", pointerId, 0, 0, { pointerType }),
        );
        expect(mounted.canvas.hasPointerCapture(pointerId)).toBeTrue();
        await dispatch(
          mounted,
          pointerEvent("pointerup", pointerId, 0, 0, { pointerType }),
        );
      }
      expect(mounted.starts).toHaveLength(0);
      expect(mounted.moves).toHaveLength(0);
      expect(mounted.selectStarts.map((start) => start.pointerType)).toEqual([
        "mouse",
        "touch",
        "pen",
      ]);
      expect(mounted.selectEnds.map((end) => end.reason)).toEqual([
        "release",
        "release",
        "release",
      ]);
      expect(mounted.controlPhysics.selectPresses).toBe(3);
      expect(mounted.controlPhysics.selectReleases).toBe(3);
    } finally {
      await unmount(mounted);
    }
  });

  test("Select cancel, lost capture and blur each return capture exactly once", async () => {
    const mounted = await mountSurface();
    try {
      await dispatch(mounted, pointerEvent("pointerdown", 80, 0, 0));
      await dispatch(mounted, pointerEvent("pointercancel", 80, 0, 0));
      await dispatch(mounted, pointerEvent("lostpointercapture", 80, 0, 0));

      await dispatch(mounted, pointerEvent("pointerdown", 81, 0, 0));
      await dispatch(mounted, pointerEvent("lostpointercapture", 81, 0, 0));

      await dispatch(mounted, pointerEvent("pointerdown", 82, 0, 0));
      window.dispatchEvent(new Event("blur"));

      expect(mounted.selectEnds.map((end) => end.reason)).toEqual([
        "cancel",
        "lost-capture",
        "cancel",
      ]);
      expect(mounted.canvas.hasPointerCapture(82)).toBeFalse();
    } finally {
      await unmount(mounted);
    }
  });

  test("Enter travel is scoped to the focused semantic application", async () => {
    const mounted = await mountSurface();
    const application = document.createElement("div");
    application.setAttribute("role", "application");
    const unrelated = document.createElement("button");
    document.body.append(application, unrelated);
    try {
      application.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      application.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          repeat: true,
        }),
      );
      expect(mounted.controlPhysics.selectPresses).toBe(1);
      application.dispatchEvent(
        new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
      );
      expect(mounted.controlPhysics.selectReleases).toBe(1);

      unrelated.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      expect(mounted.controlPhysics.selectPresses).toBe(1);

      application.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
      window.dispatchEvent(new Event("blur"));
      expect(mounted.controlPhysics.selectPresses).toBe(2);
      expect(mounted.controlPhysics.selectReleases).toBe(2);
    } finally {
      application.remove();
      unrelated.remove();
      await unmount(mounted);
    }
  });

  test("window blur cancels capture and leaves the next gesture usable", async () => {
    const mounted = await mountSurface();
    try {
      await dispatch(mounted, pointerEvent("pointerdown", 36, 80, 0));
      expect(mounted.canvas.hasPointerCapture(36)).toBeTrue();
      window.dispatchEvent(new Event("blur"));
      expect(mounted.ends.map((end) => end.reason)).toEqual(["cancel"]);
      expect(mounted.canvas.hasPointerCapture(36)).toBeFalse();

      await dispatch(
        mounted,
        pointerEvent("pointerdown", 37, 80, 0, { pointerType: "touch" }),
      );
      await dispatch(
        mounted,
        pointerEvent("pointermove", 37, 0, -80, { pointerType: "touch" }),
      );
      expect(mounted.starts.at(-1)?.pointerType).toBe("touch");
      expect(mounted.moves.at(-1)?.angleDeg).toBeCloseTo(90, 8);
    } finally {
      await unmount(mounted);
    }
  });

  test("a thrown start callback releases capture and leaves the next gesture usable", async () => {
    let startsToThrow = 1;
    const mounted = await mountSurface("front", {
      onArcStart: () => {
        if (startsToThrow > 0) {
          startsToThrow -= 1;
          throw new Error("planted start failure");
        }
      },
    });
    const pointerId = 41;
    try {
      await dispatchExpectingWindowError(
        mounted,
        pointerEvent("pointerdown", pointerId, 80, 0),
        "planted start failure",
      );
      expect(startsToThrow).toBe(0);
      expect(mounted.canvas.hasPointerCapture(pointerId)).toBeFalse();
      expect(mounted.ends.map((end) => end.reason)).toEqual(["cancel"]);

      await dispatch(mounted, pointerEvent("pointerdown", 42, 80, 0));
      await dispatch(mounted, pointerEvent("pointerup", 42, 0, -80));
      expect(mounted.starts).toHaveLength(2);
      expect(mounted.ends.map((end) => end.reason)).toEqual([
        "cancel",
        "release",
      ]);
    } finally {
      await unmount(mounted);
    }
  });

  test("a thrown move callback cancels listeners and capture before rethrowing", async () => {
    let movesToThrow = 1;
    const mounted = await mountSurface("front", {
      onArcMove: () => {
        if (movesToThrow > 0) {
          movesToThrow -= 1;
          throw new Error("planted move failure");
        }
      },
    });
    const pointerId = 43;
    try {
      await dispatch(mounted, pointerEvent("pointerdown", pointerId, 80, 0));
      await dispatchExpectingWindowError(
        mounted,
        pointerEvent("pointermove", pointerId, 0, -80),
        "planted move failure",
      );
      expect(movesToThrow).toBe(0);
      expect(mounted.canvas.hasPointerCapture(pointerId)).toBeFalse();
      expect(mounted.ends.map((end) => end.reason)).toEqual(["cancel"]);

      await dispatch(mounted, pointerEvent("pointerdown", 44, 80, 0));
      await dispatch(mounted, pointerEvent("pointermove", 44, 0, -80));
      await dispatch(mounted, pointerEvent("pointerup", 44, 0, -80));
      expect(mounted.moves).toHaveLength(2);
      expect(mounted.ends.map((end) => end.reason)).toEqual([
        "cancel",
        "release",
      ]);
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

  test("reconciler unmount returns an active Select press", async () => {
    const mounted = await mountSurface();
    const pointerId = 83;
    await dispatch(mounted, pointerEvent("pointerdown", pointerId, 0, 0));
    expect(mounted.canvas.hasPointerCapture(pointerId)).toBeTrue();
    await unmount(mounted);
    expect(mounted.selectEnds.map((end) => end.reason)).toEqual(["cancel"]);
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
