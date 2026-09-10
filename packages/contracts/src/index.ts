import { z } from 'zod';

export const singingStatuses = ['CAN_SING', 'REGULARLY_SING', 'PRACTICING', 'WANT_TO_LEARN'] as const;
export const singingStatusSchema = z.enum(singingStatuses);
export const listTypes = ['TOP_LIST', 'SINGING_LIST'] as const;
export const listTypeSchema = z.enum(listTypes);
export const listVisibilities = ['PRIVATE', 'PUBLIC'] as const;
export const listVisibilitySchema = z.enum(listVisibilities);

export const usernameSchema = z.string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,32}$/, 'Username must be 3–32 letters, numbers, or underscores');
export const displayNameSchema = z.string().trim().min(1).max(80);
export const passwordSchema = z.string().min(12).max(128);

export const registerSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  password: passwordSchema
});

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128)
});

export const listTypePathSchema = z.enum(['top-list', 'singing-list']).transform((value) =>
  value === 'top-list' ? 'TOP_LIST' as const : 'SINGING_LIST' as const
);

export const updateListVisibilitySchema = z.object({
  visibility: listVisibilitySchema
});

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
export type ListType = z.infer<typeof listTypeSchema>;
export type ListVisibility = z.infer<typeof listVisibilitySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateListVisibilityInput = z.infer<typeof updateListVisibilitySchema>;
export type AddTopListItemInput = z.infer<typeof addTopListItemSchema>;
export type ReorderTopListInput = z.infer<typeof reorderTopListSchema>;
export type UpsertSingingListItemInput = z.infer<typeof upsertSingingListItemSchema>;
