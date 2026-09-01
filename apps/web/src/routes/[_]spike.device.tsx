import { CompositeDevice } from "@webpod/composite";
import {
  DEVICE_ORIENTATION_PRESETS,
  clampDeviceOrientation,
  type Colourway,
  type DeviceOrientation,
  type DevicePosePreset,
} from "@webpod/device";
import { Panel } from "@webpod/panel";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useSyncExternalStore } from "react";

export const Route = createFileRoute("/_spike/device")({
  ssr: false,
  component: DeviceSpike,
});

type PreviewRoom = "dark" | "light";

type PreviewState = {
  readonly colourway: Colourway;
  readonly pose: DevicePosePreset | "custom";
  readonly orientation: DeviceOrientation;
  readonly room: PreviewRoom;
};

const INITIAL: PreviewState = Object.freeze({
  colourway: "black",
  pose: "three-quarter",
  orientation: DEVICE_ORIENTATION_PRESETS["three-quarter"],
  room: "dark",
});

let preview = INITIAL;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot(): PreviewState {
  return preview;
}

function publish(next: PreviewState): PreviewState {
  preview = next;
  for (const listener of listeners) listener();
  return preview;
}

function setPose(pose: DevicePosePreset): PreviewState {
  return publish({ ...preview, pose, orientation: DEVICE_ORIENTATION_PRESETS[pose] });
}

function setOrientation(orientation: DeviceOrientation): PreviewState {
  const next = clampDeviceOrientation(orientation);
  return publish({ ...preview, pose: poseFor(next), orientation: next });
}

function poseFor(orientation: DeviceOrientation): DevicePosePreset | "custom" {
  for (const [pose, candidate] of Object.entries(DEVICE_ORIENTATION_PRESETS)) {
    if (
      candidate.pitchDeg === orientation.pitchDeg &&
      candidate.yawDeg === orientation.yawDeg &&
      candidate.rollDeg === orientation.rollDeg
    ) {
      return pose as DevicePosePreset;
    }
  }
  return "custom";
}

type PreviewApi = {
  readonly get: () => PreviewState;
  readonly reset: () => PreviewState;
  readonly setColourway: (colourway: Colourway) => PreviewState;
  readonly setOrientation: (orientation: DeviceOrientation) => PreviewState;
  readonly setPose: (pose: DevicePosePreset) => PreviewState;
  readonly setRoom: (room: PreviewRoom) => PreviewState;
};

declare global {
  interface Window {
    __webpodDevicePreview?: PreviewApi;
  }
}

type Drag = {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
  readonly orientation: DeviceOrientation;
};

const YAW_PER_PIXEL = 0.42;
const PITCH_PER_PIXEL = 0.28;

function bindOrientationControls(stage: HTMLElement): () => void {
  const drag: { current: Drag | null } = { current: null };
  const onPointerDown = (event: PointerEvent): void => {
    // The canvas also owns the real click-wheel input surface. Requiring a
    // modifier keeps ordinary pointer/touch input on the iPod instead of
    // letting the preview camera steal capture from the product interaction.
    if (event.button !== 0 || !event.shiftKey) return;
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      orientation: preview.orientation,
    };
    stage.setPointerCapture(event.pointerId);
    stage.focus({ preventScroll: true });
    event.preventDefault();
  };
  const onPointerMove = (event: PointerEvent): void => {
    const active = drag.current;
    if (active === null || event.pointerId !== active.pointerId) return;
    setOrientation({
      pitchDeg: active.orientation.pitchDeg + (event.clientY - active.y) * PITCH_PER_PIXEL,
      yawDeg: active.orientation.yawDeg + (event.clientX - active.x) * YAW_PER_PIXEL,
      rollDeg: active.orientation.rollDeg,
    });
    event.preventDefault();
  };
  const release = (event: PointerEvent): void => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    const delta = event.shiftKey ? 12 : 5;
    if (event.key === "ArrowLeft") {
      setOrientation({ ...preview.orientation, yawDeg: preview.orientation.yawDeg - delta });
    } else if (event.key === "ArrowRight") {
      setOrientation({ ...preview.orientation, yawDeg: preview.orientation.yawDeg + delta });
    } else if (event.key === "ArrowUp") {
      setOrientation({ ...preview.orientation, pitchDeg: preview.orientation.pitchDeg + delta });
    } else if (event.key === "ArrowDown") {
      setOrientation({ ...preview.orientation, pitchDeg: preview.orientation.pitchDeg - delta });
    } else if (event.key === "Home" || event.key === "1") {
      setPose("front");
    } else if (event.key === "3") {
      setPose("three-quarter");
    } else if (event.key === "9") {
      setPose("edge");
    } else if (event.key === "End" || event.key === "0") {
      setPose("rear");
    } else {
      return;
    }
    event.preventDefault();
  };

  stage.addEventListener("pointerdown", onPointerDown);
  stage.addEventListener("pointermove", onPointerMove, { passive: false });
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  stage.addEventListener("keydown", onKeyDown);
  return () => {
    stage.removeEventListener("pointerdown", onPointerDown);
    stage.removeEventListener("pointermove", onPointerMove);
    stage.removeEventListener("pointerup", release);
    stage.removeEventListener("pointercancel", release);
    stage.removeEventListener("keydown", onKeyDown);
  };
}

function DeviceSpike() {
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  const stageRef = useRef<HTMLDivElement>(null);
  const capture = new URLSearchParams(window.location.search).has("capture");

  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;
    return bindOrientationControls(stage);
  }, []);

  useEffect(() => {
    window.__webpodDevicePreview = {
      get: snapshot,
      reset: () => publish(INITIAL),
      setColourway: (colourway) => publish({ ...preview, colourway }),
      setOrientation,
      setPose,
      setRoom: (room) => publish({ ...preview, room }),
    };
    return () => {
      delete window.__webpodDevicePreview;
    };
  }, []);

  if (!import.meta.env.DEV) return <main>Not available.</main>;

  const panelTone = state.colourway === "white" ? "light" : "dark";
  return (
    <main
      className="webpod-device-preview"
      data-room={state.room}
      data-colourway={state.colourway}
      data-pose={state.pose}
    >
      <style>{DEVICE_PREVIEW_CSS}</style>
      <div
        ref={stageRef}
        className="webpod-device-preview__stage"
        tabIndex={0}
        aria-label="Three-dimensional iPod preview. Shift-drag or use arrow keys to rotate; Home and End show front and rear."
      >
        <CompositeDevice
          className="webpod-device-preview__device"
          colourway={state.colourway}
          panelTone={panelTone}
          cameraFov={30}
          cameraSafePadding={capture ? 34 : 48}
          orientation={state.orientation}
          panel={<Panel colourway={panelTone} state="ready" />}
        />
      </div>
      {capture ? null : <PreviewControls state={state} />}
    </main>
  );
}

function PreviewControls({ state }: { readonly state: PreviewState }) {
  return (
    <nav className="webpod-device-preview__controls" aria-label="Device preview controls">
      <button type="button" onClick={() => publish({ ...state, colourway: "black" })}>Black</button>
      <button type="button" onClick={() => publish({ ...state, colourway: "white" })}>White</button>
      <button type="button" onClick={() => setPose("front")}>Front</button>
      <button type="button" onClick={() => setPose("three-quarter")}>Quarter</button>
      <button type="button" onClick={() => setPose("edge")}>Edge</button>
      <button type="button" onClick={() => setPose("rear")}>Rear</button>
      <button
        type="button"
        onClick={() => publish({ ...state, room: state.room === "dark" ? "light" : "dark" })}
      >
        {state.room === "dark" ? "Light room" : "Dark room"}
      </button>
    </nav>
  );
}

const DEVICE_PREVIEW_CSS = `
  html:has(.webpod-device-preview), body:has(.webpod-device-preview) {
    margin: 0;
    min-inline-size: 0;
    min-block-size: 100%;
    overscroll-behavior: none;
  }
  .webpod-device-preview {
    position: fixed;
    inset: 0;
    min-inline-size: 0;
    overflow: clip;
    color: #eef2f7;
    background: radial-gradient(ellipse 88% 72% at 46% 28%, #303640 0%, #171b22 50%, #090b0f 100%);
  }
  .webpod-device-preview[data-room="light"] {
    color: #121821;
    background: radial-gradient(ellipse 90% 76% at 44% 25%, #fbfcfe 0%, #e8ecf2 52%, #c9d0da 100%);
  }
  .webpod-device-preview__stage {
    position: absolute;
    inset: 0;
    min-inline-size: 0;
    outline: none;
    cursor: default;
    touch-action: none;
  }
  .webpod-device-preview__stage:focus-visible::after {
    content: "";
    position: absolute;
    inset: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
    border: 2px solid rgb(125 211 252 / .78);
    border-radius: 18px;
    pointer-events: none;
  }
  .webpod-device-preview__device,
  .webpod-device-preview__device > div,
  .webpod-device-preview__device canvas {
    inline-size: 100% !important;
    block-size: 100% !important;
  }
  .webpod-device-preview__controls {
    position: absolute;
    z-index: 3;
    inset-block-end: max(10px, env(safe-area-inset-bottom));
    inset-inline: max(10px, env(safe-area-inset-left)) max(10px, env(safe-area-inset-right));
    display: flex;
    flex-wrap: wrap;
    justify-content: safe center;
    gap: 6px;
    pointer-events: none;
  }
  .webpod-device-preview__controls button {
    min-block-size: 36px;
    padding: 8px 12px;
    border: 1px solid rgb(255 255 255 / .15);
    border-radius: 999px;
    color: inherit;
    background: rgb(8 11 16 / .68);
    backdrop-filter: blur(14px);
    font: 650 11px/1 ui-sans-serif, system-ui, sans-serif;
    pointer-events: auto;
    cursor: pointer;
  }
  .webpod-device-preview[data-room="light"] .webpod-device-preview__controls button {
    border-color: rgb(15 23 42 / .12);
    background: rgb(255 255 255 / .7);
  }
  .webpod-device-preview__controls button:focus-visible {
    outline: 2px solid #38bdf8;
    outline-offset: 2px;
  }
  @media (max-width: 520px) {
    .webpod-device-preview__controls { gap: 4px; }
    .webpod-device-preview__controls button { min-block-size: 34px; padding-inline: 9px; }
  }
  @media (prefers-reduced-transparency: reduce) {
    .webpod-device-preview__controls button { backdrop-filter: none; background: #111827; }
    .webpod-device-preview[data-room="light"] .webpod-device-preview__controls button { background: #fff; }
  }
`;
