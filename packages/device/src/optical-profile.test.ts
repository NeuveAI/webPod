import { describe, expect, test } from "bun:test";
import { PlaneGeometry } from "three";
import { addOpticalProfile, applyOpticalProfile, createBodyRoughnessMap, createOpticalNormalMap, DEFAULT_DEVICE_OPTICAL_PROFILES } from "./optical-profile";

describe("moulded-surface optical profile", () => {
  test("the Pencil-first white moulding has a real non-flat light hierarchy", () => {
    expect(DEFAULT_DEVICE_OPTICAL_PROFILES.bodyWhite).toEqual([
      [0, -2.2],
      [0.06, -4.4],
      [0.21, -3],
      [0.47, -0.25],
      [0.64, 0.22],
      [0.82, -2],
      [0.94, 0],
      [1, 3.6],
    ]);
    expect(DEFAULT_DEVICE_OPTICAL_PROFILES.wheelBlack).toEqual([
      [0, -8.921],
      [0.38, -5.676],
      [0.62, 1.9704],
      [1, 8.2946],
    ]);
    expect(DEFAULT_DEVICE_OPTICAL_PROFILES.wheelWhite).toEqual([
      [0, 0.375],
      [0.38, 5.96875],
      [0.62, 4.25],
      [1, 1],
    ]);
    expect(DEFAULT_DEVICE_OPTICAL_PROFILES.selectWhite).toEqual([
      [0, 5.649757668912411],
      [0.34, -2.1739468299597497],
      [0.7, -7.586523023024202],
      [1, -1.845465837329626],
    ]);
  });

  test("front-body roughness stays broad enough to avoid striped room banding", () => {
    expect(DEFAULT_DEVICE_OPTICAL_PROFILES.bodyBlackRoughness).toEqual([
      [0, 0.9],
      [0.25, 0.68],
      [0.5, 0.26],
      [0.75, 0.56],
      [1, 0.94],
    ]);
    expect(DEFAULT_DEVICE_OPTICAL_PROFILES.bodyWhiteRoughness).toEqual([
      [0, 0.95],
      [0.25, 0.91],
      [0.5, 0.58],
      [0.75, 0.84],
      [1, 0.94],
    ]);
    const blackValues = DEFAULT_DEVICE_OPTICAL_PROFILES.bodyBlackRoughness.map(
      ([, value]) => value,
    );
    const whiteValues = DEFAULT_DEVICE_OPTICAL_PROFILES.bodyWhiteRoughness.map(
      ([, value]) => value,
    );
    expect(Math.min(...blackValues)).toBeGreaterThanOrEqual(0.18);
    expect(Math.min(...whiteValues)).toBeGreaterThanOrEqual(0.58);
    expect(DEFAULT_DEVICE_OPTICAL_PROFILES.bodyWhite[1]?.[1]).toBeGreaterThan(-5);
    expect(DEFAULT_DEVICE_OPTICAL_PROFILES.bodyWhite.at(-1)?.[1]).toBeLessThan(4);
  });
  test("body roughness is encoded in Three's green channel", () => {
    const map = createBodyRoughnessMap([[0, 0.25], [1, 1]], 2, 3);
    const data = map.image.data as Uint8Array;
    expect(data[1]).toBeGreaterThan(247);
    expect(data.at(-3)).toBeGreaterThan(60);
    expect(data.at(-3)).toBeLessThan(65);
    map.dispose();
  });
  test("zero additive profile preserves a pre-existing crown normal", () => {
    const geometry = new PlaneGeometry(2, 2, 2, 2);
    const normals = geometry.getAttribute("normal");
    normals.setXYZ(0, 0, 0.2, Math.sqrt(0.96));
    const before = [normals.getX(0), normals.getY(0), normals.getZ(0)];
    addOpticalProfile(geometry, [[0, 0], [1, 0]], [[0, 0], [1, 0]], -1, 1);
    expect([normals.getX(0), normals.getY(0), normals.getZ(0)]).toEqual(before);
    geometry.dispose();
  });
  test("encodes top-to-bottom tilt as a deterministic tangent-space normal map", () => {
    const first = createOpticalNormalMap(
      [
        [0, -30],
        [1, 30],
      ],
      3,
    );
    const second = createOpticalNormalMap(
      [
        [0, -30],
        [1, 30],
      ],
      3,
    );
    const a = Array.from(first.image.data as Uint8Array);
    const b = Array.from(second.image.data as Uint8Array);
    expect(a).toEqual(b);
    expect(a[1]).toBeGreaterThan(a[9] ?? 255);
    expect(a[6]).toBe(255);
    first.dispose();
    second.dispose();
  });

  test("combined lateral and vertical profiles remain finite and approximately unit length", () => {
    const texture = createOpticalNormalMap(
      [
        [0, -45],
        [1, 45],
      ],
      9,
      [
        [0, 35],
        [1, -35],
      ],
    );
    const data = texture.image.data as Uint8Array;
    for (let offset = 0; offset < data.length; offset += 4) {
      const x = (data[offset] ?? 128) / 127.5 - 1,
        y = (data[offset + 1] ?? 128) / 127.5 - 1,
        z = (data[offset + 2] ?? 255) / 127.5 - 1;
      expect(Number.isFinite(x + y + z)).toBe(true);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 1);
    }
    texture.dispose();
  });

  test("baked curved-surface normals remain finite and unit length", () => {
    const geometry = applyOpticalProfile(
      new PlaneGeometry(2, 2, 2, 2),
      [
        [0, -35],
        [1, 35],
      ],
      [
        [0, 20],
        [1, -20],
      ],
      -1,
      1,
    );
    const normals = geometry.getAttribute("normal");
    for (let index = 0; index < normals.count; index += 1) {
      const x = normals.getX(index),
        y = normals.getY(index),
        z = normals.getZ(index);
      expect(Number.isFinite(x + y + z)).toBe(true);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 5);
    }
    geometry.dispose();
  });
});
