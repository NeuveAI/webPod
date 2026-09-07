import { expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { act } from 'react'
import { createRequire } from 'node:module'
import type { StickerProjectedContour } from '@webpod/device'
import { StickerContourGrips, StickerContourPaths } from './sticker-contour-presentation'

const points = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }, { x: 7, y: 8 }] as const
const shape: StickerProjectedContour = { paths: [points, points], anchors: points, center: { x: 4, y: 5 } }
test('occluded spans stay open while ordinary contour defaults remain closed', () => {
  const markup = renderToStaticMarkup(<svg><StickerContourPaths shape={{ ...shape, closed: [false, true] }} /></svg>)
  expect(markup).toContain('d="M1,2L3,4L5,6L7,8"')
  expect(markup).toContain('d="M1,2L3,4L5,6L7,8Z"')
  const ordinary = renderToStaticMarkup(<svg><StickerContourPaths shape={shape} /></svg>)
  expect(ordinary.match(/L7,8Z/g)).toHaveLength(2)
})
test('hidden material grips produce no hit target or focus stop; visible grips retain their original indices', () => {
  const render = (_point: unknown, index: number) => <button key={index} data-corner={index} aria-label={`Rotate corner ${index}`} />
  const markup = renderToStaticMarkup(<StickerContourGrips points={points} visible={[false, true, false, true]} render={render} />)
  expect(markup).not.toContain('data-corner="0"')
  expect(markup).not.toContain('data-corner="2"')
  expect(markup).toContain('data-corner="1"')
  expect(markup).toContain('data-corner="3"')
  expect(markup).not.toContain('tabindex="-1"')
  expect(renderToStaticMarkup(<StickerContourGrips points={points} visible={undefined} render={render} />).match(/<button/g)).toHaveLength(4)
})

test('visibility transitions retain the admitted DOM owner through pointer release and keyboard blur', async () => {
  // Reuse the workspace's existing DOM test runtime, without adding a product dependency.
  const require = createRequire(new URL('../../../packages/composite/package.json', import.meta.url))
  const { GlobalRegistrator } = require('@happy-dom/global-registrator') as { GlobalRegistrator: { register(): void; unregister(): void } }
  GlobalRegistrator.register()
  const previousAct = Object.getOwnPropertyDescriptor(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, value: true })
  const { createRoot } = await import('react-dom/client')
  const container = document.createElement('div'); document.body.append(container)
  const root = createRoot(container)
  let pointerOwner: number | null = null, focusOwner: number | null = null, releases = 0, keyUps = 0
  let visible: readonly [boolean, boolean, boolean, boolean] = [true, true, true, true]
  let positions: readonly { x: number; y: number }[] = points
  const render = (point: { x: number; y: number }, index: number, retainedHidden: boolean) => <button key={index} data-corner={index} data-x={point.x} tabIndex={retainedHidden ? -1 : 0} style={{ pointerEvents: retainedHidden ? 'none' : undefined }} onFocus={() => { focusOwner = index }} onBlur={() => { focusOwner = null }} onPointerUp={() => { releases++; pointerOwner = null }} onKeyUp={() => { keyUps++ }} />
  const draw = async () => act(async () => root.render(<StickerContourGrips points={positions} visible={visible} pointerOwner={pointerOwner} focusOwner={focusOwner} render={render} />))
  try {
    await draw()
    const pointerButton = container.querySelector<HTMLButtonElement>('[data-corner="0"]')
    if (pointerButton === null) throw new Error('Missing initial grip')
    pointerOwner = 0; visible = [false, true, true, true]; positions = [{ x: 99, y: 100 }, ...points.slice(1)]
    await draw()
    expect(container.querySelector('[data-corner="0"]')).toBe(pointerButton)
    expect(pointerButton.isConnected).toBe(true)
    expect(pointerButton.style.pointerEvents).toBe('none')
    expect(pointerButton.tabIndex).toBe(-1)
    expect(pointerButton.dataset.x).toBe('99')
    await act(async () => pointerButton.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7 })))
    await draw(); expect(releases).toBe(1); expect(container.querySelector('[data-corner="0"]')).toBeNull()

    const keyboardButton = container.querySelector<HTMLButtonElement>('[data-corner="1"]')
    if (keyboardButton === null) throw new Error('Missing keyboard grip')
    await act(async () => keyboardButton.focus())
    visible = [false, false, true, true]; positions = [{ x: 99, y: 100 }, { x: 300, y: 400 }, ...points.slice(2)]
    await draw()
    expect(document.activeElement).toBe(keyboardButton)
    expect(container.querySelector('[data-corner="1"]')).toBe(keyboardButton)
    expect(keyboardButton.dataset.x).toBe('3') // Last visible coordinate, not a point behind the shell.
    expect(keyboardButton.tabIndex).toBe(-1)
    await act(async () => keyboardButton.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'ArrowRight' })))
    expect(keyUps).toBe(1)
    const next = container.querySelector<HTMLButtonElement>('[data-corner="2"]')
    if (next === null) throw new Error('Missing next visible grip')
    await act(async () => next.focus()); await draw()
    expect(container.querySelector('[data-corner="1"]')).toBeNull()
    expect(document.activeElement).toBe(next)
  } finally {
    await act(async () => root.unmount()); container.remove()
    if (previousAct === undefined) Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT'); else Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', previousAct)
    GlobalRegistrator.unregister()
  }
})
