import { expect, test } from "bun:test";
import { Texture } from "three";
import { materialMapOwnership } from "./material-map-ownership";

test("front-body optical maps cannot bind to mirror steel", () => {
  const microNoise = new Texture();
  const steelAnisotropy = new Texture();
  const bodyNormal = new Texture();
  const bodyRoughness = new Texture();
  const maps = materialMapOwnership({ microNoise, steelAnisotropy, bodyNormal, bodyRoughness });
  expect(maps.steel).toEqual({ roughnessMap: microNoise, anisotropyMap: steelAnisotropy });
  expect(Object.values(maps.steel)).not.toContain(bodyNormal);
  expect(Object.values(maps.steel)).not.toContain(bodyRoughness);
  expect(maps.body).toEqual({ normalMap: bodyNormal, roughnessMap: bodyRoughness });
});
