import { describe, expect, test } from "bun:test";
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  Object3D,
  type Intersection,
} from "three";

import { matchesProbeIdentity, type ProbeTarget } from "./luminance-probe";
import { firstVisibleProbeHit, WHEEL_LABEL_DECAL_NAME } from "./probe-raycast";

const target: Pick<ProbeTarget, "objectName" | "materialName"> = {
  objectName: "device-body",
  materialName: "body-black",
};

function centreHits(scene: Scene) {
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.z = 10;
  camera.updateProjectionMatrix();
  camera.updateWorldMatrix(true, false);
  scene.updateWorldMatrix(true, true);
  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(0, 0), camera);
  return raycaster.intersectObjects(scene.children, true);
}

describe("first visible probe hit", () => {
  test("uses Three's stable type flags across module graphs", () => {
    const material = new MeshBasicMaterial();
    material.name = "body-black";
    const body = new Object3D();
    body.name = "device-body";
    Object.defineProperties(body, {
      isMesh: { value: true },
      material: { value: material },
    });
    const intersections: Array<Intersection<Object3D>> = [
      { distance: 1, point: new Vector3(), object: body },
    ];

    const hit = firstVisibleProbeHit(intersections);
    expect(hit).toEqual({
      objectName: "device-body",
      materialNames: ["body-black"],
    });
  });

  test("rejects a nearer unnamed wrong-material occluder", () => {
    const scene = new Scene();
    const bodyMaterial = new MeshBasicMaterial();
    bodyMaterial.name = "body-black";
    const body = new Mesh(new PlaneGeometry(4, 4), bodyMaterial);
    body.name = "device-body";
    const occluderMaterial = new MeshBasicMaterial();
    occluderMaterial.name = "chrome-seam";
    const occluder = new Mesh(new PlaneGeometry(2, 2), occluderMaterial);
    occluder.position.z = 1;
    scene.add(body, occluder);

    const hit = firstVisibleProbeHit(centreHits(scene));
    expect(hit?.objectName).toBeUndefined();
    expect(hit?.materialNames).toEqual(["chrome-seam"]);
    expect(
      matchesProbeIdentity(target, hit?.objectName, hit?.materialNames ?? []),
    ).toBe(false);

    occluder.removeFromParent();
    const exposed = firstVisibleProbeHit(centreHits(scene));
    expect(
      matchesProbeIdentity(
        target,
        exposed?.objectName,
        exposed?.materialNames ?? [],
      ),
    ).toBe(true);
  });

  test("fails closed when the transparent decal alpha cannot be proven empty", () => {
    const scene = new Scene();
    const wheelMaterial = new MeshBasicMaterial();
    wheelMaterial.name = "wheel-black";
    const wheel = new Mesh(new PlaneGeometry(4, 4), wheelMaterial);
    wheel.name = "device-wheel";
    const decalMaterial = new MeshBasicMaterial({ transparent: true });
    const decal = new Mesh(new PlaneGeometry(4, 4), decalMaterial);
    decal.name = WHEEL_LABEL_DECAL_NAME;
    decal.position.z = 0.1;
    scene.add(wheel, decal);

    const hit = firstVisibleProbeHit(centreHits(scene));
    expect(hit?.objectName).toBe(WHEEL_LABEL_DECAL_NAME);
    expect(
      matchesProbeIdentity(
        { objectName: "device-wheel", materialName: "wheel-black" },
        hit?.objectName,
        hit?.materialNames ?? [],
      ),
    ).toBe(false);
  });

  test("accepts the transformed back mesh only when it is the first hit", () => {
    const scene = new Scene();
    const model = new Group();
    model.rotation.y = Math.PI;
    const material = new MeshBasicMaterial();
    material.name = "steel-back";
    const back = new Mesh(new BoxGeometry(4, 4, 0.2), material);
    back.name = "device-steel-back";
    back.position.z = -1;
    model.add(back);
    scene.add(model);

    const hit = firstVisibleProbeHit(centreHits(scene));
    expect(
      matchesProbeIdentity(
        { objectName: "device-steel-back", materialName: "steel-back" },
        hit?.objectName,
        hit?.materialNames ?? [],
      ),
    ).toBe(true);
  });
});
