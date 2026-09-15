import { closeDatabase } from './client.js';
import { publishRankingReplacingDemo } from './ranking-importer.js';

const [rankingSlug, ...extraArguments] = process.argv.slice(2);

if (!rankingSlug || extraArguments.length > 0) {
  throw new Error('Usage: publish:ranking <ranking-slug>');
}

try {
  const summary = await publishRankingReplacingDemo(rankingSlug);
  console.log(JSON.stringify({ level: 'info', message: 'Ranking published and Demo unpublished', ...summary }));
} finally {
  await closeDatabase();
}
