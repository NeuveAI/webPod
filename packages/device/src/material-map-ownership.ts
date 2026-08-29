import type { Texture } from "three";

export function materialMapOwnership(input: {
  readonly microNoise: Texture;
  readonly steelAnisotropy: Texture;
  readonly bodyNormal: Texture;
  readonly bodyRoughness: Texture;
}) {
  return {
    steel: {
      roughnessMap: input.microNoise,
      anisotropyMap: input.steelAnisotropy,
    },
    body: {
      normalMap: input.bodyNormal,
      roughnessMap: input.bodyRoughness,
    },
  } as const;
}
