import { atom, useAtomValue } from 'jotai'
import { StickerContourGrips, StickerContourPaths } from './sticker-contour-presentation'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { deviceStore, stickerInventoryAtom, stickerInteractionAtom } from '@webpod/state'
import type { StickerProjectedContour, StickerProjectedQuad, StickerTransformPlane } from '@webpod/device'
import { BODY_H, BODY_W } from '@webpod/tokens'
import type { StickerPlacement } from '@webpod/stickers'
import { stickerEditorHandleModeAtom, toggleStickerEditorHandleMode, applyStickerEditor, resetStickerAppearance, dismissStickerEditor, previewStickerEdit, revertStickerEditor, retryStickerEdit, setStickerEditorProperty, stickerEditorAtom, stickerEditorFailureAtom, stickerEditorGestureAtom, stickerEditorCancelAtom, undoStickerEdit, type StickerEditorProperty, type StickerEditorState } from './sticker-editor-model'
import { stickerProjectionVersionAtom } from './sticker-collections-model'
import { chooseHudLayout, type HudLayout } from './sticker-hud-layout'

/* ANIMATION STORYBOARD — on-object precision tools
 * select: responsive spring spreads grips from print and lifts tool group into place
 * toggle: 240ms — grips and tools breathe 1 → .96 → 1.025 → 1 as frost changes
 * drag: actual projected geometry follows input directly, without spring lag
 * release: snappy grip feedback settles; guarded save retains the final pose
 * dismiss: presence reverses from its current value; reselect can interrupt immediately
 * reduced motion: immediate presence; direct manipulation and focus remain intact
 */
const HUD = { stiffness: 300, damping: 25, maxStep: .032, settle: .002 }
const releaseAtom = atom<{ corner: number; kind: 'width' | 'rotationDeg'; x: number; y: number; progress: number; epoch: number } | null>(null)
const rangeGestureAtom = atom<'active' | 'cancelled' | null>(null)
const lastPresentedAtom = atom<StickerEditorState | null>(null)
const shownEditorAtom = atom(get => get(stickerEditorAtom) ?? get(lastPresentedAtom))
const layoutAtom = atom<HudLayout | null>(null)
const dragVisualAtom = atom<{ corner: number; property: 'width' | 'rotationDeg'; pointer: { x: number; y: number } } | null>(null)
const focusedCornerAtom = atom<number | null>(null)
const modeSwitchedAtom = atom(false)
const presenceAtom = atom(0)
const viewportAtom = atom({ width: 1280, height: 900 })
type Drag = { corner: number; pointerId: number; property: 'width' | 'rotationDeg'; plane: StickerTransformPlane; source: StickerPlacement; radius: number; angle: number; accumulated: number; target: HTMLElement; projection: string; pointer: { x: number; y: number } }
const buttonClass = 'pointer-events-auto grid h-11 w-11 shrink-0 place-items-center rounded-full text-[#263139] hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-35'
let tooltipPointer: {x:number;y:number} | null = null
let tooltipDismissedAt: {x:number;y:number} | null = null
let tooltipTimer: ReturnType<typeof setTimeout> | null = null
const tooltipAtom = atom<{ id: string; text: string; x: number; y: number } | null>(null)
/** Consume tooltip dismissal even when hover did not move focus into the HUD. */
export function dismissStickerTooltip(): boolean {
  if (deviceStore.get(tooltipAtom) === null) return false
  tooltipDismissedAt = tooltipPointer
  deviceStore.set(tooltipAtom, null)
  if (tooltipTimer !== null) clearTimeout(tooltipTimer)
  return true
}
function Icon({ kind }: { kind: string }) {
  const paths: Record<string, string> = { rotate: 'M5 8a7 7 0 1 1-1 8M5 3v5h5', size: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M8 16l8-8', wear: 'M5 5l14 14M5 13l6 6M13 5l6 6M4 19l2-2M17 7l3-3', pack: 'M4 6h16v14H4zM8 6V3h8v3M8 12l4 4 4-4M12 9v7', undo: 'M4 4v6h6M4 10a8 8 0 1 1 1 9', precise: 'M4 7h16M4 17h16M8 4v6M16 14v6' }
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>
}
type StickerEditorProps = {
  readonly fit?: (placement: StickerPlacement) => StickerPlacement
  readonly screen: (placement: StickerPlacement) => { x: number; y: number } | null
  readonly contour?: (placement: StickerPlacement) => StickerProjectedContour | null
  readonly quad?: (placement: StickerPlacement) => StickerProjectedQuad | null
  readonly beginTransform?: (placement: StickerPlacement) => StickerTransformPlane | null
  readonly place: (placement: StickerPlacement, expectedSource?: StickerPlacement) => Promise<void>
  readonly returnToPack: (id: string) => void
}
/** Moving a sticker never retains the appearance HUD, including its exit animation. */
export function StickerEditor(props: StickerEditorProps) {
  const interaction = useAtomValue(stickerInteractionAtom, { store: deviceStore })
  if (interaction.stage === 'peeling' || interaction.stage === 'placing' || interaction.stage === 'settling') return null
  return <StickerAppearanceEditor {...props} />
}
function StickerAppearanceEditor({ fit, screen, quad, contour, beginTransform, place, returnToPack }: StickerEditorProps) {
  const state = useAtomValue(stickerEditorAtom, { store: deviceStore }), failure = useAtomValue(stickerEditorFailureAtom, { store: deviceStore })
  const handleMode = useAtomValue(stickerEditorHandleModeAtom, { store: deviceStore })
  const modeSwitched = useAtomValue(modeSwitchedAtom, { store: deviceStore })
  const scaling = handleMode === 'width'
  const handleHint = scaling ? 'Drag outward to enlarge, inward to shrink' : 'Drag to rotate'
  const tooltip = useAtomValue(tooltipAtom, { store: deviceStore })
  const focusedCorner = useAtomValue(focusedCornerAtom, { store: deviceStore })
  const release = useAtomValue(releaseAtom, { store: deviceStore })
  const presence = useAtomValue(presenceAtom, { store: deviceStore }), viewport = useAtomValue(viewportAtom, { store: deviceStore })
  const shown = useAtomValue(shownEditorAtom, { store: deviceStore })
  const projectionVersion = useAtomValue(stickerProjectionVersionAtom, { store: deviceStore })
  const savedLayout = useAtomValue(layoutAtom, { store: deviceStore }), dragVisual = useAtomValue(dragVisualAtom, { store: deviceStore }), gesture = useAtomValue(stickerEditorGestureAtom, { store: deviceStore })
  const drag = useRef<Drag | null>(null), velocity = useRef(0), activeId = useRef<string | null>(null), range = useRef<HTMLInputElement>(null)
  useLayoutEffect(() => { if (state !== null) deviceStore.set(lastPresentedAtom, state) }, [state])
  const selectedId = state?.source.stickerId ?? null
  const projectionKey = (source: StickerPlacement): string => JSON.stringify([source, { ...source, x: source.x + .1 }, { ...source, y: source.y + .1 }].map(p => screen(p)).map(p => p === null ? null : [Math.round(p.x * 100), Math.round(p.y * 100)]))
  useLayoutEffect(() => {
    if (activeId.current !== selectedId) { activeId.current = selectedId; deviceStore.set(modeSwitchedAtom, false); tooltipDismissedAt=null;tooltipPointer=null;deviceStore.set(focusedCornerAtom, null);deviceStore.set(releaseAtom, null); deviceStore.set(layoutAtom, null); deviceStore.set(tooltipAtom, null) }
  }, [selectedId])
  const cancel = (): void => {
    const held = drag.current; drag.current = null; deviceStore.set(dragVisualAtom, null)
    if (deviceStore.get(rangeGestureAtom) === 'active') deviceStore.set(rangeGestureAtom, 'cancelled')
    deviceStore.set(stickerEditorGestureAtom, false); revertStickerEditor()
    if (held?.target.hasPointerCapture(held.pointerId)) held.target.releasePointerCapture(held.pointerId)
  }
  useEffect(() => deviceStore.sub(stickerEditorCancelAtom, cancel), [])
  useLayoutEffect(() => {
    const element = document.getElementById('sticker-contour-tooltip')
    if (tooltip !== null && element !== null && 'showPopover' in element && !element.matches(':popover-open')) element.showPopover()
  }, [tooltip])
  useEffect(() => () => { if (tooltipTimer !== null) clearTimeout(tooltipTimer) }, [])
  useLayoutEffect(() => { if (drag.current !== null && (selectedId !== drag.current.source.stickerId || (drag.current.plane.isValid ? !drag.current.plane.isValid() : projectionKey(drag.current.source) !== drag.current.projection))) cancel() })
  useEffect(() => {
    const update = (): void => { cancel(); deviceStore.set(layoutAtom, null); deviceStore.set(viewportAtom, { width: innerWidth, height: innerHeight }) }
    const hidden = (): void => { if (document.hidden) cancel() }
    const pointerMoved = (event: PointerEvent): void => { if(tooltipDismissedAt!==null && !(event.target instanceof Element && event.target.closest('[data-tooltip-trigger]')) && Math.hypot(event.clientX-tooltipDismissedAt.x,event.clientY-tooltipDismissedAt.y)>=2) tooltipDismissedAt=null }
    update(); window.addEventListener('pointermove',pointerMoved); window.addEventListener('resize', update); document.addEventListener('visibilitychange', hidden)
    return () => { cancel(); tooltipPointer=null;tooltipDismissedAt=null;deviceStore.set(lastPresentedAtom, null); deviceStore.set(focusedCornerAtom, null); deviceStore.set(rangeGestureAtom, null); deviceStore.set(presenceAtom, 0); deviceStore.set(releaseAtom, null); deviceStore.set(tooltipAtom, null); window.removeEventListener('pointermove',pointerMoved); window.removeEventListener('resize', update); document.removeEventListener('visibilitychange', hidden) }
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
  useEffect(() => { if (state?.keyboard) document.querySelector<HTMLElement>('[data-hud-handle]')?.focus() }, [selectedId, state?.keyboard])
  const tip = (id: string, text: string, element: HTMLElement): void => {
    if (deviceStore.get(stickerEditorGestureAtom)) return
    if (tooltipTimer !== null) clearTimeout(tooltipTimer)
    const bounds = element.getBoundingClientRect()
    deviceStore.set(tooltipAtom, { id, text, x: Math.max(12, Math.min(viewport.width - 224, bounds.left + bounds.width / 2 - 106)), y: bounds.top > 106 ? bounds.top - 40 : bounds.bottom + 8 })
  }
  const tipEvents = (id: string, text: string) => ({
    'data-tooltip-trigger':id,
    'aria-describedby': tooltip?.id === id ? 'sticker-contour-tooltip' : undefined,
    onPointerEnter: (event: React.PointerEvent<HTMLElement>) => { tooltipPointer={x:event.clientX,y:event.clientY};if(event.pointerType==='touch'||tooltipDismissedAt!==null&&Math.hypot(event.clientX-tooltipDismissedAt.x,event.clientY-tooltipDismissedAt.y)<2)return;tooltipDismissedAt=null;tip(id,text,event.currentTarget) },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => { tooltipPointer={x:event.clientX,y:event.clientY};if(tooltipDismissedAt!==null&&Math.hypot(event.clientX-tooltipDismissedAt.x,event.clientY-tooltipDismissedAt.y)>=2){tooltipDismissedAt=null;tooltipPointer={x:event.clientX,y:event.clientY};tip(id,text,event.currentTarget)} },
    onPointerLeave: (event: React.PointerEvent<HTMLElement>) => { const element = event.currentTarget; tooltipTimer = setTimeout(() => { if (document.activeElement !== element) deviceStore.set(tooltipAtom, null) }, 120) },
    onFocus: (event: React.FocusEvent<HTMLElement>) => { tooltipDismissedAt=null;tip(id, text, event.currentTarget) },
    onBlur: () => deviceStore.set(tooltipAtom, null),
  })
  const tooltipView = tooltip === null ? null : <div id="sticker-contour-tooltip" role="tooltip" popover={typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype ? 'manual' : undefined} className="pointer-events-auto fixed max-w-56 rounded-lg bg-[#202a31] px-3 py-2 text-xs text-white shadow-lg" style={{ left: tooltip.x, top: tooltip.y, margin: 0, right: 'auto', bottom: 'auto', border: 0 }} onPointerEnter={event => { tooltipPointer={x:event.clientX,y:event.clientY};if (tooltipTimer !== null) clearTimeout(tooltipTimer) }} onPointerMove={event=>{tooltipPointer={x:event.clientX,y:event.clientY}}} onPointerLeave={() => { if (!document.activeElement?.hasAttribute('aria-describedby')) deviceStore.set(tooltipAtom, null) }}>{tooltip.text}</div>
  const draft = shown?.draft
  const { shape } = useMemo(() => ({ version: projectionVersion, shape: draft === undefined || contour === undefined ? null : contour(draft) }), [draft, contour, projectionVersion])
  if (shown === null || presence <= 0) {
    if (failure === null) return null
    const source = deviceStore.get(stickerInventoryAtom)?.placements.find(p => p.stickerId === failure.stickerId), point = source === undefined ? null : screen(source)
    return <><div data-sticker-editor-failure role="alert" className="pointer-events-auto fixed z-40 rounded-full bg-[#242a2e] px-3 text-xs text-white" style={{ left: Math.max(16, Math.min(viewport.width - 220, point?.x ?? 16)), top: Math.max(64, Math.min(viewport.height - 60, point?.y ?? 64)) }}>{failure.message}{failure.attempted !== undefined && <button className="min-h-11 px-3 underline" {...tipEvents('retry', 'Retry saving this change')} onClick={() => retryStickerEdit(place)}>Retry</button>}</div>{tooltipView}</>
  }
  if (shape == null) return null
  const arrangement = gesture && savedLayout !== null ? savedLayout : chooseHudLayout(shape, viewport.width, viewport.height, (deviceStore.get(stickerInventoryAtom)?.placements ?? []).filter(p => p.stickerId !== shown.source.stickerId).flatMap(p => { const q = quad?.(p); return q == null ? [] : [{ left: Math.min(...q.corners.map(p => p.x)), right: Math.max(...q.corners.map(p => p.x)), top: Math.min(...q.corners.map(p => p.y)), bottom: Math.max(...q.corners.map(p => p.y)) }] }))
  const grips = shape.anchors.map((anchor, i) => {
    const offset = arrangement.offsets[i] ?? { x: 0, y: 0 }
    const rest = { x: anchor.x + offset.x, y: anchor.y + offset.y }
    if (dragVisual?.corner === i) return dragVisual.pointer
    return release?.corner === i ? { x: release.x + (rest.x - release.x) * release.progress, y: release.y + (rest.y - release.y) * release.progress } : rest
  })
  const visibleGrips = shape.anchors.map((anchor,i) => {
    const dx=anchor.x-shape.center.x,dy=anchor.y-shape.center.y,length=Math.hypot(dx,dy)||1
    const target=grips[i] ?? anchor
    const rest={x:Math.max(target.x-6,Math.min(target.x+6,anchor.x+dx/length*5)),y:Math.max(target.y-6,Math.min(target.y+6,anchor.y+dy/length*5))}
    if (dragVisual?.corner===i) return dragVisual.pointer
    return release?.corner===i ? {x:release.x+(rest.x-release.x)*release.progress,y:release.y+(rest.y-release.y)*release.progress} : rest
  })
  const begin = (event: React.PointerEvent<HTMLButtonElement>, property: 'width' | 'rotationDeg', corner = 0): void => {
    if (state === null || state.phase === 'saving' || !event.isPrimary || event.button !== 0) return
    const plane = beginTransform?.(state.draft), point = plane?.project(event.clientX, event.clientY)
    if (plane == null || point == null) return
    const dx = (point.x - state.draft.x) * BODY_W, dy = (point.y - state.draft.y) * BODY_H, radius = Math.hypot(dx, dy)
    if (radius < 1e-6) return
    event.preventDefault(); event.stopPropagation(); event.currentTarget.setPointerCapture(event.pointerId)
    deviceStore.set(releaseAtom, null); deviceStore.set(layoutAtom, arrangement)
    setStickerEditorProperty(property); deviceStore.set(stickerEditorGestureAtom, true)
    deviceStore.set(tooltipAtom, null); deviceStore.set(dragVisualAtom, { corner, property, pointer: { x: event.clientX, y: event.clientY } })
    drag.current = { corner, pointerId: event.pointerId, property, plane, source: state.draft, radius, angle: Math.atan2(dy, dx), accumulated: 0, target: event.currentTarget, projection: projectionKey(state.draft), pointer: { x: event.clientX, y: event.clientY } }
  }
  const move = (event: React.PointerEvent): void => {
    const held = drag.current; if (held === null || held.pointerId !== event.pointerId) return
    held.pointer = { x: event.clientX, y: event.clientY }; deviceStore.set(dragVisualAtom, { corner: held.corner, property: held.property, pointer: held.pointer })
    const point = held.plane.project(event.clientX, event.clientY); if (point === null) return
    const dx = (point.x - held.source.x) * BODY_W, dy = (point.y - held.source.y) * BODY_H
    if (Math.hypot(dx, dy) < 1e-6) return
    if (held.property === 'width') {
      previewStickerEdit(held.source.width * Math.hypot(dx, dy) / held.radius, fit)
      const message = deviceStore.get(stickerEditorAtom)?.message
      deviceStore.set(tooltipAtom, message ? { id: `corner-${held.corner}`, text: message, x: Math.max(12, Math.min(viewport.width - 224, event.clientX - 106)), y: Math.max(64, Math.min(viewport.height - 52, event.clientY - 52)) } : null)
    }
    else { const angle = Math.atan2(dy, dx); held.accumulated += Math.atan2(Math.sin(angle - held.angle), Math.cos(angle - held.angle)); held.angle = angle; const degrees = held.source.rotationDeg + held.accumulated * 180 / Math.PI; previewStickerEdit(((degrees + 180) % 360 + 360) % 360 - 180, fit) }
  }
  const finish = (event: React.PointerEvent): void => {
    if (drag.current?.pointerId !== event.pointerId) return
    move(event); const held = drag.current; deviceStore.set(releaseAtom, { corner: held.corner, kind: held.property, ...held.pointer, progress: 0, epoch: event.timeStamp }); drag.current = null; deviceStore.set(dragVisualAtom, null); deviceStore.set(stickerEditorGestureAtom, false)
    if (held.target.hasPointerCapture(event.pointerId)) held.target.releasePointerCapture(event.pointerId)
    void applyStickerEditor(place)
  }
  const keys = (event: React.KeyboardEvent, property: StickerEditorProperty): void => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || state?.phase === 'saving') return
    event.preventDefault(); event.stopPropagation(); deviceStore.set(tooltipAtom,null);deviceStore.set(stickerEditorGestureAtom, true); setStickerEditorProperty(property)
    const current = deviceStore.get(stickerEditorAtom)?.draft; if (current === undefined) return
    const step = property === 'rotationDeg' ? 1 : property === 'width' ? .005 : .01
    previewStickerEdit((current[property] ?? 0) + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -step : step), fit)
  }
  const commitKey = (): void => { deviceStore.set(stickerEditorGestureAtom, false); void applyStickerEditor(place) }
  const handle = (point: { x: number; y: number }, index: number, retainedHidden: boolean) => <button key={index} type="button" data-hud-handle={scaling ? 'scale' : 'rotate'} data-contour-corner={index} tabIndex={retainedHidden ? -1 : 0} aria-label={`${scaling ? 'Scale' : 'Rotate'} sticker, ${['top left', 'top right', 'bottom right', 'bottom left'][index]} corner`} {...tipEvents(`corner-${index}`, handleHint)} onFocus={event => { deviceStore.set(focusedCornerAtom, index); tipEvents(`corner-${index}`, handleHint).onFocus(event) }} onBlur={() => { if (deviceStore.get(focusedCornerAtom) === index) deviceStore.set(focusedCornerAtom, null); tipEvents(`corner-${index}`, handleHint).onBlur() }} className={`${buttonClass} contour-grip`} style={{ position: 'fixed', left: point.x - 22, top: point.y - 22, touchAction: 'none', pointerEvents: retainedHidden ? 'none' : undefined, cursor: scaling ? (index % 2 === 0 ? 'nwse-resize' : 'nesw-resize') : 'grab', transform: `scale(${.8 + presence * .2})` }} aria-disabled={state === null || state.phase === 'saving'} onPointerDown={event => { if (!retainedHidden) begin(event, handleMode, index) }} onPointerMove={event=>{move(event);tipEvents(`corner-${index}`,handleHint).onPointerMove(event)}} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={() => { if (drag.current !== null) cancel() }} onKeyDown={event => keys(event, handleMode)} onKeyUp={event => { if (event.key !== 'Escape') commitKey() }}><svg aria-hidden="true" viewBox="0 0 32 32" width="28" height="28" style={{ transform: `translate(${retainedHidden ? 0 : (visibleGrips[index]?.x ?? point.x)-point.x}px,${retainedHidden ? 0 : (visibleGrips[index]?.y ?? point.y)-point.y}px)`, pointerEvents: 'none' }}><g className="contour-grip-pulse"><g transform={`rotate(${index * 90 + shown.draft.rotationDeg} 16 16)`}><path d={scaling ? 'M9 20V9H20M9 9L23 23' : 'M9 24V13Q9 9 13 9H24'} fill="none" stroke="rgba(36,45,51,.24)" strokeWidth="9" strokeLinecap="round"/><path d={scaling ? 'M9 20V9H20M9 9L23 23' : 'M9 23V13Q9 9 13 9H23'} fill="none" stroke="var(--contour-ink, rgba(255,255,255,.85))" strokeWidth="6" strokeLinecap="round"/></g></g></svg></button>
  return <div data-sticker-editor={shown.source.stickerId} data-editor-phase={shown.phase} data-hud-width={shown.draft.width} data-hud-mode={scaling ? 'scale' : 'rotate'} data-hud-mode-switched={modeSwitched} data-hud-presence={presence.toFixed(3)} data-hud-release={release?.progress ?? 1} inert={state === null} role="group" aria-label="Sticker controls" className="pointer-events-none fixed inset-0 z-40" style={{ opacity: Math.min(1, presence) }} onKeyDown={event => { event.stopPropagation(); if (event.key === 'Escape') { event.preventDefault(); if (deviceStore.get(stickerEditorGestureAtom)) cancel(); else if (dismissStickerTooltip()) { /* Keep the selected sticker. */ } else { const id = shown.source.stickerId; dismissStickerEditor(); document.querySelector<HTMLElement>(`[data-sticker-placed="${id}"]`)?.focus() } } else if (event.key === '[' || event.key === ']') { event.preventDefault();deviceStore.set(tooltipAtom,null); setStickerEditorProperty('width'); previewStickerEdit(shown.draft.width + (event.key === '[' ? -.005 : .005), fit); void applyStickerEditor(place) } else if ((event.metaKey || event.ctrlKey) && event.key === 'z') { event.preventDefault(); void undoStickerEdit(place) } }}>
    <style>{`
      [data-sticker-editor] [aria-disabled=true] { opacity:.35; }
      .contour-glass { background:rgba(255,255,255,.74); border:1px solid rgba(255,255,255,.8); color:#263139; box-shadow:0 2px 12px #0003,inset 0 1px 0 #fff9; }
      [data-sticker-editor]:has([data-hud-scale][aria-pressed=true]) { --contour-ink:rgba(173,221,255,.95); }
      [data-hud-mode=scale] .contour-glass { background:rgba(185,223,250,.80); border-color:rgba(222,243,255,.95); color:#163c58; }
      [data-hud-scale][aria-pressed=true] { background:rgba(93,173,231,.26); color:#124769; box-shadow:inset 0 0 0 1px rgba(63,136,190,.24); }
      [data-hud-mode=scale] [data-hud-wear] .contour-glass > div:last-child { background:rgba(215,240,255,.95); border-color:#e8f7ff; }
      .contour-glass { transition:background-color 160ms ease-out,border-color 160ms ease-out; }
      [data-sticker-contour] path, .contour-grip path { transition:stroke 160ms ease-out; }
      .contour-grip-pulse { transform-box:view-box; transform-origin:16px 16px; }
      [data-hud-mode-switched=true][data-hud-mode=scale] .contour-grip-pulse,
      [data-hud-mode-switched=true][data-hud-mode=scale] [data-hud-tools] svg { animation:contour-mode-scale 240ms ease-out; }
      [data-hud-mode-switched=true][data-hud-mode=rotate] .contour-grip-pulse,
      [data-hud-mode-switched=true][data-hud-mode=rotate] [data-hud-tools] svg { animation:contour-mode-rotate 240ms ease-out; }
      @keyframes contour-mode-scale { 0%{scale:1} 35%{scale:.96} 70%{scale:1.025} 100%{scale:1} }
      @keyframes contour-mode-rotate { 0%{scale:1} 35%{scale:.96} 70%{scale:1.025} 100%{scale:1} }
      @supports (backdrop-filter:blur(12px)) { .contour-glass { backdrop-filter:blur(12px) saturate(1.1); } }
      [data-hud-wear]:focus-within { outline:2px solid white; outline-offset:2px; border-radius:22px; }
      .contour-wear-input { appearance:none; }
      .contour-wear-input::-webkit-slider-thumb { appearance:none; width:32px; height:44px; }
      .contour-wear-input::-moz-range-thumb { width:32px; height:44px; border:0; }
      .contour-grip { filter:drop-shadow(0 2px 3px #0005); }
      .contour-grip:active svg { animation:contour-press 360ms linear both; }
      @keyframes contour-press { 0%{scale:1} 24%{scale:.86} 58%{scale:1.08} 82%{scale:.98} 100%{scale:1} }
      @media (prefers-reduced-transparency:reduce) { .contour-glass { background:#f3f5f6; backdrop-filter:none; } .contour-grip path:last-child { stroke:var(--contour-ink,#fff); } [data-hud-mode=scale] .contour-glass { background:#c7e7ff; } }
      @media (prefers-contrast:more) { .contour-glass { background:#fff; border-color:#263139; } [data-hud-mode=scale] .contour-glass { background:#c7e7ff; border-color:#163c58; } [data-hud-wear]:focus-within { outline:2px solid white; outline-offset:2px; border-radius:22px; }
      .contour-grip { filter:drop-shadow(0 0 1px #000); } }
      @media (prefers-reduced-motion:reduce) { [data-sticker-editor][data-hud-mode-switched] .contour-grip-pulse, [data-sticker-editor][data-hud-mode-switched] [data-hud-tools] svg, .contour-grip:active svg { animation:none; } .contour-glass, [data-sticker-contour] path, .contour-grip path { transition:none; } }
    `}</style>
    <svg data-sticker-contour className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true"><g fill="none" strokeLinejoin="round"><StickerContourPaths shape={shape} /></g></svg>
    <StickerContourGrips points={grips} visible={shape.anchorVisible} pointerOwner={dragVisual?.corner ?? null} focusOwner={focusedCorner} render={handle} />
    <div data-hud-wear className="pointer-events-auto fixed h-11 w-36" style={{ left: arrangement.wear.x, top: arrangement.wear.y, transform: `translateY(${(1 - presence) * 6}px)` }}><div className="contour-glass absolute inset-x-0 top-3 h-5 rounded-full" aria-hidden="true"><div className="absolute inset-x-3 top-[8px] h-[2px] rounded-full bg-[#536675]/20"/><div className="absolute top-[3px] h-3 w-8 rounded-full border border-white/90 bg-white/75 shadow-[0_1px_3px_#0003]" style={{left:(shown.draft.wear??0)*112}}/></div><input ref={range} aria-label="Sticker wear" {...tipEvents('wear', 'Adjust wear')} type="range" className="contour-wear-input relative h-11 w-full cursor-ew-resize opacity-0 focus-visible:opacity-0" min="0" max="1" step=".005" value={shown.draft.wear ?? 0} aria-disabled={shown.phase === 'saving'} onPointerDown={event => { if(shown.phase==='saving'){event.preventDefault();return} deviceStore.set(tooltipAtom, null); setStickerEditorProperty('wear'); deviceStore.set(rangeGestureAtom, 'active'); deviceStore.set(layoutAtom, arrangement); deviceStore.set(stickerEditorGestureAtom, true) }} onPointerUp={() => { const cancelled = deviceStore.get(rangeGestureAtom) === 'cancelled'; deviceStore.set(rangeGestureAtom, null); if (!cancelled) commitKey() }} onPointerCancel={() => { cancel(); deviceStore.set(rangeGestureAtom, null) }} onChange={event => { if(shown.phase==='saving'){deviceStore.set(stickerEditorAtom,current=>current===null?null:{...current});return} if (deviceStore.get(rangeGestureAtom) !== 'cancelled') { setStickerEditorProperty('wear'); previewStickerEdit(Number(event.currentTarget.value)) } else deviceStore.set(stickerEditorAtom, current => current === null ? null : { ...current }) }} onKeyDown={event => { if(shown.phase==='saving'){event.preventDefault();return} if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { deviceStore.set(tooltipAtom,null);setStickerEditorProperty('wear'); deviceStore.set(rangeGestureAtom, null); deviceStore.set(stickerEditorGestureAtom, true) } }} onKeyUp={event => { if (event.key !== 'Escape') commitKey() }}/></div>
    <div data-hud-tools className="contour-glass pointer-events-auto fixed flex rounded-full" style={{ left: arrangement.tools.x, top: arrangement.tools.y, transform: `translateY(${(1 - presence) * 8}px)` }}>
      <button type="button" data-hud-scale className={buttonClass} aria-label="Scale sticker" aria-pressed={scaling} {...tipEvents('scale', scaling ? 'Switch handles back to rotation' : 'Switch handles to scale')} disabled={shown.phase === 'saving' || gesture} onClick={() => { toggleStickerEditorHandleMode(); deviceStore.set(modeSwitchedAtom, true); deviceStore.set(tooltipAtom, null); deviceStore.set(releaseAtom, null) }}><Icon kind="size" /></button>
      <button className={buttonClass} aria-label="Return to pack"  {...tipEvents('return', 'Peel and return to pack')} aria-disabled={shown.phase === 'saving'} onClick={() => { if(shown.phase==='saving')return; deviceStore.set(tooltipAtom, null); dismissStickerEditor(); returnToPack(shown.source.stickerId) }}><Icon kind="pack" /></button>
      <button className={buttonClass} aria-label="Reset wear and straighten" {...tipEvents('reset', 'Reset wear and straighten')} aria-disabled={shown.phase === 'saving'} onClick={() => resetStickerAppearance(place)}><Icon kind="undo" /></button>
    </div>
    {tooltipView}
    {shown.message !== null && tooltip?.text !== shown.message && <span role="status" className="fixed max-w-56 rounded bg-[#242a2e] px-2 py-1 text-[11px] text-white" style={{ left: arrangement.tools.x, top: arrangement.tools.y + 52 }}>{shown.message}</span>}
    {shown.phase === 'saving' && <span role="status" className="fixed rounded bg-[#242a2e] px-2 py-1 text-[11px] text-white" style={{ left: arrangement.tools.x, top: arrangement.tools.y - 24 }}>Saving…</span>}
    {failure?.stickerId === shown.source.stickerId && <div role="alert" className="pointer-events-auto fixed rounded bg-[#242a2e] px-3 text-xs text-white" style={{ left: arrangement.tools.x, top: arrangement.tools.y + 52 }}>{failure.message}{failure.attempted !== undefined && <button className="min-h-11 px-2 underline" {...tipEvents('retry', 'Retry saving this change')} onClick={() => retryStickerEdit(place)}>Retry</button>}</div>}
  </div>
}
