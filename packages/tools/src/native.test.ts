import { expect, test } from 'bun:test'
import { delay, registerTools, tool, type RegisteredNativeTool } from './native'

for (const options of [undefined, {}]) {
  test(`native execution tolerates ${options === undefined ? 'missing options' : 'missing signal'} and remains abortable on disposal`, async () => {
    const registered: RegisteredNativeTool[] = []
    const mount = registerTools({ registerTool: async (definition) => { registered.push(definition); return undefined } }, [
      tool('status', 'Read status', {}, async (input, { signal }) => {
        expect(signal).toBeInstanceOf(AbortSignal)
        signal.throwIfAborted()
        return { input }
      }),
      tool('pending', 'Wait for cancellation', {}, async (_input, { signal }) => {
        await delay(60_000, signal)
        return {}
      }),
    ])
    await mount.ready
    const [status, pending] = registered
    if (status === undefined || pending === undefined) throw new Error('Missing registered tools')
    try {
      expect(await status.execute({ value: 42 }, options)).toEqual({ input: { value: 42 } })
      const execution = pending.execute({}, options)
      const rejected = execution.catch((error: unknown) => error)
      mount.dispose()
      expect(await rejected).toBeInstanceOf(DOMException)
      await expect(status.execute({}, options)).rejects.toThrow()
    } finally { mount.dispose() }
  })
}

test('native execution preserves caller cancellation without disposing other tools', async () => {
  const registered: RegisteredNativeTool[] = []
  const mount = registerTools({ registerTool: async (definition) => { registered.push(definition); return undefined } }, [
    tool('pending', 'Wait for cancellation', {}, async (_input, { signal }) => {
      await delay(60_000, signal)
      return {}
    }),
    tool('status', 'Read status', {}, async () => ({ ready: true })),
  ])
  await mount.ready
  const [pending, status] = registered
  if (pending === undefined || status === undefined) throw new Error('Missing registered tools')
  try {
    const controller = new AbortController()
    const execution = pending.execute({}, { signal: controller.signal })
    const rejected = execution.catch((error: unknown) => error)
    controller.abort(new Error('Caller cancelled'))
    expect(await rejected).toEqual(new Error('Caller cancelled'))
    expect(await status.execute({})).toEqual({ ready: true })
  } finally { mount.dispose() }
})
