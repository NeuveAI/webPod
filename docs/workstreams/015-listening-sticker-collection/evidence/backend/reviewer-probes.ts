import { openStickerDatabase } from '../../../../../packages/server-core/src/stickers/database.ts'
import { createStickerRepository } from '../../../../../packages/server-core/src/stickers/repository.ts'

// Synthetic owner/track fixtures only. These probes print the current defect,
// rather than assert that incorrect behavior is a desirable regression contract.
const database = openStickerDatabase(':memory:')
let time = 1_000_000
const repository = createStickerRepository(database.db, () => time)
const rock = { catalogId: '123', genre: 'rock' as const, durationMs: 1_000_000 }
function observation(sequence: number) {
  return { eventId: `event-${String(sequence)}`, streamId: 'stream', sequence, catalogId: '123', positionMs: sequence * 10_000, playing: true }
}
try {
  repository.ensureOwner('provenance')
  repository.enrichTrack('provenance', rock)
  console.log('B1 catalogue then library starter packs:', repository.importTracks('provenance', [rock], 'complete').packs.length)

  repository.ensureOwner('late-import')
  repository.enrichTrack('late-import', rock)
  for (let sequence = 0; sequence <= 30; sequence++) {
    repository.observe('late-import', observation(sequence))
    time += 10_000
  }
  console.log('B2 packs before import:', repository.inventory('late-import').packs.map((pack) => pack.stickerIds))
  console.log('B2 packs after import:', repository.importTracks('late-import', [{ ...rock, catalogId: '456' }], 'complete').packs.map((pack) => pack.stickerIds))

  repository.ensureOwner('missing-metadata')
  repository.importTracks('missing-metadata', [{ ...rock, genre: null }], 'complete')
  repository.enrichTrack('missing-metadata', rock)
  repository.observe('missing-metadata', observation(0))
  time += 10_000
  repository.observe('missing-metadata', observation(1))
  console.log('B3 explicit enrichment then 10s rock listening:', repository.inventory('missing-metadata').progress.find((row) => row.genre === 'rock')?.listenedMs)
} finally { database.close() }
