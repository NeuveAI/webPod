import { describe, expect, test } from "bun:test";
import { Group, Vector3 } from "three";

import {
  evaluate,
  LUMINANCE_TOLERANCE,
  matchesProbeIdentity,
  probeTargets,
  silhouetteHalfWidth,
  steelGradientParameter,
} from "./luminance-probe";
import { DEVICE_LAYOUT } from "./layout";

describe("§12.3 luminance tolerance", () => {
  test("preserves mirrored readings instead of hiding asymmetry in the average", () => {
    const target = {
      surface: "body-black" as const,
      objectName: "device-body",
      materialName: "body-black",
      token: "raw",
      at: 0.5,
      expectedHex: "#808080",
      y: 0,
      xs: [-1, 1],
    };
    const [result] = evaluate([
      {
        target,
        samples: [
          [20, 30, 40],
          [80, 90, 100],
        ],
      },
    ]);
    expect(result?.measuredSamples).toEqual([
      [20, 30, 40],
      [80, 90, 100],
    ]);
    expect(result?.measuredRgb).toEqual([50, 60, 70]);
  });
  test("admits floating-point noise at the exact ±4 boundary", () => {
    const expected = "#808080";
    const boundaryChannel = 128 + LUMINANCE_TOLERANCE + 2.8e-14;
    const [result] = evaluate([
      {
        target: {
          surface: "steel-back",
          objectName: "device-steel-back",
          materialName: "steel-back",
          token: "--steel-5",
          at: 0.5,
          expectedHex: expected,
          y: 0,
          xs: [0],
        },
        samples: [[boundaryChannel, boundaryChannel, boundaryChannel]],
      },
    ]);

    expect(result?.pass).toBe(true);
    expect(result?.delta).toBeGreaterThan(LUMINANCE_TOLERANCE);
  });

  test("still rejects a materially out-of-band reading", () => {
    const channel = 128 + LUMINANCE_TOLERANCE + 1e-6;
    const [result] = evaluate([
      {
        target: {
          surface: "steel-back",
          objectName: "device-steel-back",
          materialName: "steel-back",
          token: "--steel-5",
          at: 0.5,
          expectedHex: "#808080",
          y: 0,
          xs: [0],
        },
        samples: [[channel, channel, channel]],
      },
    ]);

    expect(result?.pass).toBe(false);
  });
});

describe("D-067 probe geometry and identity", () => {
  const edgeInset = 8;
  const options = {
    bodyEdgeInset: edgeInset,
    backEdgeInset: 3,
    controlInset: 6,
    seamWidth: 3,
  };

  test("every target carries an expected object and material identity", () => {
    for (const colourway of ["black", "white"] as const) {
      for (const face of ["front", "back"] as const) {
        for (const target of probeTargets(colourway, face, options)) {
          expect(target.objectName).toStartWith("device-");
          expect(target.materialName.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("off-surface and wrong-material hits cannot count", () => {
    const target = probeTargets("black", "front", options)[0];
    expect(target).toBeDefined();
    if (target === undefined) return;
    expect(
      matchesProbeIdentity(target, target.objectName, [target.materialName]),
    ).toBe(true);
    expect(matchesProbeIdentity(target, undefined, [])).toBe(false);
    expect(
      matchesProbeIdentity(target, "device-steel-back", ["steel-back"]),
    ).toBe(false);
    expect(
      matchesProbeIdentity(target, target.objectName, ["chrome-seam"]),
    ).toBe(false);
  });

  test("body samples stay inside the shared circular enclosure by the safe margin", () => {
    const seam = options.seamWidth;
    for (const target of probeTargets("white", "front", options).filter(
      (entry) => entry.surface === "body-white",
    )) {
      const reach = silhouetteHalfWidth(
        target.y,
        DEVICE_LAYOUT.body.width / 2 - seam,
        DEVICE_LAYOUT.body.height / 2 - seam,
        DEVICE_LAYOUT.body.cornerR - seam,
        DEVICE_LAYOUT.body.exponent,
      );
      for (const x of target.xs) {
        expect(Math.abs(x)).toBeLessThanOrEqual(reach - edgeInset + 1e-9);
      }
    }
  });

  test("wheel and Select samples keep their separate recessed-surface margins", () => {
    const targets = probeTargets("black", "front", options);
    const wheel = DEVICE_LAYOUT.wheel;
    for (const target of targets) {
      if (
        target.surface !== "wheel-ring-black" &&
        target.surface !== "select-black"
      ) {
        continue;
      }
      for (const x of target.xs) {
        const radius = Math.hypot(x, target.y - wheel.centerY);
        if (target.surface === "wheel-ring-black") {
          expect(radius).toBeLessThanOrEqual(
            wheel.outerR - options.controlInset + 1e-9,
          );
          expect(radius).toBeGreaterThanOrEqual(
            wheel.selectR + options.controlInset,
          );
        } else {
          expect(radius).toBeLessThanOrEqual(
            wheel.selectR - options.controlInset + 1e-9,
          );
        }
      }
    }
  });

  test("back targets preserve the 168° iso-line through the actual face transform", () => {
    const model = new Group();
    model.rotation.y = Math.PI;
    model.updateWorldMatrix(true, true);
    let mirroredTargets = 0;

    for (const target of probeTargets("black", "back", options)) {
      const x = target.xs[0];
      expect(x).toBeDefined();
      if (x === undefined) continue;
      const local = new Vector3(
        x,
        target.y,
        -DEVICE_LAYOUT.body.depth / 2,
      );
      const world = model.localToWorld(local.clone());

      expect(world.x).toBeCloseTo(-local.x, 9);
      expect(world.y).toBeCloseTo(local.y, 9);
      expect(world.z).toBeCloseTo(DEVICE_LAYOUT.body.depth / 2, 9);
      // Endpoint lines meet the rounded rectangle outside its safe inset, so
      // they clamp by 1.4%; every interior stop remains exact.
      expect(
        Math.abs(steelGradientParameter(world.x, world.y) - target.at),
      ).toBeLessThan(0.014);

      if (Math.abs(x) > 1) {
        mirroredTargets += 1;
        const untransformed = steelGradientParameter(local.x, local.y);
        expect(
          Math.abs(untransformed - steelGradientParameter(world.x, world.y)),
        ).toBeGreaterThan(0.04);
      }
    }
    expect(mirroredTargets).toBe(4);
  });
});
