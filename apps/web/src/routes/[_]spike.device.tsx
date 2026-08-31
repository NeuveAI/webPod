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
  DEVICE_ORIENTATION_PRESETS,
  DEVICE_LAYOUT,
  DeviceCanvas,
  clampDeviceOrientation,
  evaluate,
  firstVisibleProbeHit,
  orientationFromFace,
  type DeviceOrientation,
  type DevicePosePreset,
  matchesProbeIdentity,
  probeSurfaceIsCoherent,
  probeTargets,
  resolveProbeSurface,
  resolveDeviceVisibleFace,
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
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";
import {
  CanvasTexture,
  Group,
  Light,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  NearestFilter,
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
  readonly pose: DevicePosePreset | "custom";
  readonly probeFace: DeviceFace;
  readonly orientation: DeviceOrientation;
  readonly room: "light" | "dark";
  readonly cameraDistance: number;
  readonly dpr: number | [number, number];
  readonly lightRig: LightRigParams;
  readonly envRoom: EnvRoomParams;
  readonly form: DeviceFormParams;
  readonly materials: DeviceMaterials;
  readonly opticalProfiles: DeviceOpticalProfiles;
};

const INITIAL: SpikeParams = {
  colourway: "white",
  pose: "front",
  probeFace: "front",
  orientation: DEVICE_ORIENTATION_PRESETS.front,
  room: "light",
  // 980 clips the 330 × 552 enclosure against its same-sized canvas at a 30°
  // FOV, hiding the rounded corners and making the body read as a square slab.
  cameraDistance: 1160,
  // Looking follows the browser's physical pixel density through DeviceCanvas'
  // ResizeObserver path. The calibration runner still sets this to 1 before
  // reading pixels so a model-space sample cannot land between framebuffer px.
  dpr: [1, 3],
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
  readonly pose?: DevicePosePreset | "custom";
  readonly probeFace?: DeviceFace;
  readonly orientation?: Partial<DeviceOrientation>;
  readonly room?: "light" | "dark";
  readonly cameraDistance?: number;
  readonly dpr?: number | [number, number];
  readonly lightRig?: Partial<LightRigParams>;
  readonly envRoom?: Partial<EnvRoomParams>;
  readonly form?: Partial<DeviceFormParams>;
  readonly materials?: Partial<DeviceMaterials>;
  readonly opticalProfiles?: DeviceOpticalProfiles;
};

function setParams(patch: SpikePatch): SpikeParams {
  const { face: _face, ...restPatch } = patch;
  const drivesOrientation =
    restPatch.orientation !== undefined ||
    (restPatch.pose !== undefined && restPatch.pose !== "custom") ||
    _face !== undefined;
  const orientationBase =
    restPatch.orientation !== undefined
      ? {
          pitchDeg:
            restPatch.orientation.pitchDeg ?? current.orientation.pitchDeg,
          yawDeg: restPatch.orientation.yawDeg ?? current.orientation.yawDeg,
          rollDeg:
            restPatch.orientation.rollDeg ?? current.orientation.rollDeg,
        }
      : restPatch.pose !== undefined && restPatch.pose !== "custom"
        ? DEVICE_ORIENTATION_PRESETS[restPatch.pose]
        : _face !== undefined
          ? orientationFromFace(_face)
          : current.orientation;
  const orientation = drivesOrientation
    ? clampDeviceOrientation(orientationBase)
    : current.orientation;
  const pose = drivesOrientation
    ? poseFromOrientation(orientation)
    : (restPatch.pose ?? current.pose);
  const probeFace = drivesOrientation
    ? probeFaceFromOrientation(orientation)
    : (restPatch.probeFace ?? current.probeFace);
  current = {
    ...current,
    ...restPatch,
    pose,
    probeFace,
    orientation,
    lightRig: { ...current.lightRig, ...restPatch.lightRig },
    envRoom: { ...current.envRoom, ...restPatch.envRoom },
    form: { ...current.form, ...restPatch.form },
    materials: { ...current.materials, ...restPatch.materials },
    opticalProfiles: restPatch.opticalProfiles ?? current.opticalProfiles,
  };
  for (const listener of listeners) listener();
  return current;
}

function resetParams(): SpikeParams {
  current = INITIAL;
  for (const listener of listeners) listener();
  return current;
}

function poseFromOrientation(orientation: DeviceOrientation): DevicePosePreset | "custom" {
  for (const [pose, preset] of Object.entries(DEVICE_ORIENTATION_PRESETS)) {
    if (
      preset.pitchDeg === orientation.pitchDeg &&
      preset.yawDeg === orientation.yawDeg &&
      preset.rollDeg === orientation.rollDeg
    ) {
      return pose as DevicePosePreset;
    }
  }
  return "custom";
}

function probeFaceFromOrientation(orientation: DeviceOrientation): DeviceFace {
  return resolveDeviceVisibleFace(orientation) === "back" ? "back" : "front";
}

function setPose(pose: DevicePosePreset): SpikeParams {
  const orientation = DEVICE_ORIENTATION_PRESETS[pose];
  return setParams({
    pose,
    probeFace: pose === "rear" ? "back" : "front",
    orientation,
  });
}

function nudgeOrientation(delta: Partial<DeviceOrientation>): SpikeParams {
  const orientation = clampDeviceOrientation({
    pitchDeg: (delta.pitchDeg ?? 0) + current.orientation.pitchDeg,
    yawDeg: (delta.yawDeg ?? 0) + current.orientation.yawDeg,
    rollDeg: (delta.rollDeg ?? 0) + current.orientation.rollDeg,
  });
  return setParams({
    pose: poseFromOrientation(orientation),
    probeFace: probeFaceFromOrientation(orientation),
    orientation,
  });
}

function getBrowserPixelRatio(): number {
  return window.devicePixelRatio;
}

function getServerPixelRatio(): number {
  return 1;
}

/** Re-arms the resolution query after every density change, including zoom. */
function subscribeBrowserPixelRatio(listener: () => void): () => void {
  let resolution = window.matchMedia(
    `(resolution: ${window.devicePixelRatio}dppx)`,
  );
  const onChange = (): void => {
    resolution.removeEventListener("change", onChange);
    resolution = window.matchMedia(
      `(resolution: ${window.devicePixelRatio}dppx)`,
    );
    resolution.addEventListener("change", onChange);
    listener();
  };
  resolution.addEventListener("change", onChange);
  window.visualViewport?.addEventListener("resize", listener);
  return () => {
    resolution.removeEventListener("change", onChange);
    window.visualViewport?.removeEventListener("resize", listener);
  };
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
  pixels(): {
    readonly browserDpr: number;
    readonly source: {
      readonly logicalWidth: number;
      readonly logicalHeight: number;
      readonly pixelWidth: number;
      readonly pixelHeight: number;
    };
    readonly webgl: {
      readonly cssWidth: number;
      readonly cssHeight: number;
      readonly pixelWidth: number;
      readonly pixelHeight: number;
    };
  };
};

declare global {
  interface Window {
    __deviceCalibration?: ProbeApi;
  }
}

const screenHandle: { current: ScreenMeshHandle | null } = { current: null };

function LuminanceProbe() {
  const gl = useThree((state) => state.gl);
  const canvas = useThree((state) => state.gl.domElement);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  const sample = useCallback((): Array<ProbeResult> => {
    // ⚑ Read the store, not a ref mirroring a prop. The store is already the
    // thing outside React that both the tuner and the scene read, so a ref
    // would be a second copy of it that can only be wrong — and writing one
    // during render is what `react-hooks/refs` exists to stop.
    const active = getSnapshot();
    const { body } = DEVICE_LAYOUT;
    const form = active.form;

    const targets = probeTargets(active.colourway, active.probeFace, {
      // Clear the actual rolled seam plus two body pixels of raster margin.
      // A fixed 3px inset sat inside the 5.875px bevel at screen-row stops.
      bodyEdgeInset: Math.ceil(form.frontBevel) + 2,
      backEdgeInset: 3,
      // Recess walls need more clearance than the exposed body perimeter.
      controlInset: 6,
      seamWidth: form.seamWidth,
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
    const projected = new Vector3();
    const sampleNdc = new Vector2();
    const raycaster = new Raycaster();
    const pixelDrift =
      1.5 * Math.max(body.width / bufferW, body.height / bufferH);

    const readings: Array<ProbeReading> = targets.map((target) => {
      const samples = target.xs.map((x) => {
        const solved = resolveProbeSurface(
          model,
          {
            objectName: target.objectName,
            materialNames: [target.materialName],
          },
          x,
          target.y,
          active.probeFace,
          body.depth * 4,
        );
        projected.copy(solved.worldPoint).project(camera);
        const px = Math.min(
          bufferW - 1,
          Math.max(0, Math.floor((projected.x * 0.5 + 0.5) * bufferW)),
        );
        const py = Math.min(
          bufferH - 1,
          Math.max(0, Math.floor((projected.y * 0.5 + 0.5) * bufferH)),
        );
        sampleNdc.set(
          ((px + 0.5) / bufferW) * 2 - 1,
          ((py + 0.5) / bufferH) * 2 - 1,
        );
        raycaster.setFromCamera(sampleNdc, camera);
        const intersections = raycaster.intersectObjects(scene.children, true);
        const hit = firstVisibleProbeHit(intersections);
        if (
          hit === null ||
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
        const visibleLocal = model.worldToLocal(hit.point.clone());
        if (
          !probeSurfaceIsCoherent(
            x,
            target.y,
            solved.localPoint,
            visibleLocal,
            pixelDrift,
          )
        ) {
          throw new Error(
            `device probe surface drift for ${target.token}: intended (${x}, ${target.y}, actual), solved (${solved.localPoint.x}, ${solved.localPoint.y}, ${solved.localPoint.z}), visible (${visibleLocal.x}, ${visibleLocal.y}, ${visibleLocal.z}), tolerance ${pixelDrift}`,
          );
        }
        // readPixels' origin is bottom-left, which is already this frame's y-up.
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
      pixels: () => {
        const active = getSnapshot();
        const screen = getPreviewScreen(
          window.devicePixelRatio,
          active.colourway === "white" ? "light" : "dark",
        );
        const bounds = canvas.getBoundingClientRect();
        return {
          browserDpr: window.devicePixelRatio,
          source: {
            logicalWidth: PREVIEW_SOURCE_SIZE.width,
            logicalHeight: PREVIEW_SOURCE_SIZE.height,
            pixelWidth: screen.canvas.width,
            pixelHeight: screen.canvas.height,
          },
          webgl: {
            cssWidth: bounds.width,
            cssHeight: bounds.height,
            pixelWidth: canvas.width,
            pixelHeight: canvas.height,
          },
        };
      },
    };
    window.__deviceCalibration = api;
    return () => {
      delete window.__deviceCalibration;
    };
  }, [canvas, sample, scene]);

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
  canvas: HTMLCanvasElement;
  material: MeshBasicMaterial;
  texture: CanvasTexture;
  pixelRatio: number;
  tone: "dark" | "light";
} | null = null;

const PREVIEW_VISIBLE_SIZE = { width: 272, height: 204 } as const;
const PREVIEW_SOURCE_SIZE = { width: 320, height: 240 } as const;
const PREVIEW_SOURCE_SCALE =
  PREVIEW_SOURCE_SIZE.width / PREVIEW_VISIBLE_SIZE.width;

function resolvePreviewPixelRatio(devicePixelRatio: number): number {
  return Math.min(3, Math.max(1, devicePixelRatio));
}

function paintPreviewScreen(
  canvas: HTMLCanvasElement,
  devicePixelRatio: number,
  tone: "dark" | "light",
): number {
  const pixelRatio = resolvePreviewPixelRatio(devicePixelRatio);
  canvas.width = Math.ceil(PREVIEW_SOURCE_SIZE.width * pixelRatio);
  canvas.height = Math.ceil(PREVIEW_SOURCE_SIZE.height * pixelRatio);
  const context = canvas.getContext("2d");
  if (context === null) return pixelRatio;
  context.setTransform(
    pixelRatio * PREVIEW_SOURCE_SCALE,
    0,
    0,
    pixelRatio * PREVIEW_SOURCE_SCALE,
    0,
    0,
  );
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, PREVIEW_VISIBLE_SIZE.width, PREVIEW_VISIBLE_SIZE.height);

  const palette =
    tone === "dark"
      ? {
          panelTop: "#73777B",
          panelBottom: "#55585C",
          titleTop: "#8C9095",
          titleBottom: "#67707A",
          text: "#F2F6FB",
          textMuted: "#D4DBE4",
          textSubtle: "#BEC9D6",
          divider: "rgba(255,255,255,0.14)",
          pane: "#686C71",
          paneShade: "#606469",
          highlightTop: "#63C3E1",
          highlightBottom: "#3097C2",
          accent: "#8DE5FF",
        }
      : {
          panelTop: "#EEF2F6",
          panelBottom: "#E1E7EE",
          titleTop: "#F9FBFD",
          titleBottom: "#D8E0E8",
          text: "#0F172A",
          textMuted: "#475569",
          textSubtle: "#64748B",
          divider: "rgba(15,23,42,0.10)",
          pane: "#E8EDF4",
          paneShade: "#DDE4EC",
          highlightTop: "#D8EDF8",
          highlightBottom: "#8FD0EC",
          accent: "#5EC8EA",
        };

  const background = context.createLinearGradient(0, 0, 0, PREVIEW_VISIBLE_SIZE.height);
  background.addColorStop(0, palette.panelTop);
  background.addColorStop(1, palette.panelBottom);
  context.fillStyle = background;
  context.fillRect(0, 0, PREVIEW_VISIBLE_SIZE.width, PREVIEW_VISIBLE_SIZE.height);

  context.globalAlpha = tone === "dark" ? 0.08 : 0.06;
  for (let y = 0; y < PREVIEW_VISIBLE_SIZE.height; y += 3) {
    context.fillStyle = tone === "dark" ? "#FFFFFF" : "#0F172A";
    context.fillRect(0, y, PREVIEW_VISIBLE_SIZE.width, 1);
  }
  context.globalAlpha = 1;

  const title = context.createLinearGradient(0, 0, 0, 21);
  title.addColorStop(0, palette.titleTop);
  title.addColorStop(1, palette.titleBottom);
  context.fillStyle = title;
  context.fillRect(0, 0, 272, 21);

  context.strokeStyle = palette.divider;
  context.beginPath();
  context.moveTo(0, 21.5);
  context.lineTo(272, 21.5);
  context.stroke();

  context.fillStyle = palette.text;
  context.font = '700 11px "Helvetica Neue", Helvetica, Arial, sans-serif';
  context.textAlign = "center";
  context.fillText("Music", 136, 14);

  context.strokeStyle = palette.textSubtle;
  context.lineWidth = 1;
  context.strokeRect(247.5, 6.5, 16, 8);
  context.strokeRect(250.5, 8.5, 10, 4);

  const rows = [
    ["Cover Flow", "", false],
    ["Playlists", "2", false],
    ["Artists", "4", false],
    ["Albums", "4", true],
    ["Songs", "42", false],
    ["Genres", "4", false],
    ["Radio", "3", false],
    ["Search", "", false],
  ] as const;
  const listWidth = 168;
  const rowHeight = 21;

  rows.forEach(([label, value, selected], index) => {
    const y = 21 + index * rowHeight;
    if (selected) {
      const highlight = context.createLinearGradient(0, y, 0, y + rowHeight);
      highlight.addColorStop(0, palette.highlightTop);
      highlight.addColorStop(1, palette.highlightBottom);
      context.fillStyle = highlight;
      context.fillRect(0, y, listWidth, rowHeight);
    }
    context.strokeStyle = palette.divider;
    context.beginPath();
    context.moveTo(0, y + rowHeight + 0.5);
    context.lineTo(listWidth, y + rowHeight + 0.5);
    context.stroke();
    context.fillStyle = selected ? palette.text : palette.textMuted;
    context.textAlign = "left";
    context.font = '700 11px "Helvetica Neue", Helvetica, Arial, sans-serif';
    context.fillText(label, 8, y + 14);
    context.textAlign = "right";
    if (value.length > 0) context.fillText(value, 140, y + 14);
    context.fillText("›", 160, y + 14);
  });

  const pane = context.createLinearGradient(listWidth, 21, 272, 204);
  pane.addColorStop(0, palette.pane);
  pane.addColorStop(1, palette.paneShade);
  context.fillStyle = pane;
  context.fillRect(listWidth, 21, 104, 183);

  context.strokeStyle = palette.divider;
  context.beginPath();
  context.moveTo(listWidth + 0.5, 21);
  context.lineTo(listWidth + 0.5, 204);
  context.stroke();

  const artGradient = context.createLinearGradient(178, 42, 250, 114);
  artGradient.addColorStop(0, "#D488C0");
  artGradient.addColorStop(1, "#F0B5AE");
  context.fillStyle = artGradient;
  context.fillRect(179, 40, 70, 70);

  context.globalAlpha = 0.34;
  context.fillStyle = "#FFFFFF";
  context.beginPath();
  context.arc(242, 54, 24, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(176, 108);
  context.lineTo(214, 72);
  context.lineTo(251, 109);
  context.closePath();
  context.fill();
  context.globalAlpha = 1;

  context.fillStyle = palette.text;
  context.textAlign = "left";
  context.font = '700 10px "Helvetica Neue", Helvetica, Arial, sans-serif';
  context.fillText("4 albums", 182, 132);
  context.font = '600 10px "Helvetica Neue", Helvetica, Arial, sans-serif';
  context.fillStyle = palette.textSubtle;
  context.fillText("Rotate to browse", 182, 145);

  context.fillStyle = tone === "dark" ? "rgba(255,255,255,0.12)" : "rgba(15,23,42,0.10)";
  context.fillRect(257, 40, 3, 118);
  context.fillStyle = palette.accent;
  context.fillRect(257, 95, 3, 32);
  return pixelRatio;
}

function getPreviewScreen(
  devicePixelRatio: number,
  tone: "dark" | "light",
) {
  if (previewScreenCache !== null) {
    const pixelRatio = resolvePreviewPixelRatio(devicePixelRatio);
    if (
      previewScreenCache.pixelRatio !== pixelRatio ||
      previewScreenCache.tone !== tone
    ) {
      previewScreenCache.pixelRatio = paintPreviewScreen(
        previewScreenCache.canvas,
        pixelRatio,
        tone,
      );
      previewScreenCache.tone = tone;
      previewScreenCache.texture.needsUpdate = true;
    }
    return previewScreenCache;
  }
  const canvas = document.createElement("canvas");
  const pixelRatio = paintPreviewScreen(canvas, devicePixelRatio, tone);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = NearestFilter;
  texture.name = "webpod-preview-screen-texture";
  texture.needsUpdate = true;
  const material = new MeshBasicMaterial({ map: texture, toneMapped: false });
  material.name = "webpod-preview-screen-material";
  previewScreenCache = {
    canvas,
    material,
    pixelRatio,
    tone,
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

type PoseDragState = {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
  readonly orientation: DeviceOrientation;
};

const YAW_DEG_PER_PX = 0.45;
const PITCH_DEG_PER_PX = 0.3;
const ROLL_KEY_STEP = 2;
const PITCH_KEY_STEP = 4;
const YAW_KEY_STEP = 8;

function bindPoseValidation(stage: HTMLElement): () => void {
  const drag: { current: PoseDragState | null } = { current: null };

  const release = (pointerId: number): void => {
    if (drag.current?.pointerId === pointerId) drag.current = null;
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    drag.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      orientation: current.orientation,
    };
    stage.focus({ preventScroll: true });
    event.preventDefault();
  };

  const onPointerMove = (event: PointerEvent): void => {
    const active = drag.current;
    if (active === null || active.pointerId !== event.pointerId) return;
    const orientation = clampDeviceOrientation({
      pitchDeg:
        active.orientation.pitchDeg +
        (event.clientY - active.clientY) * PITCH_DEG_PER_PX,
      yawDeg:
        active.orientation.yawDeg +
        (event.clientX - active.clientX) * YAW_DEG_PER_PX,
      rollDeg: active.orientation.rollDeg,
    });
    setParams({ orientation });
    event.preventDefault();
  };

  const onPointerUp = (event: PointerEvent): void => release(event.pointerId);
  const onPointerCancel = (event: PointerEvent): void =>
    release(event.pointerId);
  const onKeyDown = (event: KeyboardEvent): void => {
    switch (event.key) {
      case "ArrowLeft":
        nudgeOrientation({ yawDeg: -YAW_KEY_STEP });
        break;
      case "ArrowRight":
        nudgeOrientation({ yawDeg: YAW_KEY_STEP });
        break;
      case "ArrowUp":
        nudgeOrientation({ pitchDeg: PITCH_KEY_STEP });
        break;
      case "ArrowDown":
        nudgeOrientation({ pitchDeg: -PITCH_KEY_STEP });
        break;
      case "[":
        nudgeOrientation({ rollDeg: -ROLL_KEY_STEP });
        break;
      case "]":
        nudgeOrientation({ rollDeg: ROLL_KEY_STEP });
        break;
      case "1":
      case "Home":
        setPose("front");
        break;
      case "3":
        setPose("three-quarter");
        break;
      case "9":
        setPose("edge");
        break;
      case "0":
      case "End":
      case "f":
      case "F":
        setPose("rear");
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("keydown", onKeyDown);
  window.addEventListener("pointermove", onPointerMove, { passive: false });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
  return () => {
    stage.removeEventListener("pointerdown", onPointerDown);
    stage.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerCancel);
  };
}

function DeviceSpike() {
  const params = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const stageRef = useRef<HTMLDivElement>(null);
  const room = ROOM[params.room];
  const browserPixelRatio = useSyncExternalStore(
    subscribeBrowserPixelRatio,
    getBrowserPixelRatio,
    getServerPixelRatio,
  );
  const previewScreen = getPreviewScreen(
    browserPixelRatio,
    params.colourway === "white" ? "light" : "dark",
  );
  const onScreenMeshReady = useCallback((handle: ScreenMeshHandle) => {
    screenHandle.current = handle;
  }, []);
  const capture = new URLSearchParams(window.location.search).has("capture");

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

  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;
    return bindPoseValidation(stage);
  }, []);

  if (!import.meta.env.DEV) {
    return (
      <main style={{ padding: 24, fontFamily: "ui-monospace, monospace" }}>
        Not available.
      </main>
    );
  }

  return (
    <main
      className="webpod-device-spike"
      style={{ background: room.sweep, color: room.ink }}
    >
      <style>{DEVICE_SPIKE_CSS}</style>
      <div
        aria-hidden
        className="webpod-device-spike__floor"
        style={{
          background: room.floor,
        }}
      />
      <div
        ref={stageRef}
        className="webpod-device-spike__stage"
        tabIndex={0}
        aria-label="Volumetric iPod preview. Drag to rotate, arrow keys adjust pose, Home and End snap front and rear."
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
          orientation={params.orientation}
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
      {capture ? null : <Hud params={params} tone={room.ink2} />}
    </main>
  );
}

const DEVICE_SPIKE_CSS = `
  html:has(.webpod-device-spike), body:has(.webpod-device-spike) {
    margin: 0;
    min-inline-size: 0;
    min-block-size: 100%;
  }
  .webpod-device-spike {
    position: fixed;
    inset: 0;
    box-sizing: border-box;
    display: grid;
    place-items: safe center;
    overflow: clip;
    padding-block: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-bottom));
    padding-inline: max(16px, env(safe-area-inset-left)) max(16px, env(safe-area-inset-right));
  }
  .webpod-device-spike__floor {
    position: absolute;
    inset-inline: 0;
    inset-block-end: 0;
    block-size: 32%;
  }
  .webpod-device-spike__stage {
    position: relative;
    inline-size: min(330px, calc(100dvi - 32px));
    max-block-size: calc(100dvb - 32px);
    aspect-ratio: 330 / 552;
    cursor: grab;
    touch-action: none;
    outline: none;
  }
  .webpod-device-spike__stage:focus-visible {
    box-shadow: 0 0 0 2px rgb(125 211 252 / 0.85);
    border-radius: 28px;
  }
  .webpod-device-spike__stage:active {
    cursor: grabbing;
  }
  .webpod-device-spike__stage > .webpod-device-canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
  .webpod-device-spike__hud {
    inset-block-start: max(12px, env(safe-area-inset-top));
    inset-inline: max(12px, env(safe-area-inset-left)) max(12px, env(safe-area-inset-right));
    justify-content: safe center;
    min-inline-size: 0;
  }
  .webpod-device-spike__hud button {
    min-block-size: 44px;
    min-inline-size: 44px;
    touch-action: manipulation;
  }
`;

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
      className="webpod-device-spike__hud"
      style={{
        position: "absolute",
        display: "flex",
        flexWrap: "wrap",
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
      <button type="button" onClick={() => setPose("front")}>
        front
      </button>
      <button type="button" onClick={() => setPose("three-quarter")}>
        quarter
      </button>
      <button type="button" onClick={() => setPose("edge")}>
        edge
      </button>
      <button type="button" onClick={() => setPose("rear")}>
        rear
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
        {params.colourway} / {params.pose}
      </span>
      <span>
        p {Math.round(params.orientation.pitchDeg)}° · y{" "}
        {Math.round(params.orientation.yawDeg)}° · r{" "}
        {Math.round(params.orientation.rollDeg)}°
      </span>
    </div>
  );
}
