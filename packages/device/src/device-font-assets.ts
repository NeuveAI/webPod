import { Texture, type CanvasTexture } from 'three';
import { createWheelLabelMap } from './textures';
import { createBackplateFinishMaps } from './backplate-finish';
import { DEVICE_LAYOUT } from './layout';
import type { DeviceMaterials } from './materials';

/** Browser font raster only. Dense rear texels come from the existing prepared
 * lease; worker fonts are not assumed to match native Arial glyphs. Bitmap
 * orientation/premultiplication is baked at creation because ImageBitmap ignores
 * Texture.flipY/premultiplyAlpha during upload in the installed renderer.
 */
export interface DeviceFontBitmap {
  readonly image: ImageBitmap;
  readonly colorSpace: string;
  readonly wrapS: Texture['wrapS']; readonly wrapT: Texture['wrapT'];
  readonly minFilter: Texture['minFilter']; readonly magFilter: Texture['magFilter'];
  readonly generateMipmaps: boolean; readonly anisotropy: number;
}
export interface DeviceFontAssets { readonly label: DeviceFontBitmap; readonly rearRoughness: DeviceFontBitmap; readonly rearBump: DeviceFontBitmap }
export async function captureDeviceFontAssets(isBlack: boolean, params: DeviceMaterials, backplatePixels: Uint8ClampedArray, signal: AbortSignal): Promise<DeviceFontAssets> {
  const { wheel } = DEVICE_LAYOUT;
  const label = createWheelLabelMap({ outerR: wheel.outerR, bandInnerR: wheel.labelBandInnerR, bandOuterR: wheel.labelBandOuterR,
    labelColor: isBlack ? params.wheelLabelBlack : params.wheelLabelWhite, fontPx: 13, size: 1024 });
  const back = createBackplateFinishMaps(undefined, backplatePixels);
  const owned: ImageBitmap[] = [];
  const bitmap = async (texture: CanvasTexture): Promise<DeviceFontBitmap> => {
    const image = await createImageBitmap(texture.image, { imageOrientation: texture.flipY ? 'flipY' : 'none',
      premultiplyAlpha: texture.premultiplyAlpha ? 'premultiply' : 'none', colorSpaceConversion: 'none' });
    owned.push(image);
    if (signal.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
    return { image, colorSpace: texture.colorSpace, wrapS: texture.wrapS, wrapT: texture.wrapT,
      minFilter: texture.minFilter, magFilter: texture.magFilter, generateMipmaps: texture.generateMipmaps, anisotropy: texture.anisotropy };
  };
  try {
    if (!label || !back) throw new Error('Native font raster is unavailable');
    if (signal.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
    // Sequential native snapshots bound allocations and close every successful
    // earlier result when a later capture fails or its owner retires.
    const result = { label: await bitmap(label), rearRoughness: await bitmap(back.roughnessMap), rearBump: await bitmap(back.bumpMap) };
    return result;
  } catch (error) { for (const image of owned) image.close(); throw error; }
  finally { label?.dispose(); back?.dispose(); }
}
export function disposeDeviceFontAssets(assets: DeviceFontAssets): void { for (const value of Object.values(assets)) value.image.close(); }
export function restoreDeviceFontTexture(asset: DeviceFontBitmap): Texture {
  const texture = new Texture(asset.image);
  texture.colorSpace = asset.colorSpace; texture.wrapS = asset.wrapS; texture.wrapT = asset.wrapT;
  texture.minFilter = asset.minFilter; texture.magFilter = asset.magFilter; texture.generateMipmaps = asset.generateMipmaps; texture.anisotropy = asset.anisotropy;
  texture.flipY = false; texture.premultiplyAlpha = false; texture.needsUpdate = true;
  return texture;
}
