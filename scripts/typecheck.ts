/**
 * Runs the typecheck gate once per package.
 *
 * The gate is deliberately per-package rather than repo-wide: a single root
 * program would let one package's `include` silently typecheck another's
 * files, so a package with a broken tsconfig could still come out green.
 * Every workspace directory holding a `tsconfig.json` is checked, so a new
 * package is covered the moment it exists — no list to keep in sync.
 *
 * Exits non-zero if any package fails, after running all of them, so one
 * failure does not hide the others.
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const WORKSPACE_ROOTS = ['apps', 'packages'] as const

async function findPackages(): Promise<Array<string>> {
  const found: Array<string> = []
  for (const root of WORKSPACE_ROOTS) {
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = join(root, entry.name)
      if (await Bun.file(join(dir, 'tsconfig.json')).exists()) found.push(dir)
    }
  }
  return found.sort()
}

const packages = await findPackages()
const failed: Array<string> = []

for (const dir of packages) {
  console.log(`\n── tsc --noEmit -p ${dir}/tsconfig.json`)
  const proc = Bun.spawn(['bunx', 'tsc', '--noEmit', '-p', join(dir, 'tsconfig.json')], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await proc.exited
  if (code === 0) console.log(`   ok  ${dir}`)
  else {
    console.log(`   FAIL ${dir} (exit ${String(code)})`)
    failed.push(dir)
  }
}

console.log(`\n${String(packages.length - failed.length)}/${String(packages.length)} packages clean`)
if (failed.length > 0) {
  console.log(`failed: ${failed.join(', ')}`)
  process.exit(1)
}
