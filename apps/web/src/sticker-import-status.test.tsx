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
  test('partial sampling explains earning without presenting a failed sync or retry', () => {
    const view = StickerImportStatus({ status: 'partial', retry: () => { throw new Error('Sampling must not offer retry') } })
    const html = renderToStaticMarkup(view)
    expect(html).toContain('role="status"')
    expect(html).toContain('Part of your library is synced.')
    expect(html).toContain('Listening in webPod earns more stickers.')
    expect(html).not.toContain('starter pack')
    expect(html).not.toContain('could not sync')
    expect(html).not.toContain('Retry')
    expect(retryButton(view)).toBeUndefined()
  })
  test('failed sync preserves the safe inventory message and invokes the current retry command', () => {
    let oldCalls = 0, currentCalls = 0
    const previous = StickerImportStatus({ status: 'failed', retry: () => { oldCalls++ } })
    const currentRetry = () => { currentCalls++ }
    const current = StickerImportStatus({ status: 'failed', retry: currentRetry, usable: true })
    const html = renderToStaticMarkup(current)
    expect(html).toContain('Library sync paused.')
    expect(html).toContain('Your stickers are still here.')
    expect(html).toContain('Try again')
    expect(html).not.toContain('We synced a sample')
    expect(retryButton(previous)).toBeDefined()
    const button = retryButton(current)
    expect(button?.onClick).toBe(currentRetry)
    button?.onClick?.()
    expect(currentCalls).toBe(1)
    expect(oldCalls).toBe(0)
  })
  for (const status of ['complete', 'pending', undefined] as const) {
    test(`${String(status)} does not show an import warning`, () => {
      expect(renderToStaticMarkup(<StickerImportStatus status={status} retry={() => {}} />)).toBe('')
    })
  }
})
