import { useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { BackSide, DoubleSide, FrontSide, Mesh, Raycaster, Vector2, Vector3 } from 'three';
import { DeviceCanvasOrientationContext } from './DeviceCanvas';
import { useContext } from 'react';
import { STICKER_PACK_LAYOUT, stickerPackViewportLayout, STICKER_SHEET_SLOTS, STICKER_SHEET_PRINT_WIDTH, type DeviceStickerScene, type StickerArtwork, type StickerPackVisual } from './sticker-contract';
import { STICKER_PACK_MATERIAL } from './materials';
import { createStickerPeelGeometry, createStickerSurfaceGeometry, stickerVisibleAspect } from './sticker-surface';
import { createStickerRoughness } from './sticker-textures';
import { StickerPrint } from './StickerSurface';
import { useStudioEnvironmentSnapshot } from './StudioEnvironment';
import { DEVICE_CONTENT_NAME, DEVICE_MODEL_NAME } from './ViewerLitDeviceFrame';
import { DEVICE_LAYOUT } from './layout';
import { createStickerSleeveGeometry, SLEEVE_LAMINATE } from './sticker-sleeve';
import { createStickerPaperGeometry, conformStickerToPaper, stickerPaperCurlProgress } from './sticker-paper';

/* ANIMATION STORYBOARD
 *    0ms   rear reveal exposes the bottom 32px of sealed laminate
 *  input   pull directly moves pack; owner spring resolves progress → 0 or 1
 *  input   peel bends paper around an arc, preserving its printed UV coordinates
 * release  landing interpolates free print → real rear mesh; owner spring settles
 * All clocks and reduced-motion resolution belong to the shared app controller.
 */
const PACK = Object.freeze({ depth: 130, linerClearcoat: .55, linerRoughness: .38, linerCoatRoughness: .23 });

/** Existing camera/light rig; no second canvas, renderer, or animation scheduler. */
export function StickerPackScene({ scene: stickerScene }: { readonly scene: DeviceStickerScene }) {
  const { camera, scene, gl, size, viewport } = useThree();
  const orientation = useContext(DeviceCanvasOrientationContext);
  const roughness = useMemo(() => createStickerRoughness(), []);
  useEffect(() => () => roughness.dispose(), [roughness]);
  const onProjectionReady = stickerScene.onProjectionReady;
  const packVisible = stickerScene.pack !== null;
  const presentation = (stickerScene.pack?.progress ?? 0) * (stickerScene.pack?.sheet?.reveal ?? 0);
  useLayoutEffect(() => {
    const model = scene.getObjectByName(DEVICE_MODEL_NAME);
    if (model === undefined) return;
    const pixels = viewport.getCurrentViewport(camera, new Vector3()).height / size.height;
    // Keep a substantial upper rear canvas free on a phone as the liner slides out.
    model.position.y = size.width < STICKER_PACK_LAYOUT.desktopBreakpoint ? Math.min(120, size.height * .15) * pixels * presentation : 0;
    model.updateWorldMatrix(true, true); gl.domElement.setAttribute('data-wp-collection-reframe', String(presentation));
    return () => { model.position.y = 0; model.updateWorldMatrix(true, true); };
  }, [camera, gl, presentation, scene, size.height, size.width, viewport]);
  useLayoutEffect(() => {
    const handle = { project(clientX: number, clientY: number) {
      if (!packVisible) return null;
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
  }, [camera, gl, orientation.visibleFace, scene, onProjectionReady, packVisible]);
  const pack = stickerScene.pack;
  if (pack === null) return null;
  const visible = viewport.getCurrentViewport(camera, new Vector3(0, 0, PACK.depth));
  const pixel = visible.width / size.width;
  const layout = stickerPackViewportLayout(size.width, size.height);
  const width = layout.width * pixel;
  const height = layout.height * pixel;
  const x = (layout.centerX - size.width / 2) * pixel;
  const progress = Math.max(0, Math.min(1, pack.progress));
  const start = -visible.height / 2 - height / 2 + STICKER_PACK_LAYOUT.teasePx * pixel;
  const end = -visible.height / 2 + height / 2 + STICKER_PACK_LAYOUT.bottomGapPx * pixel;
  const y = start + (end - start) * progress;
  // Lower the backing workspace on phones after detachment. The carried print
  // keeps the original origin, so its world position remains under the pointer.
  const workspaceLowering = size.width < STICKER_PACK_LAYOUT.desktopBreakpoint
    ? height * STICKER_PACK_LAYOUT.linerTravel * Math.max(0, Math.min(1, pack.workspaceLowering ?? 0)) : 0;
  const sheet = pack.sheet;
  const reveal = sheet?.reveal ?? 0;
  const linerTravel = height * STICKER_PACK_LAYOUT.linerTravel * reveal;
  const art = stickerScene.assets.find((item) => item.id === pack.stickerId);
  const slots = sheet?.slots ?? [];
  const slotIndex = slots.findIndex((slot) => slot.stickerId === pack.stickerId);
  const seat = STICKER_SHEET_SLOTS[slotIndex];
  const printWidth = width * STICKER_SHEET_PRINT_WIDTH;
  const offset = pack.dragOffset;
  return <group name="sticker-pack-scene">
    <group position={[x, y - workspaceLowering, PACK.depth]} name="sticker-pack-wrapper">
      {(sheet?.neighbors ?? []).map((neighbor, index) => <group key={neighbor.stickerId} position={[(index === 0 ? -1 : 1) * pixel * 8, pixel * 10, -pixel * (8 + index)]} rotation={[0, 0, (index === 0 ? 1 : -1) * .055]}>
        <PackPaper width={width} height={height} pixel={pixel} ink={neighbor.ink} roughness={roughness} />
        <group position={[0, 0, pixel * 2]}><CoverPrint stickerId={neighbor.stickerId} width={width * .58} pixel={pixel} roughness={roughness} stickerScene={stickerScene} /></group>
      </group>)}
      <group position={[0, linerTravel, pixel * 2]}>
        <PackPaper width={width} height={height} pixel={pixel} ink="#e9e2d1" roughness={roughness} liner curlProgress={stickerPaperCurlProgress(width, height, pixel, linerTravel)} />
      {reveal > .02 ? slots.map((slot, index) => {
        const slotArt = stickerScene.assets.find((item) => item.id === slot.stickerId);
        const position = STICKER_SHEET_SLOTS[index];
        if (slotArt === undefined || position === undefined) return null;
        const peeling = slot.stickerId === pack.stickerId && (pack.peel > 0 || pack.placement !== null || pack.dragOffset != null);
        return <group key={slot.stickerId} position={[(position.x - .5) * width, (.5 - position.y) * height, pixel * (5 * (1 - (position.x * 2 - 1) ** 2) + .8)]}>
          <SheetPrint bow={{ pixel, paperWidth: width, seatX: position.x }} art={slotArt} width={Math.min(printWidth, height * .21 / stickerVisibleAspect(slotArt))} appearance={peeling || slot.state === 'placed' ? 'placed' : slot.state === 'locked' || slot.state === 'sealed' ? 'locked' : 'earned'} roughness={roughness} stickerScene={stickerScene} />
        </group>;
      }) : null}
      </group>
      <group position={[0, 0, pixel * 8]}>
        <SleevePocket width={width + pixel * 4} height={height} pixel={pixel} ink={sheet?.ink ?? '#b7aa86'} roughness={roughness} />
        {slots[0] === undefined ? null : <CoverPrint stickerId={slots[0].stickerId} width={width * .58} pixel={pixel} roughness={roughness} stickerScene={stickerScene} />}
      </group>
    </group>
    {art === undefined || seat === undefined || (pack.peel === 0 && pack.placement === null && pack.dragOffset == null) ? null : <PeelingPrint paperWidth={width} pixel={pixel} seatX={seat.x} art={art} pack={pack} width={Math.min(printWidth, height * .21 / stickerVisibleAspect(art))}
      origin={new Vector3(x + (seat.x - .5) * width + (offset?.x ?? 0) * pixel, y + linerTravel + (.5 - seat.y) * height - (offset?.y ?? 0) * pixel, PACK.depth + pixel * (2 + 5 * (1 - (seat.x * 2 - 1) ** 2) + .8))}
      stickerScene={stickerScene} roughness={roughness} />}
  </group>;
}
/** Release stock bows and curls at its unprinted top corner; the printed sleeve is stiffer. */
function PackPaper({ width, height, pixel, ink, roughness, liner = false, curlProgress = 1 }: { readonly width: number; readonly height: number; readonly pixel: number; readonly ink: string; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly liner?: boolean; readonly curlProgress?: number }) {
  const studio = useStudioEnvironmentSnapshot();
  const stock = useMemo(() => createStickerPaperGeometry(width, height, pixel, liner, curlProgress), [width, height, pixel, liner, curlProgress]);
  useEffect(() => () => { stock.front.dispose(); stock.back.dispose(); stock.edge.dispose(); }, [stock]);
  return <group name={liner ? "release-liner-stock" : "printed-sleeve-stock"}>
    <mesh geometry={stock.back} raycast={() => {}}><meshStandardMaterial color={liner ? '#c4bba8' : '#b8a88d'} roughness={.94} side={BackSide} /></mesh>
    <mesh geometry={stock.edge} raycast={() => {}}><meshStandardMaterial color={liner ? '#b6aa92' : '#aa9574'} roughness={.96} side={DoubleSide} /></mesh>
    <mesh geometry={stock.front} raycast={() => {}}><meshPhysicalMaterial {...STICKER_PACK_MATERIAL} color={ink} roughnessMap={roughness} bumpMap={roughness} bumpScale={pixel * .2} roughness={liner ? PACK.linerRoughness : SLEEVE_LAMINATE.roughness} clearcoat={liner ? PACK.linerClearcoat : SLEEVE_LAMINATE.clearcoat} clearcoatRoughness={liner ? PACK.linerCoatRoughness : SLEEVE_LAMINATE.clearcoatRoughness} envMap={studio.texture} side={FrontSide} /></mesh>
  </group>;
}
/** Folded/glued paper pocket; the thumb notch and fold thickness identify the sleeve. */
function SleevePocket({ width, height, pixel, ink, roughness }: { readonly width: number; readonly height: number; readonly pixel: number; readonly ink: string; readonly roughness: ReturnType<typeof createStickerRoughness> }) {
  const studio = useStudioEnvironmentSnapshot();
  const geometry = useMemo(() => createStickerSleeveGeometry(width, height, pixel), [width, height, pixel]);
  const exterior = { ...SLEEVE_LAMINATE, color: ink, envMap: studio.texture, roughnessMap: roughness, bumpMap: roughness, bumpScale: pixel * .2 };
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group>
    <mesh geometry={geometry} raycast={() => {}}>
      <meshPhysicalMaterial attach="material-0" {...exterior} />
      <meshStandardMaterial attach="material-1" color="#bca787" roughness={.94} />
      <meshStandardMaterial attach="material-2" color="#b8a88d" roughness={.94} />
    </mesh>
    {[-1, 1].map((side) => <mesh key={side} position={[side * (width / 2 - pixel * 4), 0, pixel * 1.05]} rotation={[0, side * .045, 0]} raycast={() => {}}><planeGeometry args={[pixel * 7, height - pixel * 2]} /><meshPhysicalMaterial {...exterior} /></mesh>)}
    <mesh position={[0, -height / 2 + pixel * 3, pixel * 1.05]} rotation={[.06, 0, 0]} raycast={() => {}}><planeGeometry args={[width - pixel * 2, pixel * 5]} /><meshPhysicalMaterial {...exterior} /></mesh>
  </group>;
}
function SheetPrint({ art, width, appearance, roughness, stickerScene, bow }: { readonly art: StickerArtwork; readonly width: number; readonly appearance: 'earned' | 'locked' | 'placed'; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly stickerScene: DeviceStickerScene; readonly bow?: { pixel: number; paperWidth: number; seatX: number } }) {
  const paperPixel = bow?.pixel ?? 0, paperWidth = bow?.paperWidth ?? 1, seatX = bow?.seatX ?? .5;
  const geometry = useMemo(() => {
    return conformStickerToPaper(createStickerPeelGeometry(art, width, 0), paperWidth, paperPixel, seatX);
  }, [art, width, paperPixel, paperWidth, seatX]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <StickerPrint art={art} geometry={geometry} roughness={roughness} appearance={appearance} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} />;
}
function CoverPrint({ stickerId, width, pixel, roughness, stickerScene }: { readonly stickerId: string; readonly width: number; readonly pixel: number; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly stickerScene: DeviceStickerScene }) {
  const art = stickerScene.assets.find((asset) => asset.id === stickerId);
  return art === undefined ? null : <group position={[0, -width * .04, pixel * 4]}><SheetPrint art={art} width={width} appearance="earned" roughness={roughness} stickerScene={stickerScene} /></group>;
}

function PeelingPrint({ art, pack, width, origin, stickerScene, roughness, paperWidth, pixel, seatX }: {
  readonly paperWidth: number; readonly pixel: number; readonly seatX: number;
  readonly art: StickerArtwork; readonly pack: StickerPackVisual; readonly width: number; readonly origin: Vector3;
  readonly stickerScene: DeviceStickerScene; readonly roughness: ReturnType<typeof createStickerRoughness>;
}) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const orientation = useContext(DeviceCanvasOrientationContext);
  const geometry = useMemo(() => conformStickerToPaper(createStickerPeelGeometry(art, width, pack.peel), paperWidth, pixel, seatX), [art, width, pack.peel, paperWidth, pixel, seatX]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const { x: originX, y: originY, z: originZ } = origin;
  useLayoutEffect(() => {
    // Reset from the immutable peel shape so repeated effects cannot compound translation.
    const base = conformStickerToPaper(createStickerPeelGeometry(art, width, pack.peel), paperWidth, pixel, seatX);
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
    const point = new Vector3(); const destination = new Vector3(); const start = new Vector3(originX, originY, originZ);
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(source, index).add(start);
      if (targetPositions !== undefined && content !== undefined) {
        destination.fromBufferAttribute(targetPositions, index).applyMatrix4(content.matrixWorld);
        point.lerp(destination, amount);
      }
      positions.setXYZ(index, point.x, point.y, point.z);
    }
    positions.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    base.dispose(); target?.dispose(); invalidate();
  }, [art, width, geometry, pack.peel, pack.placement, pack.landing, originX, originY, originZ, scene, invalidate, orientation.orientation, paperWidth, pixel, seatX]);
  return <StickerPrint art={art} geometry={geometry} roughness={roughness} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} />;
}
