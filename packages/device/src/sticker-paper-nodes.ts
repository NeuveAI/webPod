import { nodeVec3 } from './node-material-values';
import type { Node, NodeMaterial } from 'three/webgpu';
import { Fn, If, attribute, clamp, float, max, normalLocal, sin, uniform, vec2, vec3 } from 'three/tsl';
import type { GpuPaperInput } from './sticker-paper-gpu';

/** Full-resolution paper deformation shared by both node backends. The source
 * grid, UVs and exact CPU bounds remain unchanged. Updating curl changes only a
 * uniform; local normals are replaced before stock bump/clearcoat processing.
 */
export function createPaperNodes(input: GpuPaperInput) {
  const curl = uniform(1);
  const reach = Math.min(42 * input.pixel, input.width * .16, input.height * .16);
  const front = Fn(([grid]: [Node<'vec2'>]) => {
    const xy = vec2(grid.x.div(96).sub(.5).mul(input.width), float(.5).sub(grid.y.div(96)).mul(input.height));
    const amount = clamp(curl, 0, 1);
    const radius = float(reach).div(amount.greaterThan(0).select(amount, float(1)).mul(2));
    const distance = input.liner ? amount.greaterThan(0).select(max(0, float(reach).sub(float(input.width * .5).sub(xy.x).add(float(input.height * .5).sub(xy.y)).div(Math.SQRT2))), float(0)) : float(0);
    const angle = distance.div(radius);
    const contraction = distance.sub(radius.mul(sin(angle))).div(Math.SQRT2);
    const bow = float(input.pixel * (input.liner ? 5 : 2.5)).mul(float(1).sub(xy.x.mul(2 / input.width).pow(2)));
    return vec3(xy.sub(contraction), bow.add(radius.mul(2).mul(sin(angle.mul(.5)).pow(2))));
  });
  const triangle = Fn(([a, b, c]: [Node<'vec2'>, Node<'vec2'>, Node<'vec2'>]) => {
    const pa = front(a), pb = front(b), pc = front(c);
    return pc.sub(pb).cross(pa.sub(pb));
  });
  const normal = Fn(([grid]: [Node<'vec2'>]) => {
    const sum = vec3(0).toVar();
    for (let row = -1; row <= 0; row++) for (let col = -1; col <= 0; col++) {
      const cell = grid.add(vec2(col, row));
      If(cell.x.greaterThanEqual(0).and(cell.y.greaterThanEqual(0)).and(cell.x.lessThan(96)).and(cell.y.lessThan(96)), () => {
        const a = cell, b = cell.add(vec2(0, 1)), c = cell.add(vec2(1, 1)), d = cell.add(vec2(1, 0));
        if (col === 0 || row === 0) sum.addAssign(triangle(a, b, d));
        if (col === -1 || row === -1) sum.addAssign(triangle(b, c, d));
      });
    }
    return sum.normalize();
  });
  const point = Fn(([vertex]: [Node<'vec3'>]) => front(vertex.xy).sub(normal(vertex.xy).mul(input.pixel * (input.liner ? .3 : .7)).mul(vertex.z)));
  return { curl, front, normal, point };
}

/** Installs point and triangle-normal deformation without replacing physical shading. */
export function installPaperNodes(material: NodeMaterial, input: GpuPaperInput, edge = false) {
  const nodes = createPaperNodes(input);
  material.positionNode = Fn(() => {
    const vertex = nodeVec3(attribute('paperVertex', 'vec3'));
    const normal = edge
      ? nodes.point(nodeVec3(attribute('paperC', 'vec3'))).sub(nodes.point(nodeVec3(attribute('paperB', 'vec3')))).cross(nodes.point(nodeVec3(attribute('paperA', 'vec3'))).sub(nodes.point(nodeVec3(attribute('paperB', 'vec3'))))).normalize()
      : nodes.normal(vertex.xy);
    normalLocal.assign(normal);
    return nodes.point(vertex);
  })();
  return { setCurl(value: number) { nodes.curl.value = Math.max(0, Math.min(1, value)); }, nodes };
}
