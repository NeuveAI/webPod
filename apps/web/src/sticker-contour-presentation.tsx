import { useLayoutEffect, useMemo, type ReactNode } from 'react'
import { atom, useAtomValue } from 'jotai'
import { deviceStore } from '@webpod/state'
import type { StickerProjectedContour, StickerScreenPoint } from '@webpod/device'

/** Occlusion cuts are open strokes, never synthetic segments across the shell. */
export function StickerContourPaths({ shape }: { readonly shape: StickerProjectedContour }) {
  return shape.paths.map((path, index) => <path key={index} d={`M${path.map(point => `${point.x},${point.y}`).join('L')}${shape.closed?.[index] === false ? '' : 'Z'}`} stroke="var(--contour-ink, rgba(255,255,255,.85))" strokeWidth="1" />)
}

type GripRenderer = (point: StickerScreenPoint, index: number, retainedHidden: boolean) => ReactNode
function ContourGrip({ point, index, visible, pointerOwner, focusOwner, render }: {
  readonly point: StickerScreenPoint; readonly index: number; readonly visible: boolean
  readonly pointerOwner: boolean; readonly focusOwner: boolean; readonly render: GripRenderer
}) {
  const lastVisibleAtom = useMemo(() => atom<StickerScreenPoint | null>(null), [])
  const lastVisible = useAtomValue(lastVisibleAtom, { store: deviceStore })
  useLayoutEffect(() => { if (visible) deviceStore.set(lastVisibleAtom, point) }, [lastVisibleAtom, point, visible])
  if (!visible && !pointerOwner && !focusOwner) return null
  // A focused grip stays at its last visible position. Captured grips follow the pointer.
  return render(visible || pointerOwner ? point : lastVisible ?? point, index, !visible)
}
/** An admitted owner survives occlusion; hidden idle anchors have no target. */
export function StickerContourGrips({ points, visible, pointerOwner = null, focusOwner = null, render }: {
  readonly points: readonly StickerScreenPoint[]
  readonly visible: StickerProjectedContour['anchorVisible']
  readonly pointerOwner?: number | null
  readonly focusOwner?: number | null
  readonly render: GripRenderer
}) {
  return points.map((point, index) => <ContourGrip key={index} point={point} index={index} visible={visible?.[index] !== false} pointerOwner={pointerOwner === index} focusOwner={focusOwner === index} render={render} />)
}
