/** Minimal WebMCP boundary from webmcp/index.bs revision 7b3f50f, §§ ModelContext,
 * ModelContextTool and ToolExecuteCallbackOptions (draft September 4, 2026).
 * webmcp-types 0.1.3 omits callback cancellation and is deliberately not used. */
export interface NativeTool {
  readonly name: string
  readonly description: string
  readonly inputSchema: Readonly<Record<string, unknown>>
  readonly annotations: { readonly readOnlyHint: boolean; readonly untrustedContentHint: boolean; readonly consequentialHint: boolean }
  readonly execute: (input: unknown, options: { readonly signal: AbortSignal }) => Promise<object>
}
export interface NativeModelContext {
  registerTool(tool: NativeTool, options: { readonly signal: AbortSignal }): Promise<undefined>
}
const contexts = new WeakMap<object, NativeModelContext>()
const owners = new WeakMap<NativeModelContext, AbortController>()
/** Feature-detect only the current document API; never install a replacement. */
export function modelContextOf(document: object): NativeModelContext | null {
  const existing = contexts.get(document)
  if (existing !== undefined) return existing
  const value: unknown = Reflect.get(document, 'modelContext')
  if (typeof value !== 'object' || value === null || !('registerTool' in value) || typeof value.registerTool !== 'function') return null
  const register = value.registerTool
  const context: NativeModelContext = { registerTool: async (tool, options) => { await register.call(value, tool, options); return undefined } }
  contexts.set(document, context)
  return context
}
/** A single mount owns registration and every execution. Disposal aborts both;
 * failed partial registration rolls back with the same native signal. */
export function registerTools(context: NativeModelContext, tools: readonly NativeTool[]): { readonly ready: Promise<void>; readonly dispose: () => void } {
  if (owners.has(context)) throw new Error('WebMCP tools are already mounted for this context.')
  const controller = new AbortController()
  owners.set(context, controller)
  const dispose = () => {
    controller.abort()
    if (owners.get(context) === controller) owners.delete(context)
  }
  const ready = (async () => {
    try {
      for (const tool of tools) {
        controller.signal.throwIfAborted()
        await context.registerTool({ ...tool, execute: async (input, options) => {
          const signal = AbortSignal.any([options.signal, controller.signal])
          signal.throwIfAborted()
          return tool.execute(input, { signal })
        } }, { signal: controller.signal })
      }
      controller.signal.throwIfAborted()
    } catch (error) { dispose(); throw error }
  })()
  return { ready, dispose }
}
/** Reject extra fields as well as malformed values even when a caller skips schema validation. */
export function objectInput(input: unknown, fields: readonly string[]): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new TypeError('Expected an input object.')
  for (const key of Object.keys(input)) if (!fields.includes(key)) throw new TypeError(`Unknown input field: ${key}`)
  return Object.fromEntries(Object.entries(input))
}
export function finiteInput(value: unknown, name: string, limit = 360): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > limit) throw new TypeError(`${name} must be finite and between ${-limit} and ${limit}.`)
  return value
}
export function enumInput<const T extends string>(value: unknown, choices: readonly T[], name: string): T {
  for (const choice of choices) if (value === choice) return choice
  throw new TypeError(`${name} must be one of ${choices.join(', ')}.`)
}
export function tool(name: string, description: string, properties: Record<string, unknown>, execute: NativeTool['execute'], readOnlyHint = false): NativeTool {
  return { name, description, inputSchema: { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }, annotations: { readOnlyHint, untrustedContentHint: true, consequentialHint: false }, execute }
}
/** Abortable pacing with no queued catch-up work. */
export function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, milliseconds)
    signal.addEventListener('abort', abort, { once: true })
  })
}
