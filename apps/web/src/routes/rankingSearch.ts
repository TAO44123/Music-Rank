import { z } from 'zod';

export const rankingSearchSchema = z.object({
  q: z.string().trim().min(1).optional().catch(undefined),
  artist: z.string().trim().min(1).optional().catch(undefined),
  year: z.coerce.number().int().min(1900).max(2100).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
  signin: z.boolean().optional().catch(undefined)
});

export type RankingSearch = z.infer<typeof rankingSearchSchema>;
