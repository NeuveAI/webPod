import { describe, expect, test } from "bun:test";

import { mergeOwned, ownedPatch, stageOwnsPath } from "./stage-ownership";

const hostileCandidate = {
  "materials.bodyBlack.roughness": 0.7,
  "opticalProfiles.bodyBlack.0.1": 4,
  "envRoom.exposure": 9,
  cameraDistance: 1,
  "lightRig.key.intensity": 1,
  "materials.steelBack.roughness": 1,
  "materials.bodyWhite.roughness": 1,
  "materials.wheelRingBlack.roughness": 1,
  "materials.selectBlack.roughness": 1,
  "form.bodyCrown": 99,
};

describe("calibration stage ownership", () => {
  test("body-black can apply only its material and optical response", () => {
    expect(ownedPatch("body-black", hostileCandidate)).toEqual({
      "materials.bodyBlack.roughness": 0.7,
      "opticalProfiles.bodyBlack.0.1": 4,
    });
  });

  test("body-black cannot own shared or other-surface keys", () => {
    for (const path of [
      "envRoom.exposure",
      "cameraDistance",
      "lightRig.key.intensity",
      "materials.steelBack.roughness",
      "materials.bodyWhite.roughness",
      "materials.wheelRingBlack.roughness",
      "materials.selectBlack.roughness",
      "form.bodyCrown",
    ]) {
      expect(stageOwnsPath("body-black", path)).toBe(false);
    }
  });

  test("body-black writes preserve every frozen non-owned value", () => {
    const frozen = Object.fromEntries(
      Object.keys(hostileCandidate).map((path) => [path, 42]),
    );
    const merged = mergeOwned("body-black", frozen, hostileCandidate);
    expect(merged["materials.bodyBlack.roughness"]).toBe(0.7);
    expect(merged["opticalProfiles.bodyBlack.0.1"]).toBe(4);
    for (const path of Object.keys(frozen).filter(
      (key) => !key.startsWith("materials.bodyBlack.") && !key.startsWith("opticalProfiles.bodyBlack"),
    )) {
      expect(merged[path]).toBe(42);
    }
  });
});
