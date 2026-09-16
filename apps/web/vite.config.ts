import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const envDir = fileURLToPath(new URL('../../config/', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, envDir, ['VITE_', 'WEB_']);
  return {
    plugins: [react()],
    envDir,
    server: {
      port: Number(env.WEB_DEV_PORT ?? 5173),
      proxy: {
        '/api': env.WEB_DEV_PROXY_TARGET ?? 'http://localhost:3001'
      }
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      testTimeout: 10_000
    }
  };
});
