/**
 * Runs the typecheck gate once per project.
 *
 * The gate is deliberately per-project rather than repo-wide: a single root
 * program would let one package's `include` silently typecheck another's
 * files, so a package with a broken tsconfig could still come out green.
 * Every directory holding a `tsconfig.json` is checked, so a new package is
 * covered the moment it exists — no list to keep in sync.
 *
 * ⚑ `scripts/` is in the sweep, which means this file typechecks itself and
 * `gates.ts` typechecks itself. It was not, and a planted type error in this
 * very file produced "10/10 packages clean" and exit 0 — the gate runner was
 * the one file the gate did not cover. A harness that cannot check itself
 * reports success for checks that never ran.
 *
 * Exits non-zero if any project fails, after running all of them, so one
 * failure does not hide the others.
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

/** Directories whose immediate children are each their own project. */
const WORKSPACE_ROOTS = ['apps', 'packages'] as const

/** Directories that are themselves a project, not a container of projects. */
const STANDALONE_ROOTS = ['scripts'] as const

async function findProjects(): Promise<Array<string>> {
  const found: Array<string> = []

  for (const root of WORKSPACE_ROOTS) {
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = join(root, entry.name)
      if (await Bun.file(join(dir, 'tsconfig.json')).exists()) found.push(dir)
    }
  }

  for (const dir of STANDALONE_ROOTS) {
    if (await Bun.file(join(dir, 'tsconfig.json')).exists()) found.push(dir)
  }

  return found.sort()
}

const projects = await findProjects()
const failed: Array<string> = []

for (const dir of projects) {
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

console.log(`\n${String(projects.length - failed.length)}/${String(projects.length)} projects clean`)
if (failed.length > 0) {
  console.log(`failed: ${failed.join(', ')}`)
  process.exit(1)
}
