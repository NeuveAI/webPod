import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

import { fingerprintBrowserSources } from '../../scripts/browser-source-fingerprint.ts'

function sourceIdentityHealth(): Plugin {
  return {
    name: 'webpod-source-identity-health',
    apply: 'serve',
    configureServer(server) {
      const expected = process.env['W5B_EXPECTED_SOURCE_FINGERPRINT']
      const expectedFileCount = Number(process.env['W5B_EXPECTED_SOURCE_FILE_COUNT'])
      if (expected === undefined) return
      server.middlewares.use('/__webpod_health', (_request, response) => {
        const current = fingerprintBrowserSources()
        response.statusCode = 200
        response.setHeader('cache-control', 'no-store')
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ expected, current: current.digest, expectedFileCount, fileCount: current.fileCount }))
      })
    },
  }
}

export default defineConfig({
  server: { port: 3000 },
  resolve: { tsconfigPaths: true },
  plugins: [sourceIdentityHealth(), tailwindcss(), tanstackStart({ srcDirectory: 'src' }), viteReact()],
})
