import { createStickerProjection } from './sticker-projection';
import { createStickerPackRecipe, stickerPackPaperMaterials, stickerPackSleeveMaterials, stickerPackSleeveParts, STICKER_PACK_PHYSICAL, type StickerPackNode } from './sticker-pack-recipe';
import { usePackGeometry, bindPackPaperBounds } from './sticker-pack-resources';
import { installGpuPaperMaterial } from './sticker-paper-gpu';
import { createGpuPaperMaterialPreparation, useGpuPaperReady } from './sticker-paper-gpu-support';
import { createCarryPreparation } from './sticker-carry-preparation';
import { usePreparedStickerPaper } from './sticker-paper-preparation';
import { createStickerVisibility } from './sticker-visibility';
import { useThree } from '@react-three/fiber';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore, type RefObject } from 'react';
import { Box3, MeshPhysicalMaterial, MeshStandardMaterial, Group, Mesh, Vector3 } from 'three';
import { DeviceCanvasOrientationContext } from './DeviceCanvas';
import { useContext } from 'react';
import { STICKER_PACK_LAYOUT, stickerPackViewportLayout, STICKER_SHEET_SLOTS, STICKER_SHEET_PRINT_WIDTH, type StickerRearProjection, type DeviceStickerScene, type StickerArtwork, type StickerPackVisual } from './sticker-contract';
import { createStickerPeelGeometry, stickerVisibleAspect } from './sticker-surface';
import { createStickerRoughness, useStickerTexture, useStickerPreparationEpoch } from './sticker-textures';
import { StickerPrint } from './StickerSurface';
import { useStudioEnvironmentSnapshot } from './StudioEnvironment';
import { DEVICE_CONTENT_NAME, DEVICE_MODEL_NAME } from './ViewerLitDeviceFrame';
import { prepareStickerAlpha } from './sticker-hit';
import { prepareStickerPrograms } from './sticker-program-preparation';
import { createStickerWarmupReadiness } from './sticker-warmup-readiness';
import { DEVICE_LAYOUT } from './layout';

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
const PACK = STICKER_PACK_PHYSICAL;

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
    visibility.current ??= createStickerVisibility({workerOnly:true});
    const projection = createStickerProjection({scene,camera,canvas:gl.domElement,readScene:()=>currentScene.current,visibility:visibility.current});
    const handle = projection.handle;
    projectionHandle.current = handle; onProjectionReady?.(handle);
    return () => { projection.dispose(); projectionHandle.current = null; onProjectionReady?.(null); };
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
  const linerTravel = height * STICKER_PACK_LAYOUT.linerTravel * reveal;
  const art = stickerScene.assets.find((item) => item.id === pack.stickerId);
  const slots = sheet?.slots ?? [];
  const slotIndex = slots.findIndex((slot) => slot.stickerId === pack.stickerId);
  const seat = STICKER_SHEET_SLOTS[slotIndex] ?? (pack.sourcePlacement == null ? undefined : { x: .5, y: .5 });
  const printWidth = width * STICKER_SHEET_PRINT_WIDTH;
  const offset = pack.dragOffset;
  const recipe = createStickerPackRecipe(stickerScene, pack, {width,height,pixel,x,y,workspaceLowering}, stickerScene.pack !== null);
  return <group ref={packRoot} visible={recipe.visible} name={recipe.name}>
    {recipe.kind === 'group' ? recipe.children.map(node => <PackRecipeNode key={node.id} node={node} roughness={roughness} stickerScene={stickerScene} />) : null}
    {art === undefined || seat === undefined || (pack.peel === 0 && pack.placement === null && pack.dragOffset == null && pack.sourcePlacement == null) ? null : <PeelingPrint paperWidth={width} pixel={pixel} seatX={seat.x} art={art} pack={pack} width={Math.min(printWidth, height * .21 / stickerVisibleAspect(art))}
      origin={new Vector3(x + (seat.x - .5) * width + (offset?.x ?? 0) * pixel, y + linerTravel + (.5 - seat.y) * height - (offset?.y ?? 0) * pixel, PACK.depth + pixel * (2 + 5 * (1 - (seat.x * 2 - 1) ** 2) + .8))}
      stickerScene={stickerScene} roughness={roughness} carryCollision={visibility} />}
  </group>;
}
/** Both render backends consume the same tree; callbacks remain on main. */
function PackRecipeNode({node,roughness,stickerScene}:{readonly node:StickerPackNode;readonly roughness:ReturnType<typeof createStickerRoughness>;readonly stickerScene:DeviceStickerScene}) {
  if(node.kind==='group')return <group name={node.name} position={node.position} rotation={node.rotation} visible={node.visible}>{node.children.map(child=><PackRecipeNode key={child.id} node={child} roughness={roughness} stickerScene={stickerScene}/>)}</group>;
  if(node.kind==='paper')return <PackPaper {...node.size} epoch={node.epoch} ink={node.ink} liner={node.liner} curlProgress={node.curl} roughness={roughness}/>;
  if(node.kind==='sleeve')return <SleevePocket {...node.size} ink={node.ink} roughness={roughness}/>;
  const art=stickerScene.assets.find(asset=>asset.id===node.artId);
  return art?<SheetPrint art={art} width={node.width} bow={node.bow} appearance={node.appearance} roughness={roughness} stickerScene={stickerScene}/>:null;
}
/** Release stock bows and curls at its unprinted top corner; the printed sleeve is stiffer. */
const PackPaper = memo(function PackPaper(props: Parameters<typeof CpuPackPaper>[0]) {
  const gl = useThree(state => state.gl);
  const ready = useGpuPaperReady(gl);
  return ready ? <GpuPackPaper {...props} /> : <CpuPackPaper {...props} />;
});
const GpuPackPaper = memo(function GpuPackPaper({ width, height, pixel, ink, roughness, liner = false, curlProgress = 1, epoch }: { readonly epoch: number; readonly width: number; readonly height: number; readonly pixel: number; readonly ink: string; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly liner?: boolean; readonly curlProgress?: number }) {
  const prepared = usePackGeometry({kind:'gpu-paper',width,height,pixel,liner});
  const stock = useMemo(() => {
    const parts = prepared?.parts;
    return parts?.front && parts.back && parts.edge ? {front:parts.front,back:parts.back,edge:parts.edge} : null;
  }, [prepared]);
  if (!stock) return <CpuPackPaper width={width} height={height} pixel={pixel} ink={ink} roughness={roughness} liner={liner} curlProgress={curlProgress} epoch={epoch} />;
  return <PreparedGpuPackPaper width={width} height={height} pixel={pixel} ink={ink} roughness={roughness} liner={liner} curlProgress={curlProgress} epoch={epoch} stock={stock} />;
});
const PreparedGpuPackPaper = memo(function PreparedGpuPackPaper({ width, height, pixel, ink, roughness, liner = false, curlProgress = 1, epoch, stock }: Parameters<typeof CpuPackPaper>[0] & {readonly stock: {readonly front: import('three').BufferGeometry;readonly back: import('three').BufferGeometry;readonly edge: import('three').BufferGeometry}}) {
  const studio = useStudioEnvironmentSnapshot(), invalidate = useThree(state => state.invalidate);
  const { gl, camera, scene } = useThree();
  const curl = useMemo(() => { const uniform = { value: 0 }; return { uniform, set(value: number) { uniform.value = value; } }; }, []);
  const input = useMemo(() => ({ width, height, pixel, liner }), [width, height, pixel, liner]);
  useLayoutEffect(() => bindPackPaperBounds(stock, input, curl.uniform), [input, curl, stock]);
  const materials = useMemo(() => {
    const recipe = stickerPackPaperMaterials({width,height,pixel}, ink, liner);
    const back = new MeshStandardMaterial(recipe.back);
    const edge = new MeshStandardMaterial(recipe.edge);
    const front = new MeshPhysicalMaterial({ ...recipe.front, roughnessMap: roughness, bumpMap: roughness, envMap: studio.texture });
    for (const material of [front, back, edge]) installGpuPaperMaterial(material, input, curl.uniform, material === edge);
    return { front, back, edge };
  }, [input, curl, ink, liner, pixel, width, height, roughness, studio.texture]);
  const preparation = useMemo(() => createGpuPaperMaterialPreparation(gl, () => { const root = new Group(); for (const part of ['front', 'back', 'edge'] as const) root.add(new Mesh(stock[part], materials[part])); return { root, materials: Object.values(materials) }; }, camera, scene), [gl, stock, materials, camera, scene]);
  const linked = useSyncExternalStore(preparation.subscribe, preparation.getSnapshot, () => false);
  useEffect(() => preparation.mount(), [preparation]);
  useLayoutEffect(() => { curl.set(curlProgress); for (const geometry of Object.values(stock)) geometry.boundingBox = null; invalidate(); }, [curl, curlProgress, stock, invalidate]);
  useEffect(() => () => { for (const material of Object.values(materials)) material.dispose(); }, [materials]);
  if (!linked) return <CpuPackPaper width={width} height={height} pixel={pixel} ink={ink} roughness={roughness} liner={liner} curlProgress={curlProgress} epoch={epoch} />;
  return <group name={liner ? 'release-liner-stock' : 'printed-sleeve-stock'}>{(['back', 'edge', 'front'] as const).map(part => <mesh key={part} geometry={stock[part]} material={materials[part]} raycast={() => {}} />)}</group>;
});
const CpuPackPaper = memo(function CpuPackPaper({ width, height, pixel, ink, roughness, liner = false, curlProgress = 1, epoch }: { readonly epoch: number; readonly width: number; readonly height: number; readonly pixel: number; readonly ink: string; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly liner?: boolean; readonly curlProgress?: number }) {
  const studio = useStudioEnvironmentSnapshot();
  const { stock } = usePreparedStickerPaper(width, height, pixel, liner, curlProgress, epoch);
  if (stock === null) return null;
  const recipe = stickerPackPaperMaterials({width,height,pixel}, ink, liner);
  return <group name={liner ? "release-liner-stock" : "printed-sleeve-stock"}>
    <mesh geometry={stock.back} raycast={() => {}}><meshStandardMaterial {...recipe.back} /></mesh>
    <mesh geometry={stock.edge} raycast={() => {}}><meshStandardMaterial {...recipe.edge} /></mesh>
    <mesh geometry={stock.front} raycast={() => {}}><meshPhysicalMaterial {...recipe.front} roughnessMap={roughness} bumpMap={roughness} envMap={studio.texture} /></mesh>
  </group>;
});
/** Folded/glued paper pocket; the thumb notch and fold thickness identify the sleeve. */
const SleevePocket = memo(function SleevePocket({ width, height, pixel, ink, roughness }: { readonly width: number; readonly height: number; readonly pixel: number; readonly ink: string; readonly roughness: ReturnType<typeof createStickerRoughness> }) {
  return <group>{stickerPackSleeveParts({width,height,pixel}).map(part=><SleevePart key={part.id} part={part} pixel={pixel} ink={ink} roughness={roughness}/>)}</group>;
});
function SleevePart({part,pixel,ink,roughness}:{readonly part:ReturnType<typeof stickerPackSleeveParts>[number];readonly pixel:number;readonly ink:string;readonly roughness:ReturnType<typeof createStickerRoughness>}) {
  const studio=useStudioEnvironmentSnapshot(), prepared=usePackGeometry(part.geometry), geometry=prepared?.parts.geometry;
  const recipe=stickerPackSleeveMaterials(pixel,ink);
  const exterior={...recipe.exterior,envMap:studio.texture,roughnessMap:roughness,bumpMap:roughness};
  if(!geometry)return null;
  return <mesh geometry={geometry} position={part.position} rotation={part.rotation} raycast={()=>{}}>{part.material==='pocket'?<><meshPhysicalMaterial attach="material-0" {...exterior}/><meshStandardMaterial attach="material-1" {...recipe.cut}/><meshStandardMaterial attach="material-2" {...recipe.interior}/></>:<meshPhysicalMaterial {...exterior}/>}</mesh>;
}
function SheetPrint({ art, width, appearance, roughness, stickerScene, bow }: { readonly art: StickerArtwork; readonly width: number; readonly appearance: 'earned' | 'locked' | 'placed'; readonly roughness: ReturnType<typeof createStickerRoughness>; readonly stickerScene: DeviceStickerScene; readonly bow?: { pixel: number; paperWidth: number; seatX: number } }) {
  const prepared=usePackGeometry({kind:'parked-print',art,width,...(bow?{bow}:{})}), geometry=prepared?.parts.geometry;
  if(!geometry)return null;
  return <StickerPrint computationEpoch={stickerScene.pack?.computationEpoch} art={art} geometry={geometry} roughness={roughness} wear={stickerScene.appearances?.find((entry) => entry.stickerId === art.id)?.wear ?? 0} appearance={appearance} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} />;
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
  const subscribeCarryOrientation = useCallback((listener: () => void) => orientation.motionAuthority?.subscribeIntent(listener) ?? (() => {}), [orientation.motionAuthority]);
  const readCarryOrientation = useCallback(() => orientation.motionAuthority?.readIntent().orientation ?? orientation.orientation, [orientation]);
  const carryOrientation = useSyncExternalStore(subscribeCarryOrientation, readCarryOrientation, readCarryOrientation);
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
    content.updateWorldMatrix(true, false); camera.updateWorldMatrix(true, false);
    collision.update(content);
    if (!collision.ready) return;
    const { art: artwork, pack: pose } = latestInput.current;
    const center = pose.sourcePlacement ? new Vector3((.5 - pose.sourcePlacement.x) * DEVICE_LAYOUT.body.width, (.5 - pose.sourcePlacement.y) * DEVICE_LAYOUT.body.height, -DEVICE_LAYOUT.body.depth / 2).applyMatrix4(content.matrixWorld) : new Vector3();
    const workspace = pose.returnToSheet ? scene.getObjectByName('sticker-pack-wrapper') : undefined;
    const bounds = workspace ? new Box3().setFromObject(workspace) : null;
    runtime.request({ art: artwork, pack: pose, width, paperWidth, pixel, seatX, origin: [originX, originY, originZ], world: content.matrixWorld.toArray(), cameraWorld: camera.matrixWorld.toArray(), projection: camera.projectionMatrix.toArray(), viewportWidth: size.width, viewportHeight: size.height, worldPixel: viewport.getCurrentViewport(camera, center).width / size.width, workspaceBounds: bounds && !bounds.isEmpty() ? { min: bounds.min.toArray(), max: bounds.max.toArray() } : null }, rear.geometry, collision);
  }, [runtime, inputKey, scene, camera, collision, collisionEpoch, carryOrientation, width, paperWidth, pixel, seatX, originX, originY, originZ, size.width, size.height, viewport]);
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
  if (!frame) return sourceMesh instanceof Mesh ? <group name="device-carried-sticker" matrix={sourceMesh.matrixWorld} matrixAutoUpdate={false}><StickerPrint computationEpoch={pack.computationEpoch} art={art} geometry={sourceMesh.geometry} roughness={roughness} wear={pack.sourcePlacement?.wear ?? 0} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} /></group> : null;
  return <group name="device-carried-sticker"><StickerPrint computationEpoch={frame.input.pack.computationEpoch} art={frame.input.art} geometry={frame.geometry} wearGeometry={frame.wearGeometry} roughness={roughness} wear={frame.input.pack.placement?.wear ?? frame.input.pack.sourcePlacement?.wear ?? stickerScene.appearances?.find((entry) => entry.stickerId === frame.input.art.id)?.wear ?? 0} finishEnabled={stickerScene.finishEnabled !== false} onError={stickerScene.onArtworkError} onReady={stickerScene.onArtworkReady} /></group>;
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
  // Callback identity changes with the exact surface/material generation. Child
  // layout effects can run before this parent's passive effect subscribes.
  const surfaces = useMemo(() => createStickerWarmupReadiness({ geometry, texture, environment: studio.texture, preparationEpoch }), [geometry, texture, studio.texture, preparationEpoch]);
  useEffect(() => () => { roughness.dispose(); geometry.dispose(); }, [roughness, geometry]);
  useEffect(() => {
    let current = true;
    let started = false;
    let generation = 0;
    let preparation: AbortController | null = null;
    report(art.id, false);
    if (failed) onError?.(art.id);
    const prepare = (): void => {
      if (!current || started || !surfaces.complete()) return;
      const expected = ++generation;
      preparation?.abort(); preparation = new AbortController();
      report(art.id, false);
      if (texture === null || failed || group.current === null || gl.getContext().isContextLost()) return;
      started = true;
      try {
        prepareStickerAlpha(texture); gl.initTexture(texture);
        // Retain actual variants through readiness and cancel every superseded poll.
        void prepareStickerPrograms(gl, group.current, camera, scene, preparation.signal).then(() => {
          if (current && expected === generation && !gl.getContext().isContextLost()) report(art.id, true);
        }, (error: unknown) => { if (current && expected === generation && !(error instanceof Error && error.name === 'AbortError')) onError?.(art.id); });
      } catch { if (current && expected === generation) onError?.(art.id); }
    };
    const lost = (): void => { generation++; started = false; preparation?.abort(); report(art.id, false); };
    gl.domElement.addEventListener('webglcontextlost', lost); gl.domElement.addEventListener('webglcontextrestored', prepare);
    const unsubscribe = surfaces.subscribe(prepare);
    return () => { unsubscribe(); current = false; generation++; preparation?.abort(); gl.domElement.removeEventListener('webglcontextlost', lost); gl.domElement.removeEventListener('webglcontextrestored', prepare); report(art.id, false); };
  }, [art.id, camera, failed, gl, onError, report, scene, studio.texture, texture, preparationEpoch, surfaces]);
  return <group ref={group} visible={false} name={`prepared-sticker-${art.id}`}>
    {(['earned', 'locked', 'placed'] as const).map((appearance) => <StickerPrint key={`${appearance}:${geometry.uuid}:${texture?.uuid ?? "pending"}:${preparationEpoch}`} computationEpoch={preparationEpoch} art={art} geometry={geometry} roughness={roughness} finishEnabled appearance={appearance} onSurfaceReady={surfaces[appearance]} onError={onError} />)}
  </group>;
});
