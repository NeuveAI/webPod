import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { BackSide, FrontSide, MeshPhysicalMaterial, type BufferGeometry, type Texture } from 'three';
import { STICKER_LAMINATE } from './materials';
import { createStickerSurfaceGeometry, STICKER_SURFACE } from './sticker-surface';
import { createStickerRoughness, useStickerTexture } from './sticker-textures';
import type { DeviceStickerPlacement, DeviceStickerScene, StickerArtwork } from './sticker-contract';
import { useStudioEnvironmentSnapshot } from './StudioEnvironment';

/** Sticker geometry lives beneath device-model-content, inheriting the real shell pose. */
export function StickerSurface({ scene, rear }: { readonly scene: DeviceStickerScene; readonly rear: BufferGeometry }) {
  const roughness = useMemo(() => createStickerRoughness(), []);
  useEffect(() => () => roughness.dispose(), [roughness]);
  return <group name="device-equipped-stickers">
    {scene.placements.map((placement) => {
      const art = scene.assets.find((asset) => asset.id === placement.stickerId);
      return art === undefined ? null : <EquippedSticker key={placement.stickerId} art={art} placement={placement} rear={rear} roughness={roughness} scene={scene} />;
    })}
  </group>;
}
function EquippedSticker({ art, placement, rear, roughness, scene }: {
  readonly art: StickerArtwork; readonly placement: DeviceStickerPlacement; readonly rear: BufferGeometry;
  readonly roughness: Texture; readonly scene: DeviceStickerScene;
}) {
  const geometry = useMemo(() => {
    try { return createStickerSurfaceGeometry(art, placement, rear); } catch { return null; }
  }, [art, placement, rear]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (geometry === null) return null;
  return <StickerPrint art={art} geometry={geometry} roughness={roughness} finishEnabled={scene.finishEnabled !== false} onError={scene.onArtworkError} onReady={scene.onArtworkReady} />;
}
/** One map alpha-tests before physical lighting, clipping both print and satin response. */
export function StickerPrint({ art, geometry, roughness, finishEnabled, onError, onReady }: {
  readonly art: StickerArtwork; readonly geometry: BufferGeometry; readonly roughness: Texture;
  readonly finishEnabled: boolean; readonly onError?: (id: string) => void; readonly onReady?: (id: string) => void;
}) {
  const { texture, failed } = useStickerTexture(art.url);
  const invalidate = useThree((state) => state.invalidate);
  const studio = useStudioEnvironmentSnapshot();
  useEffect(() => { invalidate(); }, [texture, geometry, finishEnabled, studio, invalidate]);
  useEffect(() => { if (failed) onError?.(art.id); }, [failed, art.id, onError]);
  useEffect(() => { if (texture !== null) onReady?.(art.id); }, [texture, art.id, onReady]);
  const materials = useMemo(() => {
    const shared = { ...STICKER_LAMINATE, map: texture, roughnessMap: roughness,
      envMap: studio.texture, alphaTest: STICKER_SURFACE.alphaThreshold, transparent: true, depthWrite: false };
    const front = new MeshPhysicalMaterial({ ...shared, side: FrontSide, clearcoat: finishEnabled ? STICKER_LAMINATE.clearcoat : 0 });
    const back = new MeshPhysicalMaterial({ ...shared, side: BackSide, clearcoat: 0 });
    back.onBeforeCompile = vinylBackingShader;
    back.customProgramCacheKey = () => "webpod-sticker-backing-v1";
    return { front, back };
  }, [texture, roughness, studio.texture, finishEnabled]);
  useEffect(() => () => { materials.front.dispose(); materials.back.dispose(); }, [materials]);
  if (texture === null) return null;
  // Meshes borrow geometry/maps. Their owners dispose those, while this component
  // owns exactly these two physical materials, including the unprinted underside.
  return <group name={`sticker-print-${art.id}`}>
    <mesh name={`sticker-${art.id}`} geometry={geometry} material={materials.front} dispose={null} raycast={() => {}} renderOrder={3} />
    <mesh name={`sticker-backing-${art.id}`} geometry={geometry} material={materials.back} dispose={null} raycast={() => {}} renderOrder={3} />
  </group>;
}

/** Keep source alpha/UV exactly while the peeled adhesive underside remains unprinted. */
const vinylBackingShader: MeshPhysicalMaterial["onBeforeCompile"] = (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n diffuseColor.rgb = vec3(0.79, 0.73, 0.61);");
};
