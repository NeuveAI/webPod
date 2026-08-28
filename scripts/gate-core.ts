import { Glob } from 'bun'
import { resolve, sep } from 'node:path'
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

export interface GateSummary {
  readonly automatedPassed: number
  readonly automatedFailed: number
  readonly manualOutstanding: number
}

const SOURCE_GLOB = new Glob('{apps,packages,scripts}/**/*.{ts,tsx,js,jsx,css,html,json}')
const CODE_GLOB = new Glob('{apps,packages,scripts}/**/*.{ts,tsx,js,jsx}')
const PANEL_GLOB = new Glob('packages/panel/**/*.{ts,tsx,js,jsx,css,html}')
const TOOL_GLOB = new Glob('packages/tools/**/*.{ts,tsx,js,jsx}')
const IGNORED_SEGMENTS = new Set(['node_modules', 'dist', '.output', '.tanstack', 'test-results'])

interface SourceFile {
  readonly path: string
  readonly text: string
}

interface LocatedText {
  readonly path: string
  readonly line: number
  readonly text: string
}

const U8_PATTERN = /\b(?:allows?|allowed|allowing|den(?:y|ies|ied|ying)|permits?|permitted|permitting|permissions?|grants?|granted|granting|authori[sz](?:e|es|ed|ing|ation|ations)?|approv(?:e|es|ed|ing|al|als)|pending|blocked|asks?\s+(?:for|to)|asked\s+(?:for|to)|waiting\s+for)\b/iu
const AGENT_FLAG_PATTERN = /^(?:agentPresent|agentAttached|agentIdle|isAgentConnected)$/iu
const HANDEDNESS_PATTERN = /^(?:handed|handedness|leftHand|rightHand)$/iu
const NAMING_PATTERN = /(?<![\d.])002(?!\d)|implementation-spine|workstream/iu

function normalizePath(path: string): string {
  return path.split(sep).join('/')
}

function isIgnored(path: string): boolean {
  return path.split('/').some((part) => IGNORED_SEGMENTS.has(part))
}

function scriptKind(path: string): ts.ScriptKind {
  if (path.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (path.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (path.endsWith('.js')) return ts.ScriptKind.JS
  if (path.endsWith('.json')) return ts.ScriptKind.JSON
  return ts.ScriptKind.TS
}

function sourceFile(file: SourceFile): ts.SourceFile {
  return ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, scriptKind(file.path))
}

function lineAt(source: ts.SourceFile, position: number): number {
  return source.getLineAndCharacterOfPosition(position).line + 1
}

function finding(path: string, line: number, message: string): string {
  return `${path}:${String(line)}: ${message}`
}

function result(id: string, label: string, findings: readonly string[]): GateResult {
  return { id, label, status: findings.length === 0 ? 'pass' : 'fail', findings }
}

async function readGlob(root: string, glob: Glob): Promise<readonly SourceFile[]> {
  const files: SourceFile[] = []
  for await (const rawPath of glob.scan({ cwd: root, dot: false, onlyFiles: true })) {
    const path = normalizePath(rawPath)
    if (isIgnored(path)) continue
    files.push({ path, text: await Bun.file(resolve(root, rawPath)).text() })
  }
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

function authoredText(file: SourceFile, includeComments: boolean): readonly LocatedText[] {
  if (!/\.(?:[cm]?[jt]sx?|json)$/u.test(file.path)) {
    const text = includeComments ? file.text : file.text.replaceAll(/\/\*[\s\S]*?\*\//gu, '').replaceAll(/\/\/.*$/gmu, '')
    return text.split('\n').map((line, index) => ({ path: file.path, line: index + 1, text: line }))
  }

  const source = sourceFile(file)
  const pieces: LocatedText[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) {
      pieces.push({ path: file.path, line: lineAt(source, node.getStart(source)), text: node.text })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  if (includeComments) {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, file.path.endsWith('x') ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, file.text)
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
        pieces.push({ path: file.path, line: lineAt(source, scanner.getTokenPos()), text: scanner.getTokenText() })
      }
    }
  }
  return pieces
}

function contentFindings(files: readonly SourceFile[], pattern: RegExp, options: { readonly comments: boolean; readonly ignore?: (item: LocatedText) => boolean }): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    for (const item of authoredText(file, options.comments)) {
      if (options.ignore?.(item) === true) continue
      pattern.lastIndex = 0
      const match = pattern.exec(item.text)
      if (match !== null) {
        const matchedLine = item.line + (item.text.slice(0, match.index).match(/\n/g)?.length ?? 0)
        findings.push(finding(item.path, matchedLine, 'forbidden authored content'))
      }
    }
  }
  return findings
}

function executableNameFindings(files: readonly SourceFile[], pattern: RegExp, label: string, includeStrings = false): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    const source = sourceFile(file)
    const visit = (node: ts.Node): void => {
      const candidate = ts.isIdentifier(node) || ts.isPrivateIdentifier(node)
        ? node.text
        : includeStrings && ts.isStringLiteralLike(node)
          ? node.text
          : undefined
      if (candidate !== undefined) {
        pattern.lastIndex = 0
        if (pattern.test(candidate)) findings.push(finding(file.path, lineAt(source, node.getStart(source)), `${label}: ${candidate}`))
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

function u8Findings(files: readonly SourceFile[]): readonly string[] {
  const productFiles = files.filter((file) => !file.path.startsWith('packages/providers/')
    && !file.path.startsWith('scripts/')
    && !/\.(?:test|spec|e2e)\.[cm]?[jt]sx?$/u.test(file.path))
  return contentFindings(productFiles, U8_PATTERN, {
    comments: false,
    ignore: (item) => {
      const withoutRequiredState = item.text.replaceAll('permission-denied', '')
      U8_PATTERN.lastIndex = 0
      return !U8_PATTERN.test(withoutRequiredState)
    },
  })
}

function useStateFindings(files: readonly SourceFile[]): readonly string[] {
  return executableNameFindings(files, /^useState$/u, 'executable useState')
}

function panelCanvasFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    if (!/\.(?:[cm]?[jt]sx?)$/u.test(file.path)) {
      const withoutComments = file.text.replaceAll(/\/\*[\s\S]*?\*\//gu, '').replaceAll(/\/\/.*$/gmu, '')
      for (const [index, line] of withoutComments.split('\n').entries()) {
        if (/<canvas\b|\buseFrame\b/iu.test(line)) findings.push(finding(file.path, index + 1, 'panel canvas API'))
      }
      continue
    }
    const source = sourceFile(file)
    const visit = (node: ts.Node): void => {
      let violation: string | undefined
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        if (node.tagName.getText(source).toLowerCase() === 'canvas') violation = 'Canvas JSX element'
      } else if (ts.isIdentifier(node) && (node.text === 'useFrame' || node.text === 'Canvas')) {
        violation = node.text
      } else if (ts.isStringLiteralLike(node) && node.text.toLowerCase() === 'canvas') {
        violation = 'canvas element name'
      }
      if (violation !== undefined) findings.push(finding(file.path, lineAt(source, node.getStart(source)), `panel canvas API: ${violation}`))
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

function agentFlagFindings(sources: readonly SourceFile[], code: readonly SourceFile[]): readonly string[] {
  const findings = [...executableNameFindings(code, AGENT_FLAG_PATTERN, 'fabricated agent flag', true)]
  for (const file of sources.filter((candidate) => /\.(?:css|html)$/u.test(candidate.path))) {
    const withoutComments = file.text.replaceAll(/\/\*[\s\S]*?\*\//gu, '').replaceAll(/<!--([\s\S]*?)-->/gu, '')
    for (const [index, line] of withoutComments.split('\n').entries()) {
      if (/agentPresent|agentAttached|agentIdle|isAgentConnected/iu.test(line)) findings.push(finding(file.path, index + 1, 'fabricated agent flag in authored markup/style'))
    }
  }
  return findings
}

function hapticFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    const source = sourceFile(file)
    const visit = (node: ts.Node): void => {
      const isDirect = ts.isPropertyAccessExpression(node)
        ? node.expression.getText(source) === 'navigator' && node.name.text === 'vibrate'
        : ts.isElementAccessExpression(node)
          ? node.expression.getText(source) === 'navigator' && node.argumentExpression !== undefined
            && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'vibrate'
          : false
      if (isDirect) findings.push(finding(file.path, lineAt(source, node.getStart(source)), 'direct navigator vibration access'))
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

function handednessFindings(files: readonly SourceFile[]): readonly string[] {
  return executableNameFindings(files, HANDEDNESS_PATTERN, 'stored handedness', true)
}

function isProviderExpression(node: ts.Expression, source: ts.SourceFile): boolean {
  return node.getText(source) === 'provider'
}

function providerFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files.filter((candidate) => !candidate.path.startsWith('packages/providers/'))) {
    const source = sourceFile(file)
    const visit = (node: ts.Node): void => {
      let violation = false
      if (ts.isPropertyAccessExpression(node)) violation = isProviderExpression(node.expression, source) && node.name.text === 'id'
      if (ts.isElementAccessExpression(node)) violation = isProviderExpression(node.expression, source) && node.argumentExpression !== undefined
        && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'id'
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer !== undefined
        && isProviderExpression(node.initializer, source)) {
        violation = node.name.elements.some((element) => (element.propertyName ?? element.name).getText(source) === 'id')
      }
      if (violation) findings.push(finding(file.path, lineAt(source, node.getStart(source)), 'provider identity read outside provider layer'))
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

function containsUnsupportedLiteral(node: ts.Node): boolean {
  let found = false
  const visit = (child: ts.Node): void => {
    if (found) return
    if (ts.isStringLiteralLike(child) && /not supported|unsupported/iu.test(child.text)) { found = true; return }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

function identifiersIn(node: ts.Node): readonly string[] {
  const names: string[] = []
  const visit = (child: ts.Node): void => {
    if (ts.isIdentifier(child)) names.push(child.text)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return names
}

function toolReturnFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    const source = sourceFile(file)
    const tainted = new Set<string>()
    const declarations: Array<{ readonly name: string; readonly initializer: ts.Expression }> = []
    const collect = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer !== undefined) {
        declarations.push({ name: node.name.text, initializer: node.initializer })
      }
      ts.forEachChild(node, collect)
    }
    collect(source)
    let changed = true
    while (changed) {
      changed = false
      for (const declaration of declarations) {
        if (tainted.has(declaration.name)) continue
        const initializer = declaration.initializer
        if (initializer !== undefined && (containsUnsupportedLiteral(initializer) || identifiersIn(initializer).some((name) => tainted.has(name)))) {
          tainted.add(declaration.name)
          changed = true
        }
      }
    }
    const reportReturn = (node: ts.Node): void => {
      if (!containsUnsupportedLiteral(node) && !identifiersIn(node).some((name) => tainted.has(name))) return
      findings.push(finding(file.path, lineAt(source, node.getStart(source)), 'tool return contains unsupported result'))
    }
    const visit = (node: ts.Node): void => {
      if (ts.isReturnStatement(node) && node.expression !== undefined) reportReturn(node.expression)
      if (ts.isArrowFunction(node) && !ts.isBlock(node.body)) reportReturn(node.body)
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

function isFlipCall(node: ts.Node, source: ts.SourceFile): node is ts.CallExpression {
  return ts.isCallExpression(node) && /flip/iu.test(node.expression.getText(source))
}

function propertyCallName(node: ts.CallExpression): string | undefined {
  return ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : undefined
}

function errorContext(node: ts.CallExpression, source: ts.SourceFile): string | undefined {
  for (let current: ts.Node | undefined = node.parent; current !== undefined; current = current.parent) {
    if (ts.isCatchClause(current)) return 'catch handler'
    if (ts.isJsxAttribute(current) && /error|failure|failed/iu.test(current.name.getText(source))) return `JSX ${current.name.getText(source)} handler`
    if (ts.isFunctionLike(current)) {
      const parent = current.parent
      if (ts.isVariableDeclaration(parent) && /error|failure|failed/iu.test(parent.name.getText(source))) return `error handler ${parent.name.getText(source)}`
      if (ts.isPropertyAssignment(parent) && /error|failure|failed/iu.test(parent.name.getText(source))) return `error handler ${parent.name.getText(source)}`
      if (ts.isMethodDeclaration(current) && current.name !== undefined && /error|failure|failed/iu.test(current.name.getText(source))) return `error handler ${current.name.getText(source)}`
      if (ts.isCallExpression(parent)) {
        const name = propertyCallName(parent)
        const index = parent.arguments.findIndex((argument) => argument === current)
        if (name === 'catch' && index === 0) return 'promise catch handler'
        if (name === 'then' && index === 1) return 'promise rejection handler'
      }
    }
  }
  return undefined
}

function flipFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files) {
    const source = sourceFile(file)
    const visit = (node: ts.Node): void => {
      if (isFlipCall(node, source)) {
        const context = errorContext(node, source)
        if (context !== undefined) findings.push(finding(file.path, lineAt(source, node.getStart(source)), `flip call inside ${context}`))
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

function containsTierReference(node: ts.Node): boolean {
  let found = false
  const visit = (child: ts.Node): void => {
    if (found) return
    if (ts.isIdentifier(child) && child.text.toLowerCase() === 'tier') { found = true; return }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

function tierFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files.filter((candidate) => !candidate.path.startsWith('packages/composite/'))) {
    const source = sourceFile(file)
    const visit = (node: ts.Node): void => {
      let violation = false
      if (ts.isBinaryExpression(node)) {
        const comparison = node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
          || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
          || node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken
          || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken
        violation = comparison && containsTierReference(node)
      } else if (ts.isSwitchStatement(node)) {
        violation = containsTierReference(node.expression)
      } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        violation = containsTierReference(node.expression.expression)
          && /^(?:startsWith|endsWith|includes|match|test)$/u.test(node.expression.name.text)
      }
      if (violation) findings.push(finding(file.path, lineAt(source, node.getStart(source)), 'tier-dependent branch outside composite'))
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return findings
}

function namingFindings(files: readonly SourceFile[]): readonly string[] {
  return contentFindings(files, NAMING_PATTERN, { comments: true })
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

function byteIndex(haystack: Uint8Array, needle: Uint8Array): number {
  if (needle.length === 0) return -1
  outer: for (let offset = 0; offset <= haystack.length - needle.length; offset += 1) {
    for (let index = 0; index < needle.length; index += 1) {
      if (haystack[offset + index] !== needle[index]) continue outer
    }
    return offset
  }
  return -1
}

function lineAtByte(bytes: Uint8Array, offset: number): number {
  let line = 1
  for (let index = 0; index < offset; index += 1) if (bytes[index] === 10) line += 1
  return line
}

async function credentialFindings(root: string): Promise<readonly string[]> {
  const findings: string[] = []
  const tracked = await gitOutput(root, ['ls-files', '-z'])
  if (tracked.code !== 0) return ['git ls-files failed']
  const trackedPaths = tracked.text.split('\0').filter(Boolean)
  const encoder = new TextEncoder()
  const begin = ['-----BEGIN ', 'PRIVATE KEY-----'].join('')
  const rsa = ['-----BEGIN RSA ', 'PRIVATE KEY-----'].join('')
  const ec = ['-----BEGIN EC ', 'PRIVATE KEY-----'].join('')
  const openssh = ['-----BEGIN OPENSSH ', 'PRIVATE KEY-----'].join('')
  const relativeCert = ['./', 'cert/'].join('')
  const signatures = [begin, rsa, ec, openssh, relativeCert].map((signature) => encoder.encode(signature))

  for (const path of trackedPaths) {
    if (path === '.env' || (path.startsWith('.env.') && !path.endsWith('.example'))) findings.push(`tracked environment file: ${path}`)
    const keyLikePath = path.startsWith('cert/') || /\.(?:p8|pem|key|p12)$/iu.test(path)
    if (keyLikePath) findings.push(`tracked credential path: ${path}`)
    if (path.startsWith('cert/')) continue

    const file = Bun.file(resolve(root, path))
    if (!await file.exists()) continue
    const bytes = new Uint8Array(await file.arrayBuffer())
    for (const signature of signatures) {
      const offset = byteIndex(bytes, signature)
      if (offset >= 0) {
        findings.push(`${path}:${String(lineAtByte(bytes, offset))}: credential signature detected`)
        break
      }
    }
  }

  for (const sentinel of ['cert/gate-sentinel.p8', 'gate-sentinel.pem', 'gate-sentinel.key', 'gate-sentinel.p12']) {
    const ignored = Bun.spawn(['git', 'check-ignore', '--no-index', '--quiet', sentinel], { cwd: root, stdout: 'ignore', stderr: 'ignore' })
    if (await ignored.exited !== 0) findings.push(`credential pattern is not ignored: ${sentinel}`)
  }
  return findings
}

/** Run every deterministic W5a static predicate against a repository root. */
export async function runStaticGates(options: StaticGateOptions): Promise<readonly GateResult[]> {
  const root = resolve(options.root)
  const [sources, code, panel, tools] = await Promise.all([
    readGlob(root, SOURCE_GLOB),
    readGlob(root, CODE_GLOB),
    readGlob(root, PANEL_GLOB),
    readGlob(root, TOOL_GLOB),
  ])
  return [
    result('U8', 'no invented permission language', u8Findings(sources)),
    result('U9', 'no executable useState', useStateFindings(code)),
    result('U10', 'panel remains DOM-only', panelCanvasFindings(panel)),
    result('AGENT-FLAG', 'no fabricated agent-presence signal', agentFlagFindings(sources, code)),
    result('HAPTICS', 'no direct navigator vibration', hapticFindings(code)),
    result('HALO', 'no stored handedness', handednessFindings(code)),
    result('PROVIDER', 'provider branching uses capabilities', providerFindings(code)),
    result('TOOLS', 'unsupported capabilities are unregistered', toolReturnFindings(tools)),
    result('FLIP', 'no automatic flip from an error handler', flipFindings(code)),
    result('TRAILERS', 'branch commits contain no attribution trailers', await trailerFindings(root, options.commitRange)),
    result('NAMING', 'initiative ids stay out of implementation artifacts', namingFindings(sources)),
    result('TIER', 'tier comparisons are composite-owned', tierFindings(code)),
    result('CREDENTIALS', 'tracked credential material is absent and key paths stay ignored', await credentialFindings(root)),
    { id: 'U14', label: 'thumb occlusion requires owner phone-in-hand validation', status: 'manual', findings: [] },
    { id: 'U15', label: 'unsupported controls absent, reviewer inspection required', status: 'manual', findings: [] },
  ]
}

/** Render one stable, grep-friendly status line plus metadata-only evidence. */
export function formatGate(gate: GateResult): string {
  const prefix = gate.status === 'pass' ? 'PASS' : gate.status === 'manual' ? 'MANUAL' : 'FAIL'
  const details = gate.findings.map((item) => `\n      ${item}`).join('')
  return `${prefix.padEnd(6)} ${gate.id.padEnd(12)} ${gate.label}${details}`
}

/** Count automated results separately from unresolved manual validation. */
export function summarizeGates(results: readonly GateResult[]): GateSummary {
  return {
    automatedPassed: results.filter((gate) => gate.status === 'pass').length,
    automatedFailed: results.filter((gate) => gate.status === 'fail').length,
    manualOutstanding: results.filter((gate) => gate.status === 'manual').length,
  }
}

/** Format a summary that never represents manual gates as cleared. */
export function formatSummary(summary: GateSummary): string {
  return `${String(summary.automatedPassed)} automated passed; ${String(summary.automatedFailed)} automated failed; ${String(summary.manualOutstanding)} manual outstanding`
}

/** Return true when every automated predicate passed; manual gates stay explicit. */
export function gatesPassed(results: readonly GateResult[]): boolean {
  return results.every((gate) => gate.status !== 'fail')
}
