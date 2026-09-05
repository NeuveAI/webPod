import { describe, expect, test } from "bun:test";
import { ExtrudeGeometry, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "/Users/vinicius/code/webPod/packages/device/node_modules/three/build/three.module.js";

import { frontCoreDepth, tessellateVerticalCrown } from "/Users/vinicius/code/webPod/packages/device/src/curved-shell";
import { resolveFrontAssemblyDepths } from "/Users/vinicius/code/webPod/packages/device/src/front-surface";
import { DEFAULT_DEVICE_FORM } from "/Users/vinicius/code/webPod/packages/device/src/form";
import { DEVICE_LAYOUT } from "/Users/vinicius/code/webPod/packages/device/src/layout";
import { DEFAULT_DEVICE_MATERIALS } from "/Users/vinicius/code/webPod/packages/device/src/materials";
import { frontShellPlan } from "/Users/vinicius/code/webPod/packages/device/src/product-shell";
import {
  projectToRoundedRectBoundary,
  roundedRectBoundaryDistance,
  squareRoundedRectApertureWalls,
} from "/Users/vinicius/code/webPod/packages/device/src/screen-aperture";
import { circleHole, roundedRectHole, silhouetteShape } from "/Users/vinicius/code/webPod/packages/device/src/shapes";
import { DEVICE_SURFACE_LAYOUT } from "/Users/vinicius/code/webPod/packages/device/src/surface-layout";

const { body, wheel } = DEVICE_LAYOUT;
const { displayWell } = DEVICE_SURFACE_LAYOUT.front;

function productionFrontExtrusion(): ExtrudeGeometry {
  const form = DEFAULT_DEVICE_FORM;
  const plan = frontShellPlan(
    body.width,
    body.height,
    body.cornerR,
    form.seamWidth,
    form.frontBevel,
  );
  const shape = silhouetteShape(
    plan.faceWidth,
    plan.faceHeight,
    plan.faceCornerR,
    body.exponent,
    48,
  );
  shape.holes.push(
    roundedRectHole(
      displayWell.centerX,
      displayWell.centerY,
      displayWell.width,
      displayWell.height,
      displayWell.cornerR,
    ),
  );
  shape.holes.push(circleHole(wheel.centerX, wheel.centerY, wheel.outerR));
  return new ExtrudeGeometry(shape, {
    depth: frontCoreDepth(form.frontThickness, form.frontBevel),
    bevelEnabled: true,
    bevelThickness: form.frontBevel,
    bevelSize: form.frontBevel,
    bevelSegments: 16,
    curveSegments: 1,
  });
}

function aperturePlan() {
  return {
    centerX: displayWell.centerX,
    centerY: displayWell.centerY,
    width: displayWell.width,
    height: displayWell.height,
    cornerR: displayWell.cornerR,
  } as const;
}

function meshSection(source: string, name: string): string {
  const start = source.indexOf(`name="${name}"`);
  if (start < 0) throw new Error(`missing ${name}`);
  const end = source.indexOf("</mesh>", start);
  if (end < 0) throw new Error(`unterminated ${name}`);
  return source.slice(start, end);
}

describe("square LCD aperture and flat assembly reveal", () => {
  test("production collapses only the automatic inner bevel into one square wall", () => {
    const geometry = productionFrontExtrusion();
    const position = geometry.getAttribute("position");
    const aperture = aperturePlan();
    const candidates: number[] = [];
    let rejectedSlope = 0;
    for (let index = 0; index < position.count; index += 1) {
      const distance = roundedRectBoundaryDistance(
        { x: position.getX(index), y: position.getY(index) },
        aperture,
      );
      if (distance > DEFAULT_DEVICE_FORM.frontBevel + 1e-5) continue;
      candidates.push(index);
      rejectedSlope = Math.max(rejectedSlope, distance);
    }
    expect(candidates.length).toBeGreaterThan(1_000);
    // Control: untouched Three geometry contains the rejected 3.5px slope.
    expect(rejectedSlope).toBeGreaterThan(3);
    const candidateSet = new Set(candidates);

    squareRoundedRectApertureWalls(
      geometry,
      aperture,
      DEFAULT_DEVICE_FORM.frontBevel,
    );

    for (const index of candidates) {
      const point = { x: position.getX(index), y: position.getY(index) };
      expect(roundedRectBoundaryDistance(point, aperture)).toBeLessThan(1e-5);
      const boundary = projectToRoundedRectBoundary(point, aperture);
      expect(point.x).toBeCloseTo(boundary.x, 4);
      expect(point.y).toBeCloseTo(boundary.y, 4);
    }

    const normal = geometry.getAttribute("normal");
    let wallTriangles = 0;
    for (let index = 0; index < position.count; index += 3) {
      const vertices = [index, index + 1, index + 2];
      if (!vertices.every((vertex) => candidateSet.has(vertex))) continue;
      const z = vertices.map((vertex) => position.getZ(vertex));
      if (Math.max(...z) - Math.min(...z) < 0.1) continue;
      wallTriangles += 1;
      for (const vertex of vertices) {
        expect(Math.abs(normal.getZ(vertex))).toBeLessThan(1e-5);
      }
    }
    expect(wallTriangles).toBeGreaterThan(100);
    geometry.dispose();
  });

  test("the complete crowned body leaves active display edges clear from front and quarter cameras", () => {
    const form = DEFAULT_DEVICE_FORM;
    const source = productionFrontExtrusion();
    const aperture = aperturePlan();
    squareRoundedRectApertureWalls(source, aperture, form.frontBevel);
    const crowned = tessellateVerticalCrown(source, body.height / 2 - form.seamWidth,
      form.bodyCrown, undefined,
      { top: form.topEdgeCrown, bottom: form.bottomEdgeCrown, extent: form.edgeCrownExtent },
      { halfWidth: body.width / 2 - form.seamWidth, crown: form.bodyCrossCrown });
    crowned.translate(0, 0, body.depth / 2 - form.frontThickness + form.frontBevel);
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(crowned, material);
    mesh.updateMatrixWorld();
    const screen = DEVICE_LAYOUT.screen;
    const screenZ = resolveFrontAssemblyDepths(form).screenFrontZ;
    // These rays test the actual visible border, not the repair's candidate
    // selection predicate. The rejected miter ends occluded up to 1.5px here.
    const cameras = [new Vector3(0, 0, 1400), new Vector3(1100, 380, 790)];
    for (const margin of [0.1, 0.5, 1.5]) {
      const points: Vector3[] = [];
      for (let x = -screen.width / 2 + 10; x <= screen.width / 2 - 10; x += 12) {
        for (const sign of [-1, 1]) points.push(new Vector3(x,
          screen.centerY + sign * (screen.height / 2 - margin), screenZ));
      }
      for (let y = screen.centerY - screen.height / 2 + 10; y <= screen.centerY + screen.height / 2 - 10; y += 12) {
        for (const sign of [-1, 1]) points.push(new Vector3(sign * (screen.width / 2 - margin), y, screenZ));
      }
      for (const camera of cameras) {
        for (const point of points) {
          const ray = new Raycaster(camera, point.clone().sub(camera).normalize());
          const distance = camera.distanceTo(point);
          const hit = ray.intersectObject(mesh).find((hit) => hit.distance < distance - 1e-4); if(hit) throw new Error(JSON.stringify({camera:camera.toArray(),point:point.toArray(),hit:hit.point.toArray(),gap:distance-hit.distance}));
        }
      }
    }
    source.dispose(); crowned.dispose(); material.dispose();
  });

  test("the visible reveal is unlit black and neither screen layer can restore a reflective lip", async () => {
    expect(DEFAULT_DEVICE_MATERIALS.screenReveal).toEqual({
      color: "#050608",
      toneMapped: false,
    });
    const device = await Bun.file("packages/device/src/Device.tsx").text();
    const frontStart = device.indexOf("const frontGeometry");
    const frontEnd = device.indexOf("  const {\n    ringGeometry");
    expect(frontStart).toBeGreaterThanOrEqual(0);
    expect(frontEnd).toBeGreaterThan(frontStart);
    const frontBuild = device.slice(frontStart, frontEnd);
    expect(frontBuild).toContain("squareRoundedRectApertureWalls(");

    const glassBuild = device.slice(
      device.indexOf("const glassGeometry"),
      device.indexOf("const displayMaskGeometry"),
    );
    expect(glassBuild).toContain("new ShapeGeometry(shape, 1)");
    expect(glassBuild).not.toMatch(/ExtrudeGeometry|bevel|glassThickness/);

    const revealStart = device.indexOf("const displayWellGeometry");
    const revealEnd = device.indexOf("const screenGeometry");
    expect(revealStart).toBeGreaterThanOrEqual(0);
    expect(revealEnd).toBeGreaterThan(revealStart);
    const revealBuild = device.slice(revealStart, revealEnd);
    expect(revealBuild).toContain(
      "form.displayWellInset + form.displayWellDepth",
    );
    expect(revealBuild).toContain("bevelEnabled: false");
    expect(device).toContain(
      "position={[glass.centerX, glass.centerY, displayReferenceZ]}",
    );

    for (const name of ["device-display-mask", "device-display-well"]) {
      const section = meshSection(device, name);
      expect(section).toContain("<meshBasicMaterial");
      expect(section).toContain("materials.screenReveal.color");
      expect(section).toContain("materials.screenReveal.toneMapped");
      expect(section).not.toContain("meshPhysicalMaterial");
      expect(section).not.toContain("studioEnvironmentProps");
      expect(section).not.toMatch(/metalness|roughness|clearcoat|envMap|castShadow/);
    }
  });
});
