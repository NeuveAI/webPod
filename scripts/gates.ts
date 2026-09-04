import { formatGate, formatSummary, gatesPassed, runStaticGates, summarizeGates, type GateResult } from './gate-core.ts'
import { COMMAND_GATES, type CommandGate } from './gate-commands.ts'

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function commandGate(root: string, gate: CommandGate): Promise<GateResult> {
  console.log(`\n── ${gate.id}: ${gate.command.join(' ')}`)
  const child = Bun.spawn([...gate.command], { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  const code = await child.exited
  return { id: gate.id, label: gate.label, status: code === 0 ? 'pass' : 'fail', findings: code === 0 ? [] : [`command exited ${String(code)}`] }
}

const root = argument('--root') ?? process.cwd()
const staticOnly = process.argv.includes('--static-only')
const commitRange = argument('--commit-range')
const results: GateResult[] = []

if (!staticOnly) for (const gate of COMMAND_GATES) results.push(await commandGate(root, gate))
results.push(...await runStaticGates({ root, ...(commitRange === undefined ? {} : { commitRange }) }))

console.log('\n── gate summary')
for (const gate of results) console.log(formatGate(gate))
console.log(`\n${formatSummary(summarizeGates(results))}`)
if (!gatesPassed(results)) process.exit(1)
