import { describe, expect, test } from 'bun:test';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { createStickerVisibility, stickerVisibilityQuery } from './sticker-visibility';

test('visibility query captures transforms once and refreshes them for the next query', () => {
  const content = new Group(), geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial(), camera = new PerspectiveCamera();
  content.add(new Mesh(geometry, material));
  const visibility = createStickerVisibility();
  let cameraReads = 0;
  const getPosition = camera.getWorldPosition.bind(camera);
  camera.getWorldPosition = target => { cameraReads++; return getPosition(target); };
  for (const angle of [.3, 1.2]) {
    content.rotation.y = angle; content.position.set(3, -4, 5); content.updateWorldMatrix(true, true);
    camera.position.copy(new Vector3(0, 0, 10).applyMatrix4(content.matrixWorld)); camera.updateMatrixWorld();
    const query = stickerVisibilityQuery(visibility, content, camera), reads = cameraReads;
    for (let i = 0; i < 20; i++) {
      expect(query(new Vector3(0, 0, 1.18).applyMatrix4(content.matrixWorld))).toBe(true);
      expect(query(new Vector3(0, 0, -1.18).applyMatrix4(content.matrixWorld))).toBe(false);
    }
    expect(cameraReads).toBe(reads);
  }
  expect(cameraReads).toBe(2); expect(visibility.revision).toBe(1);
  visibility.dispose(); geometry.dispose(); material.dispose();
});

describe('actual assembly sticker visibility', () => {
  test('visible front print and hidden opposite print use the same first shell hit', () => {
    const root = new Group(), geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
    const shell = new Mesh(geometry, material); root.add(shell);
    let disposals = 0; geometry.addEventListener('dispose', () => disposals++);
    const visibility = createStickerVisibility(); visibility.update(root);
    expect(visibility.visible(new Vector3(0, 0, 10), new Vector3(0, 0, 1.18))).toBe(true);
    expect(visibility.visible(new Vector3(0, 0, 10), new Vector3(0, 0, -1.18))).toBe(false);
    shell.position.x = 4; visibility.update(root);
    expect(visibility.visible(new Vector3(0, 0, 10), new Vector3(0, 0, -1.18))).toBe(true);
    shell.position.x = 0; shell.visible = false; visibility.update(root);
    expect(visibility.visible(new Vector3(0, 0, 10), new Vector3(0, 0, -1.18))).toBe(true);
    visibility.dispose(); visibility.dispose();
    expect(disposals).toBe(0);
    expect(visibility.visible(new Vector3(), new Vector3(1, 0, 0))).toBe(false);
    expect(() => visibility.update(root)).toThrow('disposed');
    geometry.dispose(); material.dispose();
  });
  test('sticker meshes are excluded while transformed child hardware remains physical', () => {
    const root = new Group(), child = new Group(), geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
    const sticker = new Mesh(geometry, material); sticker.name = 'sticker-example'; root.add(sticker);
    const hardware = new Mesh(geometry, material); child.add(hardware); child.position.z = 4; root.add(child);
    const visibility = createStickerVisibility(); visibility.update(root);
    expect(visibility.visible(new Vector3(0, 0, 10), new Vector3(0, 0, 1.18))).toBe(false);
    child.visible = false; visibility.update(root);
    expect(visibility.visible(new Vector3(0, 0, 10), new Vector3(0, 0, -1.18))).toBe(true);
    visibility.dispose(); geometry.dispose(); material.dispose();
  });
  test('global pose changes reuse the BVH; local transforms and buffer updates replace it', () => {
    const root = new Group(), child = new Group(), geometry = new BoxGeometry(2, 2, 2), material = new MeshBasicMaterial();
    child.position.set(.123, .456, .789); child.add(new Mesh(geometry, material)); root.add(child);
    const visibility = createStickerVisibility(); visibility.update(root);
    const revision = visibility.revision;
    for (const yaw of [0, .1, .2, .3]) { root.rotation.y = yaw; visibility.update(root); }
    expect(visibility.revision).toBe(revision);
    child.position.x += .01; visibility.update(root); expect(visibility.revision).toBe(revision + 1);
    geometry.getAttribute('position').needsUpdate = true; visibility.update(root); expect(visibility.revision).toBe(revision + 2);
    if (geometry.index) geometry.index.needsUpdate = true;
    visibility.update(root); expect(visibility.revision).toBe(revision + 3);
    geometry.setAttribute('position', geometry.getAttribute('position').clone());
    visibility.update(root); expect(visibility.revision).toBe(revision + 4);
    if (geometry.index) geometry.setIndex(geometry.index.clone());
    visibility.update(root); expect(visibility.revision).toBe(revision + 5);
    visibility.dispose(); geometry.dispose(); material.dispose();
  });
});
