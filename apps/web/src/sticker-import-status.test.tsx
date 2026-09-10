import { describe, expect, test } from 'bun:test'
import { Children, isValidElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { StickerImportStatus } from './sticker-collection'

function retryButton(node: ReactNode): { onClick?: () => void } | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue
    if (child.type === 'button' && isValidElement<{ onClick?: () => void }>(child)) return child.props
    const found = retryButton(child.props.children)
    if (found !== undefined) return found
  }
  return undefined
}

describe('sticker import status', () => {
  test('partial sampling does not add a visible routine notice or retry', () => {
    const view = StickerImportStatus({ status: 'partial', retry: () => { throw new Error('Sampling must not offer retry') } })
    const html = renderToStaticMarkup(view)
    expect(html).toBe('')
    expect(retryButton(view)).toBeUndefined()
  })
  test('failed sync preserves the safe inventory message and invokes the current retry command', () => {
    let oldCalls = 0, currentCalls = 0
    const previous = StickerImportStatus({ status: 'failed', retry: () => { oldCalls++ } })
    const currentRetry = () => { currentCalls++ }
    const current = StickerImportStatus({ status: 'failed', retry: currentRetry, usable: true })
    const html = renderToStaticMarkup(current)
    expect(html).toContain('Library sync paused.')
    expect(html).toContain('Try again')
    expect(html).not.toContain('We synced a sample')
    expect(retryButton(previous)).toBeDefined()
    const button = retryButton(current)
    expect(button?.onClick).toBe(currentRetry)
    button?.onClick?.()
    expect(currentCalls).toBe(1)
    expect(oldCalls).toBe(0)
  })
  test('signed-out failed sync offers an explicit authorization gesture instead of a no-op retry', () => {
    let connected = 0
    const connect = () => { connected++ }
    const view = StickerImportStatus({ status: 'failed', usable: true, connect, retry: () => { throw new Error('Signed-out sync must authorize first') } })
    const html = renderToStaticMarkup(view)
    expect(html).toContain('Sign in to Apple Music')
    expect(html).not.toContain('Try again')
    expect(html).toContain('Library sync paused.')
    expect(retryButton(view)?.onClick).toBe(connect)
    retryButton(view)?.onClick?.()
    expect(connected).toBe(1)
  })
  for (const status of ['complete', 'pending', undefined] as const) {
    test(`${String(status)} does not show an import warning`, () => {
      expect(renderToStaticMarkup(<StickerImportStatus status={status} retry={() => {}} />)).toBe('')
    })
  }
})
