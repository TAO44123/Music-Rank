# 分环境配置 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 dev/staging/production 三套环境各有一份配置文件,数据库连接与前后端配置统一从中读取,前后端可按环境分别打包,缺配置时启动即失败。

**Architecture:** 新增 `@music-rank/config` 包,导出一个**纯函数** `loadConfig()`——它用 `dotenv.parse` 读文件而不写 `process.env`,按 base → `.local` → 真实环境变量的顺序合并后用 zod 校验。后端所有入口从它取值;前端不用它,改走 Vite 原生的 `--mode` + `envDir`。

**Tech Stack:** Node 24 / TypeScript 5.9 (NodeNext) / zod 4.6 / dotenv 17.4 / Vite 7.2.1 / Vitest 4 / npm workspaces

**Spec:** `docs/superpowers/specs/2026-09-16-environment-config-design.md`

**Branch:** `feature/environment-config`

## Global Constraints

- 配置目录固定为仓库根的 `config/`,**不得创建 `config/.env`**(无 mode 后缀的那个)——Vite 会在所有模式下加载它,破坏环境隔离。
- base 文件(`.env.development` / `.env.staging` / `.env.production`)中**机密键整个不出现,不写成留空**。留空会被注入成空字符串并永久遮挡 `.local` 的真值。
- 优先级链恒为 **真实环境变量 > `.env.<env>.local` > `.env.<env>`**,Node 与 Vite 两侧一致。
- `NODE_ENV` 枚举必须含 `test`(vitest 强制设 `NODE_ENV=test`)。`nodeEnv` 类型为 `'development' | 'production' | 'test'`。
- 静态文件服务判断只认 `config.nodeEnv === 'production'`,**不得**改用 `appEnv`。
- `playwright.config.ts` **不得**设 `APP_ENV`。
- npm script 中禁止 `VAR=value command` 前缀(Windows cmd.exe 不认)。跨平台注入只用 `--env-file`。
- `docker-compose.yml` 与 `docker-compose.override.yml` **本次不改**。

---

### Task 1: 四个配置文件与 gitignore

**Files:**
- Create: `config/.env.example`
- Create: `config/.env.development`
- Create: `config/.env.staging`
- Create: `config/.env.production`
- Modify: `.gitignore`
- Delete: `config/production.env`

**Interfaces:**
- Consumes: 无。键名清单见 spec 的"结构"一节
- Produces: 供 Task 2-6 读取的配置文件;`WEB_DEV_PORT` / `WEB_DEV_PROXY_TARGET` / `VITE_APP_ENV` 供 Task 5 使用

- [ ] **Step 1: 写 `config/.env.example`**

```
# 所有环境可用的键。复制需要的行到 config/.env.<env>.local 覆盖本机取值。
# 优先级:真实环境变量 > .env.<env>.local > .env.<env>

# --- 运行环境 ---
APP_ENV=development              # development | staging | production,决定读哪个文件
NODE_ENV=development             # development | production,影响 Express/React 的生产优化

# --- 后端 ---
PORT=3001
APP_ORIGIN=http://localhost:5173 # 必填。CSRF origin guard 与 cookie 作用域按它校验
LOG_LEVEL=info                   # debug | info | warn | error(当前代码尚未消费,先占位)
DEMO_USER_ID=7c5b5636-48f8-4e9b-89b0-06381d28496b

# --- 数据库 ---
# 必填。含密码,因此不写进已跟踪的 base 文件;放 .env.<env>.local 或真实环境变量。
DATABASE_URL=postgresql://music_rank:music_rank@localhost:5432/music_rank

# --- 前端(仅 development 需要)---
WEB_DEV_PORT=5173                           # Vite dev server 端口。改它必须同时改 APP_ORIGIN
WEB_DEV_PROXY_TARGET=http://localhost:3001  # Vite proxy 目标。改 PORT 必须同时改它
VITE_APP_ENV=development                    # 唯一进入浏览器产物的键
```

- [ ] **Step 2: 写三个环境文件**

`config/.env.development`(dev 的库口令本就是公开弱口令,可入库):

```
APP_ENV=development
NODE_ENV=development
PORT=3001
APP_ORIGIN=http://localhost:5173
DATABASE_URL=postgresql://music_rank:music_rank@localhost:5432/music_rank
LOG_LEVEL=debug
DEMO_USER_ID=7c5b5636-48f8-4e9b-89b0-06381d28496b
WEB_DEV_PORT=5173
WEB_DEV_PROXY_TARGET=http://localhost:3001
VITE_APP_ENV=development
```

`config/.env.staging`(占位值;**不含 `DATABASE_URL`**):

```
APP_ENV=staging
NODE_ENV=production
PORT=3001
APP_ORIGIN=http://localhost:3001
LOG_LEVEL=info
VITE_APP_ENV=staging
# DATABASE_URL 必填,放 config/.env.staging.local 或真实环境变量
```

`config/.env.production`(**不含 `DATABASE_URL`**):

```
APP_ENV=production
NODE_ENV=production
PORT=3001
APP_ORIGIN=http://localhost:3001
LOG_LEVEL=info
VITE_APP_ENV=production
# DATABASE_URL 必填,放 config/.env.production.local 或真实环境变量
```

- [ ] **Step 3: 改 `.gitignore`**

在现有的 `.env` / `.env.local` 两行之后加一行:

```
config/*.local
```

- [ ] **Step 4: 删除被取代的文件**

```bash
git rm config/production.env
```

- [ ] **Step 5: 验证跟踪与忽略都正确**

Run:

```bash
git status --porcelain
```

Expected: 四个 `config/.env.*` 出现在待提交列表中。

再验证忽略规则(先造一个临时文件):

```bash
echo "DATABASE_URL=postgresql://x" > config/.env.development.local && git check-ignore -v config/.env.development.local
```

Expected: 打印命中 `config/*.local` 规则。这个文件保留着,后续任务要用。

- [ ] **Step 6: 提交**

```bash
git add config .gitignore
git commit -m "feat: add per-environment config files"
```

---

### Task 2: `@music-rank/config` 包

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/src/index.ts`
- Test: `packages/config/src/index.test.ts`

**Interfaces:**
- Consumes: Task 1 建立的 `config/.env.development`(模块顶层的 `config` 常量会在 import 时读取它)
- Produces:
  - `loadConfig(options?: { env?: NodeJS.ProcessEnv; configDirectory?: string }): AppConfig`
  - `config: AppConfig`(模块加载时以默认参数求值一次)
  - `type AppConfig = { appEnv: 'development'|'staging'|'production'; nodeEnv: 'development'|'production'|'test'; server: { port: number; appOrigin: string }; database: { url: string }; logging: { level: 'debug'|'info'|'warn'|'error' }; demo: { userId: string } }`

- [ ] **Step 1: 建包骨架**

`packages/config/package.json`(形状照搬 `packages/contracts`):

```json
{
  "name": "@music-rank/config",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run --exclude 'dist/**'"
  },
  "dependencies": {
    "dotenv": "^17.2.3",
    "zod": "^4.1.12"
  }
}
```

`packages/config/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

然后在仓库根运行 `npm install` 让 workspace 链接生效。

- [ ] **Step 2: 写失败的测试**

创建 `packages/config/src/index.test.ts`。注意 fixture 清理**故意不吞异常**——本机历史上出现过测试往 `%TEMP%` 堆积残留目录、清理失败却被静默吞掉的问题:

```ts
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
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npm run test --workspace @music-rank/config`

Expected: FAIL,报找不到 `./index.js`。

- [ ] **Step 4: 实现**

创建 `packages/config/src/index.ts`:

```ts
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
```

`...env` 放在最后使真实环境变量优先级最高;这同时让 `--env-file` 注入的已合并结果直接生效,两种机制不冲突。`readEnvFile` 吞 `ENOENT` 是有意的——`.local` 本就可选。

- [ ] **Step 5: 跑测试确认通过**

Run: `npm run test --workspace @music-rank/config`

Expected: PASS,8 个测试全绿。

- [ ] **Step 6: 提交**

```bash
git add packages/config package.json package-lock.json
git commit -m "feat: add @music-rank/config with layered env loading"
```

---

### Task 3: `packages/database` 与 `drizzle.config.ts` 接入

**Files:**
- Modify: `packages/database/src/config.ts`(整文件替换)
- Modify: `packages/database/drizzle.config.ts`(整文件替换)
- Modify: `packages/database/package.json`
- Delete: `packages/database/.env`

**Interfaces:**
- Consumes: `config` from `@music-rank/config`
- Produces: `demoUserId: string` 与 `databaseUrl: string`——**导出名与类型保持不变**,`packages/database/src/client.ts:3`、`src/seed.ts:3`、`apps/api/src/app.test.ts:4` 依赖它们

- [ ] **Step 1: 改 `packages/database/src/config.ts`**

整文件替换为:

```ts
import { config } from '@music-rank/config';

export const demoUserId = config.demo.userId;
export const databaseUrl = config.database.url;
```

刻意保留这两个导出名,使 `client.ts`、`seed.ts` 与 `app.test.ts` 无需改动。

- [ ] **Step 2: 改 `packages/database/drizzle.config.ts`**

整文件替换为:

```ts
import { defineConfig } from 'drizzle-kit';
import { config } from '@music-rank/config';

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: config.database.url
  }
});
```

这消除了原先与 `src/config.ts` 重复的那份 localhost 默认值。

- [ ] **Step 3: 调依赖**

编辑 `packages/database/package.json`:在 `dependencies` 加 `"@music-rank/config": "*"`;从 `devDependencies` 删除 `"dotenv": "^17.2.3"`(dotenv 现在只由 `@music-rank/config` 直接使用)。然后在仓库根跑 `npm install`。

- [ ] **Step 4: 删除重复的 .env**

```bash
rm packages/database/.env
```

- [ ] **Step 5: 验证**

Run:

```bash
npm run build --workspace @music-rank/config && npm run typecheck --workspace @music-rank/database
```

Expected: 两条都成功。`@music-rank/config` 必须先 build,因为 `@music-rank/database` 通过 `dist` 消费它。

- [ ] **Step 6: 提交**

```bash
git add packages/database package.json package-lock.json
git commit -m "refactor: read database config from @music-rank/config"
```

---

### Task 4: `apps/api` 接入

**Files:**
- Modify: `apps/api/src/index.ts:1-14`
- Modify: `apps/api/src/app.ts:60`
- Modify: `apps/api/package.json`
- Delete: `apps/api/.env`

**Interfaces:**
- Consumes: `config` from `@music-rank/config`
- Produces: 行为不变的 `createApp()`;其 `allowedOrigin` 默认值改为 `config.server.appOrigin`

- [ ] **Step 1: 改 `apps/api/src/index.ts`**

把首行的 `import 'dotenv/config';` 换成 `import { config } from '@music-rank/config';`,并替换两处 `process.env` 读取。改动后前 14 行为:

```ts
import { config } from '@music-rank/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { closeDatabase } from '@music-rank/database';
import { createApp } from './app.js';

const port = config.server.port;
const app = createApp();

if (config.nodeEnv === 'production') {
  const webDist = fileURLToPath(new URL('../../web/dist/', import.meta.url));
  app.use(express.static(webDist));
  app.get('/{*path}', (_request, response) => response.sendFile('index.html', { root: webDist }));
}
```

**判断条件必须是 `config.nodeEnv`,不是 `config.appEnv`**——e2e 靠真实环境变量把 `NODE_ENV` 顶成 `production`,而 `APP_ENV` 仍为 `development`;用 `appEnv` 会让 e2e 不再服务静态文件,整套 e2e 失败。

- [ ] **Step 2: 改 `apps/api/src/app.ts`**

在文件顶部 import 区加一行 `import { config } from '@music-rank/config';`,并把第 60 行的默认值改掉:

```ts
export function createApp({ currentUserId, allowedOrigin = config.server.appOrigin, authRateLimit, enforceOrigin = true }: AppOptions = {}) {
```

- [ ] **Step 3: 调依赖并删除重复 .env**

编辑 `apps/api/package.json`:`dependencies` 加 `"@music-rank/config": "*"`,删除 `"dotenv": "^17.2.3"`。然后:

```bash
rm apps/api/.env && npm install
```

- [ ] **Step 4: 跑 API 测试**

Run:

```bash
npm run db:up && npm run db:migrate && npm run db:seed && npm run test --workspace @music-rank/api
```

Expected: PASS。若本机 Postgres 不在 5432,在 `config/.env.development.local` 写入正确的 `DATABASE_URL` 后再跑。

- [ ] **Step 5: 提交**

```bash
git add apps/api package.json package-lock.json
git commit -m "refactor: read api config from @music-rank/config"
```

---

### Task 5: `apps/web` 接入 Vite mode

**Files:**
- Modify: `apps/web/vite.config.ts`(整文件替换)

**Interfaces:**
- Consumes: Task 1 写入的 `WEB_DEV_PORT` / `WEB_DEV_PROXY_TARGET` / `VITE_APP_ENV`
- Produces: 按 `--mode` 选择配置的前端构建;`import.meta.env.VITE_APP_ENV` 可在浏览器侧读取

- [ ] **Step 1: 改 `apps/web/vite.config.ts`**

整文件替换为:

```ts
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
```

`envDir` 用绝对路径,避免受 cwd 影响。`loadEnv` 第三参限定只取这两个前缀;Vite 只会把 `VITE_*` 注入 `import.meta.env`,所以 `WEB_*` 与 `DATABASE_URL` 都不会进浏览器产物。

- [ ] **Step 2: 验证两种 mode 都能构建**

Run:

```bash
npm run build --workspace @music-rank/web -- --mode production
npm run build --workspace @music-rank/web -- --mode staging
```

Expected: 两次都构建成功。

- [ ] **Step 3: 确认机密没有进产物**

Run:

```bash
grep -rl "music_rank:music_rank" apps/web/dist/ || echo "OK: no database credentials in bundle"
```

Expected: 打印 `OK: no database credentials in bundle`。

- [ ] **Step 4: 跑前端测试**

Run: `npm run test --workspace @music-rank/web`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/web
git commit -m "feat: select web config by vite mode"
```

---

### Task 6: 根脚本与最后的清理

**Files:**
- Modify: `package.json`(scripts 段)
- Delete: `.env`

**Interfaces:**
- Consumes: Task 1-5 的全部产物
- Produces: `build` / `build:staging` / `start:prod` / `start:staging` 四条按环境区分的命令

- [ ] **Step 1: 改根 `package.json` 的 scripts**

替换 `typecheck`、`build`、`start:prod` 三条,并新增 `build:staging`、`start:staging`:

```json
    "typecheck": "npm run build --workspace @music-rank/config && npm run build --workspace @music-rank/contracts && npm run build --workspace @music-rank/database && npm run typecheck --workspaces --if-present",
    "build": "npm run build --workspace @music-rank/config && npm run build --workspace @music-rank/contracts && npm run build --workspace @music-rank/database && npm run build --workspace @music-rank/api && npm run build --workspace @music-rank/web -- --mode production",
    "build:staging": "npm run build --workspace @music-rank/config && npm run build --workspace @music-rank/contracts && npm run build --workspace @music-rank/database && npm run build --workspace @music-rank/api && npm run build --workspace @music-rank/web -- --mode staging",
    "start:prod": "node --env-file=config/.env.production --env-file-if-exists=config/.env.production.local apps/api/dist/index.js",
    "start:staging": "node --env-file=config/.env.staging --env-file-if-exists=config/.env.staging.local apps/api/dist/index.js",
```

`--env-file` 在前、`--env-file-if-exists` 在后,顺序不可颠倒:后者覆盖前者,这样 `.local` 才能盖住 base。`@music-rank/config` 必须排在 build 链最前,因为其余包依赖它的 `dist`。

- [ ] **Step 2: 删除根 .env**

```bash
rm .env
```

- [ ] **Step 3: 验证失败路径(本次改动的核心行为)**

Run:

```bash
npm run build && npm run start:prod
```

Expected: 在没有 `config/.env.production.local` 的情况下,进程**立刻退出并打印含 `DATABASE_URL` 的错误**。过去它会静默去连 localhost 弱口令库,这正是要消除的行为。

- [ ] **Step 4: 验证成功路径**

创建 `config/.env.production.local` 写入一行可用的 `DATABASE_URL`,重跑:

```bash
npm run start:prod
```

Expected: 监听 3001,`curl http://localhost:3001/api/health` 返回 `{"status":"ok","database":"ok"}`,根路径返回前端 HTML。确认后停掉进程。

- [ ] **Step 5: 提交**

```bash
git add package.json
git commit -m "feat: add per-environment build and start scripts"
```

---

### Task 7: 文档

**Files:**
- Create: `docs/CONFIGURATION.md`
- Modify: `README.md`(`## Environment` 一节,47-51 行)
- Modify: `docs/ENGINEERING_GUIDE.md`(环境变量表 150 行起,`start:prod` 说明 193-202 行)

**Interfaces:**
- Consumes: Task 1-6 的最终形态
- Produces: 配置的唯一权威文档

- [ ] **Step 1: 写 `docs/CONFIGURATION.md`**

必须覆盖以下六节,内容取自本计划与 spec,不要新编事实:

1. **优先级与文件布局** —— 真实环境变量 > `.env.<env>.local` > `.env.<env>`;四个已跟踪文件加未跟踪的 `.local`;明确写出两条禁令及其原因:不要创建 `config/.env`(Vite 会在所有模式下加载它),base 文件不放机密键、更不要留空(空字符串会永久遮挡 `.local` 的真值)。
2. **新人 onboarding** —— clone → `npm install` → 若本机端口与默认值冲突则创建 `config/.env.development.local` → `npm run db:up` → `npm run db:migrate` → `npm run db:seed` → `npm run dev`。
3. **后端按环境打包与启动** —— `npm run build` / `npm run build:staging`;`npm run start:prod` / `npm run start:staging`;说明 `--env-file` 的唯一职责是跨平台注入 `APP_ENV`,以及为何不用 `VAR=value` 前缀(Windows cmd.exe 不认)。
4. **前端按环境打包** —— `vite build --mode <env>`;`VITE_*` 进产物、`WEB_*` 不进;`envDir` 指向 `config/`。
5. **Docker(仅 PostgreSQL)** —— 描述**现有**流程:`npm run db:up` 起 `docker-compose.yml` 中的 `postgres:17.6-alpine`,凭据与端口写死在该文件;本机端口冲突时用未跟踪的 `docker-compose.override.yml` 改发布端口。明确写出:staging/production 的 PostgreSQL 不走 Docker;**compose 的端口与 `DATABASE_URL` 是两处独立配置,改端口需同时改两边**。
6. **耦合表** —— 原样收录:

   | 改 | 必须同时改 | 原因 |
   | --- | --- | --- |
   | `WEB_DEV_PORT` | `APP_ORIGIN` | origin guard 与 cookie 按 `APP_ORIGIN` 校验,不同步即 403 |
   | `PORT` | `WEB_DEV_PROXY_TARGET` | Vite proxy 仍指旧端口,请求 404 |
   | `docker-compose` 发布端口 | `DATABASE_URL` | 两处独立配置,compose 本次未纳入统一管理 |

- [ ] **Step 2: 收敛 README 与 ENGINEERING_GUIDE**

删除 `README.md` 的 `## Environment` 一节中描述 `.env.example` 与 `config/production.env` 的过时内容,替换为一句指向 `docs/CONFIGURATION.md` 的链接。同样处理 `docs/ENGINEERING_GUIDE.md` 的环境变量表与 `start:prod` 说明——删除过时表格,改为指向新文档,避免三处重复描述同一套机制。

- [ ] **Step 3: 核对文档中每条命令都能跑**

逐条执行文档里出现的命令,确认无一失效。

- [ ] **Step 4: 提交**

```bash
git add docs README.md
git commit -m "docs: add CONFIGURATION.md as the single source for config"
```

---

### Task 8: 全量验证

**Files:** 无改动。仅验证;发现问题回到对应 Task 修复。

**Interfaces:**
- Consumes: Task 1-7 的全部产物
- Produces: 可据以宣称完成的证据

- [ ] **Step 1: 类型与测试**

Run:

```bash
npm run typecheck && npm run test
```

Expected: 全部通过。

- [ ] **Step 2: e2e**

Run: `npm run test:e2e`

Expected: 全绿。这验证了"`playwright.config.ts` 不设 `APP_ENV`、靠真实环境变量顶 `NODE_ENV`"这条约束确实成立。

- [ ] **Step 3: 失败路径复验**

先临时移走 `config/.env.staging.local`(若存在),然后:

```bash
npm run start:staging
```

Expected: **立即退出**并打印含 `DATABASE_URL` 的错误。必须亲眼确认,不能推断。

- [ ] **Step 4: 确认没有多余文件被提交**

Run:

```bash
git status --porcelain && git ls-files | grep -E "\.env"
```

Expected: 工作区干净;`git ls-files` 只列出 `config/.env.example`、`config/.env.development`、`config/.env.staging`、`config/.env.production` 四个,**不含任何 `.local`**,也不含根 `.env`、`apps/api/.env`、`packages/database/.env`、`config/production.env`。

- [ ] **Step 5: 检查临时目录没有泄漏**

Run(PowerShell):

```powershell
(Get-ChildItem $env:TEMP -Directory -Filter 'music-rank-config-*').Count
```

Expected: `0`。Task 1 的 fixture 清理不吞异常,若此处非 0 说明清理逻辑有问题,回到 Task 1 修复。
