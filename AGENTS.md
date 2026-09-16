# AGENTS.md

给在本仓库工作的 AI agent 的约定。人类同样适用,但本文件的写法针对 agent:每条都是可执行的规则,不是背景介绍。

## 仓库形状

npm workspaces monorepo,Node 24,TypeScript NodeNext。

```
apps/api          Express 5 + Drizzle。production 时同时服务前端静态文件
apps/web          React 19 + Vite 7 + MUI
packages/config   配置加载与校验(本文件重点)
packages/contracts zod schema,前后端共用
packages/database Drizzle schema、迁移、seed
config/           分环境配置文件
```

常用命令见 `README.md`;配置的完整说明见 `docs/CONFIGURATION.md`;从旧配置结构迁移见 `docs/CONFIG_MIGRATION.md`。

---

## 配置:硬规则

这些不是风格偏好。每一条都对应一个已经发生过或被实测证实的故障。

### 不要创建 `.env`

仓库根、`apps/api/`、`packages/database/` 下的 `.env` 和 `.env.example` **已于 2026-09-16 全部删除**,没有任何代码读取它们。看到有人让你"创建 `.env`"或"复制 `.env.example`",那是过时的指令——配置只存在于 `config/`。

`packages/database` 与 `apps/api` 都已移除 `dotenv` 依赖,不要加回去。唯一直接使用 dotenv 的是 `packages/config`。

### 不要创建 `config/.env`

指**不带 mode 后缀**的那个文件。Vite 会在所有 mode 下加载它,等于给四套环境开一个共享后门。四个文件就是 `.env.example` / `.env.development` / `.env.staging` / `.env.production`,不多不少。

### 机密键在已跟踪文件里整个不出现,不要留空

写 `DATABASE_URL=` 会被 `--env-file` 注入成空字符串,此后 `.env.<env>.local` 里的真值**永远盖不上去**(dotenv 认为键已存在就不覆盖)。schema 对字符串键加了 `.min(1)` 兜底,但正确做法是该键在 base 文件里根本不写,只在 `.env.example` 里以注释说明。

### 优先级链

**真实环境变量 > `config/.env.<env>.local` > `config/.env.<env>`**

Node 与 Vite 两侧一致。`.local` 文件未跟踪(`.gitignore` 的 `config/*.local`),放机密与本机覆盖。

### `NODE_ENV` 的枚举必须包含 `test`

vitest 强制设 `NODE_ENV=test`。若把枚举收窄成 development/production,`apps/api/src/app.test.ts` 经 `@music-rank/database` 间接加载 loader 时会在 **import 阶段**抛错,整个测试套件全灭——且报错位置离真正的原因很远,极难排查。

### 静态文件服务判断用 `nodeEnv`,不用 `appEnv`

`apps/api/src/index.ts` 里的 `if (config.nodeEnv === 'production')` 不要改成 `appEnv`。e2e 靠真实环境变量把 `NODE_ENV` 顶成 `production`、同时让 `APP_ENV` 保持 `development`,这样才能在全新 clone 上无需任何未跟踪文件即可运行。改成 `appEnv` 会让 e2e 不再服务静态文件。

### `playwright.config.ts` 不要设 `APP_ENV`

理由同上。若设成 `production`,它会去找未跟踪的 `.env.production.local`,e2e 在干净环境上必挂。

### npm script 里禁止 `VAR=value command` 前缀

只有 POSIX shell 认识。Windows 的 cmd.exe 下报 `'NODE_ENV' is not recognized`,PowerShell 下是解析错误。跨平台注入只用 Node 的 `--env-file`。

注意顺序:`--env-file=<base>` 在前,`--env-file-if-exists=<local>` 在后。后者覆盖前者,颠倒了 `.local` 就失效。用 `-if-exists` 是因为 `.local` 可选,而普通 `--env-file` 遇到缺失文件会直接报错退出。

### 前端两类前缀

| 前缀 | 是否进浏览器产物 | 用途 |
| --- | --- | --- |
| `VITE_*` | **是** | 只有 `VITE_APP_ENV` |
| `WEB_*` | 否 | `WEB_DEV_PORT`、`WEB_DEV_PROXY_TARGET`,只给 `vite.config.ts` |

前后端共用 `config/` 同一批文件,里面有 `DATABASE_URL`。Vite 的前缀过滤是隔离的**唯一**依靠,不要用空前缀调用 `loadEnv` 再把结果塞进 `define`。

### `docker-compose` 未纳入统一管理

`docker-compose.yml` 的发布端口与 `DATABASE_URL` 是两处独立配置,这是有意的决定。不要擅自把 compose 改成从 `config/` 插值——那会改变 `db:up` 的行为并影响所有人的本机环境。

---

## 新增一个配置键的完整清单

漏掉任何一步都会产生"改了但不生效"或"本地对、CI 挂"。按顺序做:

1. **`packages/config/src/index.ts`** —— 在 `environmentSchema` 里加键。必填就不给 `.default()`,可选就给。字符串键加 `.min(1)`。
2. **同文件的 `AppConfig` 类型** —— 加字段,并在 `loadConfig` 的返回对象里做映射。类型是手写的,不是从 schema 推导的,两处都要改。
3. **`packages/config/src/index.test.ts`** —— 加测试。必填键测"缺失时抛错且信息含键名",可选键测默认值。
4. **`config/.env.example`** —— 加一行,带注释说明取值范围和影响。
5. **`config/.env.development`** —— 加开发默认值。非机密才写。
6. **`config/.env.staging` 和 `config/.env.production`** —— 按需加。**机密不写**,只在注释里说明要放 `.local`。
7. **`docs/CONFIGURATION.md` 第 7 节的键清单表** —— 加一行。
8. 若该键与别的键存在耦合(改 A 必须改 B),加进 `docs/CONFIGURATION.md` 第 6 节的耦合表。

验证:

```bash
npm run test --workspace @music-rank/config
npm run typecheck
```

## 修改现有键的默认值

改 `config/.env.development` 之前先确认:这个值有没有被 `docs/` 里的某张表复述?`docs/CONFIGURATION.md` 第 7 节和 `docs/LOCAL_FIRST_RUN_GUIDE.md` 第 9 节各有一份键清单,改了要同步。

## 调试"配置不是我以为的值"

打印 loader 最终解析出的结果,不要靠读文件推断:

```bash
npm run build --workspace @music-rank/config
node --input-type=module -e "import {config} from './packages/config/dist/index.js'; console.log(config)"
```

它读的是 `dist/`,所以要先 build。若结果与预期不符,按优先级链从高到低查:shell 里的真实环境变量 → `config/.env.<APP_ENV>.local` → `config/.env.<APP_ENV>`。

---

## 其他约定

- **测试文件会被编译进 `dist/`**(tsconfig 的 `include` 是 `src/**/*.ts`)。带测试的包,其 `test` script 必须写 `vitest run --exclude 'dist/**'`,否则 build 之后测试数量翻倍。
- **临时目录必须清理干净,且清理失败要抛出**。本仓库所在机器出现过测试往系统 temp 堆积残留目录、而清理错误被静默吞掉的问题。`packages/config/src/index.test.ts` 的 `afterEach` 是正确写法的参考:不要 try/catch 包住 `fs.rmSync`。
- **提交前跑** `npm run typecheck && npm run test`。改了 `apps/api` 或 `config/` 还要跑 `npm run test:e2e`。
