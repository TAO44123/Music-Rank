import { defineConfig } from '@playwright/test';

const e2ePort = 3101;

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: `http://127.0.0.1:${e2ePort}`, browserName: 'chromium' },
  webServer: {
    // Environment goes through `env` rather than a `VAR=value` command prefix,
    // which only POSIX shells understand; on Windows the command runs under
    // cmd.exe and the prefix fails with "'NODE_ENV' is not recognized".
    command: 'npm run build && npm run db:migrate && npm run db:seed && npm run start',
    env: { NODE_ENV: 'production', APP_ORIGIN: `http://127.0.0.1:${e2ePort}`, PORT: String(e2ePort) },
    url: `http://127.0.0.1:${e2ePort}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
