import { expect, spyOn, test } from 'bun:test'
import { requestHandler } from '@tanstack/react-start/server'

test('Start classifies exact request cancellation but preserves independent failures during cancellation', async () => {
  const controller = new AbortController(); const cancelled = new DOMException('Disconnected', 'AbortError')
  controller.abort(cancelled)
  const request = new Request('http://local.invalid/', { signal: controller.signal })
  const logged = spyOn(console, 'error').mockImplementation(() => undefined)
  try {
    const expected = requestHandler(async () => { throw request.signal.reason })
    expect((await expected(request, {})).status).toBe(499)
    expect(logged).not.toHaveBeenCalled()
    const independent = requestHandler(async () => { throw new Error('Synthetic independent failure') })
    expect((await independent(request, {})).status).toBe(500)
    expect(logged).toHaveBeenCalledTimes(1)
    const sameName = requestHandler(async () => { throw new DOMException('Different cancellation', 'AbortError') })
    expect((await sameName(request, {})).status).toBe(500)
    expect(logged).toHaveBeenCalledTimes(2)
    const unconnected = requestHandler(async () => { throw cancelled })
    expect((await unconnected(new Request('http://local.invalid/'), {})).status).toBe(500)
    expect(logged).toHaveBeenCalledTimes(3)
  } finally { logged.mockRestore() }
})
