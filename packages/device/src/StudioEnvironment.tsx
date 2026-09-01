import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { PMREMGenerator, type Scene, type WebGLRenderer } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type StudioInstallation = {
  readonly gl: WebGLRenderer;
  readonly scene: Scene;
  readonly sigma: number;
  readonly intensity: number;
  readonly invalidate: () => void;
};

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
  scene.environment = target.texture;
  scene.environmentIntensity = intensity;
  invalidate();

  return () => {
    if (scene.environment === target.texture) {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
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
