import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { closeDatabase } from './client.js';
import { dryRunRankingImport, importRankingManifest, replaceRankingManifest } from './ranking-importer.js';

const argumentsList = process.argv.slice(2);
const dryRun = argumentsList[0] === '--dry-run';
const replace = argumentsList[0] === '--replace';
const manifestArgument = dryRun || replace ? argumentsList[1] : argumentsList[0];

if (!manifestArgument || dryRun && replace || argumentsList.length !== (dryRun || replace ? 2 : 1)) {
  throw new Error('Usage: import:ranking [--dry-run | --replace] <manifest-path>');
}

try {
  const manifest = JSON.parse(await readFile(resolve(process.cwd(), manifestArgument), 'utf8')) as unknown;
  const summary = dryRun
    ? await dryRunRankingImport(manifest)
    : replace
      ? await replaceRankingManifest(manifest)
      : await importRankingManifest(manifest);
  console.log(JSON.stringify({
    level: 'info',
    message: dryRun ? 'Ranking import dry run complete' : replace ? 'Ranking replaced' : 'Ranking imported',
    ...summary
  }));
} finally {
  await closeDatabase();
}
