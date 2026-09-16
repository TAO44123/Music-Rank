# 配置迁移手册

2026-09-16([PR #7](https://github.com/TAO44123/Music-Rank/pull/7))把配置从散落的 `.env` 改成了 `config/` 下的分环境文件。本文件告诉你在各种处境下需要做什么。

配置机制本身的说明在 [CONFIGURATION.md](CONFIGURATION.md);本文件只讲**迁移**。

## 变了什么

| 改动前 | 改动后 |
| --- | --- |
| 仓库根 `.env`、`apps/api/.env`、`packages/database/.env` 三份内容相同、手工同步 | `config/.env.development` 一份,已跟踪 |
| 仓库根 `.env.example` | `config/.env.example` |
| `config/production.env` | `config/.env.production` |
| 本机覆盖只能直接改上面那些文件 | `config/.env.<env>.local`,未跟踪,只写要改的行 |
| 缺 `DATABASE_URL` 时静默连 localhost 弱口令库 | 缺 `DATABASE_URL` 或 `APP_ORIGIN` 时启动即报错退出 |
| 前端端口和 proxy 目标写死在 `vite.config.ts` | `WEB_DEV_PORT` / `WEB_DEV_PROXY_TARGET` |
| 只有 production 一套 | development / staging / production 三套,加一份 example |

**键名一个都没变。** `DATABASE_URL` 还是 `DATABASE_URL`,变的只是它该写在哪个文件里。

---

## 场景 A:已有的本地 checkout

拉到最新 main 之后,**旧的 `.env` 文件不会被 git 删掉**——它们是未跟踪文件,`git pull` 不碰。它们会原地留着,但已经没有任何代码读取。这是本次迁移最容易踩的坑:你改它们不会有任何效果,排查时却会以为配置生效了。

先看看你的旧值和新的已跟踪默认值差在哪。只有差异才需要搬:

```bash
diff <(grep -vE '^\s*(#|$)' .env | sort) <(grep -vE '^\s*(#|$)' config/.env.development | sort)
```

左边带 `<` 的行就是你的本机特有值。把它们写进 `config/.env.development.local`(只写差异行,其余自动从 base 继承):

```bash
cat > config/.env.development.local <<'EOF'
DATABASE_URL=postgresql://music_rank:music_rank@localhost:5434/music_rank
EOF
```

然后删掉死文件:

```bash
rm -f .env .env.example apps/api/.env packages/database/.env
```

重装依赖(`packages/config` 是新 workspace,`apps/api` 与 `packages/database` 移除了 `dotenv`):

```bash
npm ci
```

确认配置解析结果符合预期:

```bash
npm run build --workspace @music-rank/config
node --input-type=module -e "import {config} from './packages/config/dist/index.js'; console.log(config)"
```

## 场景 B:全新机器

不需要复制任何模板。`config/.env.development` 已在仓库里且默认值可用:

```bash
npm ci
npm run db:up && npm run db:migrate && npm run db:seed
npm run dev
```

只有当本机取值与默认值冲突时才建 `config/.env.development.local`。最常见的是 Postgres 端口被别的项目占用。

## 场景 C:手上有未合并的分支

把 main 合进来或 rebase 上去时,冲突集中在这几个文件:

| 文件 | 冲突原因 | 怎么解 |
| --- | --- | --- |
| `package.json` | 根 scripts 的 `build` / `typecheck` / `start:prod` 都改了,并新增了两条 | **取 main 的版本**,再把你分支新加的 script 合进去 |
| `apps/api/src/index.ts` | 首行 `import 'dotenv/config'` 换成了 `import { config }`,`process.env` 读取全部替换 | 取 main 的版本,把你的改动重新应用上去 |
| `apps/api/src/app.ts` | 第 60 行附近 `allowedOrigin` 的默认值改了 | 同上 |
| `apps/web/vite.config.ts` | 从对象形式改成了 `defineConfig(({ mode }) => ...)` 函数形式 | 取 main 的版本,把你的 plugin/别名等改动搬进返回的对象里 |
| `packages/database/src/config.ts` | 整文件重写成从 `@music-rank/config` 取值 | **取 main 的版本**,不要保留旧的 `process.env` 写法 |
| `.gitignore` | 新增 `config/*.local` | 两边都留 |
| `README.md`、`docs/ENGINEERING_GUIDE.md`、`docs/LOCAL_FIRST_RUN_GUIDE.md` | 环境变量相关段落被删改为指向 `CONFIGURATION.md` | 取 main 的版本 |

如果你的分支**新增过配置键**(往旧的 `.env.example` 里加过行),那不能简单取 main 的版本——要按 [AGENTS.md](../AGENTS.md) 的"新增一个配置键的完整清单"重新走一遍,一共 8 步,漏掉任何一步都会出现"改了但不生效"。

合完先跑:

```bash
npm ci && npm run typecheck && npm run test
```

改动涉及 `apps/api` 或 `config/` 的还要跑 `npm run test:e2e`。

## 场景 D:服务器 / 部署环境

已跟踪的 `config/.env.production` **不含** `DATABASE_URL`。服务器上必须建 `config/.env.production.local` 提供它和正确的 `APP_ORIGIN`:

```bash
printf 'DATABASE_URL=postgresql://music_rank:<密码>@localhost:5432/music_rank\nAPP_ORIGIN=https://your-domain.com\n' > config/.env.production.local
chmod 600 config/.env.production.local
```

或者完全不用文件,由部署平台注入真实环境变量——它们优先级最高,`.local` 可以不存在。

三个部署注意事项:

- **`npm ci` 不能加 `--omit=dev`。** `typescript`(构建)和 `tsx`(迁移与 seed)都在 devDependencies 里。
- **在服务器上跑迁移必须显式指定环境。** `npm run db:migrate` 的 `APP_ENV` 缺省是 `development`,会去连开发默认的 localhost:5432,而不是生产库:

  ```bash
  APP_ENV=production npm run db:migrate
  ```

  `drizzle-kit` 不接受 Node 的命令行标志,所以没有跨平台的 npm script 能做这件事;Linux 上用前缀写法即可。
- **`APP_ORIGIN` 必须精确等于浏览器地址栏的 origin。** origin guard 是严格字符串比较,差一个字符(多个结尾斜杠、http 写成 https、带了端口)所有写操作全部 403。

---

## 症状对照表

| 症状 | 原因 | 解决 |
| --- | --- | --- |
| 改了 `.env` 完全没反应 | 那些文件已废弃,没有代码读 | 改 `config/.env.<env>.local` |
| 启动即退出,报 `DATABASE_URL: Invalid input: expected string, received undefined` | 当前环境缺 `DATABASE_URL` | 建对应的 `.local`,或注入真实环境变量 |
| 启动即退出,报 `Too small: expected string to have >=1 characters` | 某个键被写成了空值 | 该键要么给真实值,要么整行删掉走默认值 |
| 所有 POST/PATCH/DELETE 返回 403 `INVALID_ORIGIN` | `APP_ORIGIN` 与浏览器 origin 不一致 | 两者改成完全相同 |
| 前端页面正常但所有 API 请求 404 | 改了 `PORT` 却没改 `WEB_DEV_PROXY_TARGET` | 两者一起改 |
| 改了前端端口后写操作 403 | 改了 `WEB_DEV_PORT` 却没改 `APP_ORIGIN` | 两者一起改 |
| 整个测试套件在 import 阶段崩溃 | `config/.env.development` 被删或缺 `DATABASE_URL` | 从 main 恢复该文件 |
| `npm run build` 之后测试数量翻倍 | `dist/` 里的编译产物也被当测试跑 | 该包的 `test` script 加 `--exclude 'dist/**'` |
| 服务器上 `db:migrate` 打到了开发库 | `APP_ENV` 缺省 `development` | 加 `APP_ENV=production` 前缀 |
| 部署后 `npm run build` 报找不到 `tsc` | 用了 `npm ci --omit=dev` | 去掉该参数重装 |
| 本机端口改了 Docker 连不上 | compose 的发布端口与 `DATABASE_URL` 是两处独立配置 | `docker-compose.override.yml` 和 `.local` 同时改 |

## 检查清单

迁移完成的标志:

```bash
# 1. 旧文件都不在了
ls .env .env.example apps/api/.env packages/database/.env 2>&1 | grep -c "No such file"   # 应为 4

# 2. 被跟踪的 env 文件正好四个,且没有 .local
git ls-files | grep -E "\.env"

# 3. 配置解析结果符合预期
npm run build --workspace @music-rank/config
node --input-type=module -e "import {config} from './packages/config/dist/index.js'; console.log(config)"

# 4. 全绿
npm run typecheck && npm run test
```
