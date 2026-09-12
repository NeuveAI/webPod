import { ConvertNode } from 'three/webgpu';
import { nodeObject } from 'three/tsl';
import type { Node } from 'three/webgpu';

/** Explicit shader conversions at canonical lighting inputs, whose installed
 * declarations expose unparameterized Node. These generate typed TSL nodes;
 * they are not TypeScript renderer/material compatibility assertions. */
export const nodeVec3 = (value: Node): Node<'vec3'> => nodeObject(new ConvertNode<'vec3'>(value, 'vec3'));
/** MaterialColor's runtime map branch includes alpha despite its vec3 declaration. */
export const nodeVec4 = (value: Node): Node<'vec4'> => nodeObject(new ConvertNode<'vec4'>(value, 'vec4'));
