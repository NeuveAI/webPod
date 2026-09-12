import { Box3, BufferGeometry, Float32BufferAttribute, PlaneGeometry, Sphere, Vector3, REVISION, type Material, type WebGLRenderer } from 'three';
import { STICKER_PAPER } from './sticker-paper';

/** Identical grid adjacency to PlaneGeometry: a,b,d and b,c,d in row order. */
export const PAPER_GPU_GLSL = `
uniform vec4 paperSize;
uniform float paperCurl;
vec3 paperFront(vec2 grid) {
  vec2 xy = vec2((grid.x / 96.0 - 0.5) * paperSize.x, (0.5 - grid.y / 96.0) * paperSize.y);
  float reach = min(42.0 * paperSize.z, min(paperSize.x, paperSize.y) * 0.16);
  float curl = clamp(paperCurl, 0.0, 1.0);
  float radius = reach / (2.0 * (curl > 0.0 ? curl : 1.0));
  float distance = paperSize.w > 0.5 && curl > 0.0 ? max(0.0, reach - ((paperSize.x * 0.5 - xy.x) + (paperSize.y * 0.5 - xy.y)) / sqrt(2.0)) : 0.0;
  float angle = distance / radius;
  float contraction = (distance - radius * sin(angle)) / sqrt(2.0);
  float bow = paperSize.z * (paperSize.w > 0.5 ? 5.0 : 2.5) * (1.0 - pow(2.0 * xy.x / paperSize.x, 2.0));
  return vec3(xy - contraction, bow + 2.0 * radius * pow(sin(angle * 0.5), 2.0));
}
vec3 paperTriangle(vec2 a, vec2 b, vec2 c) {
  vec3 pa = paperFront(a), pb = paperFront(b), pc = paperFront(c);
  return cross(pc - pb, pa - pb);
}
vec3 paperNormal(vec2 grid) {
  vec3 sum = vec3(0.0);
  // Visit adjoining cells in the same row/column order as indexed normals.
  for (int row = -1; row <= 0; row++) for (int col = -1; col <= 0; col++) {
    vec2 cell = grid + vec2(float(col), float(row));
    if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= 96.0 || cell.y >= 96.0) continue;
    vec2 a = cell, b = cell + vec2(0.0, 1.0), c = cell + vec2(1.0, 1.0), d = cell + vec2(1.0, 0.0);
    if (col == 0 || row == 0) sum += paperTriangle(a, b, d);
    if (col == -1 || row == -1) sum += paperTriangle(b, c, d);
  }
  return normalize(sum);
}
vec3 paperPoint(vec3 vertex) {
  vec3 front = paperFront(vertex.xy);
  float thickness = paperSize.z * (paperSize.w > 0.5 ? 0.3 : 0.7);
  return front - paperNormal(vertex.xy) * thickness * vertex.z;
}
`;
export interface GpuPaperInput { readonly width: number; readonly height: number; readonly pixel: number; readonly liner: boolean }
export function gpuPaperSupported(renderer: WebGLRenderer): boolean {
  const gl = renderer.getContext();
  return REVISION === '185' && !gl.isContextLost() && gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT)?.precision === 23;
}
/** Static full-resolution grid and edge topology; only the curl uniform changes. */
export function createGpuPaperGeometry({ width, height, pixel }: GpuPaperInput) {
  if (![width, height, pixel].every(value => value > 0 && Number.isFinite(value))) throw new RangeError('Invalid paper dimensions');
  const n = STICKER_PAPER.segments, stride = n + 1;
  const front = new PlaneGeometry(width, height, n, n);
  const coordinates: number[] = [];
  for (let row = 0; row <= n; row++) for (let col = 0; col <= n; col++) coordinates.push(col, row, 0);
  front.setAttribute('paperVertex', new Float32BufferAttribute(coordinates, 3));
  const back = front.clone();
  const rearCoordinates = back.getAttribute('paperVertex');
  for (let i = 0; i < rearCoordinates.count; i++) rearCoordinates.setZ(i, 1);
  const boundary: number[] = [];
  for (let x = 0; x < n; x++) boundary.push(x);
  for (let y = 0; y < n; y++) boundary.push(y * stride + n);
  for (let x = n; x > 0; x--) boundary.push(n * stride + x);
  for (let y = n; y > 0; y--) boundary.push(y * stride);
  const edge = new BufferGeometry(), vertex: number[] = [], aa: number[] = [], bb: number[] = [], cc: number[] = [];
  const coordinate = (id: number, rear: number): readonly [number, number, number] => [id % stride, Math.floor(id / stride), rear];
  for (let i = 0; i < boundary.length; i++) {
    const a = boundary[i], b = boundary[(i + 1) % boundary.length]; if (a === undefined || b === undefined) continue;
    const fa = coordinate(a, 0), ra = coordinate(a, 1), fb = coordinate(b, 0), rb = coordinate(b, 1);
    for (const triangle of [[fa, ra, fb], [fb, ra, rb]]) {
      const [a, b, c] = triangle; if (!a || !b || !c) continue;
      for (const point of triangle) { vertex.push(...point); aa.push(...a); bb.push(...b); cc.push(...c); }
    }
  }
  edge.setAttribute('position', new Float32BufferAttribute(new Float32Array(vertex.length), 3));
  edge.setAttribute('normal', new Float32BufferAttribute(new Float32Array(vertex.length), 3));
  edge.setAttribute('paperVertex', new Float32BufferAttribute(vertex, 3));
  edge.setAttribute('paperA', new Float32BufferAttribute(aa, 3)); edge.setAttribute('paperB', new Float32BufferAttribute(bb, 3)); edge.setAttribute('paperC', new Float32BufferAttribute(cc, 3));
  // Curl contracts into the sheet. Bow/curl/backing never exceed this radius.
  const radius = Math.hypot(width / 2, height / 2, 5 * pixel + 2 * Math.min(42 * pixel, width * .16, height * .16) + pixel);
  for (const geometry of [front, back, edge]) geometry.boundingSphere = new Sphere(new Vector3(), radius);
  return { front, back, edge };
}
/** Preserve stock Three materials; alter only the vertex position/normal inputs. */
export function installGpuPaperMaterial(material: Material, input: GpuPaperInput, curl: { value: number }, edge: boolean): void {
  material.onBeforeCompile = shader => {
    shader.uniforms.paperSize = { value: [input.width, input.height, input.pixel, input.liner ? 1 : 0] };
    shader.uniforms.paperCurl = curl;
    const declarations = `attribute vec3 paperVertex;\n${edge ? 'attribute vec3 paperA; attribute vec3 paperB; attribute vec3 paperC;' : ''}\n${PAPER_GPU_GLSL}`;
    shader.vertexShader = declarations + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', edge
      ? 'vec3 objectNormal = normalize(cross(paperPoint(paperC) - paperPoint(paperB), paperPoint(paperA) - paperPoint(paperB)));'
      : 'vec3 objectNormal = paperNormal(paperVertex.xy);');
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = paperPoint(paperVertex);');
  };
  material.customProgramCacheKey = () => `paper-gpu-grid96-v1-${edge ? 'edge' : 'surface'}`;
}

/** Exact CPU boundary mirror for the existing return-clearance Box3 consumer.
 * All deformation is confined to the top-right reach; bow depends on x only.
 * Front/back extrema are on the perimeter (including x=0 grid midpoint).
 * This evaluates adjacent triangles only, never reconstructs the interior mesh. */
export function sampleGpuPaperBounds(input: GpuPaperInput, curlProgress: number) {
  const { width, height, pixel, liner } = input, n = STICKER_PAPER.segments;
  const reach = Math.min(STICKER_PAPER.curlReachPx * pixel, width * .16, height * .16), curl = Math.max(0, Math.min(1, curlProgress));
  const radius = reach / (STICKER_PAPER.curlAngle * (curl || 1));
  const thickness = pixel * (liner ? STICKER_PAPER.linerThicknessPx : STICKER_PAPER.sleeveThicknessPx);
  const points = new Map<number, Vector3>();
  const point = (col: number, row: number) => {
    const key = row * (n + 1) + col, cached = points.get(key); if (cached) return cached;
    const x = Math.fround(col * (width / n) - width / 2), y = Math.fround(-(row * (height / n) - height / 2));
    const distance = liner && curl > 0 ? Math.max(0, reach - ((width / 2 - x) + (height / 2 - y)) / Math.SQRT2) : 0;
    const angle = distance / radius, contraction = (distance - radius * Math.sin(angle)) / Math.SQRT2;
    const result = new Vector3(Math.fround(x - contraction), Math.fround(y - contraction), Math.fround(pixel * (liner ? 5 : 2.5) * (1 - (2 * x / width) ** 2) + radius * (1 - Math.cos(angle))));
    points.set(key, result); return result;
  };
  const normal = (col: number, row: number) => {
    const sum = new Vector3(), cb = new Vector3(), ab = new Vector3();
    const add = (a: Vector3, b: Vector3, c: Vector3) => {
      cb.subVectors(c, b); ab.subVectors(a, b); cb.cross(ab);
      sum.set(Math.fround(sum.x + cb.x), Math.fround(sum.y + cb.y), Math.fround(sum.z + cb.z));
    };
    for (let y = Math.max(0, row - 1); y <= Math.min(n - 1, row); y++) for (let x = Math.max(0, col - 1); x <= Math.min(n - 1, col); x++) {
      const a = point(x, y), b = point(x, y + 1), c = point(x + 1, y + 1), d = point(x + 1, y);
      if (col === x || row === y) add(a, b, d);
      if (col === x + 1 || row === y + 1) add(b, c, d);
    }
    sum.normalize(); return sum.set(Math.fround(sum.x), Math.fround(sum.y), Math.fround(sum.z));
  };
  const front = new Box3(), back = new Box3();
  for (let i = 0; i <= n; i++) for (const [col, row] of [[i, 0], [i, n], [0, i], [n, i]]) {
    if (col === undefined || row === undefined) continue;
    const p = point(col, row), v = normal(col, row); front.expandByPoint(p);
    back.expandByPoint(new Vector3(Math.fround(p.x - v.x * thickness), Math.fround(p.y - v.y * thickness), Math.fround(p.z - v.z * thickness)));
  }
  return { front, back, edge: front.clone().union(back) };
}
