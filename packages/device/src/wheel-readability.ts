import { Color, type MeshPhysicalMaterial, Vector3, type Texture } from "three";

import { PX_PER_MM } from "./layout";
import type { PhysicalSurfaceParams } from "./materials";
import { createPolycarbonateMaterial } from "./physical-materials";
import {
  WHEEL_REST_NORMAL_ATTRIBUTE,
  type WheelContactReadability,
  type WheelReadabilitySample,
} from "./control-physics";

/*
 * Keep the shader attribute name and controller-installed geometry attribute
 * on one exported constant; a mismatch would silently erase the rim response.
 */

/**
 * Contact-local grazing response, in physical units where possible.
 *
 * This is a deliberately weak virtual product-light card, not extra control
 * travel. It sits almost tangent to the wheel and reaches Three's physical
 * BRDF only where the real displaced normals turn away from the contact-centre
 * normal. That slope gate prevents a diffuse spotlight disc on flat plastic.
 * Other meshes cannot receive this term, and zero rest intensity removes it.
 */
export const WHEEL_GRAZING_RESPONSE = Object.freeze({
  tangentOffsetMm: 7.5,
  surfaceLiftMm: 1.2,
  rangeMm: 16,
  innerConeDeg: 20,
  outerConeDeg: 42,
  normalSlopeStartDeg: 1,
  normalSlopeFullDeg: 1.35,
  peakLinearIrradiance: 0.06,
  color: "#FFF9F2",
});

export type WheelGrazingPose = {
  readonly position: Readonly<{ x: number; y: number; z: number }>;
  readonly target: Readonly<{ x: number; y: number; z: number }>;
  readonly direction: Readonly<{ x: number; y: number; z: number }>;
  readonly normal: Readonly<{ x: number; y: number; z: number }>;
  readonly range: number;
  readonly innerConeCos: number;
  readonly outerConeCos: number;
  readonly irradiance: number;
};

function radians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Resolve one continuous, body-local grazing pose from physical contact. */
export function wheelGrazingPose(
  sample: WheelReadabilitySample,
): WheelGrazingPose {
  const point = new Vector3(sample.point.x, sample.point.y, sample.point.z);
  const normal = new Vector3(
    sample.normal.x,
    sample.normal.y,
    sample.normal.z,
  ).normalize();
  const radialLength = Math.hypot(point.x, point.y);
  const tangent = new Vector3(
    radialLength === 0 ? 0 : -point.y / radialLength,
    radialLength === 0 ? 1 : point.x / radialLength,
    0,
  );
  tangent.addScaledVector(normal, -tangent.dot(normal)).normalize();
  const position = point
    .clone()
    .addScaledVector(
      tangent,
      WHEEL_GRAZING_RESPONSE.tangentOffsetMm * PX_PER_MM,
    )
    .addScaledVector(
      normal,
      WHEEL_GRAZING_RESPONSE.surfaceLiftMm * PX_PER_MM,
    );
  const direction = point.clone().sub(position).normalize();
  const engagement = Math.max(0, Math.min(1, sample.engagement));
  return {
    position,
    target: point,
    direction,
    normal,
    range: WHEEL_GRAZING_RESPONSE.rangeMm * PX_PER_MM,
    innerConeCos: Math.cos(radians(WHEEL_GRAZING_RESPONSE.innerConeDeg)),
    outerConeCos: Math.cos(radians(WHEEL_GRAZING_RESPONSE.outerConeDeg)),
    irradiance:
      WHEEL_GRAZING_RESPONSE.peakLinearIrradiance * engagement,
  };
}

type ShaderUniform<T> = { value: T };
type CompilableShader = {
  readonly uniforms: Record<string, ShaderUniform<unknown>>;
  vertexShader: string;
  fragmentShader: string;
};

const VERTEX_COMMON = `#include <common>
uniform vec3 webpodWheelGrazingPosition;
uniform vec3 webpodWheelGrazingDirection;
attribute vec3 ${WHEEL_REST_NORMAL_ATTRIBUTE};
varying vec3 webpodWheelGrazingPositionView;
varying vec3 webpodWheelGrazingDirectionView;
varying vec3 webpodWheelRestNormalView;`;

const VERTEX_POSITION = `#include <project_vertex>
webpodWheelGrazingPositionView = ( modelViewMatrix * vec4( webpodWheelGrazingPosition, 1.0 ) ).xyz;
webpodWheelGrazingDirectionView = normalize( mat3( modelViewMatrix ) * webpodWheelGrazingDirection );
webpodWheelRestNormalView = normalize( normalMatrix * ${WHEEL_REST_NORMAL_ATTRIBUTE} );`;

const FRAGMENT_COMMON = `#include <common>
uniform vec3 webpodWheelGrazingColor;
uniform float webpodWheelGrazingIrradiance;
uniform float webpodWheelGrazingRange;
uniform float webpodWheelGrazingInnerCos;
uniform float webpodWheelGrazingOuterCos;
uniform float webpodWheelGrazingSlopeStart;
uniform float webpodWheelGrazingSlopeFull;
varying vec3 webpodWheelGrazingPositionView;
varying vec3 webpodWheelGrazingDirectionView;
varying vec3 webpodWheelRestNormalView;`;

const FRAGMENT_LIGHT = `#include <lights_fragment_begin>
#if defined( RE_Direct )
  if ( webpodWheelGrazingIrradiance > 0.0 ) {
    vec3 webpodWheelToLight = webpodWheelGrazingPositionView - geometryPosition;
    float webpodWheelLightDistance = length( webpodWheelToLight );
    vec3 webpodWheelLightDirection = webpodWheelToLight / max( webpodWheelLightDistance, 0.00001 );
    float webpodWheelConeCos = dot( -webpodWheelLightDirection, normalize( webpodWheelGrazingDirectionView ) );
    float webpodWheelCone = smoothstep( webpodWheelGrazingOuterCos, webpodWheelGrazingInnerCos, webpodWheelConeCos );
    float webpodWheelRangeWindow = saturate( 1.0 - webpodWheelLightDistance / webpodWheelGrazingRange );
    vec3 webpodWheelRestNormal = normalize( webpodWheelRestNormalView );
    float webpodWheelFacingSlope = max( 0.0, dot( geometryNormal - webpodWheelRestNormal, webpodWheelLightDirection ) );
    float webpodWheelNormalRim = smoothstep( webpodWheelGrazingSlopeStart, webpodWheelGrazingSlopeFull, webpodWheelFacingSlope );
    IncidentLight webpodWheelGrazingLight;
    webpodWheelGrazingLight.color = webpodWheelGrazingColor * webpodWheelGrazingIrradiance * webpodWheelCone * webpodWheelRangeWindow * webpodWheelRangeWindow * webpodWheelNormalRim;
    webpodWheelGrazingLight.direction = webpodWheelLightDirection;
    webpodWheelGrazingLight.visible = webpodWheelCone > 0.0 && webpodWheelRangeWindow > 0.0 && webpodWheelNormalRim > 0.0;
    RE_Direct( webpodWheelGrazingLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  }
#endif`;

/** Install the wheel-only direct-light term into Three's physical pipeline. */
export function patchWheelGrazingShader(shader: CompilableShader): void {
  const originalVertex = shader.vertexShader;
  const originalFragment = shader.fragmentShader;
  const hasEveryRequiredSeam =
    originalVertex.includes("#include <common>") &&
    originalVertex.includes("#include <project_vertex>") &&
    originalFragment.includes("#include <common>") &&
    originalFragment.includes("#include <lights_fragment_begin>");
  if (!hasEveryRequiredSeam) {
    throw new Error(
      "Three physical shader changed; wheel grazing response was not installed",
    );
  }
  shader.vertexShader = originalVertex
    .replace("#include <common>", VERTEX_COMMON)
    .replace("#include <project_vertex>", VERTEX_POSITION);
  shader.fragmentShader = originalFragment
    .replace("#include <common>", FRAGMENT_COMMON)
    .replace("#include <lights_fragment_begin>", FRAGMENT_LIGHT);
  if (
    !shader.vertexShader.includes("webpodWheelGrazingPositionView") ||
    !shader.fragmentShader.includes("webpodWheelNormalRim")
  ) {
    throw new Error(
      "Three physical shader changed; wheel grazing response was not installed",
    );
  }
}

/** Mutable uniforms shared by the event-driven controller and wheel material. */
export class WheelGrazingResponse implements WheelContactReadability {
  readonly #position = { value: new Vector3() };
  readonly #direction = { value: new Vector3(0, 0, -1) };
  readonly #color = { value: new Color(WHEEL_GRAZING_RESPONSE.color) };
  readonly #irradiance = { value: 0 };
  readonly #range = {
    value: WHEEL_GRAZING_RESPONSE.rangeMm * PX_PER_MM,
  };
  readonly #innerConeCos = {
    value: Math.cos(radians(WHEEL_GRAZING_RESPONSE.innerConeDeg)),
  };
  readonly #outerConeCos = {
    value: Math.cos(radians(WHEEL_GRAZING_RESPONSE.outerConeDeg)),
  };
  readonly #slopeStart = {
    value: Math.sin(radians(WHEEL_GRAZING_RESPONSE.normalSlopeStartDeg)),
  };
  readonly #slopeFull = {
    value: Math.sin(radians(WHEEL_GRAZING_RESPONSE.normalSlopeFullDeg)),
  };

  update(sample: WheelReadabilitySample): void {
    const pose = wheelGrazingPose(sample);
    this.#position.value.set(pose.position.x, pose.position.y, pose.position.z);
    this.#direction.value.set(
      pose.direction.x,
      pose.direction.y,
      pose.direction.z,
    );
    this.#irradiance.value = pose.irradiance;
  }

  clear(): void {
    this.#irradiance.value = 0;
  }

  install(shader: CompilableShader): void {
    shader.uniforms.webpodWheelGrazingPosition = this.#position;
    shader.uniforms.webpodWheelGrazingDirection = this.#direction;
    shader.uniforms.webpodWheelGrazingColor = this.#color;
    shader.uniforms.webpodWheelGrazingIrradiance = this.#irradiance;
    shader.uniforms.webpodWheelGrazingRange = this.#range;
    shader.uniforms.webpodWheelGrazingInnerCos = this.#innerConeCos;
    shader.uniforms.webpodWheelGrazingOuterCos = this.#outerConeCos;
    shader.uniforms.webpodWheelGrazingSlopeStart = this.#slopeStart;
    shader.uniforms.webpodWheelGrazingSlopeFull = this.#slopeFull;
    patchWheelGrazingShader(shader);
  }
}

/** Create the sole physical material that can receive contact-local light. */
export function createWheelGrazingMaterial(
  params: PhysicalSurfaceParams,
  envMap: Texture | null,
  response: WheelGrazingResponse,
): MeshPhysicalMaterial {
  const material = createPolycarbonateMaterial(params, envMap);
  const baseCompile = material.onBeforeCompile;
  const baseCacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    baseCompile.call(material, shader, renderer);
    response.install(shader);
  };
  material.customProgramCacheKey = () =>
    `${baseCacheKey}|webpod-wheel-grazing-v2`;
  return material;
}
