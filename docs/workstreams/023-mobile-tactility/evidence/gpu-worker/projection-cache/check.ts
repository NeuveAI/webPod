import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry } from '../../../../../../packages/device/node_modules/three';
import { stickerProjectedQuad } from '../../../../../../packages/device/src/sticker-transform-projection';
import { setPreparedStickerContour } from '../../../../../../packages/device/src/sticker-contour-preparation-data';
const prepare = (geometry: import('../../../../../../packages/device/node_modules/three').BufferGeometry) => setPreparedStickerContour(geometry, {width: 1, height: 1, alpha: new Uint8Array([255]), onset: new Uint8Array([255]), boundaryCandidates: new Uint32Array()}, 0, {paths: [], anchors: new Float64Array()});
const root = process.cwd(), temporary = await mkdtemp(join(tmpdir(), 'projection-reference-'));
try {
  const source = await Bun.file(`${import.meta.dir}/baseline.txt`).text();
  await Bun.write(join(temporary, 'reference.ts'), source.replace("from '../../../../../../packages/device/node_modules/three'", `from '${root}/packages/device/node_modules/three/build/three.module.js'`).replace("from './layout'", `from '${root}/packages/device/src/layout'`));
  const reference = (await import(join(temporary, 'reference.ts'))) as {stickerProjectedQuad: typeof stickerProjectedQuad};
  const material = new MeshBasicMaterial(), mesh = new Mesh(new PlaneGeometry(30, 20, 96, 96), material);
  const camera = new PerspectiveCamera(40, 1.4, 1, 1000); camera.position.z = 300;
  const canvas = {left: 17, top: 29, width: 900, height: 700};
  prepare(mesh.geometry);
  let comparisons = 0;
  const compare = () => { assert.deepEqual(stickerProjectedQuad(mesh, camera, canvas), reference.stickerProjectedQuad(mesh, camera, canvas)); comparisons++; };
  for (let i = 0; i < 24; i++) { mesh.rotation.set(i * .02, i * .1, i * .03); camera.position.x = i; compare(); }
  const positions = mesh.geometry.getAttribute('position');
  positions.setXYZ(0, 30, 10, 7); compare(); // no version bump: live position reads remain exact
  positions.needsUpdate = true; compare();
  mesh.geometry.setAttribute('position', positions.clone()); compare();
  const uv = mesh.geometry.getAttribute('uv');
  uv.setXY(0, .5, .5); uv.needsUpdate = true; compare();
  mesh.geometry.setAttribute('uv', uv.clone()); compare();
  const small = new PlaneGeometry(30, 20, 2, 2), values = new Uint16Array(9 * 4);
  const ordinaryUv = small.getAttribute('uv');
  for (let i = 0; i < 9; i++) { values[i * 4 + 1] = ordinaryUv.getX(i) * 65534; values[i * 4 + 2] = ordinaryUv.getY(i) * 65534; }
  const data = new InterleavedBuffer(values, 4), interleaved = new InterleavedBufferAttribute(data, 2, 1, true);
  small.setAttribute('uv', interleaved); prepare(small); mesh.geometry.dispose(); mesh.geometry = small; compare();
  interleaved.setXY(0, 0, 0); interleaved.needsUpdate = true; compare();
  interleaved.offset = 0; compare(); interleaved.offset = 1;
  data.array = values.slice(); compare();
  small.setAttribute('uv', new BufferAttribute(new Float32Array(18), 2)); compare();
  // Unknown geometry must remain correct for raw unversioned UV writes.
  const raw = small.getAttribute('uv'); raw.setXY(0, 1, 1); compare();
  small.deleteAttribute('uv'); compare();
  const grid = new PlaneGeometry(30, 20, 96, 96); mesh.geometry = grid; prepare(grid);
  const counted = grid.getAttribute('uv'); let reads = 0;
  const getX = counted.getX, getY = counted.getY;
  counted.getX = function(index) { reads++; return getX.call(this, index); };
  counted.getY = function(index) { reads++; return getY.call(this, index); };
  stickerProjectedQuad(mesh, camera, canvas); const firstReads = reads; reads = 0;
  for (let i = 0; i < 20; i++) { mesh.rotation.y += .01; stickerProjectedQuad(mesh, camera, canvas); }
  const warmReads = reads; assert.equal(firstReads, 20 * 97 * 97); assert.equal(warmReads, 0);
  grid.dispose(); small.dispose(); material.dispose();
  const result = { comparisons, gridVertices: 97 * 97, firstUvScalarReads: firstReads, twentyWarmPoseUvScalarReads: warmReads, positionSamplesPerPose: 9, limitation: 'Exact CPU reference/operation counts, not browser or GPU timing.' };
  await Bun.write(`${import.meta.dir}/check.json`, `${JSON.stringify(result, null, 2)}\n`); console.log(result);
} finally { await rm(temporary, {recursive: true, force: true}); }
