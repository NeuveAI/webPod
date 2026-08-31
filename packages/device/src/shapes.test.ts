import { describe, expect, test } from "bun:test";
import {
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Vector2,
} from "three";

import { roundedRectFrameShape, silhouetteFrameShape } from "./shapes";

function hitAt(x: number): boolean {
  const geometry = new ExtrudeGeometry(
    silhouetteFrameShape(330, 552, 26, 2, 2),
    {
      depth: 20,
      bevelEnabled: true,
      bevelThickness: 3,
      bevelSize: 3,
      bevelSegments: 6,
    },
  );
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  const camera = new PerspectiveCamera(30, 1, 0.1, 1000);
  camera.position.z = 600;
  camera.lookAt(x, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateWorldMatrix(true, false);
  mesh.updateWorldMatrix(true, false);
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(0, 0), camera);
  const hit = raycaster.intersectObject(mesh).length > 0;
  geometry.dispose();
  mesh.material.dispose();
  return hit;
}

describe("silhouette frame", () => {
  test("has steel at the seam and no cap over the body", () => {
    expect(hitAt(0)).toBe(false);
    expect(hitAt(164)).toBe(true);
  });
});

describe("rounded-rectangle frame", () => {
  test("keeps the screen opening clear while preserving the bezel lip", () => {
    const geometry = new ExtrudeGeometry(
      roundedRectFrameShape(
        { width: 280, height: 212, radius: 9 },
        { width: 272, height: 204, radius: 4 },
      ),
      {
        depth: 1,
        bevelEnabled: false,
      },
    );
    const mesh = new Mesh(geometry, new MeshBasicMaterial());
    const camera = new PerspectiveCamera(30, 1, 0.1, 1000);
    camera.position.z = 600;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateWorldMatrix(true, false);
    mesh.updateWorldMatrix(true, false);
    const raycaster = new Raycaster();
    raycaster.setFromCamera(new Vector2(0, 0), camera);
    expect(raycaster.intersectObject(mesh).length).toBe(0);
    camera.lookAt(138, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateWorldMatrix(true, false);
    raycaster.setFromCamera(new Vector2(0, 0), camera);
    expect(raycaster.intersectObject(mesh).length).toBeGreaterThan(0);
    geometry.dispose();
    mesh.material.dispose();
  });
});
