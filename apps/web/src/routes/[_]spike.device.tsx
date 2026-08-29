/**
 * `/_spike/device` — P2, the object.
 *
 * Answers `preview-validation.md`'s second question: *does the modelled iPod
 * read as the object, and do its materials match the spec numbers?* Everything
 * on this page is the real `@webpod/device` — there is no parallel copy of the
 * scene here — so a screenshot of this route is a statement about the package.
 *
 * ⚑ **The filename escapes the underscore** — `[_]spike.device.tsx`, not
 * `_spike.device.tsx`. In TanStack Router a bare `_` prefix marks a *pathless
 * layout route* and is stripped from the URL, so the unescaped name would have
 * served this diagnostic at `/device`: a bare, product-looking top-level path,
 * one refactor from shipping unnoticed. W6.0 found this the hard way and D-032
 * is the ruling.
 *
 * ⚑ **No component-local state, and no Jotai either.** The tunables live in a module-level
 * store read through `useSyncExternalStore` — React 19's own primitive for
 * exactly this. That satisfies the *stated purpose* of the repo's ban ("tool
 * callbacks live outside React and must read and write the same state the UI
 * renders"): the rig tuner drives this store from outside React entirely, over
 * `window.__deviceCalibration`, and the scene re-renders from it. A component closure would
 * have made the tuner unable to reach the values it exists to move. `packages/state` is
 * W2's and is not imported.
 */
import { useThree } from "@react-three/fiber";
import { createFileRoute } from "@tanstack/react-router";
import {
  DEFAULT_DEVICE_FORM,
  DEFAULT_DEVICE_MATERIALS,
  DEFAULT_ENV_ROOM,
  DEFAULT_LIGHT_RIG,
  DEFAULT_DEVICE_OPTICAL_PROFILES,
  DEVICE_MODEL_NAME,
  DEVICE_LAYOUT,
  DeviceCanvas,
  evaluate,
  firstVisibleProbeHit,
  matchesProbeIdentity,
  probeTargets,
  rmsDelta,
  type Colourway,
  type DeviceFace,
  type DeviceFormParams,
  type DeviceMaterials,
  type DeviceOpticalProfiles,
  type EnvRoomParams,
  type LightRigParams,
  type ProbeReading,
  type ProbeResult,
  type ScreenMeshHandle,
} from "@webpod/device";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  CanvasTexture,
  Group,
  Light,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Raycaster,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";

export const Route = createFileRoute("/_spike/device")({
  ssr: false,
  component: DeviceSpike,
});

/* ─────────────────────────────────────────────────────────────
   The tunables, as a store outside React.
   ───────────────────────────────────────────────────────────── */

type SpikeParams = {
  readonly colourway: Colourway;
  readonly face: DeviceFace;
  readonly room: "light" | "dark";
  readonly cameraDistance: number;
  readonly dpr: number;
  readonly lightRig: LightRigParams;
  readonly envRoom: EnvRoomParams;
  readonly form: DeviceFormParams;
  readonly materials: DeviceMaterials;
  readonly opticalProfiles: DeviceOpticalProfiles;
};

const INITIAL: SpikeParams = {
  colourway: "white",
  face: "front",
  room: "light",
  // 980 clips the 330 × 552 enclosure against its same-sized canvas at a 30°
  // FOV, hiding the rounded corners and making the body read as a square slab.
  cameraDistance: 1160,
  dpr: 1,
  lightRig: DEFAULT_LIGHT_RIG,
  envRoom: DEFAULT_ENV_ROOM,
  form: DEFAULT_DEVICE_FORM,
  materials: DEFAULT_DEVICE_MATERIALS,
  opticalProfiles: DEFAULT_DEVICE_OPTICAL_PROFILES,
};

let current: SpikeParams = INITIAL;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SpikeParams {
  return current;
}

/** A one-level-deep patch, which is all the tuner needs and all it can break. */
type SpikePatch = {
  readonly colourway?: Colourway;
  readonly face?: DeviceFace;
  readonly room?: "light" | "dark";
  readonly cameraDistance?: number;
  readonly dpr?: number;
  readonly lightRig?: Partial<LightRigParams>;
  readonly envRoom?: Partial<EnvRoomParams>;
  readonly form?: Partial<DeviceFormParams>;
  readonly materials?: Partial<DeviceMaterials>;
  readonly opticalProfiles?: DeviceOpticalProfiles;
};

function setParams(patch: SpikePatch): SpikeParams {
  current = {
    ...current,
    ...patch,
    lightRig: { ...current.lightRig, ...patch.lightRig },
    envRoom: { ...current.envRoom, ...patch.envRoom },
    form: { ...current.form, ...patch.form },
    materials: { ...current.materials, ...patch.materials },
    opticalProfiles: patch.opticalProfiles ?? current.opticalProfiles,
  };
  for (const listener of listeners) listener();
  return current;
}

function resetParams(): SpikeParams {
  current = INITIAL;
  for (const listener of listeners) listener();
  return current;
}

/* ─────────────────────────────────────────────────────────────
   The luminance probe.
   ───────────────────────────────────────────────────────────── */

/**
 * `window.__deviceCalibration` — the rig tuner's only entry point.
 *
 * ⚑ Every method is a **command**, not a query over a live scene: `sample()`
 * renders one frame and reads it back in the same task. That ordering is not
 * optional. The canvas is created without `preserveDrawingBuffer`, so the
 * drawing buffer is valid only between a draw call and the next compositing
 * step; reading it a task later returns cleared pixels, which would silently
 * grade a black screen as a very dark body and pass §4.2 stop 4.
 */
type ProbeApi = {
  setParams(patch: SpikePatch): SpikeParams;
  getParams(): SpikeParams;
  reset(): SpikeParams;
  sample(): Array<ProbeResult>;
  rms(): number;
  /**
   * The scene as the renderer actually has it — material class and the handful
   * of parameters that decide the render, read off the live objects rather
   * than off the props that were meant to produce them.
   *
   * ⚑ Worth its twenty lines: the first render of this scene was uniformly
   * 150 units too bright, and every plausible cause (env gain, light units,
   * tone mapping) was a *number* while the actual cause was a material that
   * had not received its parameters at all. Reading the objects back is the
   * only check that distinguishes those.
   */
  describe(): Array<Record<string, unknown>>;
  screenMesh(): Record<string, unknown> | null;
};

declare global {
  interface Window {
    __deviceCalibration?: ProbeApi;
  }
}

const screenHandle: { current: ScreenMeshHandle | null } = { current: null };

function LuminanceProbe() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  const sample = useCallback((): Array<ProbeResult> => {
    // ⚑ Read the store, not a ref mirroring a prop. The store is already the
    // thing outside React that both the tuner and the scene read, so a ref
    // would be a second copy of it that can only be wrong — and writing one
    // during render is what `react-hooks/refs` exists to stop.
    const active = getSnapshot();
    const { body } = DEVICE_LAYOUT;
    const frontFaceZ = body.depth / 2;
    const form = active.form;
    const ringSag =
      (DEVICE_LAYOUT.wheel.outerR *
        Math.tan((form.ringDishTiltDeg * Math.PI) / 180)) /
      form.ringDishExponent;
    const ringZ = frontFaceZ - form.recessDepth - ringSag;
    const ringInnerZ =
      ringZ +
      ringSag *
        ((DEVICE_LAYOUT.wheel.selectR - 1) / DEVICE_LAYOUT.wheel.outerR) **
          form.ringDishExponent;
    const selectSag =
      (DEVICE_LAYOUT.wheel.selectR *
        Math.tan((form.selectDomeTiltDeg * Math.PI) / 180)) /
      form.selectDomeExponent;

    const targets = probeTargets(active.colourway, active.face, {
      // Three body pixels clears bevel antialiasing while preserving the stop
      // table's endpoint response. Raycast identity below is the authority.
      edgeInset: 3,
      // Recess walls need more clearance than the exposed body perimeter.
      controlInset: 6,
      frontFaceZ,
      // Back targets are body-local. The model's live world matrix rotates
      // them into the viewer-facing +z plane before projection.
      backFaceZ: -frontFaceZ,
      seamWidth: form.seamWidth,
      ringZ: (radius) =>
        ringZ +
        ringSag *
          (radius / DEVICE_LAYOUT.wheel.outerR) ** form.ringDishExponent,
      selectZ: (radius) =>
        ringInnerZ +
        form.selectProud +
        selectSag *
          (1 -
            (radius / DEVICE_LAYOUT.wheel.selectR) ** form.selectDomeExponent),
    });

    // ⚑ One draw, then **one** readback, in the same task.
    //
    // The ordering is not optional: the canvas has no `preserveDrawingBuffer`,
    // so the drawing buffer is valid only between a draw call and the next
    // compositing step, and reading it a task later returns cleared pixels —
    // which would silently grade a black screen as a very dark body and pass
    // §4.2 stop 4.
    //
    // The *singleness* is not optional either, for a duller reason: every
    // `readPixels` is a GPU pipeline stall, and the first version of this made
    // one per column — 64 stalls per view, which took the rig tuner's inner
    // loop from milliseconds to two seconds and its convergence from minutes to
    // an hour. One full-buffer read and then indexing into it is the same
    // measurement at a fraction of the cost.
    gl.render(scene, camera);
    const model = scene.getObjectByName(DEVICE_MODEL_NAME);
    if (!(model instanceof Group)) {
      throw new Error(`device probe requires ${DEVICE_MODEL_NAME}`);
    }
    const context = gl.getContext();
    const bufferW = context.drawingBufferWidth;
    const bufferH = context.drawingBufferHeight;
    const frame = new Uint8Array(bufferW * bufferH * 4);
    context.readPixels(
      0,
      0,
      bufferW,
      bufferH,
      context.RGBA,
      context.UNSIGNED_BYTE,
      frame,
    );
    const point = new Vector3();
    const ndc = new Vector2();
    const raycaster = new Raycaster();

    const readings: Array<ProbeReading> = targets.map((target) => {
      const samples = target.xs.map((x) => {
        model.localToWorld(point.set(x, target.y, target.z)).project(camera);
        ndc.set(point.x, point.y);
        raycaster.setFromCamera(ndc, camera);
        const intersections = raycaster.intersectObjects(scene.children, true);
        const hit = firstVisibleProbeHit(intersections);
        if (
          !matchesProbeIdentity(
            target,
            hit?.objectName,
            hit?.materialNames ?? [],
          )
        ) {
          throw new Error(
            `device probe rejected ${target.token}: expected ${target.objectName}/${target.materialName}, hit ${hit?.objectName ?? "nothing"}/${hit?.materialNames.join("|") ?? ""}; ray ${
              intersections
                .map((entry) => {
                  if (!(entry.object instanceof Mesh)) {
                    return `${entry.object.name || entry.object.type}[visible=${entry.object.visible}]`;
                  }
                  const materials = Array.isArray(entry.object.material)
                    ? entry.object.material
                    : [entry.object.material];
                  return `${entry.object.name || entry.object.type}[visible=${entry.object.visible};materials=${materials.map((material) => `${material.name || material.type}:${material.visible}:${material.transparent}:${material.opacity}`).join(",")}]`;
                })
                .join(" > ") || "missed scene"
            }`,
          );
        }
        const px = Math.min(
          bufferW - 1,
          Math.max(0, Math.round((point.x * 0.5 + 0.5) * bufferW)),
        );
        // readPixels' origin is bottom-left, which is already this frame's y-up.
        const py = Math.min(
          bufferH - 1,
          Math.max(0, Math.round((point.y * 0.5 + 0.5) * bufferH)),
        );
        const i = (py * bufferW + px) * 4;
        return [frame[i] ?? 0, frame[i + 1] ?? 0, frame[i + 2] ?? 0] as const;
      });
      return { target, samples };
    });

    return evaluate(readings);
  }, [gl, scene, camera]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const api: ProbeApi = {
      setParams,
      getParams: getSnapshot,
      reset: resetParams,
      sample,
      rms: () => rmsDelta(sample()),
      describe: () => {
        const rows: Array<Record<string, unknown>> = [];
        scene.traverse((object) => {
          if (object instanceof Light) {
            rows.push({
              kind: object.type,
              intensity: object.intensity,
              position: object.position,
            });
            return;
          }
          if (!(object instanceof Mesh)) return;
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          for (const material of materials) {
            if (material instanceof MeshStandardMaterial) {
              rows.push({
                kind: material.type,
                color: material.color.getHexString(),
                roughness: material.roughness,
                metalness: material.metalness,
                clearcoat:
                  material instanceof MeshPhysicalMaterial
                    ? material.clearcoat
                    : undefined,
                transmission:
                  material instanceof MeshPhysicalMaterial
                    ? material.transmission
                    : undefined,
                envMap: material.envMap === null ? null : "set",
                envMapIntensity: material.envMapIntensity,
                toneMapped: material.toneMapped,
              });
            } else if (material instanceof MeshBasicMaterial) {
              rows.push({
                kind: material.type,
                color: material.color.getHexString(),
                toneMapped: material.toneMapped,
              });
            }
          }
        });
        return rows;
      },
      screenMesh: () => {
        const handle = screenHandle.current;
        if (handle === null) return null;
        const transform = handle.readTransform();
        return {
          size: handle.size,
          panel: handle.panel,
          worldMatrix: transform.worldMatrix.toArray(),
          world: transform.world,
          viewport: transform.viewport,
        };
      },
    };
    window.__deviceCalibration = api;
    return () => {
      delete window.__deviceCalibration;
    };
  }, [sample, scene]);

  return null;
}

/* ─────────────────────────────────────────────────────────────
   The page.
   ───────────────────────────────────────────────────────────── */

/** §4.1's two rooms. CSS-consumable per §12.3, so they are CSS. */
const ROOM = {
  dark: {
    sweep:
      "radial-gradient(120% 90% at 28% 6%, #16171C 0%, #101216 36%, #0B0D10 70%, #07080A 100%)",
    floor: "linear-gradient(180deg, #0D0F13 0%, #060709 100%)",
    contact:
      "0 24px 48px 0 rgb(0 0 0 / 0.66), 0 4px 10px -2px rgb(0 0 0 / 0.48)",
    ink: "#F1F5F9",
    ink2: "#94A3B8",
  },
  light: {
    sweep:
      "radial-gradient(120% 90% at 28% 8%, #F1F3F7 0%, #E7EBF1 34%, #DDE2EA 68%, #D4DAE3 100%)",
    floor: "linear-gradient(180deg, #CDD4DE 0%, #BAC2CF 100%)",
    contact:
      "0 24px 48px 0 rgb(51 65 85 / 0.34), 0 4px 10px -2px rgb(30 41 59 / 0.20)",
    ink: "#0F172A",
    ink2: "#475569",
  },
} as const;

let previewScreenCache: {
  material: MeshBasicMaterial;
  texture: CanvasTexture;
} | null = null;
function getPreviewScreen() {
  if (previewScreenCache !== null) return previewScreenCache;
  const canvas = document.createElement("canvas");
  canvas.width = 272;
  canvas.height = 204;
  const context = canvas.getContext("2d");
  if (context === null) return null;
  context.fillStyle = "#F2F6FB";
  context.fillRect(0, 0, 272, 204);
  context.fillStyle = "#DCE5EE";
  context.fillRect(0, 0, 272, 24);
  context.fillStyle = "#334155";
  context.font = "bold 13px system-ui";
  context.fillText("iPod", 10, 17);
  context.textAlign = "right";
  context.fillText("Now Playing", 262, 17);
  context.textAlign = "left";
  context.font = "14px system-ui";
  ["Music", "Photos", "Podcasts", "Settings"].forEach((label, index) => {
    const y = 24 + index * 45;
    context.fillStyle = index === 0 ? "#CBD8E6" : "#F2F6FB";
    context.fillRect(0, y, 272, 45);
    context.fillStyle = "#334155";
    context.fillText(label, 14, y + 28);
    context.textAlign = "right";
    context.fillText("›", 256, y + 28);
    context.textAlign = "left";
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  previewScreenCache = {
    material: new MeshBasicMaterial({ map: texture, toneMapped: false }),
    texture,
  };
  return previewScreenCache;
}
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    previewScreenCache?.material.dispose();
    previewScreenCache?.texture.dispose();
    previewScreenCache = null;
  });
}

function DeviceSpike() {
  const params = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const room = ROOM[params.room];
  const previewScreen = getPreviewScreen();
  const onScreenMeshReady = useCallback((handle: ScreenMeshHandle) => {
    screenHandle.current = handle;
  }, []);

  // §10.6 elevation 5 — the device is the only thing at this elevation, and the
  // shadow is CSS because §12.3 puts the environment in the CSS layer. It is
  // sized and placed from the same layout the mesh is, so it cannot drift.
  const shadow = useMemo(
    () => ({
      width: DEVICE_LAYOUT.body.width,
      height: DEVICE_LAYOUT.body.height,
      radius: DEVICE_LAYOUT.body.cornerR,
    }),
    [],
  );

  if (!import.meta.env.DEV) {
    return (
      <main style={{ padding: 24, fontFamily: "ui-monospace, monospace" }}>
        Not available.
      </main>
    );
  }

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        background: room.sweep,
        color: room.ink,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          insetInline: 0,
          bottom: 0,
          height: "32%",
          background: room.floor,
        }}
      />
      <div
        style={{
          position: "relative",
          width: shadow.width,
          height: shadow.height,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: shadow.radius,
            boxShadow: room.contact,
          }}
        />
        <DeviceCanvas
          colourway={params.colourway}
          face={params.face}
          lightRig={params.lightRig}
          envRoom={params.envRoom}
          form={params.form}
          materials={params.materials}
          opticalProfiles={params.opticalProfiles}
          cameraDistance={params.cameraDistance}
          dpr={params.dpr}
          onScreenMeshReady={onScreenMeshReady}
          screenMaterial={previewScreen?.material}
          className="webpod-device-canvas"
        >
          <LuminanceProbe />
        </DeviceCanvas>
      </div>
      <Hud params={params} tone={room.ink2} />
    </main>
  );
}

/**
 * The controls.
 *
 * Deliberately unstyled beyond legibility: this is a diagnostic, and any craft
 * spent here is craft not spent on the object the page exists to judge.
 */
function Hud({
  params,
  tone,
}: {
  readonly params: SpikeParams;
  readonly tone: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        display: "flex",
        gap: 8,
        fontFamily: "ui-monospace, monospace",
        fontSize: 12,
        color: tone,
      }}
    >
      <button type="button" onClick={() => setParams({ colourway: "black" })}>
        black
      </button>
      <button type="button" onClick={() => setParams({ colourway: "white" })}>
        white
      </button>
      <button type="button" onClick={() => setParams({ face: "front" })}>
        front
      </button>
      <button type="button" onClick={() => setParams({ face: "back" })}>
        back
      </button>
      <button
        type="button"
        onClick={() =>
          setParams({ room: params.room === "dark" ? "light" : "dark" })
        }
      >
        room: {params.room}
      </button>
      <span>
        {params.colourway} / {params.face}
      </span>
    </div>
  );
}
