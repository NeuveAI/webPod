import { AgXToneMapping, Mesh, SRGBColorSpace, type Material, type Object3D } from 'three';
import { ConvertNode, NodeMaterial } from 'three/webgpu';
import { select, uniform, vec3, vec4 } from 'three/tsl';

const installed = new WeakSet<NodeMaterial>();
const policy = 'webpod-gl-fragment-output-v1';

function validate(material: NodeMaterial) {
  if (material.outputNode !== null || material.mrtNode !== null ||
      (material.fragmentNode !== null && 'isOutputStructNode' in material.fragmentNode)) {
    throw new Error('Native output requires a single straight RGBA fragment');
  }
}

/** Final-scene materials only: preserve GL tone-map → sRGB → fog/premult → blend.
 * PMREM-room materials are never installed. A render-updated gate keeps borrowed
 * materials linear in intermediate targets without a first-compile cache branch.
 * No texture or renderer is retained; the material owns its normal node lifetime.
 */
export function installNativeMaterialOutput<T extends Material>(material: T): T {
  if (!(material instanceof NodeMaterial)) throw new Error('Native output requires an authored node material');
  validate(material);
  if (installed.has(material)) return material;
  const originalOutput = material.setupOutput;
  const originalKey = material.customProgramCacheKey;
  const finalPass = uniform(false, 'bool').onRenderUpdate(frame => frame.renderer?.isOutputTarget === true);
  material.setupOutput = function (builder, color) {
    validate(this);
    const straight = vec4(new ConvertNode<"vec4">(color, "vec4"));
    const rgb = this.toneMapped ? straight.rgb.toneMapping(AgXToneMapping) : straight.rgb;
    const encoded = vec3(new ConvertNode<"vec3">(rgb.workingToColorSpace(SRGBColorSpace), "vec3"));
    return originalOutput.call(this, builder, vec4(select(finalPass, encoded, straight.rgb), straight.a));
  };
  material.customProgramCacheKey = function () {
    return `${originalKey.call(this)}|${policy}|${this.toneMapped ? 'mapped' : 'unmapped'}`;
  };
  material.needsUpdate = true;
  installed.add(material);
  return material;
}

/** Validate detached candidates before compile/ACK, including shared materials.
 * Unsupported automatic stock conversion or custom outputs reject the candidate
 * before admission so the host can replace the complete renderer with GL.
 */
export function assertNativeMaterialOutput(root: Object3D): void {
  root.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof NodeMaterial) || !installed.has(material)) throw new Error('Native scene material lacks output policy');
      validate(material);
    }
  });
}
