import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { formatSummary, runStaticGates, safeDirtyFingerprint, summarizeGates, type GateResult } from './gate-core.ts'

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
  await writeFile(join(root, '.gitignore'), 'cert/\nignored-target/\n*.p8\n*.pem\n*.key\n*.p12\n')
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

  test('U8 permits required account-state vocabulary', async () => {
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

  test('NAMING detects its planted violation', async () => {
    const root = await fixture()
    const text = ['export const note = "initiative ', '00', '2"\n'].join('')
    await plant(root, 'apps/web/src/name.ts', text)
    failed(await runStaticGates({ root }), 'NAMING')
  })

  test('NAMING permits canonical bookkeeping paths in script string literals', async () => {
    const root = await fixture()
    const evidencePath = '../docs/workstreams/002-implementation-spine/evidence/browser.json'
    const reviewPath = '../docs/workstreams/002-implementation-spine/reviews/browser.md'
    const decisionPath = '../docs/workstreams/002-implementation-spine/decisions/browser.md'
    const diaryPath = '../docs/workstreams/002-implementation-spine/diary/browser.md'
    await plant(
      root,
      'scripts/evidence-reader.ts',
      [
        `export const single = '${evidencePath}'`,
        `export const double = ${JSON.stringify(reviewPath)}`,
        `export const template = \`${decisionPath}\``,
        `export const adjacent = '${diaryPath}'`,
        '',
      ].join('\n'),
    )
    const gate = (await runStaticGates({ root })).find((candidate) => candidate.id === 'NAMING')
    expect(gate?.status).toBe('pass')
  })

  test('NAMING rejects traversal, repeated separators and dot segments in bookkeeping paths', async () => {
    const canonical = '../docs/workstreams/002-implementation-spine/evidence/browser.json'
    const forbiddenFile = ['implementation', '-spine'].join('')
    const malformedPaths = [
      canonical.replace('browser.json', `../../../../packages/product/${forbiddenFile}.ts`),
      canonical.replace('browser.json', `/${forbiddenFile}.json`),
      canonical.replace('browser.json', `./${forbiddenFile}.json`),
    ]

    for (const [index, malformedPath] of malformedPaths.entries()) {
      const root = await fixture()
      const source = `export const path = ${JSON.stringify(malformedPath)}\n`
      const path = `scripts/malformed-evidence-path-${String(index)}.ts`
      await plant(root, path, source)
      const gate = failed(await runStaticGates({ root }), 'NAMING')
      expect(gate.findings.some((finding) => finding.includes(path))).toBe(true)
    }
  })

  test('NAMING still rejects bookkeeping names in script comments', async () => {
    const root = await fixture()
    const bookkeepingPath = '../docs/workstreams/002-implementation-spine/evidence/browser.json'
    const comment = `// ${bookkeepingPath}\n`
    await plant(root, 'scripts/evidence-reader.ts', comment)
    failed(await runStaticGates({ root }), 'NAMING')
  })

  test('NAMING rejects adjacent noncanonical bookkeeping references', async () => {
    const canonical = '../docs/workstreams/002-implementation-spine/evidence/browser.json'
    const malformedInitiative = ['00', '2-'].join('')
    const controls = [
      ['scripts/prose.ts', `export const note = ${JSON.stringify(`Evidence: ${canonical}`)}\n`],
      ['apps/web/src/evidence.ts', `export const path = ${JSON.stringify(canonical)}\n`],
      ['scripts/unsupported-directory.ts', `export const path = ${JSON.stringify(canonical.replace('/evidence/', '/artifacts/'))}\n`],
      ['scripts/malformed-initiative.ts', `export const path = ${JSON.stringify(canonical.replace(/\/\d{3}-[a-z0-9-]+\//u, `/${malformedInitiative}/`))}\n`],
      ['scripts/empty-filename.ts', `export const path = ${JSON.stringify(canonical.replace('browser.json', ''))}\n`],
    ] as const

    for (const [path, source] of controls) {
      const root = await fixture()
      await plant(root, path, source)
      const gate = failed(await runStaticGates({ root }), 'NAMING')
      expect(gate.findings.some((finding) => finding.includes(path))).toBe(true)
    }
  })

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

  test('CREDENTIALS never opens design.pen or follows a tracked symlink', async () => {
    const root = await fixture()
    const marker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('')
    await plant(root, 'design.pen', `${marker}synthetic-encrypted-document\n`)
    await plant(root, 'ignored-target/synthetic.txt', `${marker}synthetic-ignored-target\n`)
    await symlink('../../../ignored-target/synthetic.txt', join(root, 'apps/web/src/reference.ts'))
    expect((await command(root, ['git', 'add', '-f', 'design.pen', 'apps/web/src/reference.ts'])).code).toBe(0)
    const gate = (await runStaticGates({ root })).find((candidate) => candidate.id === 'CREDENTIALS')
    expect(gate?.status).toBe('pass')
  })

  test('manual gates remain outstanding rather than counted clear', async () => {
    const results = await runStaticGates({ root: await fixture() })
    const summary = summarizeGates(results)
    expect(summary.manualOutstanding).toBe(2)
    expect(formatSummary(summary)).toContain('2 manual outstanding')
    expect(formatSummary(summary)).not.toContain('gates clear')
  })
})

describe('W5a same-review adversarial mutations', () => {
  test('U8 scans user-facing provider copy', async () => {
    const root = await fixture()
    await plant(root, 'packages/providers/src/copy.ts', 'export const reason = "Waiting for approval"\n')
    failed(await runStaticGates({ root }), 'U8')
  })

  test('U8 permits exact provider authorization API tokens', async () => {
    const root = await fixture()
    await plant(root, 'packages/providers/src/api.ts', 'export const operation = "authorize"\nexport const code = "permission_denied"\n')
    const gate = (await runStaticGates({ root })).find((candidate) => candidate.id === 'U8')
    expect(gate?.status).toBe('pass')
  })

  for (const copy of ['Authorized', 'Pending'] as const) {
    test(`U8 rejects exact visible ${copy} copy`, async () => {
      const root = await fixture()
      await plant(root, `packages/providers/src/${copy.toLowerCase()}.tsx`, `export const Copy = () => <p>${copy}</p>\n`)
      failed(await runStaticGates({ root }), 'U8')
    })
  }

  test('U8 catches ordinary authorization vocabulary', async () => {
    const root = await fixture()
    const text = 'export const copy = "The assistant is authorized"\n'
    await plant(root, 'apps/web/src/authorized.ts', text)
    failed(await runStaticGates({ root }), 'U8')
  })

  test('U8 cannot hide banned copy beside a required state identifier', async () => {
    const root = await fixture()
    const text = 'export const state = "permission-denied; waiting for approval"\n'
    await plant(root, 'packages/panel/src/model.ts', text)
    failed(await runStaticGates({ root }), 'U8')
  })

  const providerPlants = [
    'switch (provider.id) { case "apple": play() }\n',
    'if (provider.id !== "apple") pause()\n',
    'const { id } = provider\nif (id === "apple") play()\n',
  ] as const
  for (const [index, text] of providerPlants.entries()) {
    test(`PROVIDER catches adversarial form ${String(index + 1)}`, async () => {
      const root = await fixture()
      const path = `apps/web/src/provider-${String(index)}.ts`
      await plant(root, path, text)
      failed(await runStaticGates({ root }), 'PROVIDER')
    })
  }

  test('PROVIDER follows an ordinary provider alias', async () => {
    const root = await fixture()
    await plant(root, 'apps/web/src/provider-alias.ts', 'const selected = provider\nif (selected.id === "apple") play()\n')
    failed(await runStaticGates({ root }), 'PROVIDER')
  })

  test('TOOLS follows an unsupported result through a returned variable', async () => {
    const root = await fixture()
    const text = 'export function run() { const result = { error: "unsupported" }; return result }\n'
    await plant(root, 'packages/tools/src/read.ts', text)
    failed(await runStaticGates({ root }), 'TOOLS')
  })

  test('TOOLS follows a later assignment into a returned variable', async () => {
    const root = await fixture()
    await plant(root, 'packages/tools/src/later.ts', 'export function run() { let result; result = { error: "unsupported" }; return result }\n')
    failed(await runStaticGates({ root }), 'TOOLS')
  })

  test('TOOLS follows unsupported content introduced by later property assignment', async () => {
    const root = await fixture()
    await plant(root, 'packages/tools/src/property.ts', 'export function run() { const r = { error: "" }; r.error = "unsupported"; return r }\n')
    failed(await runStaticGates({ root }), 'TOOLS')
  })

  test('FLIP catches a JSX onError callback', async () => {
    const root = await fixture()
    const text = 'export const View = () => <Boundary onError={() => flipDevice()} />\n'
    await plant(root, 'apps/web/src/error.tsx', text)
    failed(await runStaticGates({ root }), 'FLIP')
  })

  test('FLIP catches a promise rejection callback', async () => {
    const root = await fixture()
    const text = 'promise.then(render, () => flipDevice())\n'
    await plant(root, 'apps/web/src/rejection.ts', text)
    failed(await runStaticGates({ root }), 'FLIP')
  })

  test('FLIP catches an error event callback', async () => {
    const root = await fixture()
    await plant(root, 'apps/web/src/event.ts', 'window.addEventListener("error", () => flipDevice())\n')
    failed(await runStaticGates({ root }), 'FLIP')
  })

  test('FLIP catches assignment to window.onerror', async () => {
    const root = await fixture()
    await plant(root, 'apps/web/src/onerror.ts', 'window.onerror = () => flipDevice()\n')
    failed(await runStaticGates({ root }), 'FLIP')
  })

  test('TIER catches enum comparison outside composite', async () => {
    const root = await fixture()
    const text = 'if (tier === Tier.T1) render()\n'
    await plant(root, 'apps/web/src/tier-enum.ts', text)
    failed(await runStaticGates({ root }), 'TIER')
  })

  test('TIER catches method-based branching outside composite', async () => {
    const root = await fixture()
    const text = 'if (tier.startsWith("t1")) render()\n'
    await plant(root, 'apps/web/src/tier-method.ts', text)
    failed(await runStaticGates({ root }), 'TIER')
  })

  test('TIER follows an ordinary tier alias', async () => {
    const root = await fixture()
    await plant(root, 'apps/web/src/tier-alias.ts', 'const mode = tier\nif (mode === "t1") render()\n')
    failed(await runStaticGates({ root }), 'TIER')
  })

  test('CREDENTIALS scans tracked documentation and never echoes its source', async () => {
    const root = await fixture()
    const marker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('')
    const payload = 'SENSITIVE-FIXTURE-PAYLOAD'
    await plant(root, 'docs/leak.txt', `${marker}${payload}\n`)
    expect((await command(root, ['git', 'add', '-f', 'docs/leak.txt'])).code).toBe(0)
    const gate = failed(await runStaticGates({ root }), 'CREDENTIALS')
    expect(gate.findings.join('\n')).toContain('docs/leak.txt:1')
    expect(gate.findings.join('\n')).not.toContain(marker)
    expect(gate.findings.join('\n')).not.toContain(payload)
  })

  test('U9 scans the executable harness itself', async () => {
    const root = await fixture()
    const text = 'export const state = useState(0)\n'
    await plant(root, 'scripts/gates.ts', text)
    failed(await runStaticGates({ root }), 'U9')
  })

  test('AGENT-FLAG scans authored CSS while ignoring comments', async () => {
    const root = await fixture()
    const text = '.agentPresent { display: block }\n'
    await plant(root, 'apps/web/src/agent.css', text)
    failed(await runStaticGates({ root }), 'AGENT-FLAG')
  })

  test('U10 catches the canonical React Canvas component', async () => {
    const root = await fixture()
    const text = 'export const Raster = () => <Canvas />\n'
    await plant(root, 'packages/panel/src/raster.tsx', text)
    failed(await runStaticGates({ root }), 'U10')
  })

  test('syntax gates ignore truthful prose and required identifiers', async () => {
    const root = await fixture()
    const text = [
      '// useState is intentionally absent',
      '// navigator.vibrate would violate the actuator boundary',
      '// the value is handed to the renderer',
      'export const state = "permission-denied"',
      '',
    ].join('\n')
    await plant(root, 'apps/web/src/compliance.ts', text)
    const results = await runStaticGates({ root })
    for (const id of ['U8', 'U9', 'HAPTICS', 'HALO']) {
      expect(results.find((gate) => gate.id === id)?.status).toBe('pass')
    }
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

describe('W5a evidence fingerprint', () => {
  test('changes when dirty content changes at the same path', async () => {
    const root = await fixture()
    await plant(root, 'apps/web/src/index.ts', 'export const ready = "first"\n')
    const first = await safeDirtyFingerprint(root)
    await plant(root, 'apps/web/src/index.ts', 'export const ready = "second"\n')
    const second = await safeDirtyFingerprint(root)
    expect(first).not.toBe(second)
  })

  test('does not follow dirty symlinks while fingerprinting', async () => {
    const root = await fixture()
    await plant(root, 'ignored-target/synthetic.txt', 'first\n')
    await symlink('../../../ignored-target/synthetic.txt', join(root, 'apps/web/src/fingerprint.ts'))
    const first = await safeDirtyFingerprint(root)
    await plant(root, 'ignored-target/synthetic.txt', 'second\n')
    expect(await safeDirtyFingerprint(root)).toBe(first)
  })
})
