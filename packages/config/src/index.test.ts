import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './index.js';

const createdDirectories: string[] = [];

function makeConfigDirectory(files: Record<string, string>): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'music-rank-config-'));
  createdDirectories.push(directory);
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(directory, name), contents);
  }
  return directory;
}

afterEach(() => {
  while (createdDirectories.length > 0) {
    const directory = createdDirectories.pop()!;
    fs.rmSync(directory, { recursive: true });
  }
});

const completeBase = [
  'APP_ENV=development',
  'NODE_ENV=development',
  'PORT=3001',
  'APP_ORIGIN=http://localhost:5173',
  'DATABASE_URL=postgresql://music_rank:music_rank@localhost:5432/music_rank',
  'LOG_LEVEL=debug'
].join('\n');

describe('loadConfig', () => {
  it('reads the base file for the requested environment', () => {
    const configDirectory = makeConfigDirectory({ '.env.development': completeBase });
    const config = loadConfig({ env: {}, configDirectory });
    expect(config.appEnv).toBe('development');
    expect(config.server.port).toBe(3001);
    expect(config.server.appOrigin).toBe('http://localhost:5173');
    expect(config.logging.level).toBe('debug');
  });

  it('lets the local file override the base file', () => {
    const configDirectory = makeConfigDirectory({
      '.env.development': completeBase,
      '.env.development.local': 'DATABASE_URL=postgresql://music_rank:music_rank@localhost:5434/music_rank'
    });
    const config = loadConfig({ env: {}, configDirectory });
    expect(config.database.url).toContain('5434');
  });

  it('lets real environment variables override the local file', () => {
    const configDirectory = makeConfigDirectory({
      '.env.development': completeBase,
      '.env.development.local': 'PORT=4000'
    });
    const config = loadConfig({ env: { PORT: '5000' }, configDirectory });
    expect(config.server.port).toBe(5000);
  });

  it('throws naming the key when DATABASE_URL is missing', () => {
    const configDirectory = makeConfigDirectory({
      '.env.development': 'APP_ORIGIN=http://localhost:5173'
    });
    expect(() => loadConfig({ env: {}, configDirectory })).toThrow(/DATABASE_URL/);
  });

  it('rejects an empty DATABASE_URL instead of silently accepting it', () => {
    const configDirectory = makeConfigDirectory({ '.env.development': completeBase });
    expect(() => loadConfig({ env: { DATABASE_URL: '' }, configDirectory })).toThrow(/DATABASE_URL/);
  });

  it('rejects an unknown APP_ENV', () => {
    const configDirectory = makeConfigDirectory({ '.env.development': completeBase });
    expect(() => loadConfig({ env: { APP_ENV: 'qa' }, configDirectory })).toThrow(/APP_ENV/);
  });

  it('accepts NODE_ENV=test because vitest sets it', () => {
    const configDirectory = makeConfigDirectory({ '.env.development': completeBase });
    const config = loadConfig({ env: { NODE_ENV: 'test' }, configDirectory });
    expect(config.nodeEnv).toBe('test');
  });

  it('applies defaults for PORT, LOG_LEVEL and DEMO_USER_ID', () => {
    const configDirectory = makeConfigDirectory({
      '.env.development': 'APP_ORIGIN=http://localhost:5173\nDATABASE_URL=postgresql://x'
    });
    const config = loadConfig({ env: {}, configDirectory });
    expect(config.server.port).toBe(3001);
    expect(config.logging.level).toBe('info');
    expect(config.demo.userId).toBe('7c5b5636-48f8-4e9b-89b0-06381d28496b');
  });
});
