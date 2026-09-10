import { randomUUID } from 'node:crypto'

// Start loads Vite config separately for client and server. One launcher-owned
// value survives both evaluations, while every build (including dirty trees)
// gets a fresh identity. Only this opaque UUID is compiled into the application.
const build = Bun.spawn([process.execPath, 'node_modules/vite/bin/vite.js', 'build'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, WEBPOD_BUILD_ID: randomUUID() },
  stdin: 'inherit', stdout: 'inherit', stderr: 'inherit',
})
process.exit(await build.exited)
