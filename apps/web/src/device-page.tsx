import {
  DEFAULT_DEVICE_MATERIALS,
  DEVICE_ORIENTATION_PRESETS,
  DeviceCanvas,
  DEFAULT_LIGHT_RIG,
  lightRigForContribution,
  type Colourway,
  type DeviceMaterials,
  type DeviceOrientation,
  type DeviceOrientationGrabStart,
  type DevicePosePreset,
  type LightRigParams,
  type LightContribution,
} from "@webpod/device";
import { useAtomValue } from "jotai";
import { DeviceSettings, InteractionSoundSetting, deviceSettingsStore, interactionAudioEnabledAtom } from "./device-settings";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import { applePlaybackDiagnostics, deriveApplePlaybackDiagnosis, serializeApplePlaybackDiagnostics, type AppleEmeCapability, type ApplePlaybackDiagnosticEvent } from "./apple-playback-diagnostics";
import {
  bindDeviceOrientationControls,
  createDevicePreviewStore,
  type DeviceOrientationControls,
  type DevicePreviewRoom,
  type DevicePreviewState,
} from "./device-preview-orientation";
import { ProductionDeviceView } from "./production-device-view";
import {
  authorizeAppleRuntime,
  musicRuntime,
  resolveMusicRuntimeMode,
  selectMusicRuntime,
  signOutAppleRuntime,
  type MusicRuntimeMode,
} from "./music-runtime";

function lightingContribution(value: string | null): LightContribution {
  return value === "key-only" || value === "fill-only" || value === "rim-only" || value === "environment-only" ? value : "combined";
}

function isColourway(value: string | null): value is Colourway {
  return value === "black" || value === "white";
}

const PRODUCTION_LIGHT_RIGS = {
  combined: lightRigForContribution(DEFAULT_LIGHT_RIG, "combined"),
  "key-only": lightRigForContribution(DEFAULT_LIGHT_RIG, "key-only"),
  "fill-only": lightRigForContribution(DEFAULT_LIGHT_RIG, "fill-only"),
  "rim-only": lightRigForContribution(DEFAULT_LIGHT_RIG, "rim-only"),
  "environment-only": lightRigForContribution(DEFAULT_LIGHT_RIG, "environment-only"),
} satisfies Readonly<Record<LightContribution, LightRigParams>>;

type GeometryEvidenceView =
  | "front"
  | "three-quarter"
  | "left-edge"
  | "right-edge"
  | "rear"
  | "rear-three-quarter"
  | "top"
  | "bottom";

const GEOMETRY_EVIDENCE_ORIENTATIONS: Readonly<
  Record<GeometryEvidenceView, DeviceOrientation>
> = Object.freeze({
  front: DEVICE_ORIENTATION_PRESETS.front,
  "three-quarter": DEVICE_ORIENTATION_PRESETS["three-quarter"],
  "left-edge": Object.freeze({ pitchDeg: 0, yawDeg: 90, rollDeg: 0 }),
  "right-edge": DEVICE_ORIENTATION_PRESETS.edge,
  rear: DEVICE_ORIENTATION_PRESETS.rear,
  "rear-three-quarter": Object.freeze({ pitchDeg: 10, yawDeg: 146, rollDeg: -2 }),
  top: Object.freeze({ pitchDeg: 90, yawDeg: 0, rollDeg: 0 }),
  bottom: Object.freeze({ pitchDeg: -90, yawDeg: 0, rollDeg: 0 }),
});

const previewStore = createDevicePreviewStore();

type PreviewApi = {
  readonly get: () => DevicePreviewState;
  readonly reset: () => DevicePreviewState;
  readonly setColourway: (colourway: Colourway) => DevicePreviewState;
  readonly setOrientation: (orientation: DeviceOrientation) => DevicePreviewState;
  readonly setPose: (pose: DevicePosePreset) => DevicePreviewState;
  readonly setRoom: (room: DevicePreviewRoom) => DevicePreviewState;
};

declare global {
  interface Window {
    __webpodDevicePreview?: PreviewApi;
  }
}

const NEUTRAL_SURFACE = Object.freeze({
  color: "#7D8288",
  albedoScale: 0.62,
  roughness: 0.72,
  metalness: 0,
  clearcoat: 0,
  envMapIntensity: 0,
  sheen: 0,
  specularIntensity: 0.08,
});

const NEUTRAL_SELECT_SURFACE = Object.freeze({
  ...NEUTRAL_SURFACE,
  color: "#989EA5",
  albedoScale: 0.7,
  roughness: 0.58,
});

const NEUTRAL_DIAGNOSTIC_MATERIALS: DeviceMaterials = Object.freeze({
  ...DEFAULT_DEVICE_MATERIALS,
  bodyBlack: NEUTRAL_SURFACE,
  bodyWhite: NEUTRAL_SURFACE,
  steelBack: NEUTRAL_SURFACE,
  wheelRingBlack: NEUTRAL_SURFACE,
  wheelRingWhite: NEUTRAL_SURFACE,
  wheelWellBlack: NEUTRAL_SURFACE,
  wheelWellWhite: NEUTRAL_SURFACE,
  selectBlack: NEUTRAL_SELECT_SURFACE,
  selectWhite: NEUTRAL_SELECT_SURFACE,
  chromeSeam: NEUTRAL_SURFACE,
  chromeSeamBlack: NEUTRAL_SURFACE,
  displayWell: NEUTRAL_SURFACE,
  rearInlay: NEUTRAL_SURFACE,
});

const NEUTRAL_DIAGNOSTIC_LIGHT_RIG: LightRigParams = Object.freeze({
  exposure: 1,
  rim: { ...DEFAULT_LIGHT_RIG.rim, enabled: false },
  key: {
    enabled: true,
    viewerAzimuthDeg: 35,
    descentDeg: 35,
    distance: 1_000,
    power: 2_400_000,
    emitter: { width: 700, height: 500 },
    color: "#FFFFFF",
  },
  kick: {
    enabled: true,
    viewerAzimuthDeg: -35,
    elevationDeg: -35,
    distance: 1_000,
    target: [0, 0, 0] as const,
    powerRatio: 1,
    emitter: { width: 700, height: 500 },
    color: "#FFFFFF",
  },
});

/** The canonical browser product page; diagnostic overrides remain development-only. */
export function DevicePage() {
  const interactionAudioEnabled = useAtomValue(interactionAudioEnabledAtom, { store: deviceSettingsStore });
  const state = useSyncExternalStore(
    previewStore.subscribe,
    previewStore.getSnapshot,
    previewStore.getSnapshot,
  );
  const stageRef = useRef<HTMLDivElement>(null);
  const orientationControlsRef = useRef<DeviceOrientationControls | null>(null);
  const onOrientationGrabStart = useCallback(
    (start: DeviceOrientationGrabStart): boolean =>
      orientationControlsRef.current?.begin(start) ?? false,
    [],
  );
  const onOrientationGrabHoverChange = useCallback((grabbable: boolean) => {
    orientationControlsRef.current?.setGrabbable(grabbable);
  }, []);
  const search = new URLSearchParams(window.location.search);
  const music = useSyncExternalStore(
    musicRuntime.subscribe,
    musicRuntime.getSnapshot,
    musicRuntime.getSnapshot,
  );
  const playbackDiagnostics = useSyncExternalStore(
    applePlaybackDiagnostics.subscribe,
    applePlaybackDiagnostics.getSnapshot,
    applePlaybackDiagnostics.getSnapshot,
  );
  const selectedMusicMode: MusicRuntimeMode = resolveMusicRuntimeMode(
    search.get("provider"),
    import.meta.env.VITE_WEBPOD_PROVIDER,
  );
  const capture = import.meta.env.DEV && search.has("capture");
  const diagnosticMode = search.get("diagnostic");
  const diagnostic = import.meta.env.DEV && diagnosticMode === "neutral";
  const productionSurfaceCapture =
    capture && diagnosticMode === "production-surface";
  const lightContribution = lightingContribution(search.get("lighting"));
  const productionLightRig = PRODUCTION_LIGHT_RIGS[lightContribution];
  const requestedView = search.get("view");
  const requestedColourway = search.get("colourway");
  const evidenceOrientation =
    capture && isGeometryEvidenceView(requestedView)
      ? GEOMETRY_EVIDENCE_ORIENTATIONS[requestedView]
      : null;
  const evidenceColourway =
    capture && isColourway(requestedColourway)
      ? requestedColourway
      : null;
  const renderedState = {
    ...state,
    ...(evidenceOrientation === null
      ? {}
      : { pose: "custom" as const, orientation: evidenceOrientation }),
    ...(evidenceColourway === null ? {} : { colourway: evidenceColourway }),
  };

  useEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;
    const controls = bindDeviceOrientationControls(stage, previewStore);
    orientationControlsRef.current = controls;
    return () => {
      orientationControlsRef.current = null;
      controls.dispose();
    };
  }, []);

  useEffect(() => {
    void selectMusicRuntime(selectedMusicMode);
  }, [selectedMusicMode]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    applePlaybackDiagnostics.enable();
    return () => { applePlaybackDiagnostics.disable(); };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__webpodDevicePreview = {
      get: previewStore.getSnapshot,
      reset: previewStore.resetOrientation,
      setColourway: previewStore.setColourway,
      setOrientation: previewStore.setOrientation,
      setPose: previewStore.setPose,
      setRoom: previewStore.setRoom,
    };
    return () => {
      delete window.__webpodDevicePreview;
    };
  }, []);

  return (
    <main
      className="webpod-device-preview"
      data-room={renderedState.room}
      data-colourway={renderedState.colourway}
      data-pose={renderedState.pose}
      data-evidence-view={evidenceOrientation === null ? undefined : requestedView}
      data-lighting-pass={diagnostic ? "neutral" : lightContribution}
    >
      <style>{DEVICE_PREVIEW_CSS}</style>
      <div
        ref={stageRef}
        className="webpod-device-preview__stage"
        role="region"
        tabIndex={0}
        aria-label="Three-dimensional iPod preview. Drag a visible outer edge to rotate, Option or Alt-drag an edge to roll, use arrow keys to rotate, or press Home to reset."
      >
        {diagnostic ? (
          <DeviceCanvas
            className="webpod-device-preview__device"
            colourway={renderedState.colourway}
            cameraFov={30}
            cameraSafePadding={capture ? 34 : 48}
            orientation={renderedState.orientation}
            materials={NEUTRAL_DIAGNOSTIC_MATERIALS}
            lightRig={NEUTRAL_DIAGNOSTIC_LIGHT_RIG}
            studioEnvironment={null}
            onOrientationGrabStart={onOrientationGrabStart}
            onOrientationGrabHoverChange={onOrientationGrabHoverChange}
          />
        ) : productionSurfaceCapture ? (
          <DeviceCanvas
            className="webpod-device-preview__device"
            colourway={renderedState.colourway}
            cameraFov={30}
            cameraSafePadding={34}
            orientation={renderedState.orientation}
            lightRig={productionLightRig}
            studioEnvironment={undefined}
            onOrientationGrabStart={onOrientationGrabStart}
            onOrientationGrabHoverChange={onOrientationGrabHoverChange}
          />
        ) : (
          <ProductionDeviceView
            interactionAudioEnabled={interactionAudioEnabled}
            className="webpod-device-preview__device"
            colourway={renderedState.colourway}
            cameraFov={30}
            cameraSafePadding={capture ? 34 : 48}
            orientation={renderedState.orientation}
            onOrientationGrabStart={onOrientationGrabStart}
            onOrientationGrabHoverChange={onOrientationGrabHoverChange}
          />
        )}
      </div>
      {capture ? null : (
        <>
          <p className="webpod-device-preview__selection-note">
            Drag a visible edge to rotate · Option/Alt-drag to roll
          </p>
          <nav className="webpod-device-preview__controls" aria-label="Device controls">
            <button type="button" onClick={previewStore.resetOrientation}>Reset view</button>
            <DeviceSettings>
              <PreviewControls state={state} music={music} />
              {import.meta.env.DEV ? <PlaybackDiagnostics events={playbackDiagnostics.events} emeCapability={playbackDiagnostics.emeCapability} /> : null}
            </DeviceSettings>
          </nav>
        </>
      )}
    </main>
  );
}

function reading(value: string | number | boolean | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

export function PlaybackDiagnostics({ events, emeCapability }: { readonly events: readonly ApplePlaybackDiagnosticEvent[]; readonly emeCapability: AppleEmeCapability | null }) {
  const latest = events.at(-1);
  const diagnosis = deriveApplePlaybackDiagnosis({ enabled: true, events, emeCapability });
  const causal = diagnosis.causalSequence === null ? undefined : events.find((event) => event.sequence === diagnosis.causalSequence);
  return (
    <section className="webpod-device-preview__playback-diagnostics" aria-label="Apple playback diagnostics">
      <div className="webpod-device-preview__diagnosis" data-kind={diagnosis.kind} role="status" aria-live="polite" aria-atomic="true">
        <span>Playback diagnosis</span>
        <strong>{diagnosis.headline}</strong>
        <p>{diagnosis.nextAction}</p>
      </div>
      <details>
        <summary>Technical timeline ({events.length})</summary>
        <button type="button" onClick={() => applePlaybackDiagnostics.clear()}>Clear timeline</button>
        <button type="button" onClick={() => void navigator.clipboard.writeText(serializeApplePlaybackDiagnostics({ enabled: true, events, emeCapability }))}>Copy diagnostics</button>
        <p>Encrypted media: {emeCapability ?? "probing"}</p>
        {latest === undefined ? <p>No playback events captured.</p> : (
          <dl>
            <div><dt>Causal</dt><dd>{causal === undefined ? "—" : <>#{causal.sequence} {causal.event} @ {causal.timestampMs}ms</>}</dd></div>
            <div><dt>Latest</dt><dd>#{latest.sequence} {latest.event} @ {latest.timestampMs}ms</dd></div>
            <div><dt>Error class</dt><dd>{causal?.errorClass ?? "—"}</dd></div>
            <div><dt>MusicKit</dt><dd>state {reading(latest.musicKit.playbackState)} ({reading(latest.musicKit.playbackStateName)}) · time {reading(latest.musicKit.currentTime)} · duration {reading(latest.musicKit.duration)} · volume {reading(latest.musicKit.volume)} · session {reading(latest.musicKit.authorized)} · preview {reading(latest.musicKit.previewOnly)}</dd></div>
            <div><dt>Queue</dt><dd>present {reading(latest.queue.present)} · items {reading(latest.queue.length)} · position {reading(latest.queue.position)} · now playing {reading(latest.queue.hasNowPlayingItem)} · result {reading(latest.operation?.queueResult)}</dd></div>
            {latest.operation === undefined ? null : <div><dt>Target</dt><dd>{reading(latest.operation.targetKind)} · total {reading(latest.operation.targetItemCount)} · queued {reading(latest.operation.queuedItemCount)} · start {reading(latest.operation.startIndex)} · offset {reading(latest.operation.queueOffset)}</dd></div>}
            {latest.playbackEventState === undefined ? null : <div><dt>Latest state</dt><dd>{reading(latest.playbackEventState.value)} ({reading(latest.playbackEventState.name)})</dd></div>}
            {latest.mediaItemState === undefined ? null : <div><dt>Latest item</dt><dd>{reading(latest.mediaItemState.value)} ({reading(latest.mediaItemState.name)})</dd></div>}
            <div><dt>Audio</dt><dd>paused {reading(latest.audio.paused)} · muted {reading(latest.audio.muted)} · volume {reading(latest.audio.volume)} · ready {reading(latest.audio.readyState)} · network {reading(latest.audio.networkState)} · error {reading(latest.audio.errorCode)}</dd></div>
            <div><dt>Activation</dt><dd>active {reading(latest.userActivation.isActive)} · ever active {reading(latest.userActivation.hasBeenActive)}</dd></div>
          </dl>
        )}
        <ol aria-label="Playback event timeline">{events.map((event) => (
          <li key={event.sequence} data-causal={event.sequence === diagnosis.causalSequence || undefined} data-latest={event.sequence === latest?.sequence || undefined}>
            #{event.sequence} · {event.timestampMs}ms · {event.event}
            {event.sequence === diagnosis.causalSequence ? <strong> Causal failure</strong> : null}
            {event.sequence === latest?.sequence && event.sequence !== diagnosis.causalSequence ? <span> Latest follow-up</span> : null}
          </li>
        ))}</ol>
      </details>
    </section>
  );
}

function isGeometryEvidenceView(
  value: string | null,
): value is GeometryEvidenceView {
  return value !== null && value in GEOMETRY_EVIDENCE_ORIENTATIONS;
}

export function PreviewControls({ state, music }: { readonly state: DevicePreviewState; readonly music: ReturnType<typeof musicRuntime.getSnapshot> }) {
  return (
    <section className="webpod-device-settings__options" aria-label="Device preferences">
      <h2 className="basis-full text-sm font-semibold">Appearance</h2>
      <button
        type="button"
        aria-pressed={state.colourway === "black"}
        onClick={() => previewStore.setColourway("black")}
      >
        Black
      </button>
      <button
        type="button"
        aria-pressed={state.colourway === "white"}
        onClick={() => previewStore.setColourway("white")}
      >
        Silver
      </button>
      <button
        type="button"
        aria-pressed={state.room === "light"}
        onClick={() => previewStore.setRoom(state.room === "dark" ? "light" : "dark")}
      >
        Light room
      </button>
      <h2 className="mt-3 basis-full text-sm font-semibold">Interaction</h2>
      <InteractionSoundSetting />
      <h2 className="mt-3 basis-full text-sm font-semibold">Apple Music</h2>
      {music.activeMode === "apple" && (music.phase === "signed-out" || music.phase === "permission-denied") ? (
        <button type="button" onClick={() => void authorizeAppleRuntime()}>
          Sign in to Apple Music
        </button>
      ) : null}
      {music.activeMode === "apple" && music.phase === "authorized" ? (
        <button type="button" onClick={() => void signOutAppleRuntime()}>
          Sign out of Apple Music
        </button>
      ) : null}
      {music.requestedMode === "apple" && music.phase === "error" ? (
        <button className="webpod-device-preview__retry" type="button" onClick={() => void selectMusicRuntime("apple")}>
          Retry Apple Music
        </button>
      ) : null}
      <output aria-live="polite">
        {music.message ?? `Apple Music: ${music.phase}`}
      </output>
    </section>
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
    -webkit-user-select: none;
    user-select: none;
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
  }
  .webpod-device-preview__stage[data-orientation-grab="active"] {
    user-select: none;
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
  .webpod-device-settings { pointer-events: auto; font: 500 13px/1.5 ui-sans-serif, system-ui, sans-serif; }
  .webpod-device-settings__options { display: flex; flex-wrap: wrap; gap: 8px; }
  .webpod-device-settings__options h2 { margin-bottom: 0; }
  .webpod-device-settings__options output { flex-basis: 100%; overflow-wrap: anywhere; color: #cbd5e1; }
  .webpod-device-settings .webpod-device-preview__playback-diagnostics {
    position: static; inline-size: auto; max-block-size: none; border-color: rgb(255 255 255 / .12);
  }
  .webpod-device-preview__controls .webpod-device-settings button {
    min-block-size: 44px; color: #eef2f7; background: #222b38; border-color: rgb(255 255 255 / .16); backdrop-filter: none;
  }
  .webpod-device-preview__controls .webpod-device-settings button[aria-pressed="true"] {
    color: #111827; background: #e2e8f0; border-color: #f8fafc;
  }
  .webpod-device-preview__selection-note {
    position: absolute;
    z-index: 4;
    inset-block-start: max(12px, env(safe-area-inset-top));
    inset-inline-start: max(14px, env(safe-area-inset-left));
    margin: 0;
    color: inherit;
    font: 500 12px/1.4 ui-sans-serif, system-ui, sans-serif;
    user-select: none;
    pointer-events: auto;
  }
  .webpod-device-preview__playback-diagnostics {
    position: absolute;
    z-index: 5;
    inset-block-start: max(42px, env(safe-area-inset-top));
    inset-inline-end: max(12px, env(safe-area-inset-right));
    inline-size: min(430px, calc(100vw - 24px));
    max-block-size: min(58vh, 560px);
    overflow: auto;
    padding: 10px 12px;
    border: 1px solid rgb(125 211 252 / .5);
    border-radius: 10px;
    color: #e5edf7;
    background: rgb(7 11 17 / .9);
    font: 500 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace;
    user-select: text;
  }
  .webpod-device-preview__diagnosis { display: grid; gap: 3px; padding: 2px 2px 10px; }
  .webpod-device-preview__diagnosis > span { color: #7dd3fc; font-size: 11px; font-weight: 750; letter-spacing: .08em; text-transform: uppercase; }
  .webpod-device-preview__diagnosis > strong { color: #f8fafc; font: 750 13px/1.35 ui-sans-serif, system-ui, sans-serif; text-wrap: balance; }
  .webpod-device-preview__diagnosis > p { margin: 0; color: #cbd5e1; font: 500 11px/1.45 ui-sans-serif, system-ui, sans-serif; text-wrap: pretty; }
  .webpod-device-preview__playback-diagnostics details { border-block-start: 1px solid rgb(125 211 252 / .24); padding-block-start: 8px; }
  .webpod-device-preview__playback-diagnostics summary { cursor: pointer; font-weight: 700; }
  .webpod-device-preview__playback-diagnostics button { margin-block: 8px; }
  .webpod-device-preview__playback-diagnostics dl,
  .webpod-device-preview__playback-diagnostics ol { margin: 8px 0 0; padding: 0; }
  .webpod-device-preview__playback-diagnostics dl div { display: grid; grid-template-columns: 72px 1fr; gap: 8px; }
  .webpod-device-preview__playback-diagnostics dt { color: #7dd3fc; }
  .webpod-device-preview__playback-diagnostics dd { margin: 0; overflow-wrap: anywhere; }
  .webpod-device-preview__playback-diagnostics ol { padding-inline-start: 22px; }
  .webpod-device-preview__playback-diagnostics li[data-causal="true"] { color: #fda4af; font-weight: 650; }
  .webpod-device-preview__playback-diagnostics li[data-latest="true"] > span { color: #93c5fd; font-weight: 650; }
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
  .webpod-device-preview[data-room="light"] .webpod-device-preview__controls > button {
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
    .webpod-device-preview__controls .webpod-device-preview__retry { min-block-size: 44px; }
  }
  @media (hover: hover) and (pointer: fine) {
    .webpod-device-preview__stage[data-orientation-grab="ready"] canvas {
      cursor: grab;
    }
    .webpod-device-preview__stage[data-orientation-grab="active"] canvas {
      cursor: grabbing;
    }
  }
  @media (prefers-reduced-transparency: reduce) {
    .webpod-device-preview__controls button { backdrop-filter: none; background: #111827; }
    .webpod-device-preview[data-room="light"] .webpod-device-preview__controls > button { background: #fff; }
  }
`;
