const root = process.cwd()
const config = 'apps/web/tests/playwright.config.ts'
const args = ['bun', 'packages/panel/node_modules/@playwright/test/cli.js', 'test', '--config', config]
const evidenceDir = `${root}/docs/workstreams/002-implementation-spine/evidence/w5b-browser`

console.log('W5b browser gates — flag-off baseline')
console.log(`command: ${args.join(' ')}`)

const child = Bun.spawn(args, { cwd: root, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, W5B_EVIDENCE_DIR: evidenceDir } })
const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
process.stdout.write(stdout)
process.stderr.write(stderr)

console.log('\nMANUAL U2-VISUAL — reviewer must identify the human actor from the greyscale screenshot without source inspection')
console.log('\nMANUAL U14 — owner-only phone-in-hand thumb-occlusion validation; not cleared by automation')
console.log('REVIEWER U15 — reviewer-only structural inspection that unsupported controls are absent; not cleared by automation')
await Bun.write(`${root}/docs/workstreams/002-implementation-spine/evidence/w5b-baseline.txt`, [stdout.trim(), stderr.trim(), '', 'MANUAL U2-VISUAL — reviewer visual judgment required.', 'OWNER U14 — owner-only phone-in-hand validation.', 'REVIEWER U15 — reviewer-only structural inspection.', ''].join('\n'))

if (exitCode !== 0) process.exit(exitCode)
