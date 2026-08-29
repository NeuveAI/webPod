import { Color, MeshPhysicalMaterial, type Texture } from "three";

import type { PhysicalSurfaceParams } from "./materials";
import type { OpticalProfile } from "./optical-profile";

type CompilableShader = { vertexShader: string; fragmentShader: string };

export function bodyClearcoatShader(
  profile: OpticalProfile,
  minY: number,
  maxY: number,
): { onBeforeCompile?: (shader: CompilableShader) => void; customProgramCacheKey?: () => string } {
  if (profile.every(([, tilt]) => tilt === 0)) return {};
  const values = profile.map(([, tilt]) => tilt.toFixed(6)).join(",");
  return {
    onBeforeCompile: (shader) => patchBodyClearcoatShader(shader, profile, minY, maxY),
    customProgramCacheKey: () => `webpod-body-clearcoat-v1:${values}:${minY}:${maxY}`,
  };
}

export function patchBodyClearcoatShader(
  shader: CompilableShader,
  profile: OpticalProfile,
  minY: number,
  maxY: number,
): void {
  const vertexNeedle = "#include <begin_vertex>";
  const fragmentNeedle = "#include <clearcoat_normal_fragment_begin>";
  if (!shader.vertexShader.includes(vertexNeedle) || !shader.fragmentShader.includes(fragmentNeedle)) {
    throw new Error("three@0.185.1 clearcoat shader seam changed");
  }
  const knots = profile.map(([at, tilt]) => `vec2(${at.toFixed(6)},${tilt.toFixed(6)})`);
  const sample = knots.slice(1).map((right, index) => {
    const left = knots[index];
    return `if (webpodAt <= ${profile[index + 1]?.[0].toFixed(6)}) { float t = smoothstep(${profile[index]?.[0].toFixed(6)}, ${profile[index + 1]?.[0].toFixed(6)}, webpodAt); webpodTilt = mix(${left}.y, ${right}.y, t); } else `;
  }).join("") + `{ webpodTilt = ${knots.at(-1)}.y; }`;
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", "#include <common>\nvarying float vWebpodObjectY;")
    .replace(vertexNeedle, `${vertexNeedle}\nvWebpodObjectY = position.y;`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", "#include <common>\nvarying float vWebpodObjectY;")
    .replace(fragmentNeedle, `${fragmentNeedle}\n#ifdef USE_CLEARCOAT\nfloat webpodAt = clamp(1.0 - (vWebpodObjectY - ${minY.toFixed(6)}) / ${(maxY - minY).toFixed(6)}, 0.0, 1.0);\nfloat webpodTilt = 0.0;\n${sample}\nfloat webpodA = radians(webpodTilt);\nclearcoatNormal = normalize(vec3(clearcoatNormal.x, clearcoatNormal.y * cos(webpodA) - clearcoatNormal.z * sin(webpodA), clearcoatNormal.y * sin(webpodA) + clearcoatNormal.z * cos(webpodA)));\n#endif`);
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
