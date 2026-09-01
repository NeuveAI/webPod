import { chromium } from '@playwright/test'

const route = process.env['WEBPOD_PREVIEW_URL'] ?? 'http://localhost:3000/_spike/device'
const modulePath = new URL('../src/web-audio-backend.ts', import.meta.url).pathname
const moduleUrl = `/@fs${modulePath}`
const outputUrl = new URL(
  '../../../docs/workstreams/002-implementation-spine/evidence/' +
    'w9b-interaction-audio-preview.wav',
  import.meta.url,
)

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  const encoded = await page.evaluate(async (previewModuleUrl) => {
    const previewModule = await import(/* @vite-ignore */ previewModuleUrl)
    const wav: ArrayBuffer = await previewModule.renderInteractionAudioPreviewWav()
    const bytes = new Uint8Array(wav)
    let binary = ''
    const chunkSize = 0x8000
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
    }
    return btoa(binary)
  }, moduleUrl)
  const bytes = Uint8Array.from(Buffer.from(encoded, 'base64'))
  await Bun.write(outputUrl, bytes)
  const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  process.stdout.write(JSON.stringify({
    output: outputUrl.pathname,
    bytes: bytes.length,
    sha256,
  }) + '\n')
} finally {
  await browser.close()
}
