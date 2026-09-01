import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  PMREMGenerator,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type StudioInstallation = {
  readonly gl: WebGLRenderer;
  readonly scene: Scene;
  readonly sigma: number;
  readonly intensity: number;
  readonly invalidate: () => void;
};

export type StudioEnvironmentSnapshot = {
  readonly texture: Texture | null;
  readonly intensity: number;
};

const EMPTY_STUDIO_ENVIRONMENT: StudioEnvironmentSnapshot = Object.freeze({
  texture: null,
  intensity: 0,
});
const studioByScene = new WeakMap<Scene, StudioEnvironmentSnapshot>();
const listenersByScene = new WeakMap<Scene, Set<() => void>>();

function readStudioEnvironment(scene: Scene): StudioEnvironmentSnapshot {
  return studioByScene.get(scene) ?? EMPTY_STUDIO_ENVIRONMENT;
}

function publishStudioEnvironment(
  scene: Scene,
  snapshot: StudioEnvironmentSnapshot,
): void {
  if (snapshot.texture === null) {
    studioByScene.delete(scene);
  } else {
    studioByScene.set(scene, snapshot);
  }
  for (const listener of listenersByScene.get(scene) ?? []) listener();
}

function subscribeToStudioEnvironment(
  scene: Scene,
  listener: () => void,
): () => void {
  const listeners = listenersByScene.get(scene) ?? new Set<() => void>();
  listeners.add(listener);
  listenersByScene.set(scene, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) listenersByScene.delete(scene);
  };
}

/**
 * Preserve a surface's authored PMREM response when one exists.
 *
 * Three's scene-level intensity is the fallback for materials that inherit the
 * scene environment. It is not an additional multiplier on an explicit
 * material map: applying it twice crushes the black shell and glass response.
 */
export function effectiveStudioEnvironmentIntensity(
  surfaceIntensity: number | undefined,
  studioIntensity: number,
): number {
  return surfaceIntensity ?? studioIntensity;
}

function installStudioEnvironment({
  gl,
  scene,
  sigma,
  intensity,
  invalidate,
}: StudioInstallation) {
  const room = new RoomEnvironment();
  const generator = new PMREMGenerator(gl);
  generator.compileEquirectangularShader();
  const target = generator.fromScene(room, sigma);
  const previousEnvironment = scene.environment;
  const previousIntensity = scene.environmentIntensity;
  const previousSnapshot = readStudioEnvironment(scene);
  const snapshot = Object.freeze({ texture: target.texture, intensity });
  scene.environment = target.texture;
  scene.environmentIntensity = intensity;
  publishStudioEnvironment(scene, snapshot);
  invalidate();

  return () => {
    if (scene.environment === target.texture) {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
    }
    if (readStudioEnvironment(scene).texture === target.texture) {
      publishStudioEnvironment(scene, previousSnapshot);
    }
    target.dispose();
    generator.dispose();
    room.dispose();
    invalidate();
  };
}

/** PBR image-based studio shared by every device pose and colourway. */
export type StudioEnvironmentProps = {
  /** PMREM blur in radians. Kept broad enough to read as a softbox, not bands. */
  readonly sigma?: number;
  /** Scene-level IBL gain; individual materials retain their own response. */
  readonly intensity?: number;
};

/** Restrained IBL: enough for material identity, below the authored lamps. */
export const DEFAULT_STUDIO_ENVIRONMENT = Object.freeze({
  sigma: 0.04,
  intensity: 0.2,
});

/**
 * Read the PMREM texture installed for this R3F scene.
 *
 * Three replaces `material.envMapIntensity` with `scene.environmentIntensity`
 * whenever a material inherits a scene environment. Device materials consume
 * this snapshot as an explicit `envMap`, retaining their own authored gains.
 */
export function useStudioEnvironmentSnapshot(): StudioEnvironmentSnapshot {
  const scene = useThree((state) => state.scene);
  const subscribe = useCallback(
    (listener: () => void) => subscribeToStudioEnvironment(scene, listener),
    [scene],
  );
  const read = useCallback(() => readStudioEnvironment(scene), [scene]);
  return useSyncExternalStore(subscribe, read, () => EMPTY_STUDIO_ENVIRONMENT);
}

/**
 * Install a Three {@link RoomEnvironment} through one PMREM conversion.
 *
 * The generated render target belongs to this component and is disposed on
 * unmount. The environment stays in world space while the single model group
 * rotates, so no highlight is attached to a pose or to the camera.
 */
export function StudioEnvironment({
  sigma = DEFAULT_STUDIO_ENVIRONMENT.sigma,
  intensity = DEFAULT_STUDIO_ENVIRONMENT.intensity,
}: StudioEnvironmentProps) {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(
    () =>
      installStudioEnvironment({ gl, scene, sigma, intensity, invalidate }),
    [gl, intensity, invalidate, scene, sigma],
  );

  return null;
}
