import { chromium, type Page } from '/Users/vinicius/code/webPod/node_modules/@playwright/test/index.mjs'
async function installDeterministicAppleMusic(page: Page): Promise<void> {
  await page.route('**/artwork?*', async (route) => route.fulfill({path:'/Users/vinicius/code/webPod/docs/workstreams/006-aqua-interface-parity/evidence/cover-crop.png',contentType:'image/png'}))
  await page.route('**/api/apple/developer-token', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ token: 'browser-proof-token', expiresAt: 4_102_444_800 }),
  }))
  await page.addInitScript(() => {
    type Listener = (event: unknown) => void
    type Resource = { readonly id: string; readonly type: string; readonly attributes: Readonly<Record<string, unknown>> }
    const listeners = new Map<string, Set<Listener>>()
    const tracks: readonly Resource[] = Array.from({ length: 11 }, (_, index) => ({
      id: `library-song-${String(index + 1)}`,
      type: 'library-songs',
      attributes: {
        name: index === 0 ? 'A Deliberately Spacious Track Title' : `Reference Track ${String(index + 1)}`,
        artistName: 'Reference Artist',
        artwork: {url:'https://reference.invalid/{w}x{h}.png',width:512,height:512},
        albumName: 'Reference Album',
        durationInMillis: 246_000 + index * 1_000,
        playable: true,
        playParams: { globalId: `catalog-song-${String(index + 1)}` },
      },
    }))
    const collections: Readonly<Record<string, readonly Resource[]>> = {
      playlists: [{ id: 'library-playlist-1', type: 'library-playlists', attributes: { name: 'Reference Playlist', trackCount: 11, canEdit: true, playParams: { globalId: 'catalog-playlist-1' } } }],
      artists: [{ id: 'library-artist-1', type: 'library-artists', attributes: { name: 'Reference Artist', playParams: { globalId: 'catalog-artist-1' } } }],
      albums: [{ id: 'library-album-1', type: 'library-albums', attributes: { name: 'Reference Album', artistName: 'Reference Artist', trackCount: 11, releaseDate: '2005-10-12', playParams: { globalId: 'catalog-album-1' } } }],
      songs: tracks,
    }
    const queue = { items: [] as readonly Resource[], position: 0 }
    const music = {
      api: {
        async music(path: string) {
          const collection = path.match(/^\/v1\/me\/library\/(playlists|artists|albums|songs)$/u)?.[1]
          if (collection !== undefined) return { data: collections[collection] ?? [], meta: { total: collections[collection]?.length ?? 0 } }
          if (path === '/v1/me/library/albums/library-album-1/tracks') return { data: tracks }
          if (path === '/v1/catalog/us/stations') return { data: [] }
          return { data: [] }
        },
        async search() { return { data: { results: {} } } },
        async artistRelationship() { return { data: [] } },
        async playlistRelationship() { return { data: [] } },
        async songRelationship() { return { data: [] } },
        async station() { return { data: [] } },
        async stations() { return { data: [] } },
      },
      isAuthorized: true,
      storefrontId: 'us',
      playbackState: 0,
      currentPlaybackTime: 0,
      currentPlaybackDuration: 0,
      nowPlayingItem: null as Resource | null,
      queue,
      volume: 1,
      shuffleMode: 0,
      repeatMode: 0,
      async authorize() { return 'browser-proof-user' },
      async unauthorize() {},
      async setQueue(options: Readonly<Record<string, unknown>>) {
        const songs = Array.isArray(options['songs']) ? options['songs'] : []
        queue.items = tracks.filter((track) => songs.includes(track.attributes['playParams'] instanceof Object ? (track.attributes['playParams'] as { globalId?: string }).globalId : undefined))
        queue.position = typeof options['startPosition'] === 'number' ? options['startPosition'] : 0
        music.nowPlayingItem = queue.items[queue.position] ?? null
        return queue
      },
      async play() { await new Promise<void>(() => undefined) },
      async pause() {},
      async skipToNextItem() {},
      async skipToPreviousItem() {},
      async seekToTime() {},
      async playLater() {},
      async playNext() {},
      addEventListener(name: string, listener: Listener) {
        const entries = listeners.get(name) ?? new Set<Listener>()
        entries.add(listener)
        listeners.set(name, entries)
      },
      removeEventListener(name: string, listener: Listener) { listeners.get(name)?.delete(listener) },
      __emit(name: string) { for (const listener of listeners.get(name) ?? []) listener({ type: name }) },
    }
    ;(globalThis as typeof globalThis & { MusicKit?: unknown }).MusicKit = {
      async configure() { return music },
      getInstance() { return music },
      PlaybackStates: { none: 0, loading: 1, paused: 2, playing: 3, waiting: 8 },
      PlayerShuffleMode: { off: 0, songs: 1, albums: 2 },
      PlayerRepeatMode: { off: 0, one: 1, all: 2 },
    }
  })
}

async function repaintComposite(page: Page): Promise<void> {
  await page.locator('.wp-panel').evaluate((panel) => {
    const source = panel.closest('canvas')
    if (source === null || !('requestPaint' in source)) throw new Error('production panel raster cannot request paint')
    const requestPaint = Reflect.get(source, 'requestPaint')
    if (typeof requestPaint !== 'function') throw new Error('production panel requestPaint is not callable')
    Reflect.apply(requestPaint, source, [])
  })
  await page.evaluate(() => new Promise<void>((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()))))
}

const freezeVisuals = (page: Page) => page.addStyleTag({
  content: '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
})


const dir='/Users/vinicius/code/webPod/docs/workstreams/006-aqua-interface-parity/evidence'
const phase=process.argv[2] ?? 'after'
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-blink-features=CanvasDrawElement']})
for (const size of [{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}]) {
for (const theme of ['white','black']) {
const page=await browser.newPage({viewport:size})
await installDeterministicAppleMusic(page)
await page.goto('http://localhost:3000/_spike/device?capture=&view=front&colourway='+theme)
const panel=page.locator('.wp-panel')
await panel.waitFor({state:'attached'})
await freezeVisuals(page)
await panel.focus()
await panel.press('Enter')
await page.waitForTimeout(100)
await panel.press('Enter')
await page.waitForTimeout(100)
await repaintComposite(page)
await page.screenshot({path:dir+'/'+phase+'-'+size.name+'-'+theme+'-list.png'})
if(phase==='after') {
  const box=await panel.boundingBox()
  if(box) await page.screenshot({path:dir+'/'+phase+'-'+size.name+'-'+theme+'-lcd-list.png',clip:box})
  await page.evaluate(()=>{const music=Reflect.get(globalThis,'MusicKit').getInstance();music.playbackState=1;music.__emit('playbackStateDidChange')})
}
await panel.press('Enter')
await page.waitForTimeout(100)
if(phase==='after') { await panel.locator('[data-playback-indeterminate="true"]').waitFor({state:'attached'}); await repaintComposite(page); await page.screenshot({path:dir+'/'+phase+'-'+size.name+'-'+theme+'-loading.png'}) }
await page.evaluate(()=>{
const music=Reflect.get(globalThis,'MusicKit').getInstance()
music.playbackState=3
music.currentPlaybackTime=87
music.currentPlaybackDuration=246
music.__emit('playbackStateDidChange')
music.__emit('playbackTimeDidChange')
})
await page.waitForTimeout(100)
await repaintComposite(page)
await page.screenshot({path:dir+'/'+phase+'-'+size.name+'-'+theme+'-now.png'})
if(phase==='after') {
  const art=panel.locator('img[data-provider-artwork]')
  await art.waitFor({state:'attached'})
  await art.evaluate((image)=>image instanceof HTMLImageElement ? image.decode() : Promise.resolve())
  await repaintComposite(page)
  await page.screenshot({path:dir+'/'+phase+'-'+size.name+'-'+theme+'-now.png'})
  const box=await panel.boundingBox()
  if(box) await page.screenshot({path:dir+'/'+phase+'-'+size.name+'-'+theme+'-lcd-now.png',clip:box})
  await panel.press('ArrowUp')
  await panel.locator('.wp-volume-feedback').waitFor({state:'attached'})
  await repaintComposite(page)
  await page.screenshot({path:dir+'/'+phase+'-'+size.name+'-'+theme+'-volume.png'})
  for(const mode of ['scrub','artwork','queue']) {
    await panel.press('Enter'); await page.waitForTimeout(100); await repaintComposite(page)
    await page.screenshot({path:dir+'/'+phase+'-'+size.name+'-'+theme+'-'+mode+'.png'})
  }
}
console.log(phase,size.name,theme,await panel.getAttribute('data-screen'))
await page.close()
}}
if(phase==='after') {
const page=await browser.newPage({viewport:{width:1440,height:900}})
await page.route('**/api/apple/developer-token', route=>route.fulfill({status:503,body:'Unavailable'}))
await page.goto('http://localhost:3000/_spike/device?capture=&view=front&colourway=white')
await page.locator('.wp-panel[data-screen="S27"]').waitFor({state:'attached'})
await repaintComposite(page)
await page.screenshot({path:dir+'/after-desktop-white-provider-error.png'})
await page.close()
}
await browser.close()
