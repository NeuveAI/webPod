import { describe, expect, test } from 'bun:test'

import { APPLE_SUPPORTS } from './apple/matrix.ts'
import { CAPABILITIES } from './capability.ts'
import { SPOTIFY_SUPPORTS } from './spotify/matrix.ts'
import type { Capability, CapabilityMatrix } from './capability.ts'

/**
 * D-045 (LAW) applied as a gate rather than as a convention.
 *
 * Structural evidence — a mechanism that makes a thing impossible — may carry
 * `VERIFIED`. Testimonial evidence, which is documentation prose or a staff
 * statement, may not: it goes stale silently while the statement does not
 * change. Combined with D-022's provenance axis that yields one checkable rule:
 *
 * > **No `false` row may be labelled `VERIFIED · docs`.**
 *
 * An absence read off a document is testimonial by construction. An absence
 * *measured* against the running API is not, which is why Apple's lyrics rows
 * are legitimately `VERIFIED · live` — the 400/40012 was observed.
 *
 * The comments are parsed from source because that is where the labels live and
 * nothing else was reading them. Before this, `spotify/matrix.ts` stamped
 * `VERIFIED · docs` on four absence claims while hedging two identical ones,
 * and the split survived a full review pass because a label is prose until
 * something asserts it.
 */
const MATRIX_FILES: readonly (readonly [string, string, CapabilityMatrix])[] = [
  ['apple', `${import.meta.dir}/apple/matrix.ts`, APPLE_SUPPORTS],
  ['spotify', `${import.meta.dir}/spotify/matrix.ts`, SPOTIFY_SUPPORTS],
]

interface LabelledRow {
  readonly capability: Capability
  readonly value: boolean
  readonly row: number
  readonly strength: string
  readonly provenance: string
}

/**
 * Pairs each matrix member with its `row N · STRENGTH · PROVENANCE` label.
 *
 * Two comment forms are in use and both are legitimate: a parity row carries
 * its label inline after the value, and a row with an argument carries a
 * docblock above it. The inline form is checked first, because a docblock
 * belonging to an earlier member sits above it too.
 */
async function readLabelledRows(path: string): Promise<readonly LabelledRow[]> {
  const source = await Bun.file(path).text()
  const label = /row\s+(\d+)\s+·\s+(VERIFIED|LIKELY|UNVERIFIED)\s+·\s+(docs|live)/
  const labelAnywhere = new RegExp(label.source, 'g')
  const member = /^ {2}([a-zA-Z]+): (true|false),(.*)$/gm

  const preceding: { index: number; row: number; strength: string; provenance: string }[] = []
  for (const match of source.matchAll(labelAnywhere)) {
    preceding.push({
      index: match.index,
      row: Number(match[1]),
      strength: match[2] ?? '',
      provenance: match[3] ?? '',
    })
  }

  const rows: LabelledRow[] = []
  for (const match of source.matchAll(member)) {
    const name = match[1] ?? ''
    if (!(CAPABILITIES as readonly string[]).includes(name)) continue

    const inline = label.exec(match[3] ?? '')
    const found =
      inline === null
        ? preceding.filter((l) => l.index < match.index).at(-1)
        : { index: match.index, row: Number(inline[1]), strength: inline[2] ?? '', provenance: inline[3] ?? '' }
    if (found === undefined) throw new Error(`no evidence label for "${name}" in ${path}`)

    rows.push({
      capability: name as Capability,
      value: match[2] === 'true',
      row: found.row,
      strength: found.strength,
      provenance: found.provenance,
    })
  }
  return rows
}

describe('D-045 — every capability value carries an evidence label', () => {
  for (const [provider, path, matrix] of MATRIX_FILES) {
    test(`${provider}: every one of the 25 rows is labelled`, async () => {
      const rows = await readLabelledRows(path)
      expect(rows.map((r) => r.capability).sort()).toEqual([...CAPABILITIES].sort())
      // The parse must agree with the shipped matrix, or it is reading comments
      // that no longer sit above the values they describe.
      for (const row of rows) expect(row.value).toBe(matrix[row.capability])
    })

    test(`${provider}: no absence claim is VERIFIED on documentation alone`, async () => {
      const rows = await readLabelledRows(path)
      const offenders = rows
        .filter((r) => !r.value && r.strength === 'VERIFIED' && r.provenance === 'docs')
        .map((r) => `row ${String(r.row)} ${r.capability}`)
      expect(offenders).toEqual([])
    })

    test(`${provider}: a VERIFIED absence carries live provenance`, async () => {
      const rows = await readLabelledRows(path)
      for (const row of rows.filter((r) => !r.value && r.strength === 'VERIFIED')) {
        expect(row.provenance).toBe('live')
      }
    })
  }

  test('Apple keeps its two measured absences at VERIFIED · live', async () => {
    // The rule must not be satisfied by flattening everything to LIKELY. The
    // lyrics rows were *measured* — 400/40012 with paired controls — and
    // downgrading them would throw away the strongest negative in the project.
    const rows = await readLabelledRows(`${import.meta.dir}/apple/matrix.ts`)
    for (const name of ['lyrics', 'lyricsSynced'] as const) {
      const row = rows.find((r) => r.capability === name)
      expect(row?.strength).toBe('VERIFIED')
      expect(row?.provenance).toBe('live')
    }
  })

  test('Apple keeps its one measured presence at VERIFIED · live', async () => {
    const rows = await readLabelledRows(`${import.meta.dir}/apple/matrix.ts`)
    const row = rows.find((r) => r.capability === 'stationSeedFromTrack')
    expect(row?.strength).toBe('VERIFIED')
    expect(row?.provenance).toBe('live')
  })

  test('rows 10, 11, 18 and 7 are LIKELY on Apple, never VERIFIED (D-029)', async () => {
    // Someone will reopen `pod-edit-playlist` and say "we verified this". They
    // must find LIKELY. That sentence is the entire value of the label.
    const rows = await readLabelledRows(`${import.meta.dir}/apple/matrix.ts`)
    for (const name of ['playlistRemoveTracks', 'playlistReorder', 'queueRemove', 'queueReorder', 'libraryRemove'] as const) {
      expect(rows.find((r) => r.capability === name)?.strength).toBe('LIKELY')
    }
  })
})
