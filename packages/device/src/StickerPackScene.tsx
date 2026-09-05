import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { Mesh, Raycaster, Vector2, Vector3 } from 'three';
import { DeviceCanvasOrientationContext } from './DeviceCanvas';
import { useContext } from 'react';
import { STICKER_PACK_LAYOUT, type DeviceStickerScene, type StickerArtwork, type StickerPackVisual } from './sticker-contract';
import { STICKER_PACK_MATERIAL } from './materials';
import { createStickerPeelGeometry, createStickerSurfaceGeometry } from './sticker-surface';
import { createStickerRoughness } from './sticker-textures';
import { StickerPrint } from './StickerSurface';
import { useStudioEnvironmentSnapshot } from './StudioEnvironment';
import { DEVICE_CONTENT_NAME } from './ViewerLitDeviceFrame';
import { DEVICE_LAYOUT } from './layout';

/* ANIMATION STORYBOARD
 *    0ms   rear reveal exposes the bottom 32px of sealed laminate
 *  input   pull directly moves pack; owner spring resolves progress → 0 or 1
 *  input   peel bends paper around an arc, preserving its printed UV coordinates
 * release  landing interpolates free print → real rear mesh; owner spring settles
 * All clocks and reduced-motion resolution belong to the shared app controller.
 */
const PACK = Object.freeze({ depth: 130, printWidthRatio: .64, printOffsetY: .04, printLift: 1, seamHeight: 5 });

/** Existing camera/light rig; no second canvas, renderer, or animation scheduler. */
export function StickerPackScene({ scene: stickerScene }: { readonly scene: DeviceStickerScene }) {
  const { camera, scene, gl, size, viewport } = useThree();
  const orientation = useContext(DeviceCanvasOrientationContext);
  const studio = useStudioEnvironmentSnapshot();
  const roughness = useMemo(() => createStickerRoughness(), []);
  useEffect(() => () => roughness.dispose(), [roughness]);
  const onProjectionReady = stickerScene.onProjectionReady;
  useLayoutEffect(() => {
    const handle = { project(clientX: number, clientY: number) {
      if (orientation.visibleFace !== 'back') return null;
      const bounds = gl.domElement.getBoundingClientRect();
      if (!(bounds.width > 0 && bounds.height > 0)) return null;
      const rear = scene.getObjectByName('device-steel-back');
      if (!(rear instanceof Mesh)) return null;
      rear.updateWorldMatrix(true, false);
      const ray = new Raycaster();
      ray.setFromCamera(new Vector2((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2), camera);
      const hit = ray.intersectObject(rear, false)[0];
      if (hit === undefined) return null;
      const point = rear.worldToLocal(hit.point.clone());
      return { x: .5 - point.x / DEVICE_LAYOUT.body.width, y: .5 - point.y / DEVICE_LAYOUT.body.height };
    } };
    onProjectionReady?.(handle);
    return () => onProjectionReady?.(null);
  }, [camera, gl, orientation.visibleFace, scene, onProjectionReady]);
  const pack = stickerScene.pack;
  if (pack === null || orientation.visibleFace !== 'back') return null;
  const visible = viewport.getCurrentViewport(camera, new Vector3(0, 0, PACK.depth));
  const pixel = visible.width / size.width;
  const width = Math.min(STICKER_PACK_LAYOUT.maxWidthPx, size.width * STICKER_PACK_LAYOUT.widthRatio) * pixel;
  const height = width * STICKER_PACK_LAYOUT.heightRatio;
  const progress = Math.max(0, Math.min(1, pack.progress));
  const start = -visible.height / 2 - height / 2 + STICKER_PACK_LAYOUT.teasePx * pixel;
  const end = -visible.height / 2 + height / 2 + STICKER_PACK_LAYOUT.bottomGapPx * pixel;
  const y = start + (end - start) * progress;
  const art = stickerScene.assets.find((item) => item.id === pack.stickerId);
  return <group name="sticker-pack-scene">
    <group position={[0, y, PACK.depth]} name="sticker-pack-wrapper">
      <mesh raycast={() => {}}>
        <boxGeometry args={[width, height, .8]} />
        <meshPhysicalMaterial {...STICKER_PACK_MATERIAL} roughnessMap={roughness} envMap={studio.texture} />
      </mesh>
      {[-1, 1].map((edge) => <mesh key={edge} position={[0, edge * (height / 2 - PACK.seamHeight), .6]} raycast={() => {}}>
        <boxGeometry args={[width, PACK.seamHeight, .5]} />
        <meshPhysicalMaterial {...STICKER_PACK_MATERIAL} color="#c7bda8" envMap={studio.texture} />
      </mesh>)}
    </group>
    {art === undefined ? null : <PeelingPrint art={art} pack={pack} width={width * PACK.printWidthRatio}
      origin={new Vector3(0, y + height * PACK.printOffsetY, PACK.depth + PACK.printLift)}
      stickerScene={stickerScene} roughness={roughness} />}
  </group>;
}
function PeelingPrint({ art, pack, width, origin, stickerScene, roughness }: {
  readonly art: StickerArtwork; readonly pack: StickerPackVisual; readonly width: number; readonly origin: Vector3;
  readonly stickerScene: DeviceStickerScene; readonly roughness: ReturnType<typeof createStickerRoughness>;
}) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const orientation = useContext(DeviceCanvasOrientationContext);
  const geometry = useMemo(() => createStickerPeelGeometry(art, width, pack.peel), [art, width, pack.peel]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const { x: originX, y: originY, z: originZ } = origin;
  useLayoutEffect(() => {
    // Reset from the immutable peel shape so repeated effects cannot compound translation.
    const base = createStickerPeelGeometry(art, width, pack.peel);
    const positions = geometry.getAttribute('position');
    const source = base.getAttribute('position');
    const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
    const rear = scene.getObjectByName('device-steel-back');
    content?.updateWorldMatrix(true, true);
    let target: ReturnType<typeof createStickerSurfaceGeometry> | null = null;
    if (pack.placement !== null && rear instanceof Mesh) {
      try { target = createStickerSurfaceGeometry(art, pack.placement, rear.geometry); } catch { target = null; }
    }
    const targetPositions = target?.getAttribute('position');
    const amount = targetPositions === undefined ? 0 : Math.max(0, Math.min(1, pack.landing));
    for (let index = 0; index < positions.count; index++) {
      const point = new Vector3().fromBufferAttribute(source, index).add(new Vector3(originX, originY, originZ));
      if (targetPositions !== undefined && content !== undefined) {
        const destination = new Vector3().fromBufferAttribute(targetPositions, index).applyMatrix4(content.matrixWorld);
        point.lerp(destination, amount);
      }
      positions.setXYZ(index, point.x, point.y, point.z);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    base.dispose(); target?.dispose(); invalidate();
  }, [art, width, geometry, pack.peel, pack.placement, pack.landing, originX, originY, originZ, scene, invalidate, orientation.orientation]);
  return <StickerPrint art={art} geometry={geometry} roughness={roughness} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} />;
}
