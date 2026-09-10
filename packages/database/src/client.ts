import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseUrl } from './config.js';
import * as schema from './schema.js';

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle({ client: pool, schema });

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
