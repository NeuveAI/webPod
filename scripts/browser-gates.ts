const root = process.cwd()
const config = 'apps/web/tests/playwright.config.ts'
const args = ['bun', 'packages/panel/node_modules/@playwright/test/cli.js', 'test', '--config', config]
const evidenceDir = `${root}/docs/workstreams/002-implementation-spine/evidence/w5b-browser`

console.log('W5b browser gates — flag-off baseline')
console.log(`command: ${args.join(' ')}`)

const child = Bun.spawn(args, { cwd: root, stdout: 'inherit', stderr: 'inherit', env: { ...process.env, W5B_EVIDENCE_DIR: evidenceDir } })
const exitCode = await child.exited

console.log('\nMANUAL U14 — owner-only phone-in-hand thumb-occlusion validation; not cleared by automation')
console.log('MANUAL U15 — reviewer-only structural inspection that unsupported controls are absent; not cleared by automation')

if (exitCode !== 0) process.exit(exitCode)
