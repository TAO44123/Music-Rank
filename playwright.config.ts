import { defineConfig } from '@playwright/test';

const e2eUserId = '57b5231a-1574-4f5f-8f8a-40bdca1b4b35';
const e2ePort = 3101;

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: `http://127.0.0.1:${e2ePort}`, browserName: 'chromium' },
  webServer: {
    command: `npm run build && DEMO_USER_ID=${e2eUserId} npm run db:seed && NODE_ENV=production DEMO_USER_ID=${e2eUserId} PORT=${e2ePort} npm run start`,
    url: `http://127.0.0.1:${e2ePort}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
