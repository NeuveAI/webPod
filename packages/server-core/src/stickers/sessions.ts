import { createHash, randomBytes } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import type { StickerDatabase } from './database.ts'
import { StickerError } from './repository.ts'
import { devices, sessions } from './schema.ts'

export const DEVICE_TTL_MS = 365 * 24 * 60 * 60 * 1000
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000
export const BOOTSTRAP_INTERVAL_MS = 5_000
export interface DeviceLease { readonly deviceHash: string; readonly owner: string; readonly generation: number }
export interface SessionLease extends DeviceLease { readonly sessionHash: string; readonly storefront: string }
export function newStickerSecret(): string { return randomBytes(32).toString('base64url') }
export function stickerSecretHash(secret: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(secret)) throw unauthorized()
  return createHash('sha256').update(secret).digest('hex')
}
function unauthorized(): StickerError { return new StickerError('unauthorized', 401, 'Reconnect Apple Music to collect stickers.') }

/** Secrets never enter database rows. Device recovery alone grants no inventory access.
 * Every awaited workflow ends with a synchronous lease check in its write transaction. */
export function createStickerSessions(db: StickerDatabase, now: () => number) {
  function device(hash: string): DeviceLease {
    const row = db.select().from(devices).where(eq(devices.secretHash, hash)).get()
    if (row === undefined || row.expiresAt <= now()) throw unauthorized()
    return { deviceHash: row.secretHash, owner: row.owner, generation: row.generation }
  }
  function checkDevice(lease: DeviceLease): void {
    const current = device(lease.deviceHash)
    if (current.generation !== lease.generation || current.owner !== lease.owner) throw unauthorized()
  }
  function resolve(hash: string): SessionLease {
    const row = db.select().from(sessions).where(eq(sessions.secretHash, hash)).get()
    if (row === undefined || row.expiresAt <= now()) throw unauthorized()
    const current = device(row.deviceHash)
    if (current.generation !== row.generation) throw unauthorized()
    return { ...current, sessionHash: hash, storefront: row.storefront }
  }
  return {
    resolve,
    prepare(secret: string | undefined): { readonly lease: DeviceLease; readonly secret: string | null } {
      if (secret !== undefined) {
        try { return { lease: device(stickerSecretHash(secret)), secret: null } } catch { /* invalid/expired recovery is replaced */ }
      }
      const fresh = newStickerSecret(); const hash = stickerSecretHash(fresh)
      db.insert(devices).values({ secretHash: hash, owner: crypto.randomUUID(), expiresAt: now() + DEVICE_TTL_MS }).run()
      return { lease: device(hash), secret: fresh }
    },
    begin(secret: string): DeviceLease {
      return db.transaction(() => {
        const hash = stickerSecretHash(secret); const lease = device(hash)
        const row = db.select().from(devices).where(eq(devices.secretHash, hash)).get()
        if (row === undefined) throw unauthorized()
        if (row.lastBootstrapAt !== 0 && now() - row.lastBootstrapAt < BOOTSTRAP_INTERVAL_MS) throw new StickerError('rate_limited', 429, 'Wait a moment before reconnecting your collection.')
        db.update(devices).set({ lastBootstrapAt: now() }).where(eq(devices.secretHash, hash)).run()
        db.delete(sessions).where(lt(sessions.expiresAt, now())).run()
        return lease
      }, { behavior: 'immediate' })
    },
    activate<A>(lease: DeviceLease, storefront: string, work: (owner: string) => A): { readonly secret: string; readonly result: A } {
      return db.transaction(() => {
        checkDevice(lease)
        const secret = newStickerSecret()
        const result = work(lease.owner)
        db.insert(sessions).values({ secretHash: stickerSecretHash(secret), deviceHash: lease.deviceHash, generation: lease.generation, storefront, expiresAt: now() + SESSION_TTL_MS }).run()
        return { secret, result }
      }, { behavior: 'immediate' })
    },
    authorized<A>(lease: SessionLease, work: (owner: string) => A): A {
      return db.transaction(() => {
        const current = resolve(lease.sessionHash)
        if (current.owner !== lease.owner || current.generation !== lease.generation) throw unauthorized()
        return work(current.owner)
      }, { behavior: 'immediate' })
    },
    revoke(secret: string | undefined, activeSecret?: string): readonly string[] {
      const hashes = new Set<string>()
      if (secret !== undefined) { try { const hash = stickerSecretHash(secret); device(hash); hashes.add(hash) } catch { /* Invalid recovery carries no authority. */ } }
      if (activeSecret !== undefined) { try { hashes.add(resolve(stickerSecretHash(activeSecret)).deviceHash) } catch { /* Already expired/revoked active access. */ } }
      db.transaction(() => {
        for (const hash of hashes) {
          const current = device(hash)
          db.update(devices).set({ generation: current.generation + 1, lastBootstrapAt: 0 }).where(eq(devices.secretHash, hash)).run()
          db.delete(sessions).where(eq(sessions.deviceHash, hash)).run()
        }
      }, { behavior: 'immediate' })
      return [...hashes]
    },
  }
}
