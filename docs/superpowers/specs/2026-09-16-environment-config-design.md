# 分环境配置 设计

日期 2026-09-16 · 分支 `feature/environment-config`

## 问题

配置目前有四个毛病:

1. `DATABASE_URL` 缺失时不报错,静默退到 `packages/database/src/config.ts:5` 里的 localhost 弱口令默认值;同一默认值在 `drizzle.config.ts:8` 又抄了一遍。
2. `dotenv` 按 cwd 查找,导致磁盘上要维护三份内容相同的 `.env`(根、`apps/api/`、`packages/database/`)。
3. 只有 `config/production.env` 一个环境文件,没有 dev/staging 的对应物;e2e 的配置硬编码在 `playwright.config.ts`。
4. `LOG_LEVEL` 在 `.env.example` 里但无人读取;`apps/web` 的 5173 和 proxy 目标写死在 `vite.config.ts`。

## 目标 / 非目标

**目标**:四套环境文件(dev/staging/prod/example);数据库连接与前后端配置统一走配置文件;前后端按环境分别打包;本机可覆盖任意值而不改代码;缺配置时启动即失败。

**非目标**:改 `docker-compose.yml`(明确决定不动);远程部署;前后端分离部署;feature flag。

## 已验证的运行时行为

实现依赖以下行为,均已实测(Node 24.18 / Vite 7.2.1 / Compose 2.29.2):

| 行为 | 结果 |
| --- | --- |
| 真实环境变量 vs `--env-file` | 真实变量优先 |
| 多个 `--env-file` | 后者覆盖前者 |
| `--env-file` 指向缺失文件 | 报错退出 |
| `--env-file-if-exists` | Node 24 支持,缺失则跳过 |
| dotenv 对已存在的键 | 不覆盖(含空字符串) |
| base 文件里 `KEY=` 留空 | 注入成空串后**永久遮挡** `.local` 的真值 |
| Vite `loadEnv` 分层 | `.env` < `.env.[mode]` < `.env.[mode].local` |
| Vite 前缀过滤 | 无前缀的键不进浏览器产物 |

第六条导出一条硬规则:**base 文件里机密键整个不出现,不是留空**。schema 另加 `.min(1)` 作为第二道防线。

## 结构

```
config/
  .env.example        进 git,带注释的完整键清单
  .env.development    进 git
  .env.staging        进 git,占位值
  .env.production     进 git,不含机密键
  .env.*.local        未跟踪,放机密与本机覆盖
packages/config/
  src/index.ts        加载 + 校验 + 导出(单文件)
  src/index.test.ts
```

`packages/config` 形状照搬 `packages/contracts`(同样的 `package.json` / `tsconfig.json` / `dist` 产物),不引入新模式。

**加载顺序**:读 `APP_ENV`(缺省 `development`)→ dotenv 加载 `config/.env.<env>.local` → 再加载 `config/.env.<env>`。因 dotenv 不覆盖已存在的键,该顺序产出的优先级为 **真实环境变量 > `.local` > base**,与 Vite、Compose 的语义一致。

**导出**:

```ts
export type AppConfig = {
  appEnv: 'development' | 'staging' | 'production';
  nodeEnv: 'development' | 'production';
  server:   { port: number; appOrigin: string };
  database: { url: string };
  logging:  { level: 'debug' | 'info' | 'warn' | 'error' };
  demo:     { userId: string };
};
export const config: AppConfig;
```

`DATABASE_URL` 与 `APP_ORIGIN` 必填且无默认——缺失即抛错,这是本次改动的核心。`PORT`(3001)、`APP_ENV`(development)、`LOG_LEVEL`(info)、`DEMO_USER_ID`(沿用现有 UUID)有默认。`LOG_LEVEL` 当前无消费方,先占位。

**环境变量分两类前缀**:`VITE_*` 进浏览器产物(仅 `VITE_APP_ENV`);`WEB_*` 只给 `vite.config.ts`(`WEB_DEV_PORT`、`WEB_DEV_PROXY_TARGET`)。`vite.config.ts` 用 `loadEnv(mode, envDir, ['VITE_', 'WEB_'])`,`envDir` 指向 `config/`。前端不使用 `packages/config`。

## 各环境取值

| 键 | development | staging | production |
| --- | --- | --- | --- |
| `APP_ENV` | development | staging | production |
| `NODE_ENV` | development | production | production |
| `PORT` | 3001 | 3001 | 3001 |
| `APP_ORIGIN` | `http://localhost:5173` | `http://localhost:3001` | `http://localhost:3001` |
| `DATABASE_URL` | localhost:5432 | 不写,走 `.local` | 不写,走 `.local` |
| `LOG_LEVEL` | debug | info | info |
| `WEB_DEV_PORT` / `WEB_DEV_PROXY_TARGET` | 5173 / `http://localhost:3001` | — | — |
| `VITE_APP_ENV` | development | staging | production |

dev 的库端口写 5432(匹配仓库里的 `docker-compose.yml`);本机被占用时在 `.env.development.local` 覆盖。

## 脚本

```
start:prod      node --env-file=config/.env.production apps/api/dist/index.js
start:staging   node --env-file=config/.env.staging    apps/api/dist/index.js
build           ... && npm run build -w @music-rank/web -- --mode production
build:staging   ... && npm run build -w @music-rank/web -- --mode staging
dev             不变(APP_ENV 缺省 development)
```

`--env-file` 只剩一个职责:跨平台注入 `APP_ENV`,不用 `VAR=value` 前缀,符合仓库既有的跨 shell 约束。分层加载全部由 loader 负责。

## 耦合规则

改一个值时必须同时改的另一个:

| 改 | 必须同时改 | 原因 |
| --- | --- | --- |
| `WEB_DEV_PORT` | `APP_ORIGIN` | origin guard 与 cookie 按 `APP_ORIGIN` 校验,不同步即 403 |
| `PORT` | `WEB_DEV_PROXY_TARGET` | Vite proxy 仍指旧端口,请求 404 |

## 测试

`packages/config/src/index.test.ts` 锁住五条:缺 `DATABASE_URL` 抛错且信息含键名 / `.local` 覆盖 base / 真实环境变量覆盖 `.local` / 空字符串被拒 / `APP_ENV` 非法值报错。

回归面:`apps/api/src/app.test.ts` 经 `createApp({ allowedOrigin })` 注入,不碰全局 env;`playwright.config.ts` 用 `env:` 传值且真实环境变量优先级最高。两者预期不受影响,实现后实跑验证。

## 文档

新建 `docs/CONFIGURATION.md` 作为配置的唯一权威:前端按环境打包、后端按环境打包、Docker 起 Postgres(描述现有 compose 流程,不改动)、耦合表、新人 onboarding 路径。`README.md:47-51` 与 `docs/ENGINEERING_GUIDE.md:150-202` 的现有描述删除并指向它。

## 实现约束

三条在实现时容易两头错、必须钉死的:

1. **静态文件服务按 `config.nodeEnv === 'production'` 判断,不是 `appEnv`。** `apps/api/src/index.ts:10` 现有的判断迁移后须落在 `nodeEnv` 上。原因见下一条。
2. **`playwright.config.ts` 不设 `APP_ENV`**,保持只传 `NODE_ENV: 'production'` 与 `APP_ORIGIN` / `PORT` 覆盖。此时 `APP_ENV` 缺省为 `development`,加载已跟踪的 `config/.env.development` 拿到 `DATABASE_URL`,而真实环境变量让 `nodeEnv` 为 `production`——即"以生产形态跑在开发配置上",与今天的 e2e 语义一致,且全新 clone 即可跑。若改设 `APP_ENV=production`,则会去找未跟踪的 `.env.production.local`,e2e 在干净环境上必挂。
3. **`NODE_ENV` 的枚举必须包含 `test`。** 实测 vitest 会强制设 `NODE_ENV=test`;若枚举只放 development/production,`app.test.ts` 经 `@music-rank/database` 间接加载 loader 时会在 import 阶段抛错,整个测试套件全灭。`nodeEnv` 因此为 `'development' | 'production' | 'test'`,静态文件判断仍只认 `=== 'production'`。
4. **`vite.config.ts` 的 `envDir` 用绝对路径解析**(`fileURLToPath(new URL('../../config/', import.meta.url))`),不用相对路径,避免受 cwd 影响。

另:`apps/api/src/app.test.ts` 经 `@music-rank/database` 间接触发 loader,所以 `config/.env.development` 必须是已跟踪且含 `DATABASE_URL` 的——这使单元测试在全新 clone 上无需任何 `.local` 即可运行,相较今天需要手工铺三份 `.env` 是净改善。

## 迁移步骤

1. 建 `packages/config`(先写测试)
2. `packages/database/src/config.ts`、`drizzle.config.ts` 改为从中取值
3. `apps/api/src/index.ts`、`app.ts` 改为从中取值
4. `vite.config.ts` 接 `loadEnv` + `envDir`
5. 写四个 config 文件;删根 `.env`、`apps/api/.env`、`packages/database/.env`、`config/production.env`
6. `.gitignore` 加 `config/*.local`;更新根 `package.json` 脚本
7. 写文档
8. 验证:`typecheck`、`test`、`build`、`start:prod`、`test:e2e`

## 已知限制

- **`docker-compose.yml` 的 `5432` 与 `DATABASE_URL` 仍是两处独立真相**(经决定不改 compose)。本机改端口仍需同时维护未跟踪的 `docker-compose.override.yml`。
- `drizzle-kit` 不接受 node 标志,无法跨平台地对 staging/prod 库跑迁移。远程部署在 scope 外;届时用真实环境变量设 `APP_ENV`,优先级最高。
