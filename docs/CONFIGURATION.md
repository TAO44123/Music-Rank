# 配置

本文件是配置的唯一权威。README 与 ENGINEERING_GUIDE 中关于环境变量的内容都指向这里。

从 2026-09-16 之前的旧配置结构迁移,见 [CONFIG_MIGRATION.md](CONFIG_MIGRATION.md)。
给 AI agent 的硬规则与"新增一个配置键"清单,见仓库根的 [AGENTS.md](../AGENTS.md)。

## 1. 优先级与文件布局

```
config/
  .env.example        已跟踪。带注释的完整键清单,复制需要的行到 .local
  .env.development    已跟踪。本地开发
  .env.staging        已跟踪。占位值
  .env.production     已跟踪。不含机密键
  .env.<env>.local    未跟踪(.gitignore 中的 config/*.local)。机密与本机覆盖
```

优先级从高到低:

**真实环境变量 > `.env.<env>.local` > `.env.<env>`**

Node 后端与 Vite 前端两侧遵循同一条链。后端由 `packages/config` 实现,前端由 Vite 原生的 mode 机制实现。

选择哪一套由 `APP_ENV` 决定(`development` | `staging` | `production`),缺省为 `development`。`APP_ENV` 与 `NODE_ENV` 是两个独立变量:`NODE_ENV` 在 Node 生态里有特殊语义,Express、React、Vite 都只认 `development` / `production`,所以 staging 环境的文件里写的是 `NODE_ENV=production`,由此拿到真正的生产优化,同时用自己那套连接串与 origin。

### 两条禁令

**不要创建 `config/.env`**(不带 mode 后缀的那个)。Vite 会在所有模式下加载它,等于给四套环境开一个共享后门,破坏隔离。

**base 文件里机密键整个不出现,不要写成留空。** 写 `DATABASE_URL=` 会被 `--env-file` 注入成空字符串;此后 `.local` 里的真值再也盖不上去,而空字符串又不会触发"缺失"检查。schema 对所有字符串键加了 `.min(1)` 作为第二道防线,但正确做法是该键在 base 文件里根本不出现。

### 缺配置的行为

`DATABASE_URL` 与 `APP_ORIGIN` 必填且没有默认值。缺失时进程在启动瞬间抛错退出,错误信息会点名缺的是哪个键、用的是哪个配置目录。这是刻意的:此前它们有 localhost 弱口令默认值,配错时不会报错,而是静默连到一个错误的数据库。

## 2. 新人上手

```bash
git clone <repo> && cd Music-Rank
npm ci
```

若本机端口与默认值冲突(常见于同时跑多个项目的 Postgres),创建 `config/.env.development.local` 覆盖,例如:

```
DATABASE_URL=postgresql://music_rank:music_rank@localhost:5434/music_rank
```

然后:

```bash
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
```

`config/.env.development` 是已跟踪的,含完整的可用默认值,所以不建任何 `.local` 也能跑起来(前提是 Postgres 在 5432)。

## 3. 后端:按环境打包与启动

```bash
npm run build           # 构建全部 workspace,web 用 --mode production
npm run build:staging   # 同上,web 改用 --mode staging
npm run start:prod      # 以 production 配置启动已构建的 API
npm run start:staging   # 以 staging 配置启动已构建的 API
```

启动命令形如:

```
node --env-file=config/.env.production --env-file-if-exists=config/.env.production.local apps/api/dist/index.js
```

`--env-file` 在前、`--env-file-if-exists` 在后,**顺序不可颠倒**:后一个文件覆盖前一个,这样 `.local` 才能盖住 base。用 `--env-file-if-exists` 而非 `--env-file` 是因为 `.local` 本就是可选的,而 Node 遇到缺失的 `--env-file` 会直接报错退出。

`--env-file` 在这里只有一个职责:跨平台地注入 `APP_ENV`。**不使用 `VAR=value command` 这种 POSIX 前缀写法**——它只有 POSIX shell 认识,在 Windows 的 cmd.exe 下会报 `'NODE_ENV' is not recognized`,PowerShell 下同样是解析错误。npm script 里不含任何 shell 特有语法,bash、zsh、PowerShell 和 cmd.exe 行为一致。

临时覆盖单个值仍然可行,因为真实环境变量优先级最高:

```bash
PORT=3002 npm run start:prod        # bash / zsh
$env:PORT=3002; npm run start:prod  # PowerShell
```

`npm run dev` 不需要任何标志,`APP_ENV` 缺省为 `development`。

## 4. 前端:按环境打包

前端不使用 `packages/config`,走 Vite 原生机制:

```bash
vite build --mode production   # 加载 config/.env.production[.local]
vite build --mode staging      # 加载 config/.env.staging[.local]
```

`apps/web/vite.config.ts` 把 `envDir` 指向仓库根的 `config/`(用绝对路径解析,不受 cwd 影响),并用 `loadEnv(mode, envDir, ['VITE_', 'WEB_'])` 读取。

两类前缀职责不同:

| 前缀 | 去向 | 用途 |
| --- | --- | --- |
| `VITE_*` | **进浏览器产物** | `VITE_APP_ENV`,供运行时识别环境 |
| `WEB_*` | 只给 `vite.config.ts`,不进产物 | `WEB_DEV_PORT`、`WEB_DEV_PROXY_TARGET` |

前后端共用 `config/` 同一批文件,里面有 `DATABASE_URL` 和密码。Vite 的前缀过滤保证只有 `VITE_*` 会被注入 `import.meta.env`——这是"一套文件同时服务前后端"能够成立的前提。

`WEB_DEV_PORT` 与 `WEB_DEV_PROXY_TARGET` 只在 `development` 文件里定义;其他环境不跑 dev server,`vite.config.ts` 中的兜底值负责收场。

## 5. Docker(仅 PostgreSQL)

只有 PostgreSQL 跑在 Docker 上,API 与 Web 都是直接跑 Node。

```bash
npm run db:up     # docker compose up -d database
npm run db:down
```

`docker-compose.yml` 使用 `postgres:17.6-alpine`,**用户名、密码、库名与端口都写死在该文件中**,不经过 `config/`。本机端口冲突时,用未跟踪的 `docker-compose.override.yml` 改发布端口,例如:

```yaml
services:
  database:
    ports: !override
      - "5434:5432"
```

staging 与 production 的 PostgreSQL 不走 Docker。

> **已知限制:** compose 的发布端口与 `DATABASE_URL` 是两处**独立**的配置,本次改动没有把 compose 纳入统一管理。改端口时必须同时改 `docker-compose.override.yml` 和 `config/.env.development.local`,两边不一致时数据库连不上。

## 6. 耦合表

改左边的值,必须同时改右边的:

| 改 | 必须同时改 | 原因 |
| --- | --- | --- |
| `WEB_DEV_PORT` | `APP_ORIGIN` | origin guard 与 cookie 按 `APP_ORIGIN` 校验,不同步即 403 |
| `PORT` | `WEB_DEV_PROXY_TARGET` | Vite proxy 仍指向旧端口,前端请求全部 404 |
| `docker-compose` 发布端口 | `DATABASE_URL` | 两处独立配置,compose 未纳入统一管理 |

## 7. 键清单

| 键 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `APP_ENV` | 否 | `development` | 决定读哪套配置文件 |
| `NODE_ENV` | 否 | `development` | `development` / `production` / `test`。生产优化开关;`production` 时 Express 提供前端静态文件。`test` 是因为 vitest 会强制设置它 |
| `PORT` | 否 | `3001` | Express 监听端口 |
| `APP_ORIGIN` | **是** | 无 | 必须与浏览器 Origin 完全一致;HTTPS 时启用 `__Host-` 前缀的 Secure Cookie |
| `DATABASE_URL` | **是** | 无 | PostgreSQL 连接串。含密码,不写进已跟踪的 base 文件 |
| `LOG_LEVEL` | 否 | `info` | `debug` / `info` / `warn` / `error`。当前代码尚未消费,schema 中先占位 |
| `DEMO_USER_ID` | 否 | `7c5b5636-…` | 凭据为空的 demo fixture ID;变更后需重新 seed |
| `WEB_DEV_PORT` | 否 | `5173` | 仅 development。Vite dev server 端口 |
| `WEB_DEV_PROXY_TARGET` | 否 | `http://localhost:3001` | 仅 development。Vite proxy 目标 |
| `VITE_APP_ENV` | 否 | 无 | 唯一进入浏览器产物的键 |

## 8. 远程环境的迁移

`drizzle-kit` 不接受 Node 的命令行标志,因此没有跨平台的 npm script 能对 staging/production 的库跑迁移。远程部署目前不在项目范围内。届时用真实环境变量设置 `APP_ENV` 即可,它优先级最高:

```bash
APP_ENV=production npm run db:migrate        # bash / zsh
$env:APP_ENV='production'; npm run db:migrate # PowerShell
```
