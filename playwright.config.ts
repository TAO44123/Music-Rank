import { defineConfig } from '@playwright/test';

const e2ePort = 3101;

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: `http://127.0.0.1:${e2ePort}`, browserName: 'chromium' },
  webServer: {
    command: `npm run build && npm run db:migrate && npm run db:seed && NODE_ENV=production APP_ORIGIN=http://127.0.0.1:${e2ePort} PORT=${e2ePort} npm run start`,
    url: `http://127.0.0.1:${e2ePort}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
