import { Color, MeshPhysicalMaterial, type Texture } from "three";

import type { PhysicalSurfaceParams } from "./materials";

type CompilableShader = { vertexShader: string; fragmentShader: string };

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
