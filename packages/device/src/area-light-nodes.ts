import { Fn, If, mat3, max, vec3 } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** Installed Three r185 LTC diffuse evaluator, expressed entirely through the
 * public TSL module. The private source module cannot be imported alongside the
 * bundled renderer: it owns a different TSL stack. Constants, branch, winding,
 * accumulation order and horizon approximation match src/nodes/functions/BSDF/LTC.js.
 */
const edgeFactor = Fn(([v1, v2]: [Node<'vec3'>, Node<'vec3'>]) => {
  const x = v1.dot(v2), y = x.abs().toVar();
  const a = y.mul(.0145206).add(.4965155).mul(y).add(.8543985).toVar();
  const b = y.add(4.1616724).mul(y).add(3.4175940).toVar();
  const v = a.div(b);
  const angle = x.greaterThan(0).select(v, max(x.mul(x).oneMinus(), 1e-7).inverseSqrt().mul(.5).sub(v));
  return v1.cross(v2).mul(angle);
}).setLayout({ name: 'webpodLtcEdgeFactor', type: 'vec3', inputs: [{ name: 'v1', type: 'vec3' }, { name: 'v2', type: 'vec3' }] });
const clippedFactor = Fn(([f]: [Node<'vec3'>]) => {
  const length = f.length();
  return max(length.mul(length).add(f.z).div(length.add(1)), 0);
}).setLayout({ name: 'webpodLtcClippedFactor', type: 'float', inputs: [{ name: 'f', type: 'vec3' }] });

interface AreaInput { N: Node<'vec3'>; V: Node<'vec3'>; P: Node<'vec3'>; mInv: Node<'mat3'>; p0: Node<'vec3'>; p1: Node<'vec3'>; p2: Node<'vec3'>; p3: Node<'vec3'> }
const evaluate = Fn(([N, V, P, mInv, p0, p1, p2, p3]: [Node<'vec3'>, Node<'vec3'>, Node<'vec3'>, Node<'mat3'>, Node<'vec3'>, Node<'vec3'>, Node<'vec3'>, Node<'vec3'>]) => {
  const v1 = p1.sub(p0).toVar(), v2 = p3.sub(p0).toVar();
  const lightNormal = v1.cross(v2), result = vec3(0).toVar();
  If(lightNormal.dot(P.sub(p0)).greaterThanEqual(0), () => {
    const tangent1 = V.sub(N.mul(V.dot(N))).normalize(), tangent2 = N.cross(tangent1).negate();
    const transform = mInv.mul(mat3(tangent1, tangent2, N).transpose()).toVar();
    const c0 = transform.mul(p0.sub(P)).normalize().toVar(), c1 = transform.mul(p1.sub(P)).normalize().toVar();
    const c2 = transform.mul(p2.sub(P)).normalize().toVar(), c3 = transform.mul(p3.sub(P)).normalize().toVar();
    const sum = vec3(0).toVar();
    sum.addAssign(edgeFactor(c0, c1)); sum.addAssign(edgeFactor(c1, c2)); sum.addAssign(edgeFactor(c2, c3)); sum.addAssign(edgeFactor(c3, c0));
    result.assign(vec3(clippedFactor(sum)));
  });
  return result;
}).setLayout({ name: 'webpodLtcEvaluate', type: 'vec3', inputs: [
  { name: 'N', type: 'vec3' }, { name: 'V', type: 'vec3' }, { name: 'P', type: 'vec3' }, { name: 'mInv', type: 'mat3' },
  { name: 'p0', type: 'vec3' }, { name: 'p1', type: 'vec3' }, { name: 'p2', type: 'vec3' }, { name: 'p3', type: 'vec3' },
] });

export function evaluateAreaLightNodes(input: AreaInput) {
  return evaluate(input.N, input.V, input.P, input.mInv, input.p0, input.p1, input.p2, input.p3);
}
