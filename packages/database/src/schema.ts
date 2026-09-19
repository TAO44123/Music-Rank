import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  primaryKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export const verificationStatusEnum = pgEnum('verification_status', ['DEMO', 'VERIFIED', 'UNVERIFIED']);
export const rankingSourceTypeEnum = pgEnum('ranking_source_type', ['DEMO', 'OFFICIAL', 'MEDIA', 'COMMUNITY']);
export const rankingRegionEnum = pgEnum('ranking_region', ['HK_TW', 'MAINLAND']);
export const singingStatusEnum = pgEnum('singing_status', ['CAN_SING', 'REGULARLY_SING', 'PRACTICING', 'WANT_TO_LEARN']);
export const listTypeEnum = pgEnum('list_type', ['TOP_LIST', 'SINGING_LIST']);
export const listVisibilityEnum = pgEnum('list_visibility', ['PRIVATE', 'PUBLIC']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  username: text('username'),
  displayName: text('display_name').notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex('users_username_unique').on(table.username),
  check('users_username_normalized', sql`${table.username} IS NULL OR ${table.username} = lower(${table.username})`)
]);

export const passwordCredentials = pgTable('password_credentials', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  ...timestamps
});

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  ...timestamps
}, (table) => [uniqueIndex('groups_slug_unique').on(table.slug)]);

export const groupMemberships = pgTable('group_memberships', {
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.groupId, table.userId], name: 'group_memberships_group_user_pk' }),
  index('group_memberships_user_id_index').on(table.userId)
]);

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex('auth_sessions_token_hash_unique').on(table.tokenHash)
]);

export const userListSettings = pgTable('user_list_settings', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  listType: listTypeEnum('list_type').notNull(),
  visibility: listVisibilityEnum('visibility').notNull().default('PUBLIC'),
  ...timestamps
}, (table) => [
  primaryKey({ columns: [table.userId, table.listType], name: 'user_list_settings_user_list_type_pk' })
]);

export const songs = pgTable('songs', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  artist: text('artist').notNull(),
  releaseYear: integer('release_year'),
  verificationStatus: verificationStatusEnum('verification_status').notNull().default('DEMO'),
  submittedByUserId: uuid('submitted_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  normalizedTitle: text('normalized_title').notNull(),
  normalizedArtist: text('normalized_artist').notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex('songs_normalized_title_artist_unique').on(table.normalizedTitle, table.normalizedArtist),
  index('songs_submitted_by_user_id_index').on(table.submittedByUserId)
]);

export const rankings = pgTable('rankings', {
  id: uuid('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull(),
  era: text('era'),
  decadeStart: integer('decade_start'),
  region: rankingRegionEnum('region'),
  displayOrder: integer('display_order').notNull(),
  sourceType: rankingSourceTypeEnum('source_type').notNull(),
  sourceUrl: text('source_url'),
  description: text('description'),
  isPublished: boolean('is_published').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  ...timestamps
}, (table) => [
  uniqueIndex('rankings_slug_unique').on(table.slug),
  check('rankings_decade_start_supported', sql`${table.decadeStart} IN (1980, 1990)`),
  check('rankings_display_order_positive', sql`${table.displayOrder} > 0`)
]);

export const rankingEntries = pgTable('ranking_entries', {
  id: uuid('id').primaryKey(),
  rankingId: uuid('ranking_id').notNull().references(() => rankings.id, { onDelete: 'cascade' }),
  songId: uuid('song_id').notNull().references(() => songs.id, { onDelete: 'restrict' }),
  rank: integer('rank').notNull(),
  sourceTimestampSeconds: integer('source_timestamp_seconds'),
  verificationStatus: verificationStatusEnum('verification_status').notNull().default('DEMO')
}, (table) => [
  uniqueIndex('ranking_entries_ranking_rank_unique').on(table.rankingId, table.rank),
  uniqueIndex('ranking_entries_ranking_song_unique').on(table.rankingId, table.songId),
  check('ranking_entries_rank_positive', sql`${table.rank} > 0`)
]);

export const userTopListEntries = pgTable('user_top_list_entries', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  songId: uuid('song_id').notNull().references(() => songs.id, { onDelete: 'restrict' }),
  position: integer('position').notNull(),
  ...timestamps
}, (table) => [
  uniqueIndex('user_top_list_entries_user_song_unique').on(table.userId, table.songId),
  check('user_top_list_entries_position_range', sql`${table.position} BETWEEN 1 AND 10`)
]);

export const singingListEntries = pgTable('singing_list_entries', {
  id: uuid('id').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  songId: uuid('song_id').notNull().references(() => songs.id, { onDelete: 'restrict' }),
  status: singingStatusEnum('status').notNull().default('WANT_TO_LEARN'),
  note: text('note'),
  ...timestamps
}, (table) => [
  uniqueIndex('singing_list_entries_user_song_unique').on(table.userId, table.songId)
]);

export const topListEntryReactions = pgTable('top_list_entry_reactions', {
  entryId: uuid('entry_id').notNull().references(() => userTopListEntries.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.entryId, table.userId], name: 'top_list_entry_reactions_entry_user_pk' }),
  index('top_list_entry_reactions_user_id_index').on(table.userId)
]);

export const singingListEntryReactions = pgTable('singing_list_entry_reactions', {
  entryId: uuid('entry_id').notNull().references(() => singingListEntries.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  primaryKey({ columns: [table.entryId, table.userId], name: 'singing_list_entry_reactions_entry_user_pk' }),
  index('singing_list_entry_reactions_user_id_index').on(table.userId)
]);
