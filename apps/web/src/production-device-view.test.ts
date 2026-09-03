import { describe, expect, test } from 'bun:test'
import { accountStatusForRuntime } from './production-device-view'

describe('production device provider status', () => {
  test('does not cover the demo library with a failed Apple Music attempt', () => {
    expect(accountStatusForRuntime({ activeMode: 'fixture', phase: 'error' })).toBeNull()
  })

  test('keeps failures visible while Apple Music remains the active provider', () => {
    expect(accountStatusForRuntime({ activeMode: 'apple', phase: 'error' })).toBe('error')
    expect(accountStatusForRuntime({ activeMode: 'apple', phase: 'signing-in' })).toBe('loading')
    expect(accountStatusForRuntime({ activeMode: 'apple', phase: 'permission-denied' })).toBeNull()
    expect(accountStatusForRuntime({ activeMode: 'apple', phase: 'authorized' })).toBeUndefined()
  })
})
