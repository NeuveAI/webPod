import { Color, MeshPhysicalMaterial, type Texture, Vector3 } from "three";

import type { PhysicalSurfaceParams } from "./materials";

type CompilableShader = { vertexShader: string; fragmentShader: string };

const BLACK_POLY_SHADER_FIELDS = [
  "subsurfaceColor",
  "subsurfaceAmbient",
  "subsurfaceDistortion",
  "subsurfacePower",
  "subsurfaceScale",
  "edgeTransmission",
] as const;

export function createBlackPolycarbonateMaterial(
  params: PhysicalSurfaceParams,
  envMap: Texture | null,
  keyDirection: readonly [number, number, number] = [0, 1, 0],
): MeshPhysicalMaterial {
  const {
    subsurfaceColor = "#000000",
    subsurfaceAmbient = 0,
    subsurfaceDistortion = 0,
    subsurfacePower = 1,
    subsurfaceScale = 0,
    edgeTransmission = 0,
    albedoScale = 1,
    color,
    ...physical
  } = params;
  const material = new MeshPhysicalMaterial({
    ...physical,
    color: new Color(color).multiplyScalar(albedoScale),
    envMap,
  });
  const transportColor = new Color(subsurfaceColor);
  const transportDirection = new Vector3(...keyDirection).normalize();
  material.onBeforeCompile = (shader) => {
    shader.uniforms.webpodSssColor = { value: transportColor };
    shader.uniforms.webpodSssAmbient = { value: subsurfaceAmbient };
    shader.uniforms.webpodSssDistortion = { value: subsurfaceDistortion };
    shader.uniforms.webpodSssPower = { value: subsurfacePower };
    shader.uniforms.webpodSssScale = { value: subsurfaceScale };
    shader.uniforms.webpodEdgeTransmission = { value: edgeTransmission };
    shader.uniforms.webpodSssLightDirection = { value: transportDirection };
    patchBlackPolycarbonateShader(shader);
  };
  material.customProgramCacheKey = () =>
    `webpod-black-poly-${BLACK_POLY_SHADER_FIELDS.map((field) => String(params[field] ?? 0)).join("-")}`;
  return material;
}

export function patchBlackPolycarbonateShader(shader: CompilableShader): void {
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      `#include <common>
uniform vec3 webpodSssColor;
uniform vec3 webpodSssLightDirection;
uniform float webpodSssAmbient;
uniform float webpodSssDistortion;
uniform float webpodSssPower;
uniform float webpodSssScale;
uniform float webpodEdgeTransmission;`,
    )
    .replace(
      "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
      `vec3 webpodViewDir = normalize( vViewPosition );
float webpodNdotV = saturate( dot( normal, webpodViewDir ) );
float webpodWrappedDiffuse = saturate( ( dot( normal, webpodSssLightDirection ) + webpodSssDistortion ) / ( 1.0 + webpodSssDistortion ) );
float webpodInternalTransport = webpodSssAmbient + pow( webpodWrappedDiffuse, webpodSssPower ) * webpodSssScale;
float webpodEdgePath = pow( 1.0 - webpodNdotV, 2.4 ) * webpodEdgeTransmission;
vec3 webpodSubsurface = webpodSssColor * ( webpodInternalTransport + webpodEdgePath );
vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance + webpodSubsurface;`,
    );
}

/** Three-compliant transmissive cover with §12.3's cool/warm chamfer dispersion. */
export function createCoverGlassMaterial(
  params: PhysicalSurfaceParams,
  envMap: Texture | null,
  size: { readonly width: number; readonly height: number },
): MeshPhysicalMaterial {
  const material = new MeshPhysicalMaterial({
    ...params,
    opacity: 1,
    transparent: false,
    envMap,
  });
  const cool = new Color("#BFD8F0");
  const warm = new Color("#F0D8BF");
  material.onBeforeCompile = (shader) => {
    shader.uniforms.glassEdgeCool = { value: cool };
    shader.uniforms.glassEdgeWarm = { value: warm };
    patchGlassShader(shader, size);
  };
  material.customProgramCacheKey = () =>
    `webpod-cover-glass-${size.width}x${size.height}`;
  return material;
}

export function patchGlassShader(
  shader: CompilableShader,
  size: { width: number; height: number },
): void {
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying vec2 vWebpodGlassUv;",
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\nvWebpodGlassUv = vec2(position.x / ${size.width.toFixed(1)} + 0.5, position.y / ${size.height.toFixed(1)} + 0.5);`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace(
      "#include <common>",
      "#include <common>\nvarying vec2 vWebpodGlassUv;\nuniform vec3 glassEdgeCool;\nuniform vec3 glassEdgeWarm;",
    )
    .replace(
      "#include <opaque_fragment>",
      `float webpodFresnel = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 3.0);
float webpodCoolEdge = max(1.0 - smoothstep(0.0, 0.035, vWebpodGlassUv.x), smoothstep(0.965, 1.0, vWebpodGlassUv.y));
float webpodWarmEdge = max(smoothstep(0.965, 1.0, vWebpodGlassUv.x), 1.0 - smoothstep(0.0, 0.035, vWebpodGlassUv.y));
outgoingLight += glassEdgeCool * webpodCoolEdge * (0.035 + 0.16 * webpodFresnel);
outgoingLight += glassEdgeWarm * webpodWarmEdge * (0.03 + 0.14 * webpodFresnel);
#include <opaque_fragment>`,
    );
}
