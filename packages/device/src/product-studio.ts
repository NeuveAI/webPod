import { Color, Mesh, Object3D, MeshBasicMaterial, PlaneGeometry, Scene } from "three";
import { DEFAULT_LIGHT_RIG, keyLightPosition, kickLightPosition } from "./light-rig";

/** Diffusion cards and negative space for product reflections. Their direction
 * follows the authored studio, not the model pose. They are passive reflection
 * scenery, kept identical while isolating the three actual scene emitters. */
export function createProductStudioEnvironment(screenReflection = false) {
  const scene = new Scene();
  scene.background = new Color("#25282E");
  const rig = DEFAULT_LIGHT_RIG;
  const cards = [
    { name: "key-diffusion", position: keyLightPosition(rig.key), target: [0, 0, 0] as const,
      emitter: rig.key.emitter, radiance: 0.85, color: "#FFFDF8" },
    { name: "fill-diffusion", position: kickLightPosition(rig.kick), target: rig.kick.target,
      emitter: rig.kick.emitter, radiance: 0.35, color: "#F5F8FF" },
    { name: "rim-diffusion", position: rig.rim.position, target: rig.rim.target,
      emitter: rig.rim.emitter, radiance: 1.1, color: "#FFFFFF" },
  ];
  // A close card inside the PMREM capture volume adds only a screen accent.
  if (screenReflection) cards.push({
    name: "screen-lower-left-accent", position: [-5, 3, 50], target: [0, 0, 0],
    emitter: { width: 3.5, height: 2.5 }, radiance: 5, color: "#F5F8FF",
  });
  const keyPosition = keyLightPosition(rig.key);
  const keyCard = new Object3D();
  keyCard.position.set(...keyPosition);
  keyCard.lookAt(0, 0, 0);
  const meshes = cards.map((card) => {
    const geometry = new PlaneGeometry(card.emitter.width * (screenReflection ? 1.6 : 1), card.emitter.height * (screenReflection ? 1.6 : 1));
    const material = new MeshBasicMaterial({ color: new Color(card.color).multiplyScalar(card.radiance), toneMapped: false });
    const mesh = new Mesh(geometry, material);
    mesh.name = card.name;
    mesh.position.set(...card.position);
    mesh.lookAt(...card.target);
    if (screenReflection && (card.name === "fill-diffusion" || card.name === "screen-lower-left-accent")) mesh.quaternion.copy(keyCard.quaternion);
    scene.add(mesh);
    return mesh;
  });
  return { scene, dispose() { for (const mesh of meshes) { mesh.geometry.dispose(); mesh.material.dispose(); } } };
}
