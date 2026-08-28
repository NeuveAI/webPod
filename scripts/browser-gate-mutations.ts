const root = process.cwd()
const config = 'apps/web/tests/playwright.config.ts'
const gates = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U11', 'U12', 'U13'] as const
const sections: string[] = [
  'W5b planted browser-gate failures',
  'Each run injects one DOM/CSS/event mutation through W5B_PLANT and must exit non-zero.',
  '',
]
let missed = false

for (const gate of gates) {
  const args = [
    'bun',
    'packages/panel/node_modules/@playwright/test/cli.js',
    'test',
    '--config',
    config,
    '--grep',
    `${gate} `,
  ]
  const child = Bun.spawn(args, {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, W5B_PLANT: gate, W5B_EVIDENCE_DIR: `${root}/apps/web/tests/test-results/mutation-evidence` },
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  const executed = stdout.includes('1 failed') && !stdout.includes('No tests found')
  const caught = exitCode !== 0 && executed
  const outcome = caught ? 'RED AS REQUIRED' : 'MUTATION MISSED'
  if (!caught) missed = true
  sections.push(`── ${gate}: ${outcome} (exit ${String(exitCode)})`, stdout.trim(), stderr.trim(), '')
  console.log(`${gate.padEnd(4)} ${outcome}`)
}

const destination = `${root}/docs/workstreams/002-implementation-spine/evidence/w5b-planted-failures.txt`
await Bun.write(destination, sections.join('\n').split('\n').map((line) => line.trimEnd()).join('\n'))
console.log(`evidence: ${destination}`)
if (missed) process.exit(1)
