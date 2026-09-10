import { createGpuPaperGeometry, installGpuPaperMaterial, sampleGpuPaperBounds } from './sticker-paper-gpu';
import { createGpuPaperMaterialPreparation, useGpuPaperReady } from './sticker-paper-gpu-support';
import { createCarryPreparation } from './sticker-carry-preparation';
import { usePreparedStickerPaper } from './sticker-paper-preparation';
import { createStickerPickCache } from './sticker-pick-cache';
import { fitStickerDrop } from './sticker-drop-fit';
import { createStickerVisibility, stickerVisibilityQuery } from './sticker-visibility';
import { projectStickerDrop } from './sticker-drop-projection';
import { captureStickerSurfaceGrab } from './sticker-surface-grab';
import { stickerWrapSurface } from './sticker-wrap';
import { projectedStickerContour } from './sticker-contour';
import { useThree } from '@react-three/fiber';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from 'react';
import { Box3, MeshPhysicalMaterial, MeshStandardMaterial, BackSide, DoubleSide, FrontSide, Group, Mesh, Raycaster, Vector2, Vector3 } from 'three';
import { DeviceCanvasOrientationContext } from './DeviceCanvas';
import { useContext } from 'react';
import { stickerPackPresentation, STICKER_PACK_MOTION, STICKER_PACK_LAYOUT, isStickerCarried, stickerPackViewportLayout, STICKER_SHEET_SLOTS, STICKER_SHEET_PRINT_WIDTH, type StickerRearProjection, type DeviceStickerScene, type StickerArtwork, type StickerPackVisual } from './sticker-contract';
import { STICKER_PACK_MATERIAL } from './materials';
import { createStickerPeelGeometry, stickerVisibleAspect } from './sticker-surface';
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
import { conformStickerToPaper, stickerPaperCurlProgress } from './sticker-paper';

/* ANIMATION STORYBOARD
 *    0ms   rear reveal exposes the bottom 32px of sealed laminate
 *  input   pull directly moves pack; owner spring resolves progress → 0 or 1
 *  input   peel bends paper around an arc, preserving its printed UV coordinates
 * release  landing interpolates free print → real rear mesh; owner spring settles
 * All clocks and reduced-motion resolution belong to the shared app controller.
 */
const EMPTY_SUBSCRIBE = () => () => {};
const EMPTY_SNAPSHOT = () => 0;
const CARRY_FRAME = Object.freeze({ stiffness: 240, damping: 30, maxStepSeconds: .032, tolerancePx: .15, maxSettleMs: 1800 });
const PARKED_STICKER_SEGMENTS = 24;
const PACK = Object.freeze({ depth: 130, returnClearancePx: 20, returnCurl: .35, linerClearcoat: .55, linerRoughness: .38, linerCoatRoughness: .23 });

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
  const subscribeVisibility = useCallback((listener: () => void) => {
    visibility.current ??= createStickerVisibility({ workerOnly: true });
    return visibility.current.subscribe(listener);
  }, []);
  const visibilitySnapshot = useCallback(() => visibility.current?.getSnapshot() ?? 0, []);
  const visibilityEpoch = useSyncExternalStore(subscribeVisibility, visibilitySnapshot, visibilitySnapshot);
  useEffect(() => () => { visibility.current?.dispose(); visibility.current = null; }, []);
  const calculatedPresentation = (stickerScene.pack?.progress ?? 0) * (stickerScene.pack?.sheet?.reveal ?? 0);
  const rearCarry = stickerScene.pack?.sourcePlacement != null;
  useEffect(() => {
    const content = scene.getObjectByName(DEVICE_CONTENT_NAME);
    if (!content) return;
    visibility.current ??= createStickerVisibility({ workerOnly: true });
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
      visibility.current ??= createStickerVisibility({ workerOnly: true });
      return stickerVisibilityQuery(visibility.current, content, camera);
    };
    const pickUncached = (clientX: number, clientY: number) => {
      const placements = currentScene.current.placements;
      if (placements.length === 0) return null;
      const bounds = gl.domElement.getBoundingClientRect(), equipped = scene.getObjectByName('device-equipped-stickers');
      if (equipped === undefined || bounds.width <= 0 || bounds.height <= 0) return null;
      const ray = new Raycaster(); ray.setFromCamera(new Vector2((clientX - bounds.left) / bounds.width * 2 - 1, 1 - (clientY - bounds.top) / bounds.height * 2), camera);
      let visible: ReturnType<typeof beginVisibility> | undefined;
      // Do not inspect the collider or raycast both shells for empty space. Only
      // an actual ink hit needs occlusion/perimeter arbitration.
      for (let index = placements.length - 1; index >= 0; index--) {
        const placement = placements[index];
        if (placement === undefined || placement.stickerId === currentScene.current.pack?.sourcePlacement?.stickerId) continue;
        const print = equipped.getObjectByName(`sticker-${placement.stickerId}`);
        if (!(print instanceof Mesh) || !print.visible) continue;
        const hit = intersectStickerPrint(ray, print, placement);
        if (hit === null) continue;
        visible ??= beginVisibility();
        if (!visible(hit.point)) continue;
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
        return { placement, hit };
      }
      return null;
    };
    const cachedPick = createStickerPickCache<ReturnType<typeof pickUncached>>();
    const pick = (clientX: number, clientY: number) => {
      if (currentScene.current.placements.length === 0) return null;
      content?.updateWorldMatrix(true, false);
      camera.updateWorldMatrix(true, false);
      const bounds = gl.domElement.getBoundingClientRect();
      return cachedPick([
        clientX, clientY, currentScene.current, visibility.current?.getSnapshot(),
        bounds.left, bounds.top, bounds.width, bounds.height,
        ...(content?.matrixWorld.elements ?? []), ...camera.matrixWorld.elements,
        ...camera.projectionMatrix.elements,
      ], () => pickUncached(clientX, clientY));
    };
    // Read the visible carried mesh while a tool edits it, including collection
    // stickers that do not yet have an equipped mesh. Saved picking stays separate.
    const projectedPrint = (placement: import('./sticker-contract').DeviceStickerPlacement) => {
      const pack = currentScene.current.pack;
      const owner = pack && isStickerCarried(pack, placement.stickerId)
        ? scene.getObjectByName('device-carried-sticker')
        : scene.getObjectByName('device-equipped-stickers');
      return owner?.getObjectByName(`sticker-${placement.stickerId}`);
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
      const print = projectedPrint(placement);
      return print instanceof Mesh ? stickerProjectedQuad(print, camera, gl.domElement.getBoundingClientRect()) : null;
    }, contour(placement: import('./sticker-contract').DeviceStickerPlacement) {
      const visible = beginVisibility();
      const print = projectedPrint(placement);
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
  useLayoutEffect(() => {
    // The child carry geometry is committed before notifying the DOM HUD.
    if (projectionHandle.current !== null) onProjectionReady?.(projectionHandle.current);
  }, [onProjectionReady, stickerScene.pack?.placement, stickerScene.pack?.peel, stickerScene.pack?.landing, visibilityEpoch]);
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
    <group visible={pack.workspaceVisible !== false} position={[x, y - workspaceLowering - (pack.tuck ?? 0) * ((height - STICKER_PACK_LAYOUT.teasePx * pixel) * progress + linerTravel), PACK.depth]} rotation={[0, -presentation.turnRadians, 0]} name="sticker-pack-wrapper">
      {(sheet?.neighbors ?? []).slice(0, 2).map((neighbor, index) => <group key={neighbor.stickerId} position={[(index === 0 ? -1 : 1) * pixel * (8 + presentation.fan * STICKER_PACK_MOTION.fanSpread), pixel * 10, -pixel * (8 + index)]} rotation={[0, 0, (index === 0 ? 1 : -1) * (.055 + presentation.fan * STICKER_PACK_MOTION.fanAngle)]}>
        <PackPaper epoch={pack.computationEpoch ?? 0} width={width} height={height} pixel={pixel} ink={neighbor.ink} roughness={roughness} />
        <group position={[0, 0, pixel * 2]}><CoverPrint stickerId={neighbor.stickerId} width={width * .58} pixel={pixel} roughness={roughness} stickerScene={stickerScene} /></group>
      </group>)}
      <group position={[0, linerTravel, pixel * 2]}>
        <PackPaper epoch={pack.computationEpoch ?? 0} width={width} height={height} pixel={pixel} ink="#e9e2d1" roughness={roughness} liner curlProgress={stickerPaperCurlProgress(width, height, pixel, linerTravel)} />
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
const PackPaper = memo(function PackPaper(props: Parameters<typeof CpuPackPaper>[0]) {
  const gl = useThree(state => state.gl);
  const ready = useGpuPaperReady(gl);
  return ready ? <GpuPackPaper {...props} /> : <CpuPackPaper {...props} />;
});
const GpuPackPaper = memo(function GpuPackPaper({ width, height, pixel, ink, roughness, liner = false, curlProgress = 1, epoch }: { readonly epoch: number; readonly width: number; readonly height: number; readonly pixel: number; readonly ink: string; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly liner?: boolean; readonly curlProgress?: number }) {
  void epoch;
  const studio = useStudioEnvironmentSnapshot(), invalidate = useThree(state => state.invalidate);
  const { gl, camera, scene } = useThree();
  const curl = useMemo(() => { const uniform = { value: 0 }; return { uniform, set(value: number) { uniform.value = value; } }; }, []);
  const input = useMemo(() => ({ width, height, pixel, liner }), [width, height, pixel, liner]);
  const stock = useMemo(() => {
    const result = createGpuPaperGeometry(input);
    let sampledCurl = NaN, sampled: ReturnType<typeof sampleGpuPaperBounds> | null = null;
    for (const part of ['front', 'back', 'edge'] as const) result[part].computeBoundingBox = () => {
      if (sampled === null || sampledCurl !== curl.uniform.value) { sampled = sampleGpuPaperBounds(input, curl.uniform.value); sampledCurl = curl.uniform.value; }
      result[part].boundingBox = sampled[part].clone();
    };
    return result;
  }, [input, curl]);
  const materials = useMemo(() => {
    const back = new MeshStandardMaterial({ color: liner ? '#c4bba8' : '#b8a88d', roughness: .94, side: BackSide });
    const edge = new MeshStandardMaterial({ color: liner ? '#b6aa92' : '#aa9574', roughness: .96, side: DoubleSide });
    const front = new MeshPhysicalMaterial({ ...STICKER_PACK_MATERIAL, color: ink, roughnessMap: roughness, bumpMap: roughness, bumpScale: pixel * .2, roughness: liner ? PACK.linerRoughness : SLEEVE_LAMINATE.roughness, clearcoat: liner ? PACK.linerClearcoat : SLEEVE_LAMINATE.clearcoat, clearcoatRoughness: liner ? PACK.linerCoatRoughness : SLEEVE_LAMINATE.clearcoatRoughness, envMap: studio.texture, side: FrontSide });
    for (const material of [front, back, edge]) installGpuPaperMaterial(material, input, curl.uniform, material === edge);
    return { front, back, edge };
  }, [input, curl, ink, liner, pixel, roughness, studio.texture]);
  const preparation = useMemo(() => createGpuPaperMaterialPreparation(gl, () => { const root = new Group(); for (const part of ['front', 'back', 'edge'] as const) root.add(new Mesh(stock[part], materials[part])); return { root, materials: Object.values(materials) }; }, camera, scene), [gl, stock, materials, camera, scene]);
  const linked = useSyncExternalStore(preparation.subscribe, preparation.getSnapshot, () => false);
  useEffect(() => preparation.mount(), [preparation]);
  useLayoutEffect(() => { curl.set(curlProgress); for (const geometry of Object.values(stock)) geometry.boundingBox = null; invalidate(); }, [curl, curlProgress, stock, invalidate]);
  useEffect(() => () => { for (const geometry of Object.values(stock)) geometry.dispose(); }, [stock]);
  useEffect(() => () => { for (const material of Object.values(materials)) material.dispose(); }, [materials]);
  if (!linked) return <CpuPackPaper width={width} height={height} pixel={pixel} ink={ink} roughness={roughness} liner={liner} curlProgress={curlProgress} epoch={epoch} />;
  return <group name={liner ? 'release-liner-stock' : 'printed-sleeve-stock'}>{(['back', 'edge', 'front'] as const).map(part => <mesh key={part} geometry={stock[part]} material={materials[part]} raycast={() => {}} />)}</group>;
});
const CpuPackPaper = memo(function CpuPackPaper({ width, height, pixel, ink, roughness, liner = false, curlProgress = 1, epoch }: { readonly epoch: number; readonly width: number; readonly height: number; readonly pixel: number; readonly ink: string; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly liner?: boolean; readonly curlProgress?: number }) {
  const studio = useStudioEnvironmentSnapshot();
  const { stock } = usePreparedStickerPaper(width, height, pixel, liner, curlProgress, epoch);
  if (stock === null) return null;
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
  const { scene, camera, viewport, size, gl, invalidate } = useThree();
  const orientation = useContext(DeviceCanvasOrientationContext);
  const runtime = useMemo(() => createCarryPreparation(), []);
  const result = useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, runtime.getServerSnapshot);
  useEffect(() => runtime.mount(), [runtime]);
  const collision = carryCollision.current;
  const collisionEpoch = useSyncExternalStore(collision?.subscribe ?? EMPTY_SUBSCRIBE, collision?.getSnapshot ?? EMPTY_SNAPSHOT, EMPTY_SNAPSHOT);
  const { x: originX, y: originY, z: originZ } = origin;
  const inputKey = JSON.stringify([art, pack, width, paperWidth, pixel, seatX, originX, originY, originZ]);
  const latestInput = useRef({ art, pack });
  useLayoutEffect(() => { latestInput.current = { art, pack }; });
  useLayoutEffect(() => {
    const content = scene.getObjectByName(DEVICE_CONTENT_NAME), rear = scene.getObjectByName('device-steel-back');
    if (!content || !(rear instanceof Mesh) || !collision) return;
    content.updateWorldMatrix(true, true); camera.updateWorldMatrix(true, false);
    collision.update(content);
    if (!collision.ready) return;
    const { art: artwork, pack: pose } = latestInput.current;
    const center = pose.sourcePlacement ? new Vector3((.5 - pose.sourcePlacement.x) * DEVICE_LAYOUT.body.width, (.5 - pose.sourcePlacement.y) * DEVICE_LAYOUT.body.height, -DEVICE_LAYOUT.body.depth / 2).applyMatrix4(content.matrixWorld) : new Vector3();
    const workspace = pose.returnToSheet ? scene.getObjectByName('sticker-pack-wrapper') : undefined;
    const bounds = workspace ? new Box3().setFromObject(workspace) : null;
    runtime.request({ art: artwork, pack: pose, width, paperWidth, pixel, seatX, origin: [originX, originY, originZ], world: content.matrixWorld.toArray(), cameraWorld: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray(), viewportWidth: size.width, viewportHeight: size.height, worldPixel: viewport.getCurrentViewport(camera, center).width / size.width, workspaceBounds: bounds && !bounds.isEmpty() ? { min: bounds.min.toArray(), max: bounds.max.toArray() } : null }, rear.geometry, collision);
  }, [runtime, inputKey, scene, camera, collision, collisionEpoch, orientation.orientation, width, paperWidth, pixel, seatX, originX, originY, originZ, size.width, size.height, viewport]);
  useLayoutEffect(() => {
    runtime.commit();
    const error = result.frame?.pointerError;
    if (error == null) gl.domElement.removeAttribute('data-wp-sticker-pointer-error');
    else gl.domElement.setAttribute('data-wp-sticker-pointer-error', error.toFixed(4));
    gl.domElement.setAttribute('data-wp-sticker-deformation', result.error ? 'failed' : result.frame ? 'ready' : 'pending');
    invalidate();
  }, [runtime, result, gl, invalidate]);
  // Borrow the already displayed source until the first complete worker pose.
  // Its mesh retains ownership; no large geometry rebuild runs during pickup.
  const sourceRoot = scene.getObjectByName(pack.sourcePlacement ? 'device-equipped-stickers' : 'sticker-pack-wrapper');
  const sourceMesh = sourceRoot?.getObjectByName(`sticker-${art.id}`);
  const frame = result.frame;
  if (!frame) return sourceMesh instanceof Mesh ? <group name="device-carried-sticker" matrix={sourceMesh.matrixWorld} matrixAutoUpdate={false}><StickerPrint art={art} geometry={sourceMesh.geometry} roughness={roughness} wear={pack.sourcePlacement?.wear ?? 0} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} /></group> : null;
  return <group name="device-carried-sticker"><StickerPrint art={frame.input.art} geometry={frame.geometry} wearGeometry={frame.wearGeometry} roughness={roughness} wear={frame.input.pack.placement?.wear ?? frame.input.pack.sourcePlacement?.wear ?? stickerScene.appearances?.find((entry) => entry.stickerId === frame.input.art.id)?.wear ?? 0} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} /></group>;
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
