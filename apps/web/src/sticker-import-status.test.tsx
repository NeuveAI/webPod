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
    expect(html).toContain('We synced a sample of your Apple Music library')
    expect(html).toContain('Keep listening in webPod to earn more')
    expect(html).not.toContain('starter pack')
    expect(html).not.toContain('could not sync')
    expect(html).not.toContain('Retry')
    expect(retryButton(view)).toBeUndefined()
  })
  test('failed sync preserves the safe inventory message and invokes the current retry command', () => {
    let oldCalls = 0, currentCalls = 0
    const previous = StickerImportStatus({ status: 'failed', retry: () => { oldCalls++ } })
    const currentRetry = () => { currentCalls++ }
    const current = StickerImportStatus({ status: 'failed', retry: currentRetry })
    const html = renderToStaticMarkup(current)
    expect(html).toContain('Some Apple Music data could not sync')
    expect(html).toContain('Your earned stickers are safe')
    expect(html).toContain('Retry sync')
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
