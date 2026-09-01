import type { Texture } from "three";

export function materialMapOwnership(input: {
  readonly microNoise: Texture;
  readonly steelAnisotropy: Texture;
}) {
  return {
    steel: {
      roughnessMap: input.microNoise,
      anisotropyMap: input.steelAnisotropy,
    },
  } as const;
}
