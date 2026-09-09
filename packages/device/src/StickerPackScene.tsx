import { fitStickerDrop } from './sticker-drop-fit';
import { constrainStickerCarryExterior, constrainStickerFreeCarry, constrainStickerLanding, createStickerGrabPeelGeometry, createStickerFreeCarryGeometry, interpolateStickerCarryGeometry, stickerCarryPointerOffset, alignStickerCarryOrigin, createStickerLandingGeometry, anchorStickerToPointer, stickerGeometryUvPoint } from './sticker-free-carry';
import { createStickerVisibility, stickerVisibilityQuery } from './sticker-visibility';
import { projectStickerDrop } from './sticker-drop-projection';
import { captureStickerSurfaceGrab } from './sticker-surface-grab';
import { stickerWrapSurface } from './sticker-wrap';
import { projectedStickerContour } from './sticker-contour';
import { useThree } from '@react-three/fiber';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { BackSide, DoubleSide, FrontSide, Group, Mesh, Raycaster, Vector2, Vector3 } from 'three';
import { DeviceCanvasOrientationContext } from './DeviceCanvas';
import { useContext } from 'react';
import { stickerPackPresentation, STICKER_PACK_MOTION, STICKER_PACK_LAYOUT, isStickerCarried, stickerPackViewportLayout, STICKER_SHEET_SLOTS, STICKER_SHEET_PRINT_WIDTH, type StickerRearProjection, type DeviceStickerScene, type StickerArtwork, type StickerPackVisual } from './sticker-contract';
import { STICKER_PACK_MATERIAL } from './materials';
import { createStickerPeelGeometry, createStickerSurfaceGeometry, createRearStickerPeelGeometry, stickerVisibleAspect, STICKER_SURFACE, stickerRearTransportWeight } from './sticker-surface';
import { createStickerRoughness, useStickerTexture, useStickerPreparationEpoch } from './sticker-textures';
import { StickerPrint } from './StickerSurface';
import { useStudioEnvironmentSnapshot } from './StudioEnvironment';
import { DEVICE_CONTENT_NAME, DEVICE_MODEL_NAME } from './ViewerLitDeviceFrame';
import { captureStickerTransformPlane, stickerProjectedQuad } from './sticker-transform-projection';
import { stickerProjectedBounds } from './sticker-projected-bounds';
import { intersectStickerPrint, prepareStickerAlpha } from './sticker-hit';
import { prepareStickerPrograms } from './sticker-program-preparation';
import { DEVICE_LAYOUT } from './layout';
import { isDeviceOuterGrabPoint } from './orientation-grab';
import { createStickerSleeveGeometry, SLEEVE_LAMINATE } from './sticker-sleeve';
import { createStickerPaperGeometry, conformStickerToPaper, stickerPaperCurlProgress } from './sticker-paper';

/* ANIMATION STORYBOARD
 *    0ms   rear reveal exposes the bottom 32px of sealed laminate
 *  input   pull directly moves pack; owner spring resolves progress → 0 or 1
 *  input   peel bends paper around an arc, preserving its printed UV coordinates
 * release  landing interpolates free print → real rear mesh; owner spring settles
 * All clocks and reduced-motion resolution belong to the shared app controller.
 */
const CARRY_FRAME = Object.freeze({ stiffness: 240, damping: 30, maxStepSeconds: .032, tolerancePx: .15, maxSettleMs: 1800 });
const PARKED_STICKER_SEGMENTS = 24;
const PACK = Object.freeze({ depth: 130, linerClearcoat: .55, linerRoughness: .38, linerCoatRoughness: .23 });

/** Existing camera/light rig; no second canvas, renderer, or animation scheduler. */
export function StickerPackScene({ scene }: { readonly scene: DeviceStickerScene }) {
  return <group><PrepareStickerAssets scene={scene} /><StickerPackContents scene={scene} /></group>;
}
function StickerPackContents({ scene: stickerScene }: { readonly scene: DeviceStickerScene }) {
  const { camera, scene, gl, size, viewport, invalidate } = useThree();
  const orientation = useContext(DeviceCanvasOrientationContext);
  const roughness = useMemo(() => createStickerRoughness(), []);
  useEffect(() => () => roughness.dispose(), [roughness]);
  const packRoot = useRef<Group>(null);
  const studio = useStudioEnvironmentSnapshot();
  const warmPackKey = stickerScene.preparedSheet?.slots.map(slot => `${slot.stickerId}:${slot.state}`).join('|') ?? '';
  useEffect(() => {
    if (!warmPackKey || !packRoot.current) return;
    const preparation = new AbortController();
    // Compile the actual sleeve/liner materials while the already-ready sheet
    // is hidden. Ownership stays alive until this packet or environment changes.
    void prepareStickerPrograms(gl, packRoot.current, camera, scene, preparation.signal).catch(() => {});
    return () => preparation.abort();
  }, [camera, gl, scene, studio.texture, warmPackKey]);
  const onProjectionReady = stickerScene.onProjectionReady;
  const packVisible = stickerScene.pack !== null;
  useLayoutEffect(() => {
    gl.domElement.setAttribute('data-wp-pack-visible', String(packVisible));
  }, [gl, packVisible]);
  const restingPresentation = useRef(0);
  const restingModelY = useRef(0);
  const previousRearCarry = useRef(false);
  const projectionHandle = useRef<StickerRearProjection | null>(null);
  const currentScene = useRef(stickerScene);
  useLayoutEffect(() => { currentScene.current = stickerScene; }, [stickerScene]);
  const visibility = useRef<ReturnType<typeof createStickerVisibility> | null>(null);
  useEffect(() => () => { visibility.current?.dispose(); visibility.current = null; }, []);
  const calculatedPresentation = (stickerScene.pack?.progress ?? 0) * (stickerScene.pack?.sheet?.reveal ?? 0);
  const rearCarry = stickerScene.pack?.sourcePlacement != null;
  useEffect(() => {
    const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
    if (!content) return;
    visibility.current ??= createStickerVisibility();
    void visibility.current.prepare(content);
  }, [scene]);
  useLayoutEffect(() => {
    const releasedCarry = previousRearCarry.current && !rearCarry;
    previousRearCarry.current = rearCarry;
    if (!rearCarry) restingPresentation.current = calculatedPresentation;
    const presentation = restingPresentation.current;
    const model = scene.getObjectByName(DEVICE_MODEL_NAME);
    if (model === undefined) return;
    const pixels = viewport.getCurrentViewport(camera, new Vector3()).height / size.height;
    // Keep a substantial upper rear canvas free on a phone as the liner slides out.
    const targetY = rearCarry ? restingModelY.current : size.width < STICKER_PACK_LAYOUT.desktopBreakpoint ? Math.min(120, size.height * .15) * pixels * presentation : 0;
    const initialY = restingModelY.current;
    let frame: number | null = null;
    const publish = (y: number): void => {
      restingModelY.current = y;
      // R3F can replace viewport state during rotation/layout. An unchanged
      // translation must not write into the DOM root's projection subscription
      // again: that render can update the canvas viewport and re-enter here.
      if (model.position.y === y) return;
      model.position.y = y; model.updateWorldMatrix(true, true); invalidate();
      if (projectionHandle.current !== null) onProjectionReady?.(projectionHandle.current);
    };
    // Only the post-press return settles autonomously. A held print retains the
    // exact displayed frame; packet pulling and pointer inputs never chase a spring.
    if (releasedCarry && !matchMedia('(prefers-reduced-motion: reduce)').matches && Math.abs(targetY - initialY) > pixels * CARRY_FRAME.tolerancePx) {
      publish(initialY);
      let position = initialY, velocity = 0, previous = performance.now();
      const started = previous;
      const settle = (now: number): void => {
        const dt = Math.min(CARRY_FRAME.maxStepSeconds, Math.max(0, (now - previous) / 1000)); previous = now;
        velocity += ((targetY - position) * CARRY_FRAME.stiffness - velocity * CARRY_FRAME.damping) * dt;
        position += velocity * dt;
        if (now - started > CARRY_FRAME.maxSettleMs || Math.abs(targetY - position) < pixels * CARRY_FRAME.tolerancePx && Math.abs(velocity) < pixels) { frame = null; publish(targetY); return; }
        publish(position); frame = requestAnimationFrame(settle);
      };
      frame = requestAnimationFrame(settle);
    } else publish(targetY);
    gl.domElement.setAttribute('data-wp-collection-reframe', String(presentation));
    return () => { if (frame !== null) cancelAnimationFrame(frame); };
  }, [camera, gl, calculatedPresentation, rearCarry, scene, size.height, size.width, viewport, invalidate, onProjectionReady]);
  useEffect(() => () => { const model = scene.getObjectByName(DEVICE_MODEL_NAME); if (model !== undefined) { model.position.y = 0; model.updateWorldMatrix(true, true); } }, [scene]);
  useLayoutEffect(() => {
    const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
    const beginVisibility = () => {
      if (content === undefined) return () => false;
      visibility.current ??= createStickerVisibility();
      return stickerVisibilityQuery(visibility.current, content, camera);
    };
    const pick = (clientX: number, clientY: number) => {
      const visible = beginVisibility();
      const bounds = gl.domElement.getBoundingClientRect(), equipped = scene.getObjectByName('device-equipped-stickers');
      if (equipped === undefined || bounds.width <= 0 || bounds.height <= 0) return null;
      const ray = new Raycaster(); ray.setFromCamera(new Vector2((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2), camera);
      // The physical perimeter remains a rotation handle even under vinyl.
      // Native sticker capture runs before R3F, so yield here to the shell lane.
      const shellHits = ['device-body', 'device-steel-back'].flatMap(name => {
        const shell = scene.getObjectByName(name);
        if (!(shell instanceof Mesh)) return [];
        shell.updateWorldMatrix(true, false);
        return ray.intersectObject(shell, false);
      }).sort((a, b) => a.distance - b.distance);
      const shellHit = shellHits[0];
      if (shellHit !== undefined) {
        const local = shellHit.object.worldToLocal(shellHit.point.clone());
        if (isDeviceOuterGrabPoint(local.x, local.y)) return null;
      }
      // Match transparent compositing: latest placement with visible ink wins,
      // even when curved/tessellated surfaces differ slightly in ray distance.
      for (const placement of [...currentScene.current.placements].reverse()) {
        if (placement.stickerId === currentScene.current.pack?.sourcePlacement?.stickerId) continue;
        const print = equipped.getObjectByName(`sticker-${placement.stickerId}`);
        if (!(print instanceof Mesh) || !print.visible) continue;
        const hit = intersectStickerPrint(ray, print, placement);
        if (hit !== null && visible(hit.point)) return { placement, hit };
      }
      return null;
    };
    const handle = { grab(clientX: number, clientY: number) {
      const picked = pick(clientX, clientY), rear = scene.getObjectByName('device-steel-back');
      if (picked === null || picked.hit.uv === undefined || content === undefined || !(rear instanceof Mesh)) return null;
      const wrap = stickerWrapSurface(rear.geometry), art = currentScene.current.assets.find(asset => asset.id === picked.placement.stickerId);
      if (wrap === undefined || art === undefined) return null;
      const source = picked.placement;
      return captureStickerSurfaceGrab(source, art, picked.hit, { x: clientX, y: clientY }, content, camera, gl.domElement, () => {
        const next = currentScene.current.placements.find(item => item.stickerId === source.stickerId);
        return next !== undefined && next.x === source.x && next.y === source.y && next.width === source.width && next.rotationDeg === source.rotationDeg && next.wear === source.wear && currentScene.current.assets.includes(art) && stickerWrapSurface(rear.geometry) === wrap;
      });
    }, project(clientX: number, clientY: number) {
      const rear = scene.getObjectByName('device-steel-back');
      if (!(rear instanceof Mesh)) return null;
      const wrap = stickerWrapSurface(rear.geometry);
      return wrap === undefined ? null : projectStickerDrop(rear, camera, gl.domElement.getBoundingClientRect(), clientX, clientY, wrap.seamZ);
    }, resolveDrop(placement: import('./sticker-contract').DeviceStickerPlacement, clientX: number, clientY: number) {
      const rear = scene.getObjectByName('device-steel-back'), content = scene.getObjectByName(DEVICE_CONTENT_NAME);
      const art = currentScene.current.assets.find(item => item.id === placement.stickerId);
      const wrap = rear instanceof Mesh ? stickerWrapSurface(rear.geometry) : undefined;
      if (!wrap || !art || !content) return placement;
      content.updateWorldMatrix(true, false);
      const anchor = currentScene.current.pack?.sourceAnchor;
      return fitStickerDrop(art, placement, anchor?.uv ?? [.5, .5], { x: clientX, y: clientY }, gl.domElement.getBoundingClientRect(), content.matrixWorld, camera, wrap);
    }, fit(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const rear = scene.getObjectByName('device-steel-back');
      const art = currentScene.current.assets.find(item => item.id === placement.stickerId);
      const wrap = rear instanceof Mesh ? stickerWrapSurface(rear.geometry) : undefined;
      if (!wrap || !art) return placement;
      const fitted = wrap.fit((.5 - placement.x) * DEVICE_LAYOUT.body.width, (.5 - placement.y) * DEVICE_LAYOUT.body.height,
        { width: placement.width * DEVICE_LAYOUT.body.width, height: placement.width * DEVICE_LAYOUT.body.width * stickerVisibleAspect(art), angle: placement.rotationDeg * Math.PI / 180 });
      return { ...placement, x: .5 - fitted.x / DEVICE_LAYOUT.body.width, y: .5 - fitted.y / DEVICE_LAYOUT.body.height, width: placement.width * fitted.scale };
    }, hit(clientX: number, clientY: number) { return pick(clientX, clientY)?.placement ?? null;
    }, quad(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const print = scene.getObjectByName('device-equipped-stickers')?.getObjectByName(`sticker-${placement.stickerId}`);
      return print instanceof Mesh ? stickerProjectedQuad(print, camera, gl.domElement.getBoundingClientRect()) : null;
    }, contour(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const visible = beginVisibility();
      const print = scene.getObjectByName('device-equipped-stickers')?.getObjectByName(`sticker-${placement.stickerId}`);
      return print instanceof Mesh ? projectedStickerContour(print, camera, gl.domElement.getBoundingClientRect(), placement.wear ?? 0, visible, visibility.current && content ? { identity: visibility.current, revision: visibility.current.revision, contentMatrix: content.matrixWorld.elements } : undefined) : null;
    }, beginTransform(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const print = scene.getObjectByName('device-equipped-stickers')?.getObjectByName(`sticker-${placement.stickerId}`);
      const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
      if (!(print instanceof Mesh) || content === undefined) return null;
      const positions = print.geometry.getAttribute('position');
      const center = new Vector3().fromBufferAttribute(positions, Math.floor(positions.count / 2));
      print.updateWorldMatrix(true, false); content.updateWorldMatrix(true, false);
      content.worldToLocal(center.applyMatrix4(print.matrixWorld));
      return captureStickerTransformPlane(content, camera, gl.domElement.getBoundingClientRect(), center.z);
    }, bounds(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const print = scene.getObjectByName('device-equipped-stickers')?.getObjectByName(`sticker-${placement.stickerId}`);
      return print instanceof Mesh ? stickerProjectedBounds(print, camera, gl.domElement.getBoundingClientRect()) : null;
    }, screen(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
      if (content === undefined) return null;
      const print = scene.getObjectByName('device-equipped-stickers')?.getObjectByName(`sticker-${placement.stickerId}`);
      if (print instanceof Mesh) {
        const projected = stickerProjectedQuad(print, camera, gl.domElement.getBoundingClientRect());
        if (projected !== null) return projected.center;
      }
      content.updateWorldMatrix(true, false);
      const point = new Vector3((.5 - placement.x) * DEVICE_LAYOUT.body.width, (.5 - placement.y) * DEVICE_LAYOUT.body.height, -DEVICE_LAYOUT.body.depth / 2).applyMatrix4(content.matrixWorld).project(camera);
      const bounds = gl.domElement.getBoundingClientRect();
      return { x: bounds.left + (point.x + 1) * bounds.width / 2, y: bounds.top + (1 - point.y) * bounds.height / 2 };
    } };
    projectionHandle.current = handle; onProjectionReady?.(handle);
    return () => { projectionHandle.current = null; onProjectionReady?.(null); };
  }, [camera, gl, orientation.visibleFace, scene, onProjectionReady, packVisible, stickerScene.pack?.sourcePlacement?.stickerId, calculatedPresentation, rearCarry]);
  const pack: StickerPackVisual | null = stickerScene.pack ?? (stickerScene.preparedSheet ? {
    presence: 0, progress: 0, peel: 0, stickerId: null, placement: null, landing: 0,
    sheet: { ...stickerScene.preparedSheet, reveal: 0 },
  } : null);
  if (pack === null) return null;
  const visible = viewport.getCurrentViewport(camera, new Vector3(0, 0, PACK.depth));
  const pixel = visible.width / size.width;
  const layout = stickerPackViewportLayout(size.width, size.height);
  const width = layout.width * pixel;
  const height = layout.height * pixel;
  const x = (layout.centerX - size.width / 2) * pixel;
  const progress = Math.max(0, Math.min(1, pack.progress));
  // Keep the pull lip above the frame edge, matching the DOM hit region.
  const start = -visible.height / 2 - height / 2 + (STICKER_PACK_LAYOUT.teasePx + STICKER_PACK_LAYOUT.bottomGapPx) * pixel;
  const end = -visible.height / 2 + height / 2 + STICKER_PACK_LAYOUT.bottomGapPx * pixel;
  const presenceTravel = height * (progress + STICKER_PACK_LAYOUT.linerTravel * (pack.sheet?.reveal ?? 0)) + (STICKER_PACK_LAYOUT.teasePx + STICKER_PACK_LAYOUT.bottomGapPx) * pixel;
  const y = start + (end - start) * progress - (1 - (pack.presence ?? 1)) * presenceTravel;
  // Lower the backing workspace on phones after detachment. The carried print
  // keeps the original origin, so its world position remains under the pointer.
  const workspaceLowering = size.width < STICKER_PACK_LAYOUT.desktopBreakpoint
    ? height * STICKER_PACK_LAYOUT.linerTravel * Math.max(0, Math.min(1, pack.workspaceLowering ?? 0)) : 0;
  const sheet = pack.sheet;
  const reveal = sheet?.reveal ?? 0;
  const presentation = stickerPackPresentation(progress, reveal, pack.turn);
  const linerTravel = height * STICKER_PACK_LAYOUT.linerTravel * reveal;
  const art = stickerScene.assets.find((item) => item.id === pack.stickerId);
  const slots = sheet?.slots ?? [];
  const slotIndex = slots.findIndex((slot) => slot.stickerId === pack.stickerId);
  const seat = STICKER_SHEET_SLOTS[slotIndex] ?? (pack.sourcePlacement == null ? undefined : { x: .5, y: .5 });
  const printWidth = width * STICKER_SHEET_PRINT_WIDTH;
  const offset = pack.dragOffset;
  return <group ref={packRoot} visible={stickerScene.pack !== null} name="sticker-pack-scene">
    <group visible={pack.workspaceVisible !== false} position={[x, y - workspaceLowering, PACK.depth]} rotation={[0, -presentation.turnRadians, 0]} name="sticker-pack-wrapper">
      {(sheet?.neighbors ?? []).map((neighbor, index) => <group key={neighbor.stickerId} position={[(index === 0 ? -1 : 1) * pixel * (8 + presentation.fan * STICKER_PACK_MOTION.fanSpread), pixel * 10, -pixel * (8 + index)]} rotation={[0, 0, (index === 0 ? 1 : -1) * (.055 + presentation.fan * STICKER_PACK_MOTION.fanAngle)]}>
        <PackPaper width={width} height={height} pixel={pixel} ink={neighbor.ink} roughness={roughness} />
        <group position={[0, 0, pixel * 2]}><CoverPrint stickerId={neighbor.stickerId} width={width * .58} pixel={pixel} roughness={roughness} stickerScene={stickerScene} /></group>
      </group>)}
      <group position={[0, linerTravel, pixel * 2]}>
        <PackPaper width={width} height={height} pixel={pixel} ink="#e9e2d1" roughness={roughness} liner curlProgress={stickerPaperCurlProgress(width, height, pixel, linerTravel)} />
      <group visible={reveal > .02}>{slots.map((slot, index) => {
        const slotArt = stickerScene.assets.find((item) => item.id === slot.stickerId);
        const position = STICKER_SHEET_SLOTS[index];
        if (slotArt === undefined || position === undefined) return null;
        const peeling = isStickerCarried(pack, slot.stickerId);
        return <group key={slot.stickerId} position={[(position.x - .5) * width, (.5 - position.y) * height, pixel * (5 * (1 - (position.x * 2 - 1) ** 2) + .8)]}>
          <SheetPrint bow={{ pixel, paperWidth: width, seatX: position.x }} art={slotArt} width={Math.min(printWidth, height * .21 / stickerVisibleAspect(slotArt))} appearance={peeling || slot.state === 'placed' ? 'placed' : slot.state === 'locked' || slot.state === 'sealed' ? 'locked' : 'earned'} roughness={roughness} stickerScene={stickerScene} />
        </group>;
      })}</group>
      </group>
      <group position={[0, 0, pixel * 8]}>
        <SleevePocket width={width + pixel * 4} height={height} pixel={pixel} ink={sheet?.ink ?? '#b7aa86'} roughness={roughness} />
        {slots[0] === undefined ? null : <CoverPrint stickerId={slots[0].stickerId} width={width * .58} pixel={pixel} roughness={roughness} stickerScene={stickerScene} />}
      </group>
    </group>
    {art === undefined || seat === undefined || (pack.peel === 0 && pack.placement === null && pack.dragOffset == null && pack.sourcePlacement == null) ? null : <PeelingPrint paperWidth={width} pixel={pixel} seatX={seat.x} art={art} pack={pack} width={Math.min(printWidth, height * .21 / stickerVisibleAspect(art))}
      origin={new Vector3(x + (seat.x - .5) * width + (offset?.x ?? 0) * pixel, y + linerTravel + (.5 - seat.y) * height - (offset?.y ?? 0) * pixel, PACK.depth + pixel * (2 + 5 * (1 - (seat.x * 2 - 1) ** 2) + .8))}
      stickerScene={stickerScene} roughness={roughness} carryCollision={visibility} />}
  </group>;
}
/** Release stock bows and curls at its unprinted top corner; the printed sleeve is stiffer. */
const PackPaper = memo(function PackPaper({ width, height, pixel, ink, roughness, liner = false, curlProgress = 1 }: { readonly width: number; readonly height: number; readonly pixel: number; readonly ink: string; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly liner?: boolean; readonly curlProgress?: number }) {
  const studio = useStudioEnvironmentSnapshot();
  const stock = useMemo(() => createStickerPaperGeometry(width, height, pixel, liner, curlProgress), [width, height, pixel, liner, curlProgress]);
  useEffect(() => () => { stock.front.dispose(); stock.back.dispose(); stock.edge.dispose(); }, [stock]);
  return <group name={liner ? "release-liner-stock" : "printed-sleeve-stock"}>
    <mesh geometry={stock.back} raycast={() => {}}><meshStandardMaterial color={liner ? '#c4bba8' : '#b8a88d'} roughness={.94} side={BackSide} /></mesh>
    <mesh geometry={stock.edge} raycast={() => {}}><meshStandardMaterial color={liner ? '#b6aa92' : '#aa9574'} roughness={.96} side={DoubleSide} /></mesh>
    <mesh geometry={stock.front} raycast={() => {}}><meshPhysicalMaterial {...STICKER_PACK_MATERIAL} color={ink} roughnessMap={roughness} bumpMap={roughness} bumpScale={pixel * .2} roughness={liner ? PACK.linerRoughness : SLEEVE_LAMINATE.roughness} clearcoat={liner ? PACK.linerClearcoat : SLEEVE_LAMINATE.clearcoat} clearcoatRoughness={liner ? PACK.linerCoatRoughness : SLEEVE_LAMINATE.clearcoatRoughness} envMap={studio.texture} side={FrontSide} /></mesh>
  </group>;
});
/** Folded/glued paper pocket; the thumb notch and fold thickness identify the sleeve. */
const SleevePocket = memo(function SleevePocket({ width, height, pixel, ink, roughness }: { readonly width: number; readonly height: number; readonly pixel: number; readonly ink: string; readonly roughness: ReturnType<typeof createStickerRoughness> }) {
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
});
function SheetPrint({ art, width, appearance, roughness, stickerScene, bow }: { readonly art: StickerArtwork; readonly width: number; readonly appearance: 'earned' | 'locked' | 'placed'; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly stickerScene: DeviceStickerScene; readonly bow?: { pixel: number; paperWidth: number; seatX: number } }) {
  const paperPixel = bow?.pixel ?? 0, paperWidth = bow?.paperWidth ?? 1, seatX = bow?.seatX ?? .5;
  const geometry = useMemo(() => {
    return conformStickerToPaper(createStickerPeelGeometry(art, width, 0, PARKED_STICKER_SEGMENTS), paperWidth, paperPixel, seatX);
  }, [art, width, paperPixel, paperWidth, seatX]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <StickerPrint art={art} geometry={geometry} roughness={roughness} wear={stickerScene.appearances?.find((entry) => entry.stickerId === art.id)?.wear ?? 0} appearance={appearance} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} />;
}
function CoverPrint({ stickerId, width, pixel, roughness, stickerScene }: { readonly stickerId: string; readonly width: number; readonly pixel: number; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly stickerScene: DeviceStickerScene }) {
  const art = stickerScene.assets.find((asset) => asset.id === stickerId);
  return art === undefined ? null : <group position={[0, -width * .04, pixel * 4]}><SheetPrint art={art} width={width} appearance="earned" roughness={roughness} stickerScene={stickerScene} /></group>;
}

function PeelingPrint({ art, pack, width, origin, stickerScene, roughness, paperWidth, pixel, seatX, carryCollision }: {
  readonly carryCollision: RefObject<ReturnType<typeof createStickerVisibility> | null>;
  readonly paperWidth: number; readonly pixel: number; readonly seatX: number;
  readonly art: StickerArtwork; readonly pack: StickerPackVisual; readonly width: number; readonly origin: Vector3;
  readonly stickerScene: DeviceStickerScene; readonly roughness: ReturnType<typeof createStickerRoughness>;
}) {
  const { scene, camera, viewport, size, gl } = useThree();
  const invalidate = useThree((state) => state.invalidate);
  const orientation = useContext(DeviceCanvasOrientationContext);
  const rearMesh = scene.getObjectByName('device-steel-back');
  const rearGeometry = rearMesh instanceof Mesh ? rearMesh.geometry : undefined;
  const sourceSurface = useMemo(() => pack.sourcePlacement != null && rearGeometry ? createStickerSurfaceGeometry(art, pack.sourcePlacement, rearGeometry) : null, [art, pack.sourcePlacement, rearGeometry]);
  const landingPlacement = pack.landing > 0 ? pack.placement : null;
  const targetSurface = useMemo(() => landingPlacement !== null && rearGeometry ? createStickerSurfaceGeometry(art, landingPlacement, rearGeometry) : null, [art, landingPlacement, rearGeometry]);
  useEffect(() => () => sourceSurface?.dispose(), [sourceSurface]);
  useEffect(() => () => targetSurface?.dispose(), [targetSurface]);
  const geometry = useMemo(() => conformStickerToPaper(createStickerPeelGeometry(art, width, 0, STICKER_SURFACE.segments), paperWidth, pixel, seatX), [art, width, paperWidth, pixel, seatX]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const { x: originX, y: originY, z: originZ } = origin;
  useLayoutEffect(() => {
    const frameStarted = performance.now();
    // Paper geometry is only needed for a sheet pickup or an explicit return.
    const base = !sourceSurface || pack.returnToSheet ? conformStickerToPaper(createStickerPeelGeometry(art, width, pack.peel, STICKER_SURFACE.segments), paperWidth, pixel, seatX) : null;
    const positions = geometry.getAttribute('position');
    let source = (base ?? sourceSurface ?? geometry).getAttribute('position');
    const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
    const rear = scene.getObjectByName('device-steel-back');
    content?.updateWorldMatrix(true, true);
    let rearOrigin: ReturnType<typeof createRearStickerPeelGeometry> | null = null;
    const rearOffset = new Vector3();
    if (pack.sourcePlacement != null && rear instanceof Mesh && content !== undefined) {
      if (sourceSurface && pack.sourceAnchor) rearOrigin = createStickerGrabPeelGeometry(sourceSurface, art, pack.sourcePlacement, pack.sourceAnchor, content.matrixWorld, camera, pack.sourcePeelFront ?? pack.peel, pack.sourcePull ?? { x: 0, y: 0 }, size.width, size.height);
      else { rearOrigin = createRearStickerPeelGeometry(art, pack.sourcePlacement, rear.geometry, pack.peel, sourceSurface ?? undefined, pack.sourcePeelFront ?? pack.peel); rearOrigin.applyMatrix4(content.matrixWorld); }
      source = rearOrigin.getAttribute('position');
      const center = new Vector3((.5 - pack.sourcePlacement.x) * DEVICE_LAYOUT.body.width, (.5 - pack.sourcePlacement.y) * DEVICE_LAYOUT.body.height, -DEVICE_LAYOUT.body.depth / 2).applyMatrix4(content.matrixWorld);
      const worldPixel = viewport.getCurrentViewport(camera, center).width / size.width;
      if (pack.sourceAnchor) {
        const anchorPoint = new Vector3(...pack.sourceAnchor.point).applyMatrix4(content.matrixWorld);
        rearOffset.copy(stickerCarryPointerOffset(anchorPoint, camera, size.width, size.height, pack.dragOffset?.x ?? 0, pack.dragOffset?.y ?? 0));
      } else rearOffset.set(pack.dragOffset?.x ?? 0, -(pack.dragOffset?.y ?? 0), 0).multiplyScalar(worldPixel).applyQuaternion(camera.quaternion);
    }
    // Constrain the attached peel before blending into the free sheet. Applying
    // old edge planes after transport pins detached vertices to the old shell
    // and stretches the backing into a visible tail.
    if (sourceSurface && rearOrigin && content) {
      const started = performance.now();
      const report = constrainStickerCarryExterior(sourceSurface, rearOrigin, content.matrixWorld);
      gl.domElement.setAttribute('data-wp-sticker-peel-contacts', JSON.stringify({ ...report, elapsedMs: +(performance.now() - started).toFixed(2) }));
    }
    const rawTransport = (pack.sourcePeelFront ?? pack.peel) >= 1 ? Math.max(0, Math.min(1, pack.detachTransport ?? 0)) : 0;
    const transport = rawTransport * rawTransport * (3 - 2 * rawTransport);
    const free = sourceSurface && content && pack.sourcePlacement && transport > 0 ? createStickerFreeCarryGeometry(art, pack.sourcePlacement, sourceSurface, content.matrixWorld, camera, pack.sourceAnchor, pack.peel) : null;
    if (free && rearOrigin && pack.sourceAnchor && content) {
      alignStickerCarryOrigin(rearOrigin, free, pack.sourceAnchor.uv, rearOffset);
    }
    if (free && rearOrigin) {
      const sourceUv = rearOrigin.getAttribute('uv'), centerIndex = Math.floor(sourceUv.count / 2);
      interpolateStickerCarryGeometry(rearOrigin, free, pack.sourceAnchor?.uv[0] ?? sourceUv.getX(centerIndex), pack.sourceAnchor?.uv[1] ?? sourceUv.getY(centerIndex), transport);
    }
    let target: ReturnType<typeof createStickerSurfaceGeometry> | null = null;
    if (pack.landing > 0 && pack.placement !== null && rear instanceof Mesh) {
      try { target = targetSurface && content ? createStickerLandingGeometry(art, pack.placement, targetSurface, content.matrixWorld, camera, pack.sourceAnchor?.uv, pack.peel, size.width, size.height) : null; } catch { target = null; }
    }
    const targetPositions = target?.getAttribute('position');
    const amount = targetPositions === undefined && !pack.returnToSheet ? 0 : Math.max(0, Math.min(1, pack.landing));
    // A world-Z packet plane is not a camera-depth plane when the device turns.
    // Fully detached vinyl clears the entire projected body, including its sides.
    let carriedDepth = new Vector3(0, 0, PACK.depth + pixel * 20).project(camera).z;
    if (content !== undefined) {
      const clearance = new Vector3(0, 0, pixel * 20).applyQuaternion(camera.quaternion);
      for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
        const corner = new Vector3(x * DEVICE_LAYOUT.body.width / 2, y * DEVICE_LAYOUT.body.height / 2, z * DEVICE_LAYOUT.body.depth / 2).applyMatrix4(content.matrixWorld).add(clearance).project(camera);
        carriedDepth = Math.min(carriedDepth, corner.z);
      }
    }
    const detachedDistance = Math.hypot(pack.dragOffset?.x ?? 0, pack.dragOffset?.y ?? 0);
    const lift = Math.min(1, detachedDistance / 24);
    const point = new Vector3(); const destination = new Vector3(); const start = new Vector3(originX, originY, originZ);
    for (let index = 0; index < positions.count; index++) {
      const row = Math.floor(index / (STICKER_SURFACE.segments + 1)) / STICKER_SURFACE.segments;
      const detached = stickerRearTransportWeight(row, pack.sourcePeelFront ?? pack.peel, pack.detachTransport ?? 0);
      point.fromBufferAttribute(source, index);
      if (rearOrigin === null) point.add(start); else if (!pack.sourceAnchor) point.addScaledVector(rearOffset, detached);
      if (rearOrigin !== null && lift > 0 && detached > 0) {
        // Lift the detached vinyl above the packet without changing its screen-space
        // grab point or apparent size; attached contact stays on the physical rear.
        point.project(camera); point.z += (Math.min(carriedDepth, point.z) - point.z) * lift * detached; point.unproject(camera);
      }
      if (pack.returnToSheet && base) {
        destination.fromBufferAttribute(base.getAttribute('position'), index).add(start).add(new Vector3(-(pack.dragOffset?.x ?? 0) * pixel, (pack.dragOffset?.y ?? 0) * pixel, 0));
        point.lerp(destination, amount);
      }
      positions.setXYZ(index, point.x, point.y, point.z);
    }
    if (pack.sourceAnchor && pack.sourcePlacement && content && !pack.returnToSheet) {
      anchorStickerToPointer(geometry, art, pack.sourcePlacement, pack.sourceAnchor, content.matrixWorld, camera, pack.sourcePull ?? { x: 0, y: 0 }, size.width, size.height, pack.sourcePeelFront ?? pack.peel, transport);
    }
    // Transport, depth lift and landing all happen after the attached-peel
    // constraint. Resolve the final displayed geometry as well.
    if (content && targetSurface && target && !pack.returnToSheet) {
      // Dock the material frames before relaxing the fold. Blending world-space
      // vertices and then pinning each to a different edge plane tears the sheet.
      interpolateStickerCarryGeometry(geometry, target, pack.sourceAnchor?.uv[0] ?? .5, pack.sourceAnchor?.uv[1] ?? .5, amount);
      if (amount < 1) {
        carryCollision.current ??= createStickerVisibility(); carryCollision.current.update(content);
        constrainStickerLanding(geometry, target, content.matrixWorld, camera, carryCollision.current.castSegment);
      }
    // Full depth lift already clears the entire body; don't raycast every node
    // again. Transitional frames borrow the warmed picking collider.
    } else if (content && (rearOrigin === null || transport > 0 || pack.sourceAnchor != null) && !(rearOrigin !== null && lift === 1 && transport === 1 && !pack.returnToSheet)) {
      carryCollision.current ??= createStickerVisibility();
      carryCollision.current.update(content);
      constrainStickerFreeCarry(geometry, content.matrixWorld, camera, carryCollision.current.castSegment, sourceSurface ?? undefined);
    }
    if (pack.sourceAnchor && content && amount === 0 && !pack.returnToSheet) {
      const shown = stickerGeometryUvPoint(geometry, ...pack.sourceAnchor.uv).project(camera);
      const origin = new Vector3(...pack.sourceAnchor.point).applyMatrix4(content.matrixWorld).project(camera);
      const error = Math.hypot((shown.x - origin.x) * size.width / 2 - (pack.sourcePull?.x ?? 0), (origin.y - shown.y) * size.height / 2 - (pack.sourcePull?.y ?? 0));
      gl.domElement.setAttribute('data-wp-sticker-pointer-error', error.toFixed(4));
    } else gl.domElement.removeAttribute('data-wp-sticker-pointer-error');
    positions.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    base?.dispose(); rearOrigin?.dispose(); free?.dispose(); target?.dispose();
    gl.domElement.setAttribute('data-wp-sticker-peel-frame-ms', (performance.now() - frameStarted).toFixed(2));
    invalidate();
  }, [art, width, geometry, pack.peel, pack.placement, pack.landing, originX, originY, originZ, scene, invalidate, orientation.orientation, paperWidth, pixel, seatX, pack.sourcePlacement, pack.returnToSheet, pack.dragOffset, camera, size.width, size.height, viewport, sourceSurface, targetSurface, pack.sourcePeelFront, pack.detachTransport, pack.sourceAnchor, pack.sourcePull, gl, carryCollision]);
  return <StickerPrint art={art} geometry={geometry} wearGeometry={pack.landing > 0 ? targetSurface : sourceSurface} roughness={roughness} wear={pack.placement?.wear ?? pack.sourcePlacement?.wear ?? stickerScene.appearances?.find((entry) => entry.stickerId === art.id)?.wear ?? 0} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} />;
}

/** Keep active textures subscribed and uploaded even while the rear packet is hidden. */
function PrepareStickerAssets({ scene }: { readonly scene: DeviceStickerScene }) {
  const ready = useRef(new Set<string>());
  const key = (scene.prepareIds ?? []).join('|');
  const ids = useMemo(() => key === '' ? [] : key.split('|'), [key]);
  const onPrepared = scene.onPrepared;
  const report = useCallback((id: string, usable: boolean) => {
    if (usable) ready.current.add(id); else ready.current.delete(id);
    onPrepared?.([...ready.current]);
  }, [onPrepared]);
  useLayoutEffect(() => { onPrepared?.(ids.filter((id) => ready.current.has(id))); }, [ids, onPrepared]);
  return <>{ids.map((id) => { const art = scene.assets.find((item) => item.id === id); return art === undefined ? null : <PrepareStickerAsset key={id} art={art} report={report} onError={scene.onArtworkError} />; })}</>;
}
const PrepareStickerAsset = memo(function PrepareStickerAsset({ art, report, onError }: { readonly art: StickerArtwork; readonly report: (id: string, ready: boolean) => void; readonly onError?: (id: string) => void }) {
  const { texture, failed } = useStickerTexture(art.url);
  const preparationEpoch = useStickerPreparationEpoch();
  const gl = useThree(state => state.gl);
  const camera = useThree(state => state.camera);
  const scene = useThree(state => state.scene);
  const studio = useStudioEnvironmentSnapshot();
  const group = useRef<Group>(null);
  const roughness = useMemo(() => createStickerRoughness(), []);
  // Shader variants don't depend on tessellation density. These hidden meshes
  // only retain compiled programs; they never represent a displayed print.
  const geometry = useMemo(() => createStickerPeelGeometry(art, 1, .75, 4), [art]);
  useEffect(() => () => { roughness.dispose(); geometry.dispose(); }, [roughness, geometry]);
  useEffect(() => {
    let current = true;
    let generation = 0;
    let preparation: AbortController | null = null;
    report(art.id, false);
    if (failed) onError?.(art.id);
    const prepare = (): void => {
      const expected = ++generation;
      preparation?.abort(); preparation = new AbortController();
      report(art.id, false);
      if (texture === null || failed || group.current === null || gl.getContext().isContextLost()) return;
      try {
        prepareStickerAlpha(texture); gl.initTexture(texture);
        // Retain actual variants through readiness and cancel every superseded poll.
        void prepareStickerPrograms(gl, group.current, camera, scene, preparation.signal).then(() => {
          if (current && expected === generation && !gl.getContext().isContextLost()) report(art.id, true);
        }, (error: unknown) => { if (current && expected === generation && !(error instanceof Error && error.name === 'AbortError')) onError?.(art.id); });
      } catch { if (current && expected === generation) onError?.(art.id); }
    };
    const lost = (): void => { generation++; preparation?.abort(); report(art.id, false); };
    gl.domElement.addEventListener('webglcontextlost', lost); gl.domElement.addEventListener('webglcontextrestored', prepare);
    prepare();
    return () => { current = false; generation++; preparation?.abort(); gl.domElement.removeEventListener('webglcontextlost', lost); gl.domElement.removeEventListener('webglcontextrestored', prepare); report(art.id, false); };
  }, [art.id, camera, failed, gl, onError, report, scene, studio.texture, texture, preparationEpoch]);
  return <group ref={group} visible={false} name={`prepared-sticker-${art.id}`}>
    {(['earned', 'locked', 'placed'] as const).map((appearance) => <StickerPrint key={appearance} art={art} geometry={geometry} roughness={roughness} finishEnabled appearance={appearance} />)}
  </group>;
});
