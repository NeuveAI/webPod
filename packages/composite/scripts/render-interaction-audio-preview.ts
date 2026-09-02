import { chromium } from '@playwright/test'

const route = process.env['WEBPOD_PREVIEW_URL'] ?? 'http://localhost:3000/_spike/device'
const modulePath = new URL('../src/web-audio-backend.ts', import.meta.url).pathname
const moduleUrl = `/@fs${modulePath}`
const outputPath = process.argv[2]
if (outputPath === undefined) throw new Error('Provide an output WAV path.')

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  await page.goto(route, { waitUntil: 'domcontentloaded' })
  const rendered = await page.evaluate(async (previewModuleUrl) => {
    const previewModule = await import(/* @vite-ignore */ previewModuleUrl)
    const wav: ArrayBuffer = await previewModule.renderInteractionAudioPreviewWav()
    const bytes = new Uint8Array(wav)
    let binary = ''
    const chunkSize = 0x8000
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
    }
    return {
      encoded: btoa(binary),
      timeline: previewModule.interactionAudioPreviewTimeline(),
    }
  }, moduleUrl)
  const bytes = Uint8Array.from(Buffer.from(rendered.encoded, 'base64'))
  await Bun.write(outputPath, bytes)
  const timelinePath = outputPath.replace(/\.wav$/i, '') + '.json'
  await Bun.write(
    timelinePath,
    JSON.stringify({
      source: 'production procedural interaction graph',
      reference: '/Users/vinicius/Downloads/clickwheel-sounds.m4a',
      cues: rendered.timeline,
    }, null, 2) + '\n',
  )
  const sha256 = new Bun.CryptoHasher('sha256').update(bytes).digest('hex')
  process.stdout.write(JSON.stringify({
    output: outputPath,
    timeline: timelinePath,
    bytes: bytes.length,
    sha256,
  }) + '\n')
} finally {
  await browser.close()
}
