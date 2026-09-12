import { NoColorSpace, SRGBColorSpace, type Texture } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { Fn, texture, vec3, vec4 } from 'three/tsl';

/** Exact LCD transfer contract: native unorm pixels need one sRGB EOTF;
 * a tagged image texture is decoded by Three. Never apply both conversions.
 * Caller owns the texture and must select storage metadata before upload.
 */
export function createLcdNodeMaterial(image: Texture, transfer: 'unorm-srgb' | 'srgb-tagged') {
  if (image.colorSpace !== (transfer === 'unorm-srgb' ? NoColorSpace : SRGBColorSpace)) throw new Error('LCD storage color space disagrees with transfer contract');
  const material = new MeshBasicNodeMaterial({ map: image, toneMapped: false });
  if (transfer === 'unorm-srgb') material.colorNode = Fn(() => {
    const sample = texture(image);
    const high = sample.rgb.mul(.9478672986).add(.0521327014).pow(2.4), low = sample.rgb.mul(.0773993808);
    const rgb = vec3(sample.r.lessThanEqual(.04045).select(low.r, high.r), sample.g.lessThanEqual(.04045).select(low.g, high.g), sample.b.lessThanEqual(.04045).select(low.b, high.b));
    return vec4(rgb, sample.a);
  })();
  return material;
}
