import { z } from 'zod';

export const singingStatuses = ['CAN_SING', 'REGULARLY_SING', 'PRACTICING', 'WANT_TO_LEARN'] as const;
export const singingStatusSchema = z.enum(singingStatuses);

export const songIdSchema = z.uuid();
export const rankingIdSchema = z.uuid();
export const searchQuerySchema = z.string().trim().max(120).optional();
export const artistFilterSchema = z.string().trim().max(120).optional();
export const releaseYearFilterSchema = z.coerce.number().int().min(1800).max(2100).optional();

export const addTopListItemSchema = z.object({
  songId: songIdSchema
});

export const reorderTopListSchema = z.object({
  orderedSongIds: z.array(songIdSchema).min(1).max(10)
}).superRefine(({ orderedSongIds }, context) => {
  if (new Set(orderedSongIds).size !== orderedSongIds.length) {
    context.addIssue({ code: 'custom', message: 'orderedSongIds must not contain duplicates' });
  }
});

export const upsertSingingListItemSchema = z.object({
  status: singingStatusSchema.default('WANT_TO_LEARN'),
  note: z.string().max(300).nullable().optional()
});

export type SingingStatus = z.infer<typeof singingStatusSchema>;
export type AddTopListItemInput = z.infer<typeof addTopListItemSchema>;
export type ReorderTopListInput = z.infer<typeof reorderTopListSchema>;
export type UpsertSingingListItemInput = z.infer<typeof upsertSingingListItemSchema>;
