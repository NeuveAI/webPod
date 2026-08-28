/**
 * The device ↔ composite boundary (D-011).
 *
 * ⚑ This is the one part of `@webpod/device` another lane builds against, so
 * it is specified here rather than left implicit in a component's props.
 *
 * **What W6 needs and why.** Under D-030 the composite path is
 * `canvas.getElementTransform(element, screenSpaceTransform)` →
 * `element.style.transform`, recomputed whenever the device moves. So W6 needs
 * three things and nothing else: the quad's **current transform**, a **signal
 * that it changed**, and a **material slot** to install its
 * `HTMLTexture`-backed material into. Everything else about the device — how
 * the body is lit, what the wheel is made of — is W4's business and is
 * deliberately not on this surface.
 *
 * ⚑ **D-054: a stale transform is not representable here, rather than
 * forbidden by a comment.** Three choices carry that:
 *
 * 1. **The handle does not expose the `Mesh`.** Handing out the `Object3D` is
 *    the obvious convenience and it is exactly the slot a stale value fits in,
 *    because `matrixWorld` is only current after the renderer has updated it —
 *    a consumer reading `mesh.matrixWorld` between frames gets last frame's
 *    answer with no error. There is no field to read it from. Every method
 *    calls `updateWorldMatrix(true, false)` first, so what comes back is
 *    always computed now.
 * 2. **The change signal carries the value.** `onTransformChange` delivers a
 *    {@link ScreenTransform}, not the handle. If it delivered the handle the
 *    listener would have to go and fetch one, and "call this after the device
 *    moves" would be back as documentation instead of structure.
 * 3. **The viewport projection is done here.** W6 needs a *screen-space*
 *    transform. Handing out world space only would make W6 reimplement the
 *    projection, where the y-flip and the device pixel ratio are two silent
 *    ways to be wrong. The handle is constructed inside the canvas, so it
 *    projects against the live camera and viewport itself.
 *
 * **Why `onBeforeRender` and not `useFrame`.** §14.1 makes an untouched device
 * produce **zero** rAF callbacks. A polling `useFrame` would violate that on
 * its own, before anything moved. `onBeforeRender` is called by three.js once
 * per *rendered* frame — and under `frameloop="demand"` frames are only
 * rendered when something asked for one. Idle costs exactly nothing, and a
 * moving device notifies on every frame it actually moved in. The listener
 * fires only when the matrix differs from the last one reported, so a render
 * triggered by something else (a texture upload, say) does not produce a
 * spurious geometry recompute downstream.
 *
 * **The material slot.** `setMaterial(null)` restores the §12.3 default so the
 * device renders standalone — the spike route depends on that, and so does any
 * tier where the composite is not mounted.
 */
import type { Camera, Material, Mesh, Object3D } from "three";
import { Matrix4, Vector3 } from "three";

/** A point in the canvas's CSS pixel space: origin top-left, +y **down**. */
export type ViewportPoint = { readonly x: number; readonly y: number };

/** The quad's four corners, in the order a texture's UVs run. */
export type ScreenCorners<T> = {
  readonly topLeft: T;
  readonly topRight: T;
  readonly bottomRight: T;
  readonly bottomLeft: T;
};

/**
 * Everything about where the quad is, computed at the moment it is handed out.
 *
 * ⚑ Do not cache one of these. It is a reading, not a handle: it is correct for
 * the frame it was produced in and says nothing about any later one. That is
 * why {@link ScreenMeshHandle.onTransformChange} exists.
 */
export type ScreenTransform = {
  /** The quad's world matrix. */
  readonly worldMatrix: Matrix4;
  /** The quad's corners in world space. */
  readonly world: ScreenCorners<Vector3>;
  /** The same corners in the canvas's CSS pixel space. */
  readonly viewport: {
    readonly corners: ScreenCorners<ViewportPoint>;
    readonly width: number;
    readonly height: number;
  };
};

export type ScreenMeshHandle = {
  /**
   * §7.4's authoring grid: **320 × 240**, composited by a single
   * `transform: scale(0.85)`. This is the coordinate system W6's DOM element
   * is laid out in.
   */
  readonly panel: {
    readonly width: number;
    readonly height: number;
    readonly scale: number;
  };
  /**
   * The quad itself, in body px — §7.3's "Screen active" row, **272 × 204**.
   *
   * ⚑ Both are on the handle rather than one plus a note, because confusing
   * them is a factor-of-0.85 error in the composited transform that produces a
   * panel which is nearly right.
   */
  readonly size: { readonly width: number; readonly height: number };
  /** Read the quad's position. Always computed now; never cached. */
  readTransform(): ScreenTransform;
  /**
   * Subscribe to transform changes. Fires during `onBeforeRender`, only on
   * frames where the transform actually differs, and is handed the new value.
   * Returns an unsubscriber.
   */
  onTransformChange(listener: (transform: ScreenTransform) => void): () => void;
  /**
   * Install a material into the slot. `null` restores the §12.3 default
   * (`MeshBasicMaterial`, `toneMapped: false`).
   *
   * ⚑ The handle does **not** dispose what it replaces or what it is given.
   * Whoever created a material owns its lifetime; a slot that disposed its
   * occupant would free a texture W6 still holds.
   */
  setMaterial(material: Material | null): void;
  /**
   * Ask for a frame. The consumer calls this after changing its texture, since
   * under `frameloop="demand"` nothing else will.
   */
  invalidate(): void;
};

/** Emitted by `<Device>` once the quad exists. */
export type ScreenMeshReady = (handle: ScreenMeshHandle) => void;

type HandleDeps = {
  readonly mesh: Mesh;
  readonly panel: {
    readonly width: number;
    readonly height: number;
    readonly scale: number;
  };
  readonly size: { readonly width: number; readonly height: number };
  readonly defaultMaterial: Material;
  readonly invalidate: () => void;
  /**
   * The live camera and canvas size.
   *
   * A getter rather than a value: r3f replaces the camera on some prop changes
   * and the viewport changes on every resize, so capturing either by value
   * would reintroduce exactly the staleness this module removes.
   */
  readonly view: () => { camera: Camera; width: number; height: number };
};

type HandleState = {
  deps: HandleDeps;
  readonly listeners: Set<(transform: ScreenTransform) => void>;
  readonly lastReported: Matrix4;
  everReported: boolean;
  readonly handle: ScreenMeshHandle;
};

const handlesByMesh = new WeakMap<Mesh, HandleState>();

/**
 * Wire a mesh up as a {@link ScreenMeshHandle}.
 *
 * Called by `<Device>`; exported because the boundary is the contract and a
 * contract that can only be produced by a React component cannot be tested
 * without one.
 */
export function createScreenMeshHandle(deps: HandleDeps): ScreenMeshHandle {
  const existing = handlesByMesh.get(deps.mesh);
  if (existing !== undefined) {
    existing.deps = deps;
    return existing.handle;
  }

  const { mesh, panel, size } = deps;

  const listeners = new Set<(transform: ScreenTransform) => void>();
  const lastReported = new Matrix4();
  const scratch = new Vector3();

  function readTransform(): ScreenTransform {
    // `updateWorldMatrix(true, false)` refreshes ancestors as well, which is
    // what makes the answer current even when the caller asks between frames.
    mesh.updateWorldMatrix(true, false);
    const worldMatrix = new Matrix4().copy(mesh.matrixWorld);
    const hw = size.width / 2;
    const hh = size.height / 2;
    const local: Array<[number, number]> = [
      [-hw, hh],
      [hw, hh],
      [hw, -hh],
      [-hw, -hh],
    ];
    const world = local.map(([x, y]) =>
      new Vector3(x, y, 0).applyMatrix4(worldMatrix),
    );

    const { camera, width, height } = state.deps.view();
    const viewportCorners = world.map((point) => {
      scratch.copy(point).project(camera);
      return {
        x: (scratch.x * 0.5 + 0.5) * width,
        // NDC is y-up and CSS pixels are y-down; this is the only place that
        // flip happens, which is the point of doing it here rather than in W6.
        y: (1 - (scratch.y * 0.5 + 0.5)) * height,
      };
    });

    return {
      worldMatrix,
      world: cornersOf(world),
      viewport: { corners: cornersOf(viewportCorners), width, height },
    };
  }

  const handle: ScreenMeshHandle = {
    panel,
    size,
    readTransform,

    setMaterial(material) {
      mesh.material = material ?? state.deps.defaultMaterial;
      state.deps.invalidate();
    },

    onTransformChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    invalidate() {
      state.deps.invalidate();
    },
  };

  const state: HandleState = {
    deps,
    listeners,
    lastReported,
    everReported: false,
    handle,
  };
  handlesByMesh.set(mesh, state);

  // three.js calls this once per rendered frame, per mesh. Under
  // `frameloop="demand"` that is once per frame somebody asked for.
  mesh.onBeforeRender = function onBeforeRender(this: Object3D) {
    if (listeners.size === 0) return;
    if (state.everReported && lastReported.equals(mesh.matrixWorld)) return;
    lastReported.copy(mesh.matrixWorld);
    state.everReported = true;
    const transform = readTransform();
    for (const listener of listeners) listener(transform);
  };

  return handle;
}

function cornersOf<T>(values: ReadonlyArray<T>): ScreenCorners<T> {
  const [topLeft, topRight, bottomRight, bottomLeft] = values;
  if (
    topLeft === undefined ||
    topRight === undefined ||
    bottomRight === undefined ||
    bottomLeft === undefined
  ) {
    throw new Error("createScreenMeshHandle: expected four corners");
  }
  return { topLeft, topRight, bottomRight, bottomLeft };
}
