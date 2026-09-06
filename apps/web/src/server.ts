import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
export { disposeStickerServer } from './server/sticker-runtime.server'

export default createServerEntry({ fetch: (request, options) => handler.fetch(request, options) })
