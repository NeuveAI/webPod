import { installNativeMaterialOutput } from "./native-material-output";
import { BackSide, FrontSide, type Texture } from 'three';
import { STICKER_LAMINATE } from './materials';
import { STICKER_SURFACE } from './sticker-surface';
import type { StickerDamageResource } from './sticker-alpha';
import { applyStickerWearNodes, installStickerSeatNodes, StickerPhysicalNodeMaterial } from './sticker-wear-nodes';

export type StickerNodeDamage = Pick<StickerDamageResource, 'id' | 'texture'>;

export interface StickerNodeMaterialInput {
  readonly id: string;
  readonly map: Texture;
  readonly roughness: Texture;
  readonly environment: Texture | null;
  readonly finishEnabled: boolean;
  readonly appearance: 'earned' | 'locked' | 'placed';
  readonly wear: number;
  /** Prepared by the resource owner, never synchronously rasterized in a worker material factory. */
  readonly damage: StickerNodeDamage | null;
}

/** Exact front/back material pair used by StickerPrint. Geometry, artwork,
 * environment and damage textures are borrowed; this owner releases only its
 * materials and controller fallback textures. Damage/hit provenance stays with
 * the prepared resource owner. Appearance changes create a new material pair.
 */
export function createStickerNodeMaterials(input: StickerNodeMaterialInput) {
  const shared = { ...STICKER_LAMINATE, map: input.map, roughnessMap: input.roughness,
    envMap: input.environment, alphaTest: STICKER_SURFACE.alphaThreshold, transparent: true, depthWrite: false };
  const front = new StickerPhysicalNodeMaterial({ ...shared, side: FrontSide, clearcoat: input.finishEnabled ? STICKER_LAMINATE.clearcoat : 0 });
  const back = new StickerPhysicalNodeMaterial({ ...shared, side: BackSide, clearcoat: 0 });
  const wearing = applyStickerWearNodes(front, input.id, false, input.damage);
  const backingWear = applyStickerWearNodes(back, input.id, true, input.damage);
  if (input.appearance !== 'earned') installStickerSeatNodes(front, input.appearance, input.map);
  const setWear = (value: number) => { const wear = input.appearance === 'earned' ? value : 0; wearing.set(wear); backingWear.set(wear); };
  setWear(input.wear);
  installNativeMaterialOutput(front); installNativeMaterialOutput(back);
  return {
    front, back, setWear,
    setDamage(resource: StickerNodeDamage | null) { wearing.setDamage(resource); backingWear.setDamage(resource); },
    dispose() { wearing.dispose(); backingWear.dispose(); front.dispose(); back.dispose(); },
  };
}
