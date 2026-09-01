import { expect, test } from "bun:test";
import { Texture } from "three";
import { materialMapOwnership } from "./material-map-ownership";

test("steel material maps are microstructure only", () => {
  const microNoise = new Texture();
  const steelAnisotropy = new Texture();
  const maps = materialMapOwnership({ microNoise, steelAnisotropy });
  expect(maps.steel).toEqual({ roughnessMap: microNoise, anisotropyMap: steelAnisotropy });
});
