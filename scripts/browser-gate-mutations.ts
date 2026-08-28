const root = process.cwd()
const config = 'apps/web/tests/playwright.config.ts'
const gates = ['U1', 'U2', 'U3', 'U4', 'U5', 'U6', 'U7', 'U11', 'U12', 'U13'] as const
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
for (const [index, gate] of gates.entries()) {
  const result = await run(['--grep', `${gate} `], { W5B_PORT: String(4411 + index), W5B_PLANT: gate })
  const landed = result.stdout.includes(`[W5B PLANT ${gate} LANDED]`)
  const selectedGateFailed = result.exitCode !== 0 && /1 failed/u.test(result.stdout) && result.stdout.includes(`${gate} `) && !/No tests found/u.test(result.stdout)
  const caught = landed && selectedGateFailed
  if (!caught) missed = true
  const outcome = caught ? 'LANDED → RED AS REQUIRED' : !landed ? 'PLANT DID NOT LAND' : 'MUTATION-SPECIFIC GUARD MISSED'
  sections.push(`── ${gate}: ${outcome} (exit ${String(result.exitCode)})`, result.stdout.trim(), result.stderr.trim(), '')
  console.log(`${gate.padEnd(4)} ${outcome}`)
}

sections.push('MANUAL U2-VISUAL — reviewer must identify the human actor from the greyscale screenshot without source inspection.', 'OWNER U14 — thumb-occlusion judgment is owner-only and is not automated.', 'REVIEWER U15 — unsupported-feature copy judgment is reviewer-only and is not automated.', '')
const destination = `${root}/docs/workstreams/002-implementation-spine/evidence/w5b-planted-failures.txt`
await Bun.write(destination, sections.join('\n').split('\n').map((line) => line.trimEnd()).join('\n'))
console.log(`evidence: ${destination}`)
if (missed) process.exit(1)
