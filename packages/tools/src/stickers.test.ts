import { describe, expect, test } from 'bun:test'
import { createStore } from 'jotai/vanilla'
import { createInteractionTools } from './interactions'
import { createInteractionMutation, createStickerTools, type StickerToolControls } from './stickers'

function fixture() {
  const calls: unknown[] = []
  const controls: StickerToolControls = {
    list: () => ({ count: 60 }),
    open: async () => { calls.push('open'); return {} }, close: async () => { calls.push('close'); return {} },
    navigate: async direction => { calls.push(direction); return {} },
    grab: async (id, source) => { calls.push([id, source]); return {} }, release: async () => { calls.push('release'); return {} },
    scale: async percent => { calls.push(percent); return {} },
    rotate: async degrees => { calls.push(degrees); return {} }, wear: async amount => { calls.push(amount); return {} }, place: async (x, y) => { calls.push([x, y]); return {} },
  }
  const tools = createStickerTools(() => controls)
  const execute = (suffix: string, input: unknown) => {
    const entry = tools.find(tool => tool.name === `webpod_${suffix}`)
    if (entry === undefined) throw new Error('Missing tool')
    return entry.execute(input, { signal: new AbortController().signal })
  }
  return { calls, tools, controls, execute }
}
describe('native sticker tool contracts', () => {
  test('ten discoverable tools route to live controls with accurate read hints', async () => {
    const f = fixture()
    expect(new Set(f.tools.map(tool => tool.name)).size).toBe(10)
    expect(f.tools.filter(tool => tool.annotations.readOnlyHint).map(tool => tool.name)).toEqual(['webpod_sticker_list'])
    for (const tool of f.tools) expect(tool.inputSchema['additionalProperties']).toBe(false)
    await f.execute('open_sticker_pack', {}); await f.execute('close_sticker_pack', {}); await f.execute('navigate_sticker_collection', { direction: 'previous' })
    expect(await f.execute('sticker_list', {})).toEqual({ count: 60 })
    await f.execute('get_sticker', { stickerId: 'PW-A01', source: 'placed' }); await f.execute('release_sticker', {})
    await f.execute('scale_sticker', { percent: 45 }); await f.execute('rotate_sticker', { degrees: -90 }); await f.execute('add_sticker_wear', { amount: .2 }); await f.execute('place_sticker', { x: .5, y: .2 })
    expect(f.calls).toEqual(['open', 'close', 'previous', ['PW-A01', 'placed'], 'release', 45, -90, .2, [.5, .2]])
  })
  test('runtime rejects malformed fields, nonfinite values and range errors before invoking', async () => {
    const f = fixture()
    for (const [name, input] of [['open_sticker_pack', { extra: 1 }], ['sticker_list', null], ['get_sticker', { stickerId: '', source: 'placed' }], ['get_sticker', { stickerId: 'PW-A01', source: 'other' }], ['navigate_sticker_collection', { direction: 'back' }], ['scale_sticker', { percent: Infinity }], ['scale_sticker', { percent: -101 }], ['scale_sticker', { percent: 10001 }], ['scale_sticker', { percent: '45' }], ['scale_sticker', {}], ['rotate_sticker', { degrees: Infinity }], ['rotate_sticker', { degrees: 361 }], ['add_sticker_wear', { amount: -.1 }], ['add_sticker_wear', { amount: NaN }], ['add_sticker_wear', { amount: 2 }], ['place_sticker', { x: -1, y: .5 }], ['place_sticker', { x: .5 }]] as const) await expect(f.execute(name, input)).rejects.toThrow()
    expect(f.calls).toEqual([])
  })
  test('cross-family lease rejects concurrent mutations but allows reads and releases after abort', async () => {
    const f = fixture(), mutation = createInteractionMutation(), controller = new AbortController()
    let finish: (() => void) | undefined
    f.controls.open = async signal => new Promise((resolve, reject) => { finish = () => resolve({}); signal.addEventListener('abort', () => reject(signal.reason), { once: true }) })
    const stickers = createStickerTools(() => f.controls, mutation)
    const core = createInteractionTools({ setVolume: async level => level, store: createStore(), mutation, pageState: () => ({ interactionReady: true, status: 'ready' }), press: async () => true, rotate: () => ({}), flick: async () => ({}) })
    const open = stickers.find(tool => tool.name === 'webpod_open_sticker_pack'), rotate = core.find(tool => tool.name === 'webpod_rotate_ipod'), list = stickers.find(tool => tool.name === 'webpod_sticker_list')
    if (open === undefined || rotate === undefined || list === undefined) throw new Error('Missing fixture tools')
    const pending = open.execute({}, { signal: controller.signal })
    await expect(rotate.execute({ xDeg: 0, yDeg: 20 }, { signal: controller.signal })).rejects.toThrow('Another device')
    expect(await list.execute({}, { signal: controller.signal })).toEqual({ count: 60 })
    controller.abort(); await expect(pending).rejects.toThrow(); finish?.()
    await expect(rotate.execute({ xDeg: 0, yDeg: 20 }, { signal: new AbortController().signal })).resolves.toEqual({})
  })
})


test('native sticker execution returns actionable domain failures instead of throwing opaque browser errors', async () => {
  const f = fixture()
  f.controls.grab = async () => { throw new Error('Unknown sticker identifier. Call webpod_sticker_list and use an exact item id.') }
  expect(await f.execute('get_sticker', { stickerId: 'rockstar', source: 'collection' })).toMatchObject({ ok: false, error: { code: 'STICKER_ACTION_FAILED', message: expect.stringContaining('exact item id'), hint: expect.stringContaining('webpod_sticker_list') } })
})
