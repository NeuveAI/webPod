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
  CLICK_WHEEL_INPUT_RADII,
  ClickWheelInputSurface,
  type ClickWheelCardinalEnd,
  type ClickWheelCardinalPress,
  type ClickWheelCardinalStart,
  type ClickWheelArcEnd,
  type ClickWheelArcSample,
  type ClickWheelSelectEnd,
  type ClickWheelSelectStart,
} from "./click-wheel-input";
import { AxialSelectControl } from "./AxialSelectControl";
import { ControlPhysicsScope } from "./ControlPhysicsScope";
import {
  CONTROL_TRAVEL,
  ControlPhysicsController,
  type ControlPhysicsDependencies,
} from "./control-physics";
import {
  FRONT_DEVICE_ORIENTATION,
  REAR_DEVICE_ORIENTATION,
  THREE_QUARTER_DEVICE_ORIENTATION,
  deviceOrientationToRotation,
  type DeviceOrientation,
} from "./orientation";
import { DeviceCanvasOrientationContext } from "./DeviceCanvas";
import { DEFAULT_DEVICE_ENVELOPE } from "./device-envelope";
import { DEVICE_LAYOUT } from "./layout";
import { DEFAULT_DEVICE_FORM, type DeviceFormParams } from "./form";
import {
  DEFAULT_FRONT_ASSEMBLY_DEPTHS,
  resolveFrontAssemblyDepths,
  frontShellOffsetAt,
} from "./front-surface";

const WIDTH = DEVICE_LAYOUT.body.width;
const HEIGHT = DEVICE_LAYOUT.body.height;
const CLICK_WHEEL_INNER_TEST_RADIUS = CLICK_WHEEL_INPUT_RADII.inner + 0.001;
const CLICK_WHEEL_OUTER_TEST_RADIUS = CLICK_WHEEL_INPUT_RADII.outer - 0.001;

GlobalRegistrator.register();
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { value: true });
extend({
  Group: THREE.Group,
  Mesh: THREE.Mesh,
  MeshBasicMaterial: THREE.MeshBasicMaterial,
  MeshPhysicalMaterial: THREE.MeshPhysicalMaterial,
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
  readonly cardinalPresses: Array<ClickWheelCardinalPress>;
  readonly cardinalStarts: Array<ClickWheelCardinalStart>;
  readonly cardinalEnds: Array<ClickWheelCardinalEnd>;
  readonly restoreAnimationFrame: () => void;
  readonly controlPhysics: RecordingControlPhysics;
  readonly selectControl: THREE.Mesh;
  readonly selectMaterial: THREE.MeshPhysicalMaterial;
  readonly rerender: () => Promise<void>;
};

class RecordingControlPhysics extends ControlPhysicsController {
  wheelPresses = 0;
  readonly wheelPressAngles: Array<number> = [];
  readonly wheelMoveAngles: Array<number> = [];
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

  override pressWheel(contactAngleDeg: number): void {
    this.wheelPresses += 1;
    this.wheelPressAngles.push(contactAngleDeg);
    super.pressWheel(contactAngleDeg);
  }

  override moveWheel(contactAngleDeg: number): void {
    this.wheelMoveAngles.push(contactAngleDeg);
    super.moveWheel(contactAngleDeg);
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
  orientation: DeviceOrientation = face === "back"
    ? REAR_DEVICE_ORIENTATION
    : FRONT_DEVICE_ORIENTATION,
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
  const cardinalPresses: Array<ClickWheelCardinalPress> = [];
  const cardinalStarts: Array<ClickWheelCardinalStart> = [];
  const cardinalEnds: Array<ClickWheelCardinalEnd> = [];
  const mountedStore: { current: RootStore | null } = { current: null };
  const controlPhysics = new RecordingControlPhysics();
  const selectGeometry = new THREE.CircleGeometry(
    DEVICE_LAYOUT.wheel.selectR,
    128,
  );
  const restoreAnimationFrame = installAnimationFrameStub();
  let revision = 0;
  const renderSurface = (): void => {
    mountedStore.current = root.render(
      <ControlPhysicsScope controller={controlPhysics}>
        <DeviceCanvasOrientationContext.Provider
          value={{
            orientation,
            visibleFace: face,
            frontInteractive: face === "front",
            form,
          }}
        >
          <group>
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
              onCardinalPress={(press) => cardinalPresses.push(press)}
              onCardinalStart={(start) => cardinalStarts.push(start)}
              onCardinalEnd={(end) => cardinalEnds.push(end)}
            />
            <AxialSelectControl
              geometry={selectGeometry}
              position={[2.5, -4.25, 3.75]}
            >
              <meshPhysicalMaterial
                name="select-integration-plastic"
                color="#F6F2E9"
                metalness={0}
                roughness={0.72}
              />
            </AxialSelectControl>
          </group>
          <group name={`select-rerender-revision-${String(revision)}`} />
        </DeviceCanvasOrientationContext.Provider>
      </ControlPhysicsScope>,
    );
  };
  await act(async () => {
    renderSurface();
    await Promise.resolve();
  });
  const store = mountedStore.current;
  if (store === null) throw new Error("R3F surface did not mount");
  store.getState().camera.updateMatrixWorld(true);
  store.getState().scene.updateMatrixWorld(true);
  const selectControl = store
    .getState()
    .scene.getObjectByName("device-select");
  if (!(selectControl instanceof THREE.Mesh)) {
    throw new Error("axial Select control did not mount");
  }
  const selectMaterial = selectControl.material;
  if (!(selectMaterial instanceof THREE.MeshPhysicalMaterial)) {
    throw new Error("Select integration material is not physical plastic");
  }
  return {
    canvas,
    root,
    store,
    starts,
    moves,
    ends,
    selectStarts,
    selectEnds,
    cardinalPresses,
    cardinalStarts,
    cardinalEnds,
    restoreAnimationFrame,
    controlPhysics,
    selectControl,
    selectMaterial,
    rerender: async () => {
      revision += 1;
      await act(async () => {
        renderSurface();
        await Promise.resolve();
      });
    },
  };
}

function wheelViewportPoint(localX: number, localY: number) {
  return {
    x: WIDTH / 2 + DEVICE_LAYOUT.wheel.centerX + localX - DEFAULT_DEVICE_ENVELOPE.center[0],
    y: HEIGHT / 2 - DEVICE_LAYOUT.wheel.centerY - localY + DEFAULT_DEVICE_ENVELOPE.center[1],
  };
}

function wheelLocalPoint(angleDeg: number, radius: number) {
  const radians = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(radians) * radius, y: -Math.sin(radians) * radius };
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

/** Projects an authored wheel-local coordinate through the mounted pose. */
function orientedPointerEvent(
  mounted: MountedSurface,
  type: string,
  pointerId: number,
  localX: number,
  localY: number,
  init: { readonly pointerType?: string; readonly button?: number } = {},
): PointerEvent {
  const input = mounted.store.getState().scene.getObjectByName("click-wheel-input");
  if (!(input instanceof THREE.Mesh)) throw new Error("click-wheel input did not mount");
  mounted.store.getState().scene.updateMatrixWorld(true);
  input.updateWorldMatrix(true, false);
  const camera = mounted.store.getState().camera;
  camera.updateMatrixWorld(true);
  const z = DEFAULT_FRONT_ASSEMBLY_DEPTHS.wheelSurfaceBaseZ + frontShellOffsetAt(
    DEVICE_LAYOUT.wheel.centerX + localX, DEVICE_LAYOUT.wheel.centerY + localY,
  ) - DEFAULT_FRONT_ASSEMBLY_DEPTHS.clickWheelInputZ;
  const projected = input.localToWorld(new THREE.Vector3(localX, localY, z)).project(camera);
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: init.button ?? 0,
    isPrimary: true,
    pointerId,
    pointerType: init.pointerType ?? "mouse",
  });
  Object.defineProperties(event, {
    offsetX: { configurable: true, value: ((projected.x + 1) / 2) * WIDTH },
    offsetY: { configurable: true, value: ((1 - projected.y) / 2) * HEIGHT },
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
  test("mounted wheel and Select ray hits publish pointer intent and clean up", async () => {
    const mounted = await mountSurface();
    expect(mounted.canvas.dataset["wpCursorControl"]).toBeUndefined();
    try {
      await dispatch(mounted, pointerEvent("pointermove", 90, 80, 0));
      expect(mounted.canvas.dataset["wpCursorControl"]).toBe("true");

      await dispatch(mounted, pointerEvent("pointermove", 90, 0, 0));
      expect(mounted.canvas.dataset["wpCursorControl"]).toBe("true");
    } finally {
      await unmount(mounted);
    }
    expect(mounted.canvas.dataset["wpCursorControl"]).toBeUndefined();
  });

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

  test("routes captured wheel gestures without cancelling delegated native events", async () => {
    const mounted = await mountSurface();
    const pointerId = 31;
    try {
      const down = pointerEvent("pointerdown", pointerId, 80, 0);
      let downPreventions = 0;
      Object.defineProperty(down, "preventDefault", {
        value: () => {
          downPreventions += 1;
        },
      });
      await dispatch(mounted, down);
      expect(downPreventions).toBe(0);
      expect(mounted.canvas.hasPointerCapture(pointerId)).toBeTrue();
      expect(mounted.starts).toHaveLength(0);

      // Radius 145 is outside the 115px annulus. Fiber's captured event must
      // still reach production, which recomputes the angle from the live ray.
      const move = pointerEvent("pointermove", pointerId, 0, -145);
      let movePreventions = 0;
      Object.defineProperty(move, "preventDefault", {
        value: () => {
          movePreventions += 1;
        },
      });
      await dispatch(mounted, move);
      expect(movePreventions).toBe(0);
      expect(mounted.starts).toHaveLength(1);
      expect(mounted.starts[0]?.angleDeg).toBeCloseTo(0, 8);
      expect(mounted.moves).toHaveLength(1);
      expect(mounted.moves[0]?.angleDeg).toBeCloseTo(90, 8);

      const up = pointerEvent("pointerup", pointerId, 0, -145);
      let upPreventions = 0;
      Object.defineProperty(up, "preventDefault", {
        value: () => {
          upPreventions += 1;
        },
      });
      await dispatch(mounted, up);
      expect(upPreventions).toBe(0);
      expect(mounted.ends.map((end) => end.reason)).toEqual(["release"]);
      expect(mounted.canvas.hasPointerCapture(pointerId)).toBeFalse();
      // Pointer movement reaches both the navigation runtime and the rigid
      // wheel's tilt axis. It never creates a second semantic press/detent.
      expect(mounted.controlPhysics.wheelPresses).toBe(1);
      expect(mounted.controlPhysics.wheelPressAngles[0]).toBeCloseTo(0, 8);
      expect(mounted.controlPhysics.wheelMoveAngles).toHaveLength(1);
      expect(mounted.controlPhysics.wheelMoveAngles[0]).toBeCloseTo(90, 8);
      expect(mounted.controlPhysics.wheelReleases).toBe(1);
    } finally {
      await unmount(mounted);
    }
  });

  test("release-qualified cardinal sectors map mouse, touch and pen exactly once", async () => {
    const mounted = await mountSurface();
    const band =
      (DEVICE_LAYOUT.wheel.labelBandInnerR +
        DEVICE_LAYOUT.wheel.labelBandOuterR) /
      2;
    const sectors = [
      { button: "menu", x: 0, y: band },
      { button: "next", x: band, y: 0 },
      { button: "play-pause", x: 0, y: -band },
      { button: "previous", x: -band, y: 0 },
    ] as const;
    try {
      let pointerId = 200;
      for (const pointerType of ["mouse", "touch", "pen"] as const) {
        for (const sector of sectors) {
          await dispatch(
            mounted,
            pointerEvent("pointerdown", pointerId, sector.x, sector.y, {
              pointerType,
            }),
          );
          expect(mounted.cardinalPresses).toHaveLength(pointerId - 200);
          await dispatch(
            mounted,
            pointerEvent("pointerup", pointerId, sector.x, sector.y, {
              pointerType,
            }),
          );
          pointerId += 1;
        }
      }

      expect(mounted.cardinalPresses.map(({ button }) => button)).toEqual([
        "menu",
        "next",
        "play-pause",
        "previous",
        "menu",
        "next",
        "play-pause",
        "previous",
        "menu",
        "next",
        "play-pause",
        "previous",
      ]);
      expect(mounted.cardinalPresses.map(({ pointerType }) => pointerType))
        .toEqual([
          "mouse", "mouse", "mouse", "mouse",
          "touch", "touch", "touch", "touch",
          "pen", "pen", "pen", "pen",
        ]);
      expect(mounted.cardinalStarts).toHaveLength(12);
      expect(mounted.cardinalEnds).toHaveLength(12);
      expect(mounted.cardinalEnds.every(({ accepted }) => accepted)).toBeTrue();
      expect(mounted.cardinalEnds.every(({ reason }) => reason === "release"))
        .toBeTrue();
      expect(mounted.starts).toHaveLength(0);
      expect(mounted.moves).toHaveLength(0);

      // A raw DOM click is not an input seam and cannot double-fire release.
      mounted.canvas.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      expect(mounted.cardinalPresses).toHaveLength(12);
    } finally {
      await unmount(mounted);
    }
  });

  test("diagonal edges and radial extremes remain tappable without entering rotation", async () => {
    const mounted = await mountSurface();
    const samples = [
      { angle: 44.999, radius: CLICK_WHEEL_INNER_TEST_RADIUS, button: "next", pointerType: "mouse" },
      { angle: 45, radius: CLICK_WHEEL_OUTER_TEST_RADIUS, button: "play-pause", pointerType: "touch" },
      { angle: 134.999, radius: 70, button: "play-pause", pointerType: "pen" },
      { angle: 135, radius: CLICK_WHEEL_INNER_TEST_RADIUS, button: "previous", pointerType: "mouse" },
      { angle: 224.999, radius: CLICK_WHEEL_OUTER_TEST_RADIUS, button: "previous", pointerType: "touch" },
      { angle: 225, radius: 70, button: "menu", pointerType: "pen" },
      { angle: 314.999, radius: CLICK_WHEEL_INNER_TEST_RADIUS, button: "menu", pointerType: "mouse" },
      { angle: 315, radius: CLICK_WHEEL_OUTER_TEST_RADIUS, button: "next", pointerType: "touch" },
    ] as const;
    try {
      for (const [index, sample] of samples.entries()) {
        const point = wheelLocalPoint(sample.angle, sample.radius);
        const pointerId = 260 + index;
        await dispatch(mounted, pointerEvent("pointerdown", pointerId, point.x, point.y, { pointerType: sample.pointerType }));
        await dispatch(mounted, pointerEvent("pointerup", pointerId, point.x, point.y, { pointerType: sample.pointerType }));
      }
      expect(mounted.cardinalPresses.map(({ button }) => button)).toEqual(samples.map(({ button }) => button));
      expect(mounted.starts).toHaveLength(0);
      expect(mounted.moves).toHaveLength(0);
      expect(mounted.ends).toHaveLength(0);
    } finally {
      await unmount(mounted);
    }
  });

  test("oblique model-space projection preserves full sectors, diagonal ownership, and movement takeover", async () => {
    const mounted = await mountSurface(
      "front",
      {},
      DEFAULT_DEVICE_FORM,
      THREE_QUARTER_DEVICE_ORIENTATION,
    );
    const input = mounted.store.getState().scene.getObjectByName("click-wheel-input");
    if (!(input instanceof THREE.Mesh)) throw new Error("Input missing");
    input.updateWorldMatrix(true, false);
    const expectedMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
      ...deviceOrientationToRotation(THREE_QUARTER_DEVICE_ORIENTATION),
    )).multiply(new THREE.Matrix4().makeTranslation(...DEFAULT_DEVICE_ENVELOPE.center.map(v => -v) as [number, number, number]))
      .multiply(new THREE.Matrix4().makeTranslation(DEVICE_LAYOUT.wheel.centerX, DEVICE_LAYOUT.wheel.centerY,
        DEFAULT_FRONT_ASSEMBLY_DEPTHS.clickWheelInputZ));
    for (let i = 0; i < 16; i++) expect(input.matrixWorld.elements[i]).toBeCloseTo(expectedMatrix.elements[i] ?? 0, 10);
    const centers = [
      { angle: 270, button: "menu" },
      { angle: 0, button: "next" },
      { angle: 90, button: "play-pause" },
      { angle: 180, button: "previous" },
    ] as const;
    const edges = [
      { angle: 44.999, radius: CLICK_WHEEL_INNER_TEST_RADIUS, button: "next" },
      { angle: 45, radius: CLICK_WHEEL_OUTER_TEST_RADIUS, button: "play-pause" },
      { angle: 134.999, radius: CLICK_WHEEL_OUTER_TEST_RADIUS, button: "play-pause" },
      { angle: 135, radius: CLICK_WHEEL_INNER_TEST_RADIUS, button: "previous" },
      { angle: 224.999, radius: CLICK_WHEEL_INNER_TEST_RADIUS, button: "previous" },
      { angle: 225, radius: CLICK_WHEEL_OUTER_TEST_RADIUS, button: "menu" },
      { angle: 314.999, radius: CLICK_WHEEL_OUTER_TEST_RADIUS, button: "menu" },
      { angle: 315, radius: CLICK_WHEEL_INNER_TEST_RADIUS, button: "next" },
    ] as const;
    try {
      let pointerId = 1_000;
      const expected: Array<ClickWheelCardinalPress["button"]> = [];
      for (const pointerType of ["mouse", "touch", "pen"] as const) {
        for (const sample of centers) {
          const point = wheelLocalPoint(sample.angle, 70);
          await dispatch(mounted, orientedPointerEvent(mounted, "pointerdown", pointerId, point.x, point.y, { pointerType }));
          await dispatch(mounted, orientedPointerEvent(mounted, "pointerup", pointerId, point.x, point.y, { pointerType }));
          expected.push(sample.button);
          pointerId += 1;
        }
      }
      for (const [index, sample] of edges.entries()) {
        const point = wheelLocalPoint(sample.angle, sample.radius);
        const pointerType = (["mouse", "touch", "pen"] as const)[index % 3];
        await dispatch(mounted, orientedPointerEvent(mounted, "pointerdown", pointerId, point.x, point.y, { pointerType }));
        await dispatch(mounted, orientedPointerEvent(mounted, "pointerup", pointerId, point.x, point.y, { pointerType }));
        expected.push(sample.button);
        pointerId += 1;
      }
      expect(mounted.cardinalPresses.map(({ button }) => button)).toEqual(expected);
      expect(mounted.cardinalPresses).toHaveLength(20);
      expect(mounted.starts).toHaveLength(0);

      const rotationStart = wheelLocalPoint(0, 70);
      const rotationMove = wheelLocalPoint(20, 70);
      await dispatch(mounted, orientedPointerEvent(mounted, "pointerdown", pointerId, rotationStart.x, rotationStart.y, { pointerType: "touch" }));
      await dispatch(mounted, orientedPointerEvent(mounted, "pointermove", pointerId, rotationMove.x, rotationMove.y, { pointerType: "touch" }));
      await dispatch(mounted, orientedPointerEvent(mounted, "pointerup", pointerId, rotationMove.x, rotationMove.y, { pointerType: "touch" }));
      expect(mounted.cardinalPresses).toHaveLength(20);
      expect(mounted.starts).toHaveLength(1);
      expect(mounted.moves).toHaveLength(1);
      expect(mounted.ends).toHaveLength(1);
      expect(mounted.starts[0]?.angleDeg).toBeCloseTo(0, 6);
      expect(mounted.moves[0]?.angleDeg).toBeCloseTo(20, 6);
      expect(mounted.cardinalEnds.at(-1)).toMatchObject({ accepted: false });
    } finally {
      await unmount(mounted);
    }
  });

  test("movement takeover cancels the cardinal candidate before rotation starts", async () => {
    const mounted = await mountSurface();
    try {
      await dispatch(mounted, pointerEvent("pointerdown", 280, 70, 0));
      await dispatch(mounted, pointerEvent("pointermove", 280, 80, 0));
      await dispatch(mounted, pointerEvent("pointerup", 280, 80, 0));
      expect(mounted.cardinalPresses.map(({ pointerId }) => pointerId)).toEqual([280]);
      expect(mounted.starts).toHaveLength(0);

      await dispatch(mounted, pointerEvent("pointerdown", 281, 70, 0, { pointerType: "touch" }));
      await dispatch(mounted, pointerEvent("pointermove", 281, 80.01, 0, { pointerType: "touch" }));
      await dispatch(mounted, pointerEvent("pointerup", 281, 80.01, 0, { pointerType: "touch" }));
      expect(mounted.cardinalPresses.map(({ pointerId }) => pointerId)).toEqual([280]);
      expect(mounted.starts.map(({ pointerId }) => pointerId)).toEqual([281]);
      expect(mounted.moves.map(({ pointerId }) => pointerId)).toEqual([281]);
      expect(mounted.ends.map(({ pointerId }) => pointerId)).toEqual([281]);

      const before = wheelLocalPoint(44.99, 70);
      const after = wheelLocalPoint(45.01, 70);
      await dispatch(mounted, pointerEvent("pointerdown", 282, before.x, before.y, { pointerType: "pen" }));
      await dispatch(mounted, pointerEvent("pointermove", 282, after.x, after.y, { pointerType: "pen" }));
      await dispatch(mounted, pointerEvent("pointerup", 282, after.x, after.y, { pointerType: "pen" }));
      expect(mounted.cardinalPresses.map(({ pointerId }) => pointerId)).toEqual([280]);
      expect(mounted.starts.map(({ pointerId }) => pointerId)).toEqual([281, 282]);
      expect(mounted.moves.map(({ pointerId }) => pointerId)).toEqual([281, 282]);
      expect(mounted.ends.map(({ pointerId }) => pointerId)).toEqual([281, 282]);
      expect(mounted.cardinalEnds.filter(({ pointerId }) => pointerId !== 280).every(({ accepted }) => !accepted)).toBeTrue();
    } finally {
      await unmount(mounted);
    }
  });

  test("cancel, lost capture, blur and drag-off reject cardinal presses", async () => {
    const mounted = await mountSurface();
    const band =
      (DEVICE_LAYOUT.wheel.labelBandInnerR +
        DEVICE_LAYOUT.wheel.labelBandOuterR) /
      2;
    try {
      await dispatch(mounted, pointerEvent("pointerdown", 220, 0, band));
      await dispatch(mounted, pointerEvent("pointercancel", 220, 0, band));

      await dispatch(mounted, pointerEvent("pointerdown", 221, band, 0));
      await dispatch(
        mounted,
        pointerEvent("lostpointercapture", 221, band, 0),
      );

      await dispatch(mounted, pointerEvent("pointerdown", 222, 0, -band));
      window.dispatchEvent(new Event("blur"));

      await dispatch(mounted, pointerEvent("pointerdown", 223, -band, 0));
      await dispatch(mounted, pointerEvent("pointermove", 223, 0, band));
      await dispatch(mounted, pointerEvent("pointerup", 223, 0, band));

      await dispatch(mounted, pointerEvent("pointerdown", 224, 0, band));
      await dispatch(mounted, pointerEvent("pointermove", 224, 0, band - 12));
      await dispatch(mounted, pointerEvent("pointerup", 224, 0, band - 12));

      expect(mounted.cardinalPresses).toHaveLength(0);
      expect(mounted.cardinalStarts).toHaveLength(5);
      expect(mounted.cardinalEnds).toHaveLength(5);
      expect(mounted.cardinalEnds.map(({ reason }) => reason)).toEqual([
        "cancel",
        "lost-capture",
        "cancel",
        "release",
        "release",
      ]);
      expect(mounted.cardinalEnds.every(({ accepted }) => !accepted)).toBeTrue();
    } finally {
      await unmount(mounted);
    }
  });

  test("Select captures mouse, touch and pen and never enters the arc runtime", async () => {
    const mounted = await mountSurface();
    try {
      for (const [index, pointerType] of ["mouse", "touch", "pen"].entries()) {
        const pointerId = 70 + index;
        const down = pointerEvent("pointerdown", pointerId, 0, 0, {
          pointerType,
        });
        let downPreventions = 0;
        Object.defineProperty(down, "preventDefault", {
          value: () => {
            downPreventions += 1;
          },
        });
        await dispatch(
          mounted,
          down,
        );
        expect(downPreventions).toBe(0);
        expect(mounted.canvas.hasPointerCapture(pointerId)).toBeTrue();
        const move = pointerEvent("pointermove", pointerId, 12, 0, {
          pointerType,
        });
        let movePreventions = 0;
        Object.defineProperty(move, "preventDefault", {
          value: () => {
            movePreventions += 1;
          },
        });
        await dispatch(mounted, move);
        expect(movePreventions).toBe(0);
        const up = pointerEvent("pointerup", pointerId, 0, 0, {
          pointerType,
        });
        let upPreventions = 0;
        Object.defineProperty(up, "preventDefault", {
          value: () => {
            upPreventions += 1;
          },
        });
        await dispatch(
          mounted,
          up,
        );
        expect(upPreventions).toBe(0);
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

  test("the mounted r=37 seam belongs only to Select while just outside belongs to the annulus", async () => {
    const mounted = await mountSurface();
    try {
      for (const [index, radius] of [36.999, 37] .entries()) {
        const pointerId = 1_100 + index;
        await dispatch(mounted, pointerEvent("pointerdown", pointerId, radius, 0, { pointerType: "touch" }));
        await dispatch(mounted, pointerEvent("pointerup", pointerId, radius, 0, { pointerType: "touch" }));
      }
      expect(mounted.selectStarts.map(({ pointerId }) => pointerId)).toEqual([1_100, 1_101]);
      expect(mounted.selectEnds.map(({ pointerId }) => pointerId)).toEqual([1_100, 1_101]);
      expect(mounted.cardinalPresses).toHaveLength(0);
      expect(mounted.starts).toHaveLength(0);

      await dispatch(mounted, pointerEvent("pointerdown", 1_102, 37.001, 0, { pointerType: "touch" }));
      await dispatch(mounted, pointerEvent("pointerup", 1_102, 37.001, 0, { pointerType: "touch" }));
      expect(mounted.cardinalPresses).toEqual([
        expect.objectContaining({ pointerId: 1_102, button: "next" }),
      ]);
      expect(mounted.selectStarts).toHaveLength(2);
      expect(mounted.starts).toHaveLength(0);
      expect(mounted.moves).toHaveLength(0);
      expect(mounted.ends).toHaveLength(0);
    } finally {
      await unmount(mounted);
    }
  });

  test("the production Select target holds the bound plastic at its axial travel until release", async () => {
    const mounted = await mountSurface();
    const rest = mounted.selectControl.position.clone();
    const materialSnapshot = mounted.selectMaterial.toJSON();
    const pointerId = 74;
    try {
      await dispatch(mounted, pointerEvent("pointerdown", pointerId, 0, 0));
      expect(mounted.controlPhysics.selectPresses).toBe(1);
      expect(mounted.controlPhysics.wheelPresses).toBe(0);
      expect(mounted.selectControl.position.x).toBe(rest.x);
      expect(mounted.selectControl.position.y).toBe(rest.y);
      expect(mounted.selectControl.position.z).toBe(
        rest.z - CONTROL_TRAVEL.selectModel,
      );
      expect(mounted.selectControl.material).toBe(mounted.selectMaterial);
      expect(mounted.selectMaterial.toJSON()).toEqual(materialSnapshot);

      await mounted.rerender();
      expect(mounted.selectControl.position.x).toBe(rest.x);
      expect(mounted.selectControl.position.y).toBe(rest.y);
      expect(mounted.selectControl.position.z).toBe(
        rest.z - CONTROL_TRAVEL.selectModel,
      );
      expect(mounted.selectControl.material).toBe(mounted.selectMaterial);

      await dispatch(mounted, pointerEvent("pointermove", pointerId, 12, 0));
      expect(mounted.selectControl.position.z).toBe(
        rest.z - CONTROL_TRAVEL.selectModel,
      );
      expect(mounted.controlPhysics.wheelMoveAngles).toHaveLength(0);

      await dispatch(mounted, pointerEvent("pointerup", pointerId, 12, 0));
      expect(mounted.controlPhysics.selectReleases).toBe(1);
      mounted.controlPhysics.setReducedMotion(true);
      expect(mounted.selectControl.position.toArray()).toEqual(rest.toArray());
      expect(mounted.selectControl.material).toBe(mounted.selectMaterial);
      expect(mounted.selectMaterial.toJSON()).toEqual(materialSnapshot);
    } finally {
      await unmount(mounted);
    }
  });

  test("Select cancel, lost capture and blur each return capture exactly once", async () => {
    const mounted = await mountSurface();
    const rest = mounted.selectControl.position.clone();
    const materialSnapshot = mounted.selectMaterial.toJSON();
    try {
      await dispatch(mounted, pointerEvent("pointerdown", 80, 0, 0));
      expect(mounted.selectControl.position.z).toBe(
        rest.z - CONTROL_TRAVEL.selectModel,
      );
      await dispatch(mounted, pointerEvent("pointercancel", 80, 0, 0));
      mounted.controlPhysics.setReducedMotion(true);
      expect(mounted.selectControl.position.toArray()).toEqual(rest.toArray());
      await dispatch(mounted, pointerEvent("lostpointercapture", 80, 0, 0));
      expect(mounted.selectControl.position.toArray()).toEqual(rest.toArray());

      await dispatch(mounted, pointerEvent("pointerdown", 81, 0, 0));
      expect(mounted.selectControl.position.z).toBe(
        rest.z - CONTROL_TRAVEL.selectModel,
      );
      await dispatch(mounted, pointerEvent("lostpointercapture", 81, 0, 0));
      expect(mounted.selectControl.position.toArray()).toEqual(rest.toArray());

      await dispatch(mounted, pointerEvent("pointerdown", 82, 0, 0));
      expect(mounted.selectControl.position.z).toBe(
        rest.z - CONTROL_TRAVEL.selectModel,
      );
      window.dispatchEvent(new Event("blur"));
      expect(mounted.selectControl.position.toArray()).toEqual(rest.toArray());

      expect(mounted.selectEnds.map((end) => end.reason)).toEqual([
        "cancel",
        "lost-capture",
        "cancel",
      ]);
      expect(mounted.canvas.hasPointerCapture(82)).toBeFalse();
      expect(mounted.selectControl.material).toBe(mounted.selectMaterial);
      expect(mounted.selectMaterial.toJSON()).toEqual(materialSnapshot);
    } finally {
      await unmount(mounted);
    }
  });

  test("Enter travel is scoped to the focused semantic application", async () => {
    const mounted = await mountSurface();
    const rest = mounted.selectControl.position.clone();
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
      expect(mounted.selectControl.position.z).toBe(
        rest.z - CONTROL_TRAVEL.selectModel,
      );
      application.dispatchEvent(
        new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
      );
      expect(mounted.controlPhysics.selectReleases).toBe(1);
      mounted.controlPhysics.setReducedMotion(true);
      expect(mounted.selectControl.position.toArray()).toEqual(rest.toArray());

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
      expect(mounted.selectControl.position.toArray()).toEqual(rest.toArray());
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
      expect(mounted.ends).toHaveLength(0);
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
      await dispatch(mounted, pointerEvent("pointerdown", pointerId, 80, 0));
      await dispatchExpectingWindowError(
        mounted,
        pointerEvent("pointermove", pointerId, 0, -80),
        "planted start failure",
      );
      expect(startsToThrow).toBe(0);
      expect(mounted.canvas.hasPointerCapture(pointerId)).toBeFalse();
      expect(mounted.ends.map((end) => end.reason)).toEqual(["cancel"]);

      await dispatch(mounted, pointerEvent("pointerdown", 42, 80, 0));
      await dispatch(mounted, pointerEvent("pointermove", 42, 0, -80));
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
      expect(mounted.ends).toHaveLength(0);
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
      expect(mounted.ends).toHaveLength(0);
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
    expect(mounted.ends).toHaveLength(0);
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
