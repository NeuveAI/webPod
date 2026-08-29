import { Glob } from 'bun'
import { lstat } from 'node:fs/promises'
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

/** Hash dirty metadata plus safe regular-file content without opening design.pen, cert, or symlink targets. */
export async function safeDirtyFingerprint(rootInput: string): Promise<string> {
  const root = resolve(rootInput)
  const status = await gitOutput(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  if (status.code !== 0) throw new Error('git status failed while fingerprinting')
  const entries = status.text.split('\0').filter(Boolean)
  const hasher = new Bun.CryptoHasher('sha256')
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index] ?? ''
    hasher.update(entry)
    const path = normalizePath(entry.slice(3))
    const renamed = entry[0] === 'R' || entry[1] === 'R'
    if (renamed) {
      const destination = entries[index + 1]
      if (destination !== undefined) { hasher.update(destination); index += 1 }
    }
    if (path === 'design.pen' || path.startsWith('cert/')) continue
    const absolute = resolve(root, path)
    let fileStatus
    try {
      fileStatus = await lstat(absolute)
    } catch {
      continue
    }
    if (!fileStatus.isFile()) continue
    hasher.update(new Uint8Array(await Bun.file(absolute).arrayBuffer()))
  }
  return hasher.digest('hex')
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
  readonly userVisible: boolean
  readonly kind: 'comment' | 'string' | 'template' | 'text'
}

const U8_PATTERN = /\b(?:allows?|allowed|allowing|den(?:y|ies|ied|ying)|permits?|permitted|permitting|permissions?|grants?|granted|granting|authori[sz](?:e|es|ed|ing|ation|ations)?|approv(?:e|es|ed|ing|al|als)|pending|blocked|asks?\s+(?:for|to)|asked\s+(?:for|to)|waiting\s+for)\b/iu
const AGENT_FLAG_PATTERN = /^(?:agentPresent|agentAttached|agentIdle|isAgentConnected)$/iu
const HANDEDNESS_PATTERN = /^(?:handed|handedness|leftHand|rightHand)$/iu
const NAMING_PATTERN = /(?<![\d.])002(?!\d)|implementation-spine|workstream/iu
const WORKSTREAM_ROOT_PATTERN = /^workstreams$/u
const WORKSTREAM_DIRECTORY_PATTERN = /^\d{3}-[a-z0-9]+(?:-[a-z0-9]+)*$/u
const BOOKKEEPING_SUBDIRECTORY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const BOOKKEEPING_FILE_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/u
const BOOKKEEPING_DIRECTORIES = new Set(['decisions', 'diary', 'evidence', 'reviews'])
const TEMPLATE_EXPRESSION_MARKER = '\u0000'

function normalizePath(path: string): string {
  return path.split(sep).join('/')
}

/** Accept canonical bookkeeping files, including canonical nested evidence directories. */
function isCanonicalBookkeepingPath(path: string): boolean {
  let relative = path
  while (relative.startsWith('../')) relative = relative.slice(3)

  const segments = relative.split('/')
  if (segments.length < 5 || segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return false

  const [docs, workstreams, workstream, directory] = segments
  const nestedDirectories = segments.slice(4, -1)
  const file = segments.at(-1)
  const baseIsCanonical = docs === 'docs'
    && workstreams !== undefined
    && WORKSTREAM_ROOT_PATTERN.test(workstreams)
    && workstream !== undefined
    && WORKSTREAM_DIRECTORY_PATTERN.test(workstream)
    && directory !== undefined
    && BOOKKEEPING_DIRECTORIES.has(directory)
    && file !== undefined
    && BOOKKEEPING_FILE_PATTERN.test(file)
  if (!baseIsCanonical) return false
  if (directory !== 'evidence' && nestedDirectories.length > 0) return false
  return nestedDirectories.every((segment) => BOOKKEEPING_SUBDIRECTORY_PATTERN.test(segment))
}

function isCanonicalBookkeepingTemplate(text: string): boolean {
  const dynamicRoot = `${TEMPLATE_EXPRESSION_MARKER}/`
  if (!text.startsWith(dynamicRoot)) return false
  const relative = text.slice(dynamicRoot.length)
  return !relative.includes(TEMPLATE_EXPRESSION_MARKER) && isCanonicalBookkeepingPath(relative)
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
    const absolute = resolve(root, rawPath)
    let status
    try {
      status = await lstat(absolute)
    } catch {
      continue
    }
    if (!status.isFile()) continue
    files.push({ path, text: await Bun.file(absolute).text() })
  }
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

function authoredText(file: SourceFile, includeComments: boolean): readonly LocatedText[] {
  if (!/\.(?:[cm]?[jt]sx?|json)$/u.test(file.path)) {
    const text = includeComments ? file.text : file.text.replaceAll(/\/\*[\s\S]*?\*\//gu, '').replaceAll(/\/\/.*$/gmu, '')
    return text.split('\n').map((line, index) => ({ path: file.path, line: index + 1, text: line, userVisible: false, kind: 'text' }))
  }

  const source = sourceFile(file)
  const pieces: LocatedText[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isJsxText(node)) {
      pieces.push({
        path: file.path,
        line: lineAt(source, node.getStart(source)),
        text: node.text,
        userVisible: ts.isJsxText(node),
        kind: ts.isJsxText(node) ? 'text' : 'string',
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  if (includeComments) {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, file.path.endsWith('x') ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, file.text)
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia) {
        pieces.push({ path: file.path, line: lineAt(source, scanner.getTokenPos()), text: scanner.getTokenText(), userVisible: false, kind: 'comment' })
      }
    }
  }
  return pieces
}

function staticTemplateExpression(node: ts.Expression, bindings: ReadonlyMap<string, string>): string | undefined {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isIdentifier(node)) return bindings.get(node.text)
  if (ts.isParenthesizedExpression(node)) return staticTemplateExpression(node.expression, bindings)
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticTemplateExpression(node.left, bindings)
    const right = staticTemplateExpression(node.right, bindings)
    if (left !== undefined && right !== undefined) return `${left}${right}`
  }
  return undefined
}

function staticStringBindings(source: ts.SourceFile): ReadonlyMap<string, string> {
  const declarations = new Map<string, ts.Expression[]>()
  const collect = (node: ts.Node): void => {
    if (ts.isVariableDeclarationList(node) && (node.flags & ts.NodeFlags.Const) !== 0) {
      for (const declaration of node.declarations) {
        if (!ts.isIdentifier(declaration.name) || declaration.initializer === undefined) continue
        const existing = declarations.get(declaration.name.text) ?? []
        existing.push(declaration.initializer)
        declarations.set(declaration.name.text, existing)
      }
    }
    ts.forEachChild(node, collect)
  }
  collect(source)

  const bindings = new Map<string, string>()
  let changed = true
  while (changed) {
    changed = false
    for (const [name, initializers] of declarations) {
      if (bindings.has(name) || initializers.length !== 1) continue
      const [initializer] = initializers
      if (initializer === undefined) continue
      const value = staticTemplateExpression(initializer, bindings)
      if (value === undefined) continue
      bindings.set(name, value)
      changed = true
    }
  }
  return bindings
}

/** Reconstruct static template text and mark every expression that cannot be proven constant. */
function authoredTemplates(file: SourceFile): readonly LocatedText[] {
  if (!/\.(?:[cm]?[jt]sx?)$/u.test(file.path)) return []
  const source = sourceFile(file)
  const bindings = staticStringBindings(source)
  const pieces: LocatedText[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isTemplateExpression(node)) {
      let text = node.head.text
      for (const span of node.templateSpans) {
        text += staticTemplateExpression(span.expression, bindings) ?? TEMPLATE_EXPRESSION_MARKER
        text += span.literal.text
      }
      pieces.push({
        path: file.path,
        line: lineAt(source, node.getStart(source)),
        text,
        userVisible: false,
        kind: 'template',
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return pieces
}

function contentFindings(files: readonly SourceFile[], pattern: RegExp, options: { readonly comments: boolean; readonly templates?: boolean; readonly ignore?: (item: LocatedText) => boolean }): readonly string[] {
  const findings = new Set<string>()
  for (const file of files) {
    const items = options.templates === true
      ? [...authoredText(file, options.comments), ...authoredTemplates(file)]
      : authoredText(file, options.comments)
    for (const item of items) {
      if (options.ignore?.(item) === true) continue
      const inspectedText = item.kind === 'template'
        ? item.text.replaceAll(TEMPLATE_EXPRESSION_MARKER, '')
        : item.text
      pattern.lastIndex = 0
      const match = pattern.exec(inspectedText)
      if (match !== null) {
        const matchedLine = item.line + (inspectedText.slice(0, match.index).match(/\n/g)?.length ?? 0)
        findings.add(finding(item.path, matchedLine, 'forbidden authored content'))
      }
    }
  }
  return [...findings]
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
  const productFiles = files.filter((file) => !file.path.startsWith('scripts/')
    && !/\.(?:test|spec|e2e)\.[cm]?[jt]sx?$/u.test(file.path))
  return contentFindings(productFiles, U8_PATTERN, {
    comments: false,
    ignore: (item) => {
      const withoutRequiredState = item.text.replaceAll('permission-denied', '')
      if (!item.userVisible && /^(?:authorize|authorized|unauthorize|unauthorized|authorization|permissions?|permission_denied|insufficient permissions|pending)$/iu.test(withoutRequiredState.trim())) return true
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

function assignedIdentifier(node: ts.Node): string | undefined {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.name.text
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(node.left)) return node.left.text
  return undefined
}

function assignedExpression(node: ts.Node): ts.Expression | undefined {
  if (ts.isVariableDeclaration(node)) return node.initializer
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) return node.right
  return undefined
}

function aliasesOf(source: ts.SourceFile, seed: (node: ts.Expression) => boolean): ReadonlySet<string> {
  const aliases = new Set<string>()
  let changed = true
  while (changed) {
    changed = false
    const visit = (node: ts.Node): void => {
      const name = assignedIdentifier(node)
      const expression = assignedExpression(node)
      if (name !== undefined && expression !== undefined && (seed(expression) || (ts.isIdentifier(expression) && aliases.has(expression.text))) && !aliases.has(name)) {
        aliases.add(name)
        changed = true
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return aliases
}

function providerFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files.filter((candidate) => !candidate.path.startsWith('packages/providers/'))) {
    const source = sourceFile(file)
    const providerAliases = aliasesOf(source, (node) => ts.isIdentifier(node) && node.text === 'provider')
    const isProviderExpression = (node: ts.Expression): boolean => ts.isIdentifier(node) && (node.text === 'provider' || providerAliases.has(node.text))
    const visit = (node: ts.Node): void => {
      let violation = false
      if (ts.isPropertyAccessExpression(node)) violation = isProviderExpression(node.expression) && node.name.text === 'id'
      if (ts.isElementAccessExpression(node)) violation = isProviderExpression(node.expression) && node.argumentExpression !== undefined
        && ts.isStringLiteralLike(node.argumentExpression) && node.argumentExpression.text === 'id'
      if (ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) && node.initializer !== undefined
        && isProviderExpression(node.initializer)) {
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
    const propertyWrites: Array<{ readonly owner: string; readonly value: ts.Expression }> = []
    const collect = (node: ts.Node): void => {
      const name = assignedIdentifier(node)
      const initializer = assignedExpression(node)
      if (name !== undefined && initializer !== undefined) declarations.push({ name, initializer })
      if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        const owner = ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)
          ? node.left.expression
          : undefined
        if (owner !== undefined && ts.isIdentifier(owner)) propertyWrites.push({ owner: owner.text, value: node.right })
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
      for (const write of propertyWrites) {
        if (tainted.has(write.owner)) continue
        if (containsUnsupportedLiteral(write.value) || identifiersIn(write.value).some((name) => tainted.has(name))) {
          tainted.add(write.owner)
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
      const parent: ts.Node = current.parent
      if (ts.isVariableDeclaration(parent) && /error|failure|failed/iu.test(parent.name.getText(source))) return `error handler ${parent.name.getText(source)}`
      if (ts.isPropertyAssignment(parent) && /error|failure|failed/iu.test(parent.name.getText(source))) return `error handler ${parent.name.getText(source)}`
      if (ts.isMethodDeclaration(current) && current.name !== undefined && /error|failure|failed/iu.test(current.name.getText(source))) return `error handler ${current.name.getText(source)}`
      if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken && parent.right === current) {
        const callbackName = ts.isPropertyAccessExpression(parent.left)
          ? parent.left.name.text
          : ts.isElementAccessExpression(parent.left) && parent.left.argumentExpression !== undefined && ts.isStringLiteralLike(parent.left.argumentExpression)
            ? parent.left.argumentExpression.text
            : undefined
        if (callbackName !== undefined && /^(?:on)?(?:error|failure|failed)$/iu.test(callbackName)) return `assigned ${callbackName} handler`
      }
      if (ts.isCallExpression(parent)) {
        const name = propertyCallName(parent)
        const index = parent.arguments.findIndex((argument) => argument === current)
        if (name === 'catch' && index === 0) return 'promise catch handler'
        if (name === 'then' && index === 1) return 'promise rejection handler'
        const event = parent.arguments[0]
        const handler: ts.Expression | undefined = parent.arguments[1]
        const isEventListener = ts.isIdentifier(parent.expression)
          ? parent.expression.text === 'addEventListener'
          : ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === 'addEventListener'
        if (event !== undefined && ts.isStringLiteralLike(event) && /error|failure|failed/iu.test(event.text)
          && handler === current && isEventListener) return `event ${event.text} handler`
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

function tierFindings(files: readonly SourceFile[]): readonly string[] {
  const findings: string[] = []
  for (const file of files.filter((candidate) => !candidate.path.startsWith('packages/composite/'))) {
    const source = sourceFile(file)
    const tierAliases = aliasesOf(source, (node) => ts.isIdentifier(node) && node.text.toLowerCase() === 'tier')
    const containsTierOrAlias = (node: ts.Node): boolean => {
      let found = false
      const inspect = (child: ts.Node): void => {
        if (ts.isIdentifier(child) && (child.text.toLowerCase() === 'tier' || tierAliases.has(child.text))) found = true
        if (!found) ts.forEachChild(child, inspect)
      }
      inspect(node)
      return found
    }
    const visit = (node: ts.Node): void => {
      let violation = false
      if (ts.isBinaryExpression(node)) {
        const comparison = node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken
          || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken
          || node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken
          || node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken
        violation = comparison && containsTierOrAlias(node)
      } else if (ts.isSwitchStatement(node)) {
        violation = containsTierOrAlias(node.expression)
      } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        violation = containsTierOrAlias(node.expression.expression)
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
  return contentFindings(files, NAMING_PATTERN, {
    comments: true,
    templates: true,
    ignore: (item) => item.path.startsWith('scripts/')
      && ((item.kind === 'string' && isCanonicalBookkeepingPath(item.text))
        || (item.kind === 'template' && isCanonicalBookkeepingTemplate(item.text))),
  })
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
    if (path === 'design.pen' || path.startsWith('cert/')) continue

    const absolute = resolve(root, path)
    let status
    try {
      status = await lstat(absolute)
    } catch {
      continue
    }
    if (!status.isFile()) continue
    const file = Bun.file(absolute)
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
