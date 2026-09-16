import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

export const defaultConfigDirectory = fileURLToPath(new URL('../../../config/', import.meta.url));

const appEnvSchema = z.enum(['development', 'staging', 'production']);

const environmentSchema = z.object({
  APP_ENV: appEnvSchema.default('development'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  APP_ORIGIN: z.url(),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DEMO_USER_ID: z.string().min(1).default('7c5b5636-48f8-4e9b-89b0-06381d28496b')
});

export type AppConfig = {
  appEnv: 'development' | 'staging' | 'production';
  nodeEnv: 'development' | 'production' | 'test';
  server: { port: number; appOrigin: string };
  database: { url: string };
  logging: { level: 'debug' | 'info' | 'warn' | 'error' };
  demo: { userId: string };
};

export type LoadConfigOptions = {
  env?: NodeJS.ProcessEnv;
  configDirectory?: string;
};

function readEnvFile(filePath: string): Record<string, string> {
  try {
    return dotenv.parse(fs.readFileSync(filePath));
  } catch {
    return {};
  }
}

export function loadConfig({ env = process.env, configDirectory = defaultConfigDirectory }: LoadConfigOptions = {}): AppConfig {
  const appEnvResult = appEnvSchema.safeParse(env.APP_ENV ?? 'development');
  if (!appEnvResult.success) {
    throw new Error(`Invalid APP_ENV: ${String(env.APP_ENV)}. Expected development, staging, or production.`);
  }
  const appEnv = appEnvResult.data;

  const base = readEnvFile(path.join(configDirectory, `.env.${appEnv}`));
  const local = readEnvFile(path.join(configDirectory, `.env.${appEnv}.local`));
  const merged = { ...base, ...local, ...env, APP_ENV: appEnv };

  const parsed = environmentSchema.safeParse(merged);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`).join('\n');
    throw new Error(`Invalid configuration for APP_ENV=${appEnv} (config directory: ${configDirectory}):\n${details}`);
  }

  const values = parsed.data;
  return {
    appEnv: values.APP_ENV,
    nodeEnv: values.NODE_ENV,
    server: { port: values.PORT, appOrigin: values.APP_ORIGIN },
    database: { url: values.DATABASE_URL },
    logging: { level: values.LOG_LEVEL },
    demo: { userId: values.DEMO_USER_ID }
  };
}

export const config = loadConfig();
