import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { runStaticGates, type GateResult } from './gate-core.ts'

const roots: string[] = []
const runner = resolve(import.meta.dir, 'gates.ts')

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

async function command(root: string, args: readonly string[]): Promise<{ readonly code: number; readonly output: string }> {
  const child = Bun.spawn([...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  return { code, output: `${stdout}${stderr}` }
}

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'webpod-gates-'))
  roots.push(root)
  await Promise.all([
    mkdir(join(root, 'apps/web/src'), { recursive: true }),
    mkdir(join(root, 'packages/panel/src'), { recursive: true }),
    mkdir(join(root, 'packages/tools/src'), { recursive: true }),
    mkdir(join(root, 'packages/providers/src'), { recursive: true }),
    mkdir(join(root, 'scripts'), { recursive: true }),
  ])
  await writeFile(join(root, '.gitignore'), 'cert/\n*.p8\n*.pem\n*.key\n*.p12\n')
  await writeFile(join(root, 'apps/web/src/index.ts'), 'export const ready = true\n')
  await writeFile(join(root, 'packages/panel/src/index.ts'), 'export const panel = "dom"\n')
  await writeFile(join(root, 'packages/tools/src/index.ts'), 'export const tools = []\n')
  await writeFile(join(root, 'package.json'), JSON.stringify({ scripts: { typecheck: 'bun -e "process.exit(0)"', lint: 'bun -e "process.exit(0)"' } }))
  expect((await command(root, ['git', 'init', '-q'])).code).toBe(0)
  expect((await command(root, ['git', 'config', 'user.email', 'gate@example.invalid'])).code).toBe(0)
  expect((await command(root, ['git', 'config', 'user.name', 'Gate Fixture'])).code).toBe(0)
  expect((await command(root, ['git', 'add', '.'])).code).toBe(0)
  expect((await command(root, ['git', 'commit', '-qm', 'baseline'])).code).toBe(0)
  return root
}

function failed(results: readonly GateResult[], id: string): GateResult {
  const gate = results.find((candidate) => candidate.id === id)
  if (gate === undefined) throw new Error(`gate ${id} did not run`)
  expect(gate.status).toBe('fail')
  return gate
}

async function plant(root: string, path: string, text: string): Promise<void> {
  const absolute = join(root, path)
  await mkdir(resolve(absolute, '..'), { recursive: true })
  await writeFile(absolute, text)
  expect(await Bun.file(absolute).text()).toBe(text)
}

describe('W5a static gates go red', () => {
  test('clean fixture is green before mutation', async () => {
    const results = await runStaticGates({ root: await fixture() })
    expect(results.filter((gate) => gate.status === 'fail')).toEqual([])
  })

  test('U8 permits the explicitly cleared account-state vocabulary', async () => {
    const root = await fixture()
    await plant(root, 'packages/panel/src/model.ts', "export const state = 'permission-denied'\n")
    const gate = (await runStaticGates({ root })).find((candidate) => candidate.id === 'U8')
    expect(gate?.status).toBe('pass')
  })

  const plants = [
    ['U8', 'apps/web/src/receipt.ts', 'export const copy = "Waiting for approval"\n'],
    ['U9', 'apps/web/src/local.ts', 'export const hook = useState(0)\n'],
    ['U10', 'packages/panel/src/raster.tsx', 'export const Raster = () => <canvas />\n'],
    ['AGENT-FLAG', 'apps/web/src/agent.ts', 'export const agentPresent = true\n'],
    ['HAPTICS', 'apps/web/src/haptic.ts', 'navigator.vibrate(5)\n'],
    ['HALO', 'apps/web/src/halo.ts', 'export const leftHand = true\n'],
    ['PROVIDER', 'apps/web/src/provider.ts', 'if (provider.id === "apple") throw new Error()\n'],
    ['TOOLS', 'packages/tools/src/read.ts', 'export const run = () => ({ error: "unsupported" })\n'],
    ['FLIP', 'apps/web/src/flip.ts', 'try { work() } catch { flipDevice() }\n'],
    ['NAMING', 'apps/web/src/name.ts', 'export const note = "initiative 002"\n'],
    ['TIER', 'apps/web/src/tier.ts', 'if (tier === "t1") render()\n'],
  ] as const

  for (const [id, path, text] of plants) {
    test(`${id} detects its planted violation`, async () => {
      const root = await fixture()
      await plant(root, path, text)
      const gate = failed(await runStaticGates({ root }), id)
      expect(gate.findings.some((finding) => finding.includes(path))).toBe(true)
    })
  }

  test('TRAILERS detects a planted branch trailer', async () => {
    const root = await fixture()
    await plant(root, 'apps/web/src/second.ts', 'export const second = true\n')
    expect((await command(root, ['git', 'add', '.'])).code).toBe(0)
    expect((await command(root, ['git', 'commit', '-qm', 'plant\n\nCo-Authored-By: Gate <gate@example.invalid>'])).code).toBe(0)
    failed(await runStaticGates({ root, commitRange: 'HEAD^..HEAD' }), 'TRAILERS')
  })

  test('TIER detects a switch branch outside composite', async () => {
    const root = await fixture()
    const text = 'switch (tier) { case "t1": render(); break }\n'
    await plant(root, 'apps/web/src/tier-switch.ts', text)
    failed(await runStaticGates({ root }), 'TIER')
  })

  test('CREDENTIALS detects a planted tracked key path without reading cert', async () => {
    const root = await fixture()
    await plant(root, 'leaked.p8', 'fixture-not-a-key\n')
    expect((await command(root, ['git', 'add', '-f', 'leaked.p8'])).code).toBe(0)
    const gate = failed(await runStaticGates({ root }), 'CREDENTIALS')
    expect(gate.findings).toContain('tracked credential path: leaked.p8')
  })
})

describe('W5a command gates propagate red', () => {
  test('TYPES reports a failing project sweep', async () => {
    const root = await fixture()
    await plant(root, 'package.json', JSON.stringify({ scripts: { typecheck: 'bun -e "process.exit(7)"', lint: 'bun -e "process.exit(0)"' } }))
    const run = await command(root, ['bun', runner, '--root', root])
    expect(run.code).toBe(1)
    expect(run.output).toContain('FAIL   TYPES')
  })

  test('LINT reports a failing lint command', async () => {
    const root = await fixture()
    await plant(root, 'package.json', JSON.stringify({ scripts: { typecheck: 'bun -e "process.exit(0)"', lint: 'bun -e "process.exit(8)"' } }))
    const run = await command(root, ['bun', runner, '--root', root])
    expect(run.code).toBe(1)
    expect(run.output).toContain('FAIL   LINT')
  })

  test('TESTS reports a planted failing Bun test', async () => {
    const root = await fixture()
    await plant(root, 'apps/web/src/planted.test.ts', 'import { expect, test } from "bun:test"\ntest("plant", () => expect(1).toBe(2))\n')
    const run = await command(root, ['bun', runner, '--root', root])
    expect(run.code).toBe(1)
    expect(run.output).toContain('FAIL   TESTS')
  })
})
