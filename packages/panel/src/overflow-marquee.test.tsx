import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { OverflowMarquee } from './overflow-marquee'

GlobalRegistrator.register()
Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true })

let container: HTMLDivElement
let root: Root
let geometryReads = 0
let originalClientWidth: PropertyDescriptor | undefined
let originalScrollWidth: PropertyDescriptor | undefined

beforeAll(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  originalClientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  originalScrollWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollWidth')
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { geometryReads++; return this.classList.contains('wp-marquee') ? 60 : 0 } })
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { geometryReads++; return this.classList.contains('wp-marquee__moving') ? 140 : 0 } })
})

afterAll(async () => {
  await act(async () => root.unmount())
  container.remove()
  if (originalClientWidth !== undefined) Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidth)
  if (originalScrollWidth !== undefined) Object.defineProperty(HTMLElement.prototype, 'scrollWidth', originalScrollWidth)
  GlobalRegistrator.unregister()
})

describe('overflow marquee', () => {
  test('measures only active overflow and records a transform distance', async () => {
    await act(async () => root.render(<OverflowMarquee text="A title wider than its window" active />))
    const marquee = container.querySelector<HTMLElement>('.wp-marquee')
    expect(marquee?.dataset['overflow']).toBe('true')
    expect(marquee?.style.getPropertyValue('--wp-marquee-distance')).toBe('80px')

    const before = geometryReads
    await act(async () => root.render(<OverflowMarquee text="A title wider than its window" active={false} />))
    expect(geometryReads).toBe(before)
    expect(container.querySelector<HTMLElement>('.wp-marquee')?.dataset['overflow']).toBe('false')
  })
})
