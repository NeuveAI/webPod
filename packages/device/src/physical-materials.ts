import { Color, MeshPhysicalMaterial, type Texture } from "three";

import type { PhysicalSurfaceParams } from "./materials";

type CompilableShader = { vertexShader: string; fragmentShader: string };

const POLYCARBONATE_SHADER_FIELDS = [
  "subsurfaceColor",
  "subsurfaceDistortion",
  "subsurfaceAttenuation",
  "subsurfacePower",
  "subsurfaceScale",
] as const;

export function createPolycarbonateMaterial(
  params: PhysicalSurfaceParams,
  envMap: Texture | null,
): MeshPhysicalMaterial {
  const {
    subsurfaceColor = "#000000",
    subsurfaceDistortion = 0,
    subsurfaceAttenuation = 0,
    subsurfacePower = 1,
    subsurfaceScale = 0,
    albedoScale = 1,
    color,
    ...physical
  } = params;
  const material = new MeshPhysicalMaterial({
    ...physical,
    color: new Color(color).multiplyScalar(albedoScale),
    envMap,
  });
  if (subsurfaceScale <= 0 || subsurfaceAttenuation <= 0) return material;
  const transportColor = new Color(subsurfaceColor);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.webpodSssColor = { value: transportColor };
    shader.uniforms.webpodSssDistortion = { value: subsurfaceDistortion };
    shader.uniforms.webpodSssAttenuation = { value: subsurfaceAttenuation };
    shader.uniforms.webpodSssPower = { value: subsurfacePower };
    shader.uniforms.webpodSssScale = { value: subsurfaceScale };
    patchBlackPolycarbonateShader(shader);
  };
  material.customProgramCacheKey = () =>
    `webpod-polycarbonate-${POLYCARBONATE_SHADER_FIELDS.map((field) => String(params[field] ?? 0)).join("-")}`;
  return material;
}

export function createBlackPolycarbonateMaterial(
  params: PhysicalSurfaceParams,
  envMap: Texture | null,
): MeshPhysicalMaterial {
  return createPolycarbonateMaterial(params, envMap);
}

export function patchBlackPolycarbonateShader(shader: CompilableShader): void {
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
uniform vec3 webpodSssColor;
uniform float webpodSssDistortion;
uniform float webpodSssAttenuation;
uniform float webpodSssPower;
uniform float webpodSssScale;`,
    )
    .replace(
      "reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );",
      `vec3 webpodScatteringHalf = normalize( directLight.direction + geometryNormal * webpodSssDistortion );
float webpodScatteringDot = pow( saturate( dot( geometryViewDir, -webpodScatteringHalf ) ), webpodSssPower ) * webpodSssScale;
vec3 webpodScattering = webpodSssColor * webpodScatteringDot;
reflectedLight.directDiffuse += webpodScattering * webpodSssAttenuation * directLight.color;
reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );`,
    );
}

/** Three-compliant transmissive cover that stays entirely inside Three's own glass model. */
export function createCoverGlassMaterial(
  params: PhysicalSurfaceParams,
  envMap: Texture | null,
): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    ...params,
    opacity: 1,
    transparent: false,
    envMap,
  });
}

export function patchGlassShader(
  shader: CompilableShader,
  _size?: { width: number; height: number },
): void {
  void shader;
  void _size;
}
