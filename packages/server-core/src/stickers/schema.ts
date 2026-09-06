import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { StickerGenre, StickerPlacement, StickerId } from '@webpod/stickers'

export const collections = sqliteTable('sticker_collections', {
  owner: text('owner').primaryKey(),
  createdAt: integer('created_at').notNull(),
  importStatus: text('import_status', { enum: ['pending', 'complete', 'partial', 'failed'] }).notNull().default('pending'),
  revision: integer('revision').notNull().default(0),
  placements: text('placements', { mode: 'json' }).$type<readonly StickerPlacement[]>().notNull().default([]),
  lastCreditAt: integer('last_credit_at').notNull().default(0),
  starterEvaluated: integer('starter_evaluated', { mode: 'boolean' }).notNull().default(false),
})
export const tracks = sqliteTable('sticker_tracks', {
  owner: text('owner').notNull().references(() => collections.owner, { onDelete: 'cascade' }),
  catalogId: text('catalog_id').notNull(),
  genre: text('genre').$type<StickerGenre>(),
  durationMs: integer('duration_ms').notNull(),
  source: text('source', { enum: ['library', 'catalog'] }).notNull(),
  catalogChecked: integer('catalog_checked', { mode: 'boolean' }).notNull().default(false),
}, (table) => [primaryKey({ columns: [table.owner, table.catalogId] })])
export const credits = sqliteTable('sticker_credits', {
  owner: text('owner').notNull().references(() => collections.owner, { onDelete: 'cascade' }),
  genre: text('genre').$type<StickerGenre>().notNull(),
  listenedMs: integer('listened_ms').notNull(),
}, (table) => [primaryKey({ columns: [table.owner, table.genre] })])
export const packs = sqliteTable('sticker_packs', {
  id: text('id').primaryKey(),
  owner: text('owner').notNull().references(() => collections.owner, { onDelete: 'cascade' }),
  grantKey: text('grant_key').notNull(),
  source: text('source', { enum: ['starter', 'listening'] }).notNull(),
  stickerIds: text('sticker_ids', { mode: 'json' }).$type<readonly StickerId[]>().notNull(),
  earnedAt: integer('earned_at').notNull(),
  openedAt: integer('opened_at'),
})
export const observations = sqliteTable('sticker_observations', {
  owner: text('owner').notNull().references(() => collections.owner, { onDelete: 'cascade' }),
  eventId: text('event_id').notNull(), streamId: text('stream_id').notNull(), sequence: integer('sequence').notNull(),
  catalogId: text('catalog_id').notNull(), positionMs: integer('position_ms').notNull(),
  playing: integer('playing', { mode: 'boolean' }).notNull(), receivedAt: integer('received_at').notNull(), creditedMs: integer('credited_ms').notNull(),
}, (table) => [primaryKey({ columns: [table.owner, table.eventId] })])

export const devices = sqliteTable('sticker_devices', {
  secretHash: text('secret_hash').primaryKey(),
  owner: text('owner').notNull().unique(),
  generation: integer('generation').notNull().default(0),
  expiresAt: integer('expires_at').notNull(),
  lastBootstrapAt: integer('last_bootstrap_at').notNull().default(0),
})
export const sessions = sqliteTable('sticker_sessions', {
  secretHash: text('secret_hash').primaryKey(),
  deviceHash: text('device_hash').notNull().references(() => devices.secretHash, { onDelete: 'cascade' }),
  generation: integer('generation').notNull(),
  storefront: text('storefront').notNull(),
  expiresAt: integer('expires_at').notNull(),
})
