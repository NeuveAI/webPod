/**
 * The producing half of the W6 seam's corner-convention test (D-056 condition 2).
 *
 * ⚑ **An untested convention shared across two packages is the classic
 * integration bug**, and this one is invisible until the panel renders upside
 * down or at 0.85 scale. So the convention is pinned here against literals, and
 * W6 owns the consuming half against the same literals. D-050 applied to a
 * boundary rather than to a constant.
 *
 * The three things being pinned:
 *   1. corner **order** is TL, TR, BR, BL,
 *   2. `viewport` is canvas **CSS pixels with +y down**, while `world` is +y up,
 *   3. `size` is the quad in body px (272 × 204) and `panel` is §7.4's
 *      authoring grid (320 × 240 at scale 0.85) — never the same number.
 */
import { describe, expect, test } from "bun:test";
import {
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
} from "three";

import { createScreenMeshHandle } from "./screen-mesh";
import { createScreenGeometry } from "./screen-geometry";
import { DEVICE_LAYOUT } from "./layout";

const VIEWPORT = { width: 400, height: 800 };

function makeHandle() {
  const size = {
    width: DEVICE_LAYOUT.screen.width,
    height: DEVICE_LAYOUT.screen.height,
  };
  const defaultMaterial = new MeshBasicMaterial({
    color: "#0B0D11",
    toneMapped: false,
  });
  const mesh = new Mesh(
    new PlaneGeometry(size.width, size.height),
    defaultMaterial,
  );
  const camera = new PerspectiveCamera(
    30,
    VIEWPORT.width / VIEWPORT.height,
    100,
    3000,
  );
  camera.position.set(0, 0, 1000);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  let frames = 0;
  const handle = createScreenMeshHandle({
    mesh,
    panel: {
      width: DEVICE_LAYOUT.screen.width / DEVICE_LAYOUT.screen.scale,
      height: DEVICE_LAYOUT.screen.height / DEVICE_LAYOUT.screen.scale,
      scale: DEVICE_LAYOUT.screen.scale,
    },
    size,
    defaultMaterial,
    invalidate: () => {
      frames += 1;
    },
    view: () => ({ camera, width: VIEWPORT.width, height: VIEWPORT.height }),
  });
  return { handle, mesh, defaultMaterial, frames: () => frames };
}

describe("the screen mesh boundary", () => {
  test("screen UVs are normalized with TL/TR/BR/BL texture orientation", () => {
    const { width, height } = DEVICE_LAYOUT.screen;
    const geometry = createScreenGeometry(width, height, DEVICE_LAYOUT.screen.cornerR);
    const positions = geometry.getAttribute("position");
    const uvs = geometry.getAttribute("uv");
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;

    for (let index = 0; index < positions.count; index += 1) {
      const u = uvs.getX(index);
      const v = uvs.getY(index);
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
      expect(u).toBeCloseTo(positions.getX(index) / width + 0.5, 6);
      expect(v).toBeCloseTo(positions.getY(index) / height + 0.5, 6);
    }

    expect(minU).toBeCloseTo(0, 6);
    expect(maxU).toBeCloseTo(1, 6);
    expect(minV).toBeCloseTo(0, 6);
    expect(maxV).toBeCloseTo(1, 6);

    const maxZ = Math.max(
      ...Array.from({ length: positions.count }, (_, index) =>
        positions.getZ(index),
      ),
    );
    const corners = [
      [-width / 2, height / 2],
      [width / 2, height / 2],
      [width / 2, -height / 2],
      [-width / 2, -height / 2],
    ] as const;
    const expected = [
      [0, 1],
      [1, 1],
      [1, 0],
      [0, 0],
    ] as const;
    corners.forEach(([x, y], corner) => {
      let found = -1,
        distance = Infinity;
      for (let index = 0; index < positions.count; index += 1) {
        if (Math.abs(positions.getZ(index) - maxZ) > 1e-6) continue;
        const d = Math.hypot(
          positions.getX(index) - x,
          positions.getY(index) - y,
        );
        if (d < distance) {
          distance = d;
          found = index;
        }
      }
      expect(found).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThan(1e-6);
      expect(uvs.getX(found)).toBeCloseTo(expected[corner]?.[0] ?? -1, 6);
      expect(uvs.getY(found)).toBeCloseTo(expected[corner]?.[1] ?? -1, 6);
    });
    geometry.dispose();
  });

  test("size is 272 × 204 body px and panel is 320 × 240 at 0.85", () => {
    const { handle } = makeHandle();
    expect(handle.size).toEqual({ width: 272, height: 204 });
    expect(handle.panel).toEqual({ width: 320, height: 240, scale: 0.85 });
  });

  test("world corners are TL, TR, BR, BL with +y up", () => {
    const { handle } = makeHandle();
    const { world } = handle.readTransform();
    expect(world.topLeft.x).toBe(-136);
    expect(world.topLeft.y).toBe(102);
    expect(world.topRight.x).toBe(136);
    expect(world.topRight.y).toBe(102);
    expect(world.bottomRight.x).toBe(136);
    expect(world.bottomRight.y).toBe(-102);
    expect(world.bottomLeft.x).toBe(-136);
    expect(world.bottomLeft.y).toBe(-102);
  });

  test("viewport corners are canvas CSS px with +y DOWN", () => {
    const { handle } = makeHandle();
    const { viewport } = handle.readTransform();
    expect(viewport.width).toBe(400);
    expect(viewport.height).toBe(800);
    // ⚑ The whole point of the test: top-left has the SMALLER y.
    expect(viewport.corners.topLeft.y).toBeLessThan(
      viewport.corners.bottomLeft.y,
    );
    expect(viewport.corners.topLeft.x).toBeLessThan(
      viewport.corners.topRight.x,
    );
    // Centred quad, centred camera: the four corners are symmetric about the
    // canvas centre, so a y-flip or an off-by-one origin shows up immediately.
    expect(
      viewport.corners.topLeft.x + viewport.corners.topRight.x,
    ).toBeCloseTo(400, 6);
    expect(
      viewport.corners.topLeft.y + viewport.corners.bottomLeft.y,
    ).toBeCloseTo(800, 6);
  });

  test("a moved device reports a new transform, not the one it was created with", () => {
    // D-054: there is no cached matrix to go stale, and no `mesh` field to read
    // an un-updated `matrixWorld` from. Moving the mesh and reading again must
    // move the answer with no explicit update call in between.
    const { handle, mesh } = makeHandle();
    const before = handle.readTransform();
    mesh.position.set(0, 50, 0);
    const after = handle.readTransform();
    expect(after.world.topLeft.y - before.world.topLeft.y).toBeCloseTo(50, 6);
    expect(after.viewport.corners.topLeft.y).toBeLessThan(
      before.viewport.corners.topLeft.y,
    );
  });

  test("onTransformChange delivers the value and fires only on a real change", () => {
    const { handle, mesh } = makeHandle();
    const seen: Array<number> = [];
    const unsubscribe = handle.onTransformChange((transform) => {
      seen.push(transform.world.topLeft.y);
    });

    mesh.updateWorldMatrix(true, false);
    mesh.onBeforeRender(
      // The renderer passes five arguments this handle does not read.
      ...([] as unknown as Parameters<Mesh["onBeforeRender"]>),
    );
    expect(seen).toEqual([102]);

    // A second render with nothing moved must not re-notify — a texture upload
    // triggering a geometry recompute downstream is the second-order cost this
    // guard exists to prevent.
    mesh.onBeforeRender(
      ...([] as unknown as Parameters<Mesh["onBeforeRender"]>),
    );
    expect(seen).toEqual([102]);

    mesh.position.set(0, 7, 0);
    mesh.updateWorldMatrix(true, false);
    mesh.onBeforeRender(
      ...([] as unknown as Parameters<Mesh["onBeforeRender"]>),
    );
    expect(seen).toEqual([102, 109]);

    unsubscribe();
    mesh.position.set(0, 20, 0);
    mesh.updateWorldMatrix(true, false);
    mesh.onBeforeRender(
      ...([] as unknown as Parameters<Mesh["onBeforeRender"]>),
    );
    expect(seen).toEqual([102, 109]);
  });

  test("callback-ref replay preserves handle identity and active subscriptions", () => {
    const first = makeHandle();
    const seen: Array<number> = [];
    first.handle.onTransformChange((transform) =>
      seen.push(transform.world.topLeft.y),
    );

    const replayed = createScreenMeshHandle({
      mesh: first.mesh,
      panel: first.handle.panel,
      size: first.handle.size,
      defaultMaterial: first.defaultMaterial,
      invalidate: () => undefined,
      view: () => {
        const camera = new PerspectiveCamera(30, 0.5, 100, 3000);
        camera.position.set(0, 0, 1000);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        return { camera, width: 400, height: 800 };
      },
    });

    expect(replayed).toBe(first.handle);
    first.mesh.updateWorldMatrix(true, false);
    first.mesh.onBeforeRender(
      ...([] as unknown as Parameters<Mesh["onBeforeRender"]>),
    );
    expect(seen).toEqual([102]);
  });

  test("setMaterial installs, null restores the default, and both ask for a frame", () => {
    const { handle, mesh, defaultMaterial, frames } = makeHandle();
    const replacement = new MeshBasicMaterial();
    handle.setMaterial(replacement);
    expect(mesh.material).toBe(replacement);
    expect(frames()).toBe(1);
    handle.setMaterial(null);
    expect(mesh.material).toBe(defaultMaterial);
    expect(frames()).toBe(2);
  });

  test("the handle exposes no Object3D — D-054, staleness has no slot", () => {
    const { handle } = makeHandle();
    expect(Object.keys(handle).sort()).toEqual([
      "invalidate",
      "onTransformChange",
      "panel",
      "readTransform",
      "setMaterial",
      "size",
    ]);
  });
});
