import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';
import { db, closeDatabase } from './client.js';

try {
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../migrations/', import.meta.url)) });
  console.log(JSON.stringify({ level: 'info', message: 'Database migrations applied' }));
} finally {
  await closeDatabase();
}
