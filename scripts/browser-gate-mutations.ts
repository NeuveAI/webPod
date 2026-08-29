const root = process.cwd()
const config = 'apps/web/tests/playwright.config.ts'
const mutations = [
  { plant: 'U1', gate: 'U1' },
  { plant: 'SOURCE', gate: 'U1' },
  { plant: 'U2', gate: 'U2' },
  { plant: 'U3', gate: 'U3' },
  { plant: 'U4', gate: 'U4' },
  { plant: 'U4_SOLID', gate: 'U4' },
  { plant: 'U5', gate: 'U5' },
  { plant: 'U6', gate: 'U6' },
  { plant: 'U7', gate: 'U7' },
  { plant: 'U7_ALL_TEXT', gate: 'U7' },
  { plant: 'U11', gate: 'U11' },
  { plant: 'U11_RASTER', gate: 'U11' },
  { plant: 'U12', gate: 'U12' },
  { plant: 'U12_ACTION', gate: 'U12' },
  { plant: 'U13', gate: 'U13' },
  { plant: 'U13_SETTLED', gate: 'U13' },
] as const
const evidenceDir = `${root}/apps/web/tests/test-results/mutation-evidence`
const sections: string[] = ['W5b planted browser-gate failures', 'A clean, isolated 10/10 control run is required before any mutation is attempted.', '']

interface RunResult { readonly exitCode: number; readonly stdout: string; readonly stderr: string }

const run = async (args: readonly string[], env: Record<string, string>): Promise<RunResult> => {
  const child = Bun.spawn(['bun', 'packages/panel/node_modules/@playwright/test/cli.js', 'test', '--config', config, ...args], {
    cwd: root,
    stdout: 'pipe', stderr: 'pipe',
    env: { ...process.env, ...env, W5B_EVIDENCE_DIR: evidenceDir },
  })
  const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
  return { stdout, stderr, exitCode }
}

const control = await run([], { W5B_PORT: '4410', W5B_PLANT: '' })
const controlClean = control.exitCode === 0 && /10 passed/u.test(control.stdout) && !/failed|No tests found/u.test(control.stdout)
sections.push(`── CONTROL: ${controlClean ? 'CLEAN 10/10' : 'DIRTY — MUTATIONS NOT RUN'} (exit ${String(control.exitCode)})`, control.stdout.trim(), control.stderr.trim(), '')
console.log(`CONTROL ${controlClean ? 'CLEAN 10/10' : 'DIRTY'}`)
if (!controlClean) {
  await Bun.write(`${root}/docs/workstreams/002-implementation-spine/evidence/w5b-planted-failures.txt`, sections.join('\n'))
  process.exit(1)
}

let missed = false
for (const [index, mutation] of mutations.entries()) {
  const result = await run(['--grep', `${mutation.gate} `], { W5B_PORT: String(4411 + index), W5B_PLANT: mutation.plant })
  const landed = result.stdout.includes(`[W5B PLANT ${mutation.plant} LANDED]`)
  const selectedGateFailed = result.exitCode !== 0 && /1 failed/u.test(result.stdout) && result.stdout.includes(`${mutation.gate} `) && !/No tests found/u.test(result.stdout)
  const caught = landed && selectedGateFailed
  if (!caught) missed = true
  const outcome = caught ? 'LANDED → RED AS REQUIRED' : !landed ? 'PLANT DID NOT LAND' : 'MUTATION-SPECIFIC GUARD MISSED'
  sections.push(`── ${mutation.plant} → ${mutation.gate}: ${outcome} (exit ${String(result.exitCode)})`, result.stdout.trim(), result.stderr.trim(), '')
  console.log(`${mutation.plant.padEnd(12)} ${outcome}`)
}

sections.push('MANUAL U2-VISUAL — reviewer must identify the human actor from the greyscale screenshot without source inspection.', 'OWNER U14 — thumb-occlusion judgment is owner-only and is not automated.', 'REVIEWER U15 — unsupported-feature copy judgment is reviewer-only and is not automated.', '')
const destination = `${root}/docs/workstreams/002-implementation-spine/evidence/w5b-planted-failures.txt`
await Bun.write(destination, sections.join('\n').split('\n').map((line) => line.trimEnd()).join('\n'))
console.log(`evidence: ${destination}`)
if (missed) process.exit(1)
