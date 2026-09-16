import { defineConfig } from 'drizzle-kit';
import { config } from '@music-rank/config';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.database.url
  }
});
