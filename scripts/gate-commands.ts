export interface CommandGate { readonly id: string; readonly label: string; readonly command: readonly string[] }

export const TEST_TIMEOUT_MS = 30_000

export const COMMAND_GATES: readonly CommandGate[] = [
  { id: 'TYPES', label: 'per-project typecheck, including the runner', command: ['bun', 'run', 'typecheck'] },
  { id: 'LINT', label: 'repo lint', command: ['bun', 'run', 'lint'] },
  { id: 'TESTS', label: 'repo tests', command: ['bun', 'test', '--timeout', String(TEST_TIMEOUT_MS)] },
] as const
