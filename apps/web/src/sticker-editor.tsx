import { atom, useAtomValue } from 'jotai'
import { useEffect, useLayoutEffect, useRef } from 'react'
import { deviceStore, stickerInventoryAtom } from '@webpod/state'
import type { StickerProjectedQuad, StickerTransformPlane } from '@webpod/device'
import { BODY_H, BODY_W } from '@webpod/tokens'
import type { StickerPlacement } from '@webpod/stickers'
import { applyStickerEditor, dismissStickerEditor, previewStickerEdit, revertStickerEditor, retryStickerEdit, setStickerEditorProperty, stickerEditorAtom, stickerEditorFailureAtom, stickerEditorGestureAtom, stickerEditorCancelAtom, stickerEditorUndoAtom, undoStickerEdit, type StickerEditorProperty, type StickerEditorState } from './sticker-editor-model'
import { chooseHudLayout, type HudLayout } from './sticker-hud-layout'

/* ANIMATION STORYBOARD — on-object precision tools
 * select: responsive spring spreads grips from print and lifts tool group into place
 * drag: actual projected geometry follows input directly, without spring lag
 * release: snappy grip feedback settles; guarded save retains the final pose
 * dismiss: presence reverses from its current value; reselect can interrupt immediately
 * reduced motion: immediate presence; direct manipulation and focus remain intact
 */
const HUD = { stiffness: 300, damping: 25, maxStep: .032, settle: .002 }
const releaseAtom = atom<{ kind: 'width' | 'rotationDeg'; x: number; y: number; progress: number; epoch: number } | null>(null)
const rangeGestureAtom = atom<'active' | 'cancelled' | null>(null)
const lastPresentedAtom = atom<StickerEditorState | null>(null)
const layoutAtom = atom<HudLayout | null>(null)
const dragVisualAtom = atom<{ property: 'width' | 'rotationDeg'; pointer: { x: number; y: number } } | null>(null)
const presenceAtom = atom(0), disclosureAtom = atom<StickerEditorProperty | null>(null)
const viewportAtom = atom({ width: 1280, height: 900 })
type Drag = { pointerId: number; property: 'width' | 'rotationDeg'; plane: StickerTransformPlane; source: StickerPlacement; radius: number; angle: number; accumulated: number; target: HTMLElement; projection: string; pointer: { x: number; y: number } }
const buttonClass = 'pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#eee7d9] hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-35'
function Icon({ kind }: { kind: string }) {
  const paths: Record<string, string> = { rotate: 'M5 8a7 7 0 1 1-1 8M5 3v5h5', size: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M8 16l8-8', wear: 'M5 5l14 14M5 13l6 6M13 5l6 6M4 19l2-2M17 7l3-3', pack: 'M4 6h16v14H4zM8 6V3h8v3M8 12l4 4 4-4M12 9v7', undo: 'M4 4v6h6M4 10a8 8 0 1 1 1 9', precise: 'M4 7h16M4 17h16M8 4v6M16 14v6' }
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>
}
export function StickerEditor({ screen, quad, beginTransform, place, returnToPack }: {
  readonly screen: (placement: StickerPlacement) => { x: number; y: number } | null
  readonly quad?: (placement: StickerPlacement) => StickerProjectedQuad | null
  readonly beginTransform?: (placement: StickerPlacement) => StickerTransformPlane | null
  readonly place: (placement: StickerPlacement, expectedSource?: StickerPlacement) => Promise<void>
  readonly returnToPack: (id: string) => void
}) {
  const state = useAtomValue(stickerEditorAtom, { store: deviceStore }), failure = useAtomValue(stickerEditorFailureAtom, { store: deviceStore }), undo = useAtomValue(stickerEditorUndoAtom, { store: deviceStore })
  const release = useAtomValue(releaseAtom, { store: deviceStore })
  const presence = useAtomValue(presenceAtom, { store: deviceStore }), disclosure = useAtomValue(disclosureAtom, { store: deviceStore }), viewport = useAtomValue(viewportAtom, { store: deviceStore })
  const last = useAtomValue(lastPresentedAtom, { store: deviceStore }), savedLayout = useAtomValue(layoutAtom, { store: deviceStore }), dragVisual = useAtomValue(dragVisualAtom, { store: deviceStore }), gesture = useAtomValue(stickerEditorGestureAtom, { store: deviceStore })
  const drag = useRef<Drag | null>(null), velocity = useRef(0), activeId = useRef<string | null>(null), range = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => { if (state !== null) deviceStore.set(lastPresentedAtom, state) }, [state])
  const shown = state ?? last
  const selectedId = state?.source.stickerId ?? null
  const projectionKey = (source: StickerPlacement): string => JSON.stringify([source, { ...source, x: source.x + .1 }, { ...source, y: source.y + .1 }].map(p => screen(p)).map(p => p === null ? null : [Math.round(p.x * 100), Math.round(p.y * 100)]))
  useLayoutEffect(() => {
    if (activeId.current !== selectedId) { activeId.current = selectedId; deviceStore.set(releaseAtom, null); deviceStore.set(layoutAtom, null); deviceStore.set(disclosureAtom, null) }
  }, [selectedId])
  const cancel = (): void => {
    const held = drag.current; drag.current = null; deviceStore.set(dragVisualAtom, null)
    if (deviceStore.get(rangeGestureAtom) === 'active') deviceStore.set(rangeGestureAtom, 'cancelled')
    deviceStore.set(stickerEditorGestureAtom, false); revertStickerEditor()
    if (held?.target.hasPointerCapture(held.pointerId)) held.target.releasePointerCapture(held.pointerId)
  }
  useEffect(() => deviceStore.sub(stickerEditorCancelAtom, cancel), [])
  useLayoutEffect(() => { if (drag.current !== null && (selectedId !== drag.current.source.stickerId || projectionKey(drag.current.source) !== drag.current.projection)) cancel() })
  useEffect(() => {
    const update = (): void => { cancel(); deviceStore.set(layoutAtom, null); deviceStore.set(viewportAtom, { width: innerWidth, height: innerHeight }) }
    const hidden = (): void => { if (document.hidden) cancel() }
    update(); window.addEventListener('resize', update); document.addEventListener('visibilitychange', hidden)
    return () => { cancel(); deviceStore.set(lastPresentedAtom, null); deviceStore.set(rangeGestureAtom, null); deviceStore.set(presenceAtom, 0); deviceStore.set(releaseAtom, null); deviceStore.set(disclosureAtom, null); window.removeEventListener('resize', update); document.removeEventListener('visibilitychange', hidden) }
  }, [])
  useEffect(() => {
    const target = selectedId === null ? 0 : 1
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { deviceStore.set(presenceAtom, target); return }
    let frame = 0, previous = performance.now(); const started = previous
    const step = (now: number): void => {
      const dt = Math.min(HUD.maxStep, (now - previous) / 1000); previous = now
      const position = deviceStore.get(presenceAtom)
      velocity.current += ((target - position) * HUD.stiffness - velocity.current * HUD.damping) * dt
      const next = position + velocity.current * dt
      if (now - started > 1500 || Math.abs(target - next) < HUD.settle && Math.abs(velocity.current) < .01) { deviceStore.set(presenceAtom, target); velocity.current = 0; return }
      deviceStore.set(presenceAtom, next); frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [selectedId])
  useEffect(() => {
    const current = deviceStore.get(releaseAtom)
    if (current === null) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { deviceStore.set(releaseAtom, null); return }
    let frame = 0, position = current.progress, speed = 0, previous = performance.now()
    const started = previous
    const tick = (now: number): void => {
      const dt = Math.min(HUD.maxStep, (now - previous) / 1000); previous = now
      speed += ((1 - position) * 400 - speed * 30) * dt; position += speed * dt
      if (now - started > 1200 || Math.abs(1 - position) < .002 && Math.abs(speed) < .01) { deviceStore.set(releaseAtom, null); return }
      deviceStore.set(releaseAtom, { ...current, progress: position }); frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [release?.epoch])
  useEffect(() => { if (state?.keyboard) document.querySelector<HTMLElement>('[data-hud-handle="rotate"]')?.focus() }, [selectedId, state?.keyboard])
  useEffect(() => { if (disclosure !== null) range.current?.focus() }, [disclosure])
  if (shown === null || presence <= 0) {
    if (failure === null) return null
    const source = deviceStore.get(stickerInventoryAtom)?.placements.find(p => p.stickerId === failure.stickerId), point = source === undefined ? null : screen(source)
    return <div data-sticker-editor-failure role="alert" className="pointer-events-auto fixed z-40 rounded-full bg-[#242a2e] px-3 text-xs text-white" style={{ left: Math.max(16, Math.min(viewport.width - 220, point?.x ?? 16)), top: Math.max(64, Math.min(viewport.height - 60, point?.y ?? 64)) }}>{failure.message}{failure.attempted !== undefined && <button className="min-h-11 px-3 underline" onClick={() => retryStickerEdit(place)}>Retry</button>}</div>
  }
  const shape = quad?.(shown.draft)
  if (shape == null) return null
  const arrangement = gesture && savedLayout !== null ? savedLayout : chooseHudLayout(shape, viewport.width, viewport.height, (deviceStore.get(stickerInventoryAtom)?.placements ?? []).filter(p => p.stickerId !== shown.source.stickerId).flatMap(p => { const q = quad?.(p); return q == null ? [] : [{ left: Math.min(...q.corners.map(p => p.x)), right: Math.max(...q.corners.map(p => p.x)), top: Math.min(...q.corners.map(p => p.y)), bottom: Math.max(...q.corners.map(p => p.y)) }] }))
  const corner = shape.corners[arrangement.corner] ?? shape.corners[2], edge = shape.edges[arrangement.edge] ?? shape.edges[0]
  const settleGrip = (kind: 'width' | 'rotationDeg', point: { x: number; y: number }) => release?.kind === kind ? { x: release.x + (point.x - release.x) * release.progress, y: release.y + (point.y - release.y) * release.progress } : point
  const resize = dragVisual?.property === 'width' ? dragVisual.pointer : settleGrip('width', { x: corner.x + arrangement.resizeOffset.x, y: corner.y + arrangement.resizeOffset.y }), rotate = dragVisual?.property === 'rotationDeg' ? dragVisual.pointer : settleGrip('rotationDeg', { x: edge.x + arrangement.rotateOffset.x, y: edge.y + arrangement.rotateOffset.y })
  const begin = (event: React.PointerEvent<HTMLButtonElement>, property: 'width' | 'rotationDeg'): void => {
    if (state === null || state.phase === 'saving' || !event.isPrimary || event.button !== 0) return
    const plane = beginTransform?.(state.draft), point = plane?.project(event.clientX, event.clientY)
    if (plane == null || point == null) return
    const dx = (point.x - state.draft.x) * BODY_W, dy = (point.y - state.draft.y) * BODY_H, radius = Math.hypot(dx, dy)
    if (radius < 1e-6) return
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
    deviceStore.set(releaseAtom, null); deviceStore.set(layoutAtom, arrangement)
    setStickerEditorProperty(property); deviceStore.set(stickerEditorGestureAtom, true)
    deviceStore.set(dragVisualAtom, { property, pointer: { x: event.clientX, y: event.clientY } })
    drag.current = { pointerId: event.pointerId, property, plane, source: state.draft, radius, angle: Math.atan2(dy, dx), accumulated: 0, target: event.currentTarget, projection: projectionKey(state.draft), pointer: { x: event.clientX, y: event.clientY } }
  }
  const move = (event: React.PointerEvent): void => {
    const held = drag.current; if (held === null || held.pointerId !== event.pointerId) return
    held.pointer = { x: event.clientX, y: event.clientY }; deviceStore.set(dragVisualAtom, { property: held.property, pointer: held.pointer })
    const point = held.plane.project(event.clientX, event.clientY); if (point === null) return
    const dx = (point.x - held.source.x) * BODY_W, dy = (point.y - held.source.y) * BODY_H
    if (Math.hypot(dx, dy) < 1e-6) return
    if (held.property === 'width') previewStickerEdit(held.source.width * Math.hypot(dx, dy) / held.radius)
    else { const angle = Math.atan2(dy, dx); held.accumulated += Math.atan2(Math.sin(angle - held.angle), Math.cos(angle - held.angle)); held.angle = angle; const degrees = held.source.rotationDeg + held.accumulated * 180 / Math.PI; previewStickerEdit(((degrees + 180) % 360 + 360) % 360 - 180) }
  }
  const finish = (event: React.PointerEvent): void => {
    if (drag.current?.pointerId !== event.pointerId) return
    move(event); const held = drag.current; deviceStore.set(releaseAtom, { kind: held.property, ...held.pointer, progress: 0, epoch: performance.now() }); drag.current = null; deviceStore.set(dragVisualAtom, null); deviceStore.set(stickerEditorGestureAtom, false)
    if (held.target.hasPointerCapture(event.pointerId)) held.target.releasePointerCapture(event.pointerId)
    void applyStickerEditor(place)
  }
  const keys = (event: React.KeyboardEvent, property: StickerEditorProperty): void => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || state?.phase === 'saving') return
    event.preventDefault(); event.stopPropagation(); deviceStore.set(stickerEditorGestureAtom, true); setStickerEditorProperty(property)
    const current = deviceStore.get(stickerEditorAtom)?.draft; if (current === undefined) return
    const step = property === 'rotationDeg' ? 1 : property === 'width' ? .005 : .01
    previewStickerEdit((current[property] ?? 0) + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : step))
  }
  const commitKey = (): void => { deviceStore.set(stickerEditorGestureAtom, false); void applyStickerEditor(place) }
  const activeProperty = dragVisual?.property ?? release?.kind
  const handle = (kind: 'size' | 'rotate', point: { x: number; y: number }) => <button key={kind} type="button" data-hud-handle={kind} aria-label={kind === 'rotate' ? 'Rotate sticker' : 'Resize sticker'} title={kind === 'rotate' ? 'Rotate' : 'Resize'} className={`${buttonClass} bg-[#242a2e]/95 shadow-lg`} style={{ position: 'fixed', left: point.x - 22, top: point.y - 22, touchAction: 'none', opacity: activeProperty !== undefined && activeProperty !== (kind === 'rotate' ? 'rotationDeg' : 'width') ? 0 : 1, pointerEvents: activeProperty !== undefined && activeProperty !== (kind === 'rotate' ? 'rotationDeg' : 'width') ? 'none' : 'auto', cursor: kind === 'rotate' ? 'grab' : 'nwse-resize', transform: `scale(${.8 + presence * .2})` }} disabled={state === null || state.phase === 'saving' || activeProperty !== undefined && activeProperty !== (kind === 'rotate' ? 'rotationDeg' : 'width')} onPointerDown={event => begin(event, kind === 'rotate' ? 'rotationDeg' : 'width')} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={() => { if (drag.current !== null) cancel() }} onKeyDown={event => keys(event, kind === 'rotate' ? 'rotationDeg' : 'width')} onKeyUp={event => { if (event.key !== 'Escape') commitKey() }}><Icon kind={kind} /></button>
  return <div data-sticker-editor={shown.source.stickerId} data-editor-phase={shown.phase} data-hud-presence={presence.toFixed(3)} data-hud-release={release?.progress ?? 1} inert={state === null} role="group" aria-label="Sticker controls" className="pointer-events-none fixed inset-0 z-40" style={{ opacity: Math.min(1, presence) }} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); if (deviceStore.get(stickerEditorGestureAtom)) cancel(); else { const id = shown.source.stickerId; dismissStickerEditor(); document.querySelector<HTMLElement>(`[data-sticker-placed="${id}"]`)?.focus() } } }}>
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"><g fill="none" strokeLinejoin="round"><polygon points={shape.corners.map(p => `${shape.center.x + (p.x - shape.center.x) * (.97 + presence * .03)},${shape.center.y + (p.y - shape.center.y) * (.97 + presence * .03)}`).join(' ')} stroke="#14191d" strokeWidth="3"/><polygon points={shape.corners.map(p => `${shape.center.x + (p.x - shape.center.x) * (.97 + presence * .03)},${shape.center.y + (p.y - shape.center.y) * (.97 + presence * .03)}`).join(' ')} stroke="#eee7d9" strokeWidth="1"/><path d={`M${corner.x},${corner.y} L${resize.x},${resize.y} M${edge.x},${edge.y} L${rotate.x},${rotate.y}`} stroke="#eee7d9" strokeWidth="1" /></g></svg>
    {handle('size', resize)}{handle('rotate', rotate)}
    <div data-hud-tools className="pointer-events-auto fixed flex rounded-full border border-white/10 bg-[#242a2e]/95 text-white shadow-lg" style={{ left: arrangement.tools.x, top: arrangement.tools.y, transform: `translateY(${(1 - presence) * 8}px)` }}>
      <button className={buttonClass} aria-label="Sticker wear" title="Wear" disabled={shown.phase === 'saving'} onClick={() => { setStickerEditorProperty('wear'); deviceStore.set(disclosureAtom, disclosure === 'wear' ? null : 'wear') }}><Icon kind="wear" /></button>
      <button className={buttonClass} aria-label="Precise adjustments" title="Precise adjustments" disabled={shown.phase === 'saving'} onClick={() => { setStickerEditorProperty('rotationDeg'); deviceStore.set(disclosureAtom, disclosure === 'rotationDeg' ? null : 'rotationDeg') }}><Icon kind="precise" /></button>
      <button className={buttonClass} aria-label="Return to pack" title="Return to pack" disabled={shown.phase === 'saving'} onClick={() => { dismissStickerEditor(); returnToPack(shown.source.stickerId) }}><Icon kind="pack" /></button>
      <button className={buttonClass} aria-label="Undo sticker change" title="Undo" disabled={undo === null || shown.phase === 'saving'} onClick={() => undoStickerEdit(place)}><Icon kind="undo" /></button>
    </div>
    {disclosure !== null && <div className="pointer-events-auto fixed w-48 rounded-xl bg-[#242a2e] px-3 py-2 text-xs text-white shadow-lg" style={{ left: Math.min(viewport.width - 208, arrangement.tools.x), top: arrangement.tools.y > viewport.height / 2 ? arrangement.tools.y - 88 : arrangement.tools.y + 52 }}><label className="flex justify-between" htmlFor="sticker-hud-value"><span>{disclosure === 'wear' ? 'Wear' : disclosure === 'width' ? 'Size' : 'Angle'}</span><span>{disclosure === 'wear' ? `${Math.round((shown.draft.wear ?? 0) * 100)}%` : disclosure === 'width' ? `${Math.round(shown.draft.width * 100)}%` : `${Math.round(shown.draft.rotationDeg)}°`}</span></label><input ref={range} id="sticker-hud-value" type="range" className="h-11 w-full accent-[#d6ba8e]" min={disclosure === 'wear' ? 0 : disclosure === 'width' ? .08 : -180} max={disclosure === 'wear' ? 1 : disclosure === 'width' ? .35 : 180} step={disclosure === 'rotationDeg' ? 1 : .005} value={shown.draft[disclosure] ?? 0} disabled={shown.phase === 'saving'} onPointerDown={() => { deviceStore.set(rangeGestureAtom, 'active'); deviceStore.set(layoutAtom, arrangement); deviceStore.set(stickerEditorGestureAtom, true) }} onPointerUp={() => { const cancelled = deviceStore.get(rangeGestureAtom) === 'cancelled'; deviceStore.set(rangeGestureAtom, null); if (!cancelled) commitKey() }} onPointerCancel={() => { cancel(); deviceStore.set(rangeGestureAtom, null) }} onChange={event => { if (deviceStore.get(rangeGestureAtom) !== 'cancelled') previewStickerEdit(Number(event.currentTarget.value)); else deviceStore.set(stickerEditorAtom, current => current === null ? null : { ...current }) }} onKeyDown={event => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { deviceStore.set(rangeGestureAtom, null); deviceStore.set(stickerEditorGestureAtom, true) } }} onKeyUp={event => { if (event.key !== 'Escape') commitKey() }}/>{disclosure !== 'wear' && <button className="min-h-11 underline" onClick={() => { const next = disclosure === 'rotationDeg' ? 'width' : 'rotationDeg'; setStickerEditorProperty(next); deviceStore.set(disclosureAtom, next) }}>{disclosure === 'rotationDeg' ? 'Size' : 'Angle'}</button>}</div>}
    {shown.phase === 'saving' && <span role="status" className="fixed rounded bg-[#242a2e] px-2 py-1 text-[11px] text-white" style={{ left: arrangement.tools.x, top: arrangement.tools.y - 24 }}>Saving…</span>}
    {failure?.stickerId === shown.source.stickerId && <div role="alert" className="pointer-events-auto fixed rounded bg-[#242a2e] px-3 text-xs text-white" style={{ left: arrangement.tools.x, top: arrangement.tools.y + 52 }}>{failure.message}{failure.attempted !== undefined && <button className="min-h-11 px-2 underline" onClick={() => retryStickerEdit(place)}>Retry</button>}</div>}
  </div>
}
