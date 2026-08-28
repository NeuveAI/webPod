import { Glob } from 'bun'
import { relative, resolve, sep } from 'node:path'
import ts from 'typescript'

export type GateStatus = 'pass' | 'fail' | 'manual'

export interface GateResult {
  readonly id: string
  readonly label: string
  readonly status: GateStatus
  readonly findings: readonly string[]
}

export interface StaticGateOptions {
  readonly root: string
  readonly commitRange?: string
}

const SOURCE_GLOB = new Glob('{apps,packages,scripts}/**/*.{ts,tsx,js,jsx,css,html,json}')
const CODE_GLOB = new Glob('{apps,packages,scripts}/**/*.{ts,tsx,js,jsx}')
const PANEL_GLOB = new Glob('packages/panel/**/*.{ts,tsx,js,jsx,css,html}')
const TOOL_GLOB = new Glob('packages/tools/**/*.{ts,tsx,js,jsx}')

const HARNESS_FILES = new Set(['scripts/gate-core.ts', 'scripts/gates.ts', 'scripts/gates.test.ts'])
const IGNORED_SEGMENTS = new Set(['node_modules', 'dist', '.output', '.tanstack'])

interface SourceFile { readonly path: string; readonly text: string }
interface LineFinding { readonly path: string; readonly line: number; readonly text: string }
interface Clearance { readonly path: string; readonly line: RegExp; readonly reason: string }

/**
 * U8 is an audit, not a blind word ban. These are product/account facts that
 * contain the vocabulary but do not imply that an agent sought or received
 * consent. Every clearance is narrow enough that changed copy is reviewed
 * again, and a stale clearance fails the gate.
 */
const U8_CLEARANCES: readonly Clearance[] = [
  { path: 'apps/web/src/routes/[_]probe.composite.tsx', line: /'permission-denied'/u, reason: 'required account-state fixture' },
  { path: 'packages/panel/src/Panel.tsx', line: /permission-denied/u, reason: 'required account-state rendering' },
  { path: 'packages/panel/src/model.ts', line: /permission-denied/u, reason: 'required account-state union' },
  { path: 'packages/providers/src/provider.ts', line: /permit playback authorises normally|permission-gated/u, reason: 'provider API fact' },
  { path: 'packages/providers/src/errors.ts', line: /does not permit/u, reason: 'account playback fact' },
  { path: 'packages/providers/src/apple/matrix.ts', line: /permission|asked for/u, reason: 'measured Apple API fact' },
  { path: 'packages/providers/src/apple/relationships.ts', line: /permission-gated|asked for/u, reason: 'measured Apple API fact' },
  { path: 'packages/providers/src/apple/relationships.test.ts', line: /permission/u, reason: 'measured API assertion' },
  { path: 'packages/providers/src/fixture/fixture-provider.ts', line: /does not permit/u, reason: 'account playback fixture' },
  { path: 'packages/state/src/contract.ts', line: /permission/u, reason: 'historical model rejection' },
  { path: 'packages/panel/e2e/panel.spec.ts', line: /permission-denied/u, reason: 'required account-state browser fixture' },
  { path: 'packages/device/src/curved-discs.ts', line: /asks for/u, reason: 'geometry specification wording' },
  { path: 'packages/device/src/Device.tsx', line: /asked for/u, reason: 'screen-handle lifecycle wording' },
  { path: 'packages/device/src/DeviceCanvas.tsx', line: /asks for/u, reason: 'React lifecycle wording' },
  { path: 'packages/device/src/env-map.ts', line: /asks for/u, reason: 'material specification wording' },
  { path: 'packages/device/src/form.ts', line: /asks for/u, reason: 'geometry specification wording' },
  { path: 'packages/device/src/luminance-probe.ts', line: /blocked by the glass/u, reason: 'physical occlusion wording' },
  { path: 'packages/device/src/screen-mesh.test.ts', line: /ask for a frame/u, reason: 'render invalidation test' },
  { path: 'packages/device/src/screen-mesh.ts', line: /asked for|Ask for/u, reason: 'render invalidation API wording' },
  { path: 'packages/providers/src/artwork.test.ts', line: /asked for/u, reason: 'artwork sizing assertion' },
  { path: 'packages/providers/src/errors.ts', line: /asked for/u, reason: 'relationship diagnostic field' },
  { path: 'packages/providers/src/identity.ts', line: /asked for/u, reason: 'identity resolution outcome' },
  { path: 'packages/providers/src/spotify/matrix.ts', line: /asks for/u, reason: 'artwork sizing posture' },
  { path: 'packages/state/src/contract.ts', line: /granted standing/u, reason: 'historical model rejection' },
] as const

const U8_PATTERN = /\b(allow|deny|denied|permit|permission|granted|authoris|authoriz|approve|approval|pending|blocked|asks? (?:for|to)|asked (?:for|to)|waiting for)\b/iu

function normalizePath(path: string): string { return path.split(sep).join('/') }
function isIgnored(path: string): boolean {
  if (HARNESS_FILES.has(path)) return true
  return path.split('/').some((part) => IGNORED_SEGMENTS.has(part))
}

async function readGlob(root: string, glob: Glob): Promise<readonly SourceFile[]> {
  const files: SourceFile[] = []
  for await (const rawPath of glob.scan({ cwd: root, dot: false, onlyFiles: true })) {
    const path = normalizePath(rawPath)
    if (isIgnored(path)) continue
    files.push({ path, text: await Bun.file(resolve(root, rawPath)).text() })
  }
  return files.sort((a, b) => a.path.localeCompare(b.path))
}

function findLines(files: readonly SourceFile[], pattern: RegExp): readonly LineFinding[] {
  const findings: LineFinding[] = []
  for (const file of files) {
    for (const [index, text] of file.text.split('\n').entries()) {
      pattern.lastIndex = 0
      if (pattern.test(text)) findings.push({ path: file.path, line: index + 1, text: text.trim() })
    }
  }
  return findings
}

function formatLine(finding: LineFinding): string {
  return `${finding.path}:${String(finding.line)}: ${finding.text}`
}

function result(id: string, label: string, findings: readonly string[]): GateResult {
  return { id, label, status: findings.length === 0 ? 'pass' : 'fail', findings }
}

function manuallyClearedU8(findings: readonly LineFinding[]): readonly LineFinding[] {
  return findings.filter((finding) => {
    const index = U8_CLEARANCES.findIndex((clearance) => {
      clearance.line.lastIndex = 0
      return clearance.path === finding.path && clearance.line.test(finding.text)
    })
    return index < 0
  })
}

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (path.endsWith('.js')) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function containsFlipCall(node: ts.Node, source: ts.SourceFile): boolean {
  let found = false
  const visit = (child: ts.Node): void => {
    if (found) return
    if (ts.isCallExpression(child) && /flip/iu.test(child.expression.getText(source))) { found = true; return }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

function functionName(node: ts.Node, source: ts.SourceFile): string | undefined {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) return node.name?.getText(source)
  if (ts.isVariableDeclaration(node) && node.initializer !== undefined
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) return node.name.getText(source)
  if (ts.isPropertyAssignment(node)
    && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) return node.name.getText(source)
  return undefined
}

function flipFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, scriptKind(file.path))
    const report = (node: ts.Node, kind: string): void => {
      const position = source.getLineAndCharacterOfPosition(node.getStart(source))
      findings.push(`${file.path}:${String(position.line + 1)}: flip call inside ${kind}`)
    }
    const visit = (node: ts.Node): void => {
      if (ts.isCatchClause(node) && containsFlipCall(node.block, source)) report(node, 'catch handler')
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'catch') {
        const callback = node.arguments[0]
        if (callback !== undefined && containsFlipCall(callback, source)) report(node, 'promise catch handler')
      }
      const name = functionName(node, source)
      if (name !== undefined && /(?:error|failure|failed)/iu.test(name) && containsFlipCall(node, source)) report(node, `error handler ${name}`)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

function tierFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    if (file.path.startsWith('packages/composite/')) continue
    const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, scriptKind(file.path))
    const visit = (node: ts.Node): void => {
      if (ts.isBinaryExpression(node)) {
        const operator = node.operatorToken.kind
        const isComparison = operator === ts.SyntaxKind.EqualsEqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsEqualsToken
          || operator === ts.SyntaxKind.EqualsEqualsToken || operator === ts.SyntaxKind.ExclamationEqualsToken
        if (isComparison) {
          const left = node.left.getText(source)
          const right = node.right.getText(source)
          if ((/\btier\b/iu.test(left) && /['"]t[1-4]['"]/iu.test(right)) || (/\btier\b/iu.test(right) && /['"]t[1-4]['"]/iu.test(left))) {
            const position = source.getLineAndCharacterOfPosition(node.getStart(source))
            findings.push(`${file.path}:${String(position.line + 1)}: ${node.getText(source)}`)
          }
        }
      }
      if (ts.isSwitchStatement(node) && /\btier\b/iu.test(node.expression.getText(source))) {
        for (const clause of node.caseBlock.clauses) {
          if (ts.isCaseClause(clause) && /['"]t[1-4]['"]/iu.test(clause.expression.getText(source))) {
            const position = source.getLineAndCharacterOfPosition(clause.getStart(source))
            findings.push(`${file.path}:${String(position.line + 1)}: tier switch ${clause.expression.getText(source)}`)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

function toolReturnFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, scriptKind(file.path))
    const report = (node: ts.Node): void => {
      if (!/not supported|unsupported/iu.test(node.getText(source))) return
      const position = source.getLineAndCharacterOfPosition(node.getStart(source))
      findings.push(`${file.path}:${String(position.line + 1)}: ${node.getText(source)}`)
    }
    const visit = (node: ts.Node): void => {
      if (ts.isReturnStatement(node)) report(node)
      if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) report(node.body)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

async function gitOutput(root: string, args: readonly string[]): Promise<{ readonly code: number; readonly text: string }> {
  const process = Bun.spawn(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  const [code, stdout] = await Promise.all([process.exited, new Response(process.stdout).text()])
  return { code, text: stdout }
}

async function branchRange(root: string): Promise<string | undefined> {
  const origin = await gitOutput(root, ['rev-parse', '--verify', 'origin/main'])
  if (origin.code === 0) return 'origin/main..HEAD'
  const parent = await gitOutput(root, ['rev-parse', '--verify', 'HEAD^'])
  return parent.code === 0 ? 'HEAD^..HEAD' : undefined
}

async function trailerFindings(root: string, requestedRange?: string): Promise<readonly string[]> {
  const range = requestedRange ?? await branchRange(root)
  if (range === undefined) return []
  const log = await gitOutput(root, ['log', '--format=%H%x09%B%x00', range])
  if (log.code !== 0) return [`cannot inspect commit range ${range}`]
  return log.text.split('\0').flatMap((entry) => {
    if (!/(Co-Authored-By|Claude-Session|Generated with)/iu.test(entry)) return []
    const hash = entry.split('\t')[0] ?? 'unknown'
    return [`${hash.slice(0, 12)}: prohibited commit trailer`]
  })
}

async function credentialFindings(root: string, files: readonly SourceFile[]): Promise<readonly string[]> {
  const findings: string[] = []
  const tracked = await gitOutput(root, ['ls-files'])
  if (tracked.code !== 0) return ['git ls-files failed']
  for (const path of tracked.text.split('\n').filter(Boolean)) {
    if (path === '.env' || (path.startsWith('.env.') && !path.endsWith('.example'))) findings.push(`tracked environment file: ${path}`)
    if (path.startsWith('cert/') || /\.(?:p8|pem|key|p12)$/iu.test(path)) findings.push(`tracked credential path: ${path}`)
  }
  for (const sentinel of ['cert/gate-sentinel.p8', 'gate-sentinel.pem', 'gate-sentinel.key', 'gate-sentinel.p12']) {
    const ignored = Bun.spawn(['git', 'check-ignore', '--no-index', '--quiet', sentinel], { cwd: root, stdout: 'ignore', stderr: 'ignore' })
    if (await ignored.exited !== 0) findings.push(`credential pattern is not ignored: ${sentinel}`)
  }
  const forbidden = /(?:-----BEGIN (?:EC |RSA )?PRIVATE KEY-----|(?:\.\/|\.\.\/)cert\/)/u
  findings.push(...findLines(files, forbidden).map(formatLine))
  return findings
}

/** Run every deterministic W5a static predicate against a repository root. */
export async function runStaticGates(options: StaticGateOptions): Promise<readonly GateResult[]> {
  const root = resolve(options.root)
  const [sources, code, panel, tools] = await Promise.all([
    readGlob(root, SOURCE_GLOB), readGlob(root, CODE_GLOB), readGlob(root, PANEL_GLOB), readGlob(root, TOOL_GLOB),
  ])
  const u8 = manuallyClearedU8(findLines(sources.filter((file) => file.path.startsWith('apps/') || file.path.startsWith('packages/')), U8_PATTERN))
  const providerFiles = code.filter((file) => !file.path.startsWith('packages/providers/'))
  return [
    result('U8', 'no invented permission language', u8.map(formatLine)),
    result('U9', 'no useState anywhere', findLines(sources, /useState/u).map(formatLine)),
    result('U10', 'panel remains DOM-only', findLines(panel, /canvas|useFrame/u).map(formatLine)),
    result('AGENT-FLAG', 'no fabricated agent-presence signal', findLines(code, /agentPresent|agentAttached|agentIdle|isAgentConnected/iu).map(formatLine)),
    result('HAPTICS', 'no direct navigator vibration', findLines(code, /navigator\.vibrate/u).map(formatLine)),
    result('HALO', 'no stored handedness', findLines(code, /handed|leftHand|rightHand/iu).map(formatLine)),
    result('PROVIDER', 'provider branching uses capabilities', findLines(providerFiles, /provider\.id\s*===/u).map(formatLine)),
    result('TOOLS', 'unsupported capabilities are unregistered', toolReturnFindings(tools)),
    result('FLIP', 'no automatic flip from an error handler', flipFindings(code)),
    result('TRAILERS', 'branch commits contain no attribution trailers', await trailerFindings(root, options.commitRange)),
    result('NAMING', 'initiative ids stay out of implementation artifacts', findLines(sources, /(?<![\d.])002(?!\d)|implementation-spine|workstream/iu).map(formatLine)),
    result('TIER', 'tier comparisons are composite-owned', tierFindings(code)),
    result('CREDENTIALS', 'credential paths and material stay server-side and ignored', await credentialFindings(root, sources)),
    { id: 'U14', label: 'thumb occlusion requires owner phone-in-hand validation', status: 'manual', findings: [] },
    { id: 'U15', label: 'unsupported controls absent, reviewer inspection required', status: 'manual', findings: [] },
  ]
}

/** Render one stable, grep-friendly status line plus any evidence for a gate. */
export function formatGate(gate: GateResult): string {
  const prefix = gate.status === 'pass' ? 'PASS' : gate.status === 'manual' ? 'MANUAL' : 'FAIL'
  const details = gate.findings.map((finding) => `\n      ${finding}`).join('')
  return `${prefix.padEnd(6)} ${gate.id.padEnd(12)} ${gate.label}${details}`
}

/** Return true only when every machine-checkable gate passed. */
export function gatesPassed(results: readonly GateResult[]): boolean {
  return results.every((gate) => gate.status !== 'fail')
}

/** Convert an absolute path to the repository-relative form used in findings. */
export function repositoryPath(root: string, path: string): string { return normalizePath(relative(root, path)) }
