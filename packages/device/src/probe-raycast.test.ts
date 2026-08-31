import { describe, expect, test } from "bun:test";
import {
  BoxGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  Shape,
  Vector2,
  Vector3,
  Object3D,
  type Intersection,
} from "three";

import { matchesProbeIdentity, type ProbeTarget } from "./luminance-probe";
import {
  firstVisibleProbeHit,
  probeSurfaceIsCoherent,
  type ProbeFace,
  resolveProbeSurface,
  visibleProbeHits,
  WHEEL_LABEL_DECAL_NAME,
} from "./probe-raycast";
import { tessellateVerticalCrown, verticalCrownOffset } from "./curved-shell";
import { probeTargets } from "./luminance-probe";

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
    expect(hit).toMatchObject({
      objectName: "device-body",
      materialNames: ["body-black"],
    });
    expect(hit?.point).toEqual(new Vector3());
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

  test("keeps the rendered rear composition in front of the steel backing", () => {
    const scene = new Scene();
    const compositionMaterial = new MeshBasicMaterial({
      transparent: true,
      opacity: 1,
    });
    compositionMaterial.name = "back-composition";
    const composition = new Mesh(
      new PlaneGeometry(4, 4),
      compositionMaterial,
    );
    composition.name = "device-back-composition";
    composition.position.z = 0.1;
    const steelMaterial = new MeshBasicMaterial();
    steelMaterial.name = "steel-back";
    const steel = new Mesh(new PlaneGeometry(4, 4), steelMaterial);
    steel.name = "device-steel-back";
    scene.add(composition, steel);

    const hits = visibleProbeHits(centreHits(scene));
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      objectName: "device-back-composition",
      materialNames: ["back-composition"],
    });
    expect(hits[1]).toMatchObject({
      objectName: "device-steel-back",
      materialNames: ["steel-back"],
    });
  });

  test("edge targets fail closed when the nearer visible shell is unnamed", () => {
    const options = {
      bodyEdgeInset: 8,
      backEdgeInset: 3,
      controlInset: 6,
      seamWidth: 3,
    };
    const [target] = probeTargets("white", "right", options);
    expect(target).toBeDefined();
    if (target === undefined) return;

    const namedHit = {
      objectName: "device-steel-shell",
      materialNames: ["chrome-seam"],
    };
    expect(
      matchesProbeIdentity(target, namedHit.objectName, namedHit.materialNames),
    ).toBe(true);

    expect(
      matchesProbeIdentity(target, undefined, namedHit.materialNames),
    ).toBe(false);
  });

  test("solves the actual tessellated mesh surface instead of a nominal z", () => {
    const shape = new Shape();
    shape.moveTo(-20, -40);
    shape.lineTo(20, -40);
    shape.lineTo(20, 40);
    shape.lineTo(-20, 40);
    shape.closePath();
    const source = new ExtrudeGeometry(shape, {
      depth: 2.25,
      bevelEnabled: true,
      bevelThickness: 5.875,
      bevelSize: 5.875,
      bevelSegments: 4,
    });
    source.computeBoundingBox();
    const sourceFront = source.boundingBox?.max.z;
    expect(sourceFront).toBeDefined();
    if (sourceFront === undefined) return;
    const crown = -2;
    const geometry = tessellateVerticalCrown(source, 40, crown, undefined, {
      top: 3,
      bottom: -3,
      extent: 36,
    });
    geometry.translate(0, 0, 7);
    const material = new MeshBasicMaterial();
    material.name = "body-black";
    const body = new Mesh(geometry, material);
    body.name = "device-body";
    const model = new Group();
    model.add(body);

    const solved = resolveProbeSurface(
      model,
      { objectName: "device-body", materialNames: ["body-black"] },
      0,
      0,
      "front",
      100,
    );
    expect(solved.localPoint.x).toBeCloseTo(0, 9);
    expect(solved.localPoint.y).toBeCloseTo(0, 9);
    expect(solved.localPoint.z).toBeCloseTo(
      7 + sourceFront + verticalCrownOffset(0, 40, crown),
      5,
    );
    // The old nominal path knew only translation + crown and missed the
    // extrusion's real lid/bevel placement by the entire front cap depth.
    expect(
      Math.abs(solved.localPoint.z - (7 + verticalCrownOffset(0, 40, crown))),
    ).toBeGreaterThan(5);
    expect(
      probeSurfaceIsCoherent(
        0,
        0,
        "front",
        solved.localPoint,
        solved.localPoint,
        0.01,
      ),
    ).toBe(true);
    const plantedNominal = solved.localPoint.clone();
    plantedNominal.z -= 5;
    expect(
      probeSurfaceIsCoherent(
        0,
        0,
        "front",
        solved.localPoint,
        plantedNominal,
        0.01,
      ),
    ).toBe(false);

    source.dispose();
    geometry.dispose();
    material.dispose();
  });
});

describe("side-face probe solves", () => {
  function solveShell(face: ProbeFace) {
    const material = new MeshBasicMaterial();
    material.name = "chrome-seam";
    const shell = new Mesh(new BoxGeometry(4, 4, 2), material);
    shell.name = "device-steel-shell";
    const model = new Group();
    model.add(shell);
    return resolveProbeSurface(
      model,
      { objectName: "device-steel-shell", materialNames: ["chrome-seam"] },
      0.75,
      1.5,
      face,
      20,
    );
  }

  test("solves the actual visible right shell instead of a front proxy", () => {
    const solved = solveShell("right");
    expect(solved.localPoint.x).toBeCloseTo(2, 6);
    expect(solved.localPoint.y).toBeCloseTo(1.5, 6);
    expect(solved.localPoint.z).toBeCloseTo(0.75, 6);
    expect(
      probeSurfaceIsCoherent(
        0.75,
        1.5,
        "right",
        solved.localPoint,
        solved.localPoint,
        0.01,
      ),
    ).toBe(true);
    const wrongVisible = solved.localPoint.clone();
    wrongVisible.z += 0.2;
    expect(
      probeSurfaceIsCoherent(
        0.75,
        1.5,
        "right",
        solved.localPoint,
        wrongVisible,
        0.01,
      ),
    ).toBe(false);
  });
});
