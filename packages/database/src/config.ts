import 'dotenv/config';

export const demoUserId = process.env.DEMO_USER_ID ?? '7c5b5636-48f8-4e9b-89b0-06381d28496b';

export const databaseUrl = process.env.DATABASE_URL
  ?? 'postgresql://music_rank:music_rank@localhost:5432/music_rank';
