import { expectTypeOf, test } from 'bun:test'

import type { W7BrowserEvidence } from './w7-browser-evidence-schema'

type ProducerIdentity = Pick<W7BrowserEvidence, 'reviewedCommit' | 'reviewedTree'>

test('the browser evidence producer requires commit and tree identity', () => {
  expectTypeOf<ProducerIdentity>().toEqualTypeOf<{
    readonly reviewedCommit: string
    readonly reviewedTree: string
  }>()
})
