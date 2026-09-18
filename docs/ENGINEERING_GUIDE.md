# Music Rank 工程师指南

## 1. 文档信息

| 项目 | 值 |
| --- | --- |
| 文档性质 | 持续维护的工程实现说明 |
| 目标读者 | 负责开发、测试、排障和后续维护的工程师 |
| 当前产品版本 | Version 1 + 认证扩展 + 响应式导航 + 多榜单目录 + Default Group 与邀请，本地多用户应用 |
| 最后更新日期 | 2026-09-18 (America/New_York) |
| 最后核对的代码提交 | DESIGN-008 delivery on `main`, based on `be0efd9`; inspect Git log for the delivery commit |
| 事实来源 | 当前仓库代码、配置、迁移和自动化测试 |

这份文档描述系统现在如何工作。首次在本机配置和运行项目时，先执行 [LOCAL_FIRST_RUN_GUIDE.md](LOCAL_FIRST_RUN_GUIDE.md)；PROJECT_SPEC_ZH.md、PROJECT_SPEC_EN.md 与 IMPLEMENTATION_HANDOFF.md 保留 Version 1 历史基线，当前已批准扩展以 [AUTHENTICATION_DESIGN.md](AUTHENTICATION_DESIGN.md)、[RANKING_CATALOG_DESIGN.md](RANKING_CATALOG_DESIGN.md) 和 [SESSION_HANDOFF.md](SESSION_HANDOFF.md) 为准。若文档与代码不一致，应先核对代码和测试，再更新本文档。

### 1.1 维护规则

发生以下变化时，应在同一次代码变更中更新本文档：

- API 路径、参数、响应、状态码或错误码发生变化。
- 数据库表、枚举、索引、约束或迁移流程发生变化。
- 环境变量、端口、启动命令或构建方式发生变化。
- 前端数据流、主要组件职责或缓存失效策略发生变化。
- 测试用户、测试数据库影响范围或完整验证命令发生变化。
- 关键依赖被升级、降级或新增版本锁定。
- 新增已知风险、技术债或排障结论。

更新时同时修改“最后更新日期”“最后核对的代码提交”和第 18 节的近期变更记录。提交尚未创建时，可以暂写“当前工作树”，提交后再替换为 commit。

### 1.2 Default Group

The user authorized implementing one default group on 2026-09-17. Product behavior
is recorded in [DESIGN-007](DESIGN_007_DEFAULT_GROUP.md); implementation phases
and acceptance gates are in [PLAN-007](PLAN_007_DEFAULT_GROUP.md). The starting
baseline is integrated `main` at `83b24f3`.

The implementation adds group tables, a member directory, `/groups`, and fixed
invitation `/invite/default`. New registrations join transactionally and start
with both personal lists PUBLIC; existing stored visibility remains unchanged.
Migration `0006_panoramic_machine_man.sql` changes only the column default. Ordinary
login does not backfill membership. Invitation authentication joins if needed
and opens the group; repeat joins are idempotent. `Groups` appears in desktop
top navigation and mobile bottom navigation. PUBLIC still means anyone,
including anonymous visitors; private lists and notes remain private.
Management, multiple groups, and group-only visibility remain future work.

## 2. 系统概览

Music Rank 是一个全栈多用户应用。公开目录按来源无关的 slug 展示三个已导入真实榜单，年代和地区为可选展示元数据；Demo 榜单保留但未发布。用户可以维护 Top 10 和带演唱状态与私密备注的 Practice Library，并通过 Default Group 发现成员的公开列表。

应用的过渡版本支持仅 username 注册登录、PostgreSQL Session、多用户隔离，以及分别公开或隐藏 Top 10 和 Practice Library。匿名用户仍可浏览公共歌曲榜单。

~~~mermaid
flowchart LR
  Browser[React Web<br/>localhost:5173] -->|开发环境 /api 代理| API[Express API<br/>localhost:3001]
  Browser -->|生产形态同源请求| API
  API --> Contracts[共享 Zod Contracts]
  API --> Services[Service 层]
  Services --> Drizzle[Drizzle ORM]
  Drizzle --> Postgres[(PostgreSQL 17.6)]
  API -->|生产环境静态文件| WebDist[apps/web/dist]
~~~

### 2.1 当前边界

当前包含：

- 三个已发布的真实榜单：`80s Chinese Songs Top 100`（100 首）、`90s Mainland China Top 100`（100 首）和 `90s Cantonese Songs Top 70`（72 首）；另保留一个未发布的 `90s Demo Ranking`（30 首种子歌曲）。
- 按标题或歌手模糊搜索。
- 歌手精确筛选和发行年份精确筛选。
- 每页 25 首的前端分页。
- 最多 10 首、可持久化排序的 My Top 10。
- 独立于 Top 10 的 My Practice Library。
- 四种演唱状态和最长 300 字符的纯文本备注。
- 本地数据库迁移、幂等种子、组件测试、API 集成测试和 Playwright E2E。
- 用户注册、登录、七天持久 Session 和退出撤销。
- 新注册默认公开且可独立设为私密的 Top 10 与 Practice Library；公开 Practice Library 不包含备注。
- TanStack Router manages four primary destinations, slug ranking routes, protected personal/group routes, fixed invitations, and public profiles.
- 排名搜索、歌手、年份和客户端页码写入并校验 URL Search 参数；歌手与年份 Facet 只来自当前榜单。
- macOS、Linux、PowerShell 和 cmd.exe 均可使用的 production-shaped 启动命令。

当前不包含：

- SSO、邮箱验证、密码重置和账户删除。
- Anonymous user directory, following, and Unlisted sharing.
- 本次功能不包含 EC2 部署；已有部署流程见 DEPLOYMENT.md。
- 音频播放、歌词、视频采集、OCR 或 AI 提取。
- 自动从视频提取榜单内容；正式榜单通过已提供的 JSON manifest 和现有导入器同步。
- Group management, chat, and admin tools.

## 3. 技术栈与版本约束

| 层 | 技术 | 当前约束 |
| --- | --- | --- |
| Runtime | Node.js | 24.21.0，由 .nvmrc 和 package.json 固定 |
| 包管理器 | npm | 11.19.0 |
| Monorepo | npm workspaces | apps/* 与 packages/* |
| 前端 | React | package.json 声明 ^19.2.0 |
| 构建工具 | Vite | 精确固定为 7.2.1 |
| React Vite 插件 | @vitejs/plugin-react | 精确固定为 5.1.1 |
| UI | Material UI 与 Emotion | package.json 声明 ^7.3.5 / ^11.14.0 |
| 服务端状态 | TanStack Query | package.json 声明 ^5.90.10 |
| 客户端路由 | TanStack Router | apps/web/package.json 声明 ^1.170.35 |
| 拖放 | dnd-kit | core ^6.3.1，sortable ^10.0.0 |
| API | Express | package.json 声明 ^5.1.0 |
| 校验 | Zod | API/contracts 声明 ^4.1.12；Web 声明 ^4.6.2 |
| ORM | Drizzle ORM | package.json 声明 ^0.44.7 |
| 数据库驱动 | pg | package.json 声明 ^8.16.3 |
| 数据库 | PostgreSQL | Docker 镜像 postgres:17.6-alpine |
| 测试 | Vitest、Testing Library、Supertest、Playwright | 解析版本以 package-lock.json 为准 |

package-lock.json 是依赖解析结果的权威来源。除 Vite 和 @vitejs/plugin-react 外，大多数依赖使用兼容范围。

### 3.1 Vite 版本锁定

Vite 7.2.1 和 @vitejs/plugin-react 5.1.1 是有意锁定的组合。此前更宽泛的解析组合曾导致开发服务器返回 HTTP 500，并从 React refresh wrapper 报告 Missing field moduleType。

调整这两个版本时至少验证：

- npm run typecheck
- npm run test
- npm run build
- npm run test:e2e
- npm run dev 能正常启动
- http://localhost:5173/@vite/client 返回 HTTP 200

## 4. 仓库结构

| 路径 | 职责 |
| --- | --- |
| apps/web | React/Vite 前端 |
| apps/web/src/router.tsx | 路由树、Router 工厂和类型声明合并 |
| apps/web/src/routes | Root layout, ranking, personal, practice, public profile, groups, and default invitation routes |
| apps/web/src/shell/AppShellContext.tsx | Session, auth dialog, Snackbar, shared list/auth mutations, and protected-cache cleanup |
| apps/web/src/queries.ts | queryOptions 工厂，供组件与路由守卫共用同一份定义 |
| apps/web/src/api.ts | 前端 API 类型、请求封装和 ApiError |
| apps/web/src/components | Ranking、Top 10、Practice Library、TabNav 和 BottomNav UI |
| apps/web/src/theme.ts | Material UI 主题和状态颜色 |
| apps/api | Express API |
| apps/api/src/app.ts | Middleware、路由注册和请求校验入口 |
| apps/api/src/auth.ts | 仅 username 账号查找、占位凭据与原子注册、Session 创建/解析/撤销；保留 scrypt 工具 |
| apps/api/src/security.ts | Origin 防护与认证速率限制 |
| apps/api/src/services.ts | 数据访问和业务规则 |
| apps/api/src/groups.ts | Default-group lookup, idempotent joining, membership-authorized directory/profile reads |
| apps/api/src/errors.ts | AppError、Zod 错误和未知错误处理 |
| apps/api/src/current-user.ts | Session Cookie 用户解析、可选认证和测试用户注入边界 |
| apps/api/src/index.ts | 监听端口、静态文件和优雅退出 |
| packages/contracts | 前后端共享的 Zod 请求 Schema 和类型 |
| packages/database | Drizzle Schema、客户端、迁移和种子 |
| packages/database/migrations | 已跟踪的 SQL 迁移与 Drizzle 元数据 |
| e2e | Playwright 关键流程 |
| docs | 产品、交接和工程文档 |
| docs/LOCAL_FIRST_RUN_GUIDE.md | 新成员或 Agent 的首次环境检查、配置、启动和验证 Runbook |
| docs/AUTHENTICATION_DESIGN.md | 认证、榜单可见性和未来 SSO 边界 |
| playwright.config.ts | E2E 专用用户、端口和 Web Server |
| docker-compose.yml | 本地 PostgreSQL 服务和持久卷 |

构建产物位于各 workspace 的 dist 目录，并由 .gitignore 排除。

## 5. 本地开发

### 5.1 前置条件

- Node.js 24.21.0
- npm 11.19.0
- Docker 和 Docker Compose
- 日常开发需要本机端口 5173、3001 和 5432 可用；E2E 还需要 3101 可用

### 5.2 配置

配置位于仓库根的 `config/`,每个环境一份文件,优先级为
**真实环境变量 > `config/.env.<env>.local` > `config/.env.<env>`**。
已跟踪的 base 文件不含机密:`DATABASE_URL` 在其中根本不出现,由未跟踪的
`.env.<env>.local` 或真实环境变量提供。`DATABASE_URL` 与 `APP_ORIGIN`
缺失时进程启动即抛错退出,不再退回开发默认值。

`APP_ENV` 决定读哪套文件,与 `NODE_ENV` 是两个独立变量:后者在 Node 生态中
只认 `development` / `production`(以及 vitest 强制的 `test`),因此 staging
环境的文件里写的是 `NODE_ENV=production`。

完整键清单、分环境打包与启动命令、前端如何取配置、以及哪些键必须成对修改,
见 [CONFIGURATION.md](CONFIGURATION.md)。

### 5.3 首次启动

~~~bash
npm ci
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev
~~~

开发地址：

- Web：http://localhost:5173
- API：http://localhost:3001
- 健康检查：http://localhost:3001/api/health
- PostgreSQL：localhost:5432

开发环境由 Vite 把 /api 请求代理到 localhost:3001。

### 5.4 常用命令

| 命令 | 作用 |
| --- | --- |
| npm run db:up | 启动 PostgreSQL 容器 |
| npm run db:down | 停止容器；不会主动删除命名卷 |
| npm run db:generate | 根据 Drizzle Schema 生成迁移 |
| npm run db:migrate | 应用已跟踪迁移 |
| npm run db:seed | 创建或更新 demo fixtures |
| npm run import:ranking --workspace @music-rank/database -- [--dry-run \| --replace] manifests/<file>.json | 校验、导入或原子替换版本控制的榜单清单 |
| npm run publish:ranking --workspace @music-rank/database -- <slug> | 原子发布已验证的目标榜单并保持 Demo 未发布 |
| npm run dev | 并行启动 API watch 和 Vite |
| npm run typecheck | 构建共享包并检查所有 workspace 类型 |
| npm run test | 运行所有 Vitest 测试 |
| npm run build | 构建 config、contracts、database、API 和 Web(Web 用 --mode production) |
| npm run build:staging | 同上,Web 改用 --mode staging |
| npm run test:e2e | 构建并运行 Playwright 关键流程 |
| npm run start | 启动已构建的 API，使用 development 配置 |
| npm run start:prod | 以 production 配置启动已构建的 API |
| npm run start:staging | 以 staging 配置启动已构建的 API |

### 5.5 生产形态的本地运行

先执行 `npm run build`,再执行 `npm run start:prod`。生产模式下 Express 从
`apps/web/dist` 提供静态资源,并将非 API 路径回退到 `index.html`。是否提供静态
资源由 `NODE_ENV === 'production'` 判断,而非 `APP_ENV`——e2e 正是靠真实环境
变量把 `NODE_ENV` 顶成 `production`、同时让 `APP_ENV` 保持 `development`,才能
在全新 clone 上无需任何未跟踪文件即可运行。

启动命令通过 Node 的 `--env-file` 注入 `APP_ENV`,再用 `--env-file-if-exists`
叠加可选的 `.local`,后者必须排在后面才能覆盖前者。这里刻意不使用
`VAR=value command` 这种 POSIX 前缀写法:它只有 POSIX shell 认识,在 Windows 的
cmd.exe 下会报 `'NODE_ENV' is not recognized`,PowerShell 下同样是解析错误。
npm script 里不含任何 shell 特有语法,bash、zsh、PowerShell 和 cmd.exe 行为一致。

已存在的环境变量优先级高于 `--env-file`,因此临时改端口仍然可行。

`npm run dev` 的 API 与 `npm run start:prod` 默认都监听 3001，不能同时运行。需要并行保留开发服务时，应同时覆盖 production 的 `PORT` 和 `APP_ORIGIN`，并避开 E2E 专用的 3101；例如 macOS/zsh 可使用 `PORT=3102 APP_ORIGIN=http://localhost:3102 npm run start:prod`，PowerShell 可先设置 `$env:PORT` 与 `$env:APP_ORIGIN`。若只做 production-shaped Demo，先停止开发服务再使用默认 3001。

当前项目没有正式部署配置、反向代理配置、TLS、进程守护或运行时监控。

## 6. 应用架构

### 6.1 请求链路

1. React 页面通过 apps/web/src/api.ts 的 request 函数发起同源 fetch。
2. 开发环境由 Vite 代理 /api；生产形态由 Express 同源处理。
3. app.ts 为每个请求生成 requestId，并在响应完成后输出结构化 JSON 日志。
4. Unsafe 请求先经过同源校验；/api/me 路由再从 HttpOnly Cookie 解析 Session。
5. Zod 在路由入口校验 Path、Query 和 Body。
6. Service 层执行业务规则、事务和 Drizzle 查询。
7. errorHandler 将已知错误映射为 JSON 响应。

### 6.2 Workspace 依赖方向

- apps/web 依赖 packages/contracts。
- apps/api 依赖 packages/contracts 和 packages/database。
- packages/database 不依赖应用层。
- packages/contracts 不依赖其他 workspace。

根命令会先构建 contracts 和 database，因为 API 和 Web 从这些包的 dist 导出读取类型或运行时代码。

### 6.3 当前用户模型

生产和普通开发调用 createApp() 时，createCurrentUserResolver 从 Cookie 读取不透明 token，以 SHA-256 哈希查询未过期 Session，并把内部 userId 写入 response.locals。缺失、过期或无效 Session 返回 401 AUTH_REQUIRED。

createApp 仍允许注入 currentUserId，但只供既有个人列表集成测试隔离使用；普通运行入口从不传入该选项。Service 继续显式接收 userId。未来 OIDC/SSO 登录只需在验证外部身份后调用同一个 Session 创建边界。

## 7. 数据模型

### 7.1 公共枚举

| 枚举 | 值 |
| --- | --- |
| verification_status | DEMO、VERIFIED、UNVERIFIED |
| ranking_source_type | DEMO、OFFICIAL、MEDIA、COMMUNITY |
| ranking_region | HK_TW、MAINLAND |
| singing_status | CAN_SING、REGULARLY_SING、PRACTICING、WANT_TO_LEARN |
| list_type | TOP_LIST、SINGING_LIST |
| list_visibility | PRIVATE、PUBLIC |

### 7.2 users

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| id | uuid | 主键 |
| username | text | 可空；真实账户必须设置，小写且唯一；demo/test fixture 可为空 |
| display_name | text | 非空 |
| created_at | timestamptz | 非空，默认 now() |
| updated_at | timestamptz | 非空，默认 now() |

删除用户会级联删除其密码凭据、Session、榜单设置、Top 10 和 Singing List 项。

### 7.3 password_credentials

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| user_id | uuid | 主键和 users 外键，删除用户时级联 |
| password_hash | text | 已有 scrypt hash 保留；新账号存不可认证的 DISABLED_USERNAME_ONLY_V1；不通过 API 或日志输出 |
| created_at / updated_at | timestamptz | 非空，默认 now() |

### 7.4 auth_sessions

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | users 外键，删除用户时级联 |
| token_hash | text | 随机 Cookie token 的 SHA-256 哈希，唯一 |
| expires_at | timestamptz | 七天绝对过期时间 |
| created_at / updated_at | timestamptz | 非空，默认 now() |

### 7.5 user_list_settings

以 `(user_id, list_type)` 为复合主键。visibility 默认为 PUBLIC；注册事务会创建 TOP_LIST 和 SINGING_LIST 两条公开设置。已有设置不变，缺少记录时 Service 仍按 PRIVATE 处理，避免旧数据意外公开。

### 7.6 songs

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| id | uuid | 主键 |
| title | text | 非空 |
| artist | text | 非空 |
| release_year | integer | 可空 |
| verification_status | verification_status | 非空，默认 DEMO |
| normalized_title | text | 非空 |
| normalized_artist | text | 非空 |
| created_at / updated_at | timestamptz | 非空，默认 now() |

normalized_title 与 normalized_artist 组成唯一索引。当前 Seed 使用 trim 后的 locale lowercase 生成标准化值。被榜单或个人列表引用的歌曲使用 restrict 删除规则。

### 7.7 rankings

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| id | uuid | 主键 |
| title | text | 非空 |
| slug | text | 非空且唯一，供导入与管理稳定识别 |
| era | text | 可空 |
| decade_start | integer | 可空；存在时当前只允许 1980 或 1990 |
| region | ranking_region | 可空；存在时为 HK_TW 或 MAINLAND |
| display_order | integer | 非空且大于 0，控制目录顺序 |
| source_type | ranking_source_type | 非空 |
| source_url | text | 可空 |
| description | text | 可空 |
| is_published | boolean | 非空，默认 false |
| verified_at | timestamptz | 可空 |
| created_at / updated_at | timestamptz | 非空，默认 now() |

公开读取接口只返回 is_published 为 true 的榜单，并按 display_order、title 稳定排序。slug 是唯一公开身份；decade_start 与 region 仅为可选元数据，多条已发布榜单可以共享相同值或完全不填。删除榜单会级联删除 ranking_entries。

### 7.8 ranking_entries

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| id | uuid | 主键 |
| ranking_id | uuid | 外键，删除榜单时级联 |
| song_id | uuid | 外键，歌曲删除受限 |
| rank | integer | 非空且大于 0 |
| source_timestamp_seconds | integer | 可空，当前 demo Seed 未设置 |
| verification_status | verification_status | 非空，默认 DEMO |

唯一约束：

- 同一榜单不能重复 rank。
- 同一榜单不能重复 song_id。

### 7.9 user_top_list_entries

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 外键，删除用户时级联 |
| song_id | uuid | 外键，歌曲删除受限 |
| position | integer | 1 到 10 |
| created_at / updated_at | timestamptz | 非空，默认 now() |

业务与数据库不变量：

- 同一用户不能重复添加同一歌曲。
- 同一用户不能重复 position。
- position 必须在 1 到 10 之间。
- 用户最多有 10 条记录。
- 删除后由 Service 把剩余位置压缩为连续序列。

用户与 position 的唯一约束由迁移补充为 DEFERRABLE INITIALLY DEFERRED。重排和删除压缩事务会显式执行 SET CONSTRAINTS ALL DEFERRED，以允许同一事务内交换位置。

### 7.10 singing_list_entries

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 外键，删除用户时级联 |
| song_id | uuid | 外键，歌曲删除受限 |
| status | singing_status | 非空，默认 WANT_TO_LEARN |
| note | text | 可空；API 限制最长 300 字符 |
| created_at / updated_at | timestamptz | 非空，默认 now() |

同一用户和歌曲只能有一条记录。写入使用 upsert，冲突时更新 status、note 和 updated_at。列表按 updated_at 倒序返回。

### 7.11 Migration 与 Seed

Schema 源文件是 packages/database/src/schema.ts。修改后先生成迁移，再人工检查 SQL，最后应用迁移。不要手工修改已经在共享环境执行过的历史迁移。

当前 Seed：

- 创建或更新一个 demo 用户。
- 创建或更新 `90s Demo Ranking`，分类为 1990/MAINLAND，slug 为
  `90s-demo-ranking`，但保留它已有的 `is_published` 值；因此不会重新发布
  已被真实试点替换的 Demo。
- 创建或更新 30 首固定 UUID 的歌曲。
- 创建或更新 30 个固定榜单位置。
- 可以重复执行。

- 不创建、删除或覆盖 Top 10 和 Singing List 数据。
- 不为 demo 用户创建 username、密码凭据、Session 或公开设置。

DEMO_USER_ID 只控制 demo fixture，不再参与普通请求的当前用户解析。

### 7.12 Ranking manifest import

`packages/database/manifests/80s-chinese-top-100.json`,
`packages/database/manifests/90s-mainland-top-100.json`, and
`packages/database/manifests/90s-cantonese-top-70.json` are version-controlled,
user-approved Bilibili source manifests. `packages/database/src/ranking-importer.ts`
validates source metadata, one or more contiguous unique ranks beginning at 1,
and normalized-song uniqueness before it writes anything. The importer is
transactional and idempotent: a failed later row rolls back earlier writes, and
a repeated manifest reuses its existing songs and entries. It imports
unpublished first. The dedicated publication operation then preserves an
unpublished `90s-demo-ranking` while publishing the verified target in the same
transaction, without deleting Demo data.

Exact matches against a Demo song may upgrade that shared row to the manifest's
release year and `VERIFIED` status. Both dry-run and import reject a conflicting
release year on an already non-Demo song. This lets authoritative rankings
replace fixture metadata without weakening conflict protection for production
data or creating duplicate songs.

`--replace` is the controlled path for an authoritative manifest correction. It
deletes and recreates the target ranking and entries inside one transaction,
preserves the ranking's prior publication state, updates exact shared songs from
the new manifest, and deletes only old songs that have no ranking, Top 10, or
Practice Library references. The current pilot takes all 100 rank/title/artist/
release-year values verbatim from the user-provided JSON; it has no
canonicalization overrides. The source URL is display metadata only and was not
visited or used to validate the replacement.

### 7.13 Groups and memberships

`groups` has a UUID primary key, unique slug, display name, and created/updated
timestamps. `group_memberships` has composite primary key `(group_id,user_id)`,
`joined_at`, cascading group/user foreign keys, and a user-ID index.
`0005_bizarre_the_stranger.sql` creates both tables and inserts Default Group.
The canonical ID is exported by `packages/database/src/groups.ts`.

New-account registration writes membership in the existing transaction with
credentials, initial public list settings, and session. Ordinary login, GET APIs, and
Demo seed do not backfill users. Invitation joins use `ON CONFLICT DO NOTHING`;
concurrent/repeated requests keep one membership. TTT was joined only in the
local development database; AAA was preserved as a nonmember for user testing.
No production database operation was performed.

## 8. REST API 总览

| 方法 | 路径 | 成功状态 | 作用 |
| --- | --- | --- | --- |
| GET | /api/health | 200 | API 和数据库健康检查 |
| GET | /api/rankings | 200 | 获取所有已发布榜单 |
| GET | /api/rankings/:slug | 200 | 按稳定 slug 获取榜单、Facet、来源及过滤后的条目 |
| GET | /api/songs | 200 | 搜索或列出歌曲 |
| POST | /api/auth/register | 201 | 注册并创建 Session |
| POST | /api/auth/login | 200 | 仅 username 登录已有账号并创建 Session |
| POST | /api/auth/logout | 204 | 撤销当前 Session 并清除 Cookie |
| GET | /api/auth/session | 200 | 获取当前用户或 null |
| GET | /api/group-invitations/default | 200 | Anonymous-safe group summary; no membership writes |
| POST | /api/group-invitations/default/join | 200 | Real session and valid Origin; insert or confirm membership |
| GET | /api/me/groups | 200 | Current user's groups; nonmembers receive an empty array |
| GET | /api/me/groups/:groupId/members | 200 | Member-only safe directory |
| GET | /api/me/groups/:groupId/members/:username | 200 | Member-only identity and visibility flags; no list contents |
| GET | /api/me/list-settings | 200 | 获取两个个人榜单的有效可见性 |
| PATCH | /api/me/lists/:listType/visibility | 200 | 修改一个个人榜单的可见性 |
| GET | /api/me/top-list | 200 | 获取当前用户 Top 10 |
| POST | /api/me/top-list/items | 201 | 添加 Top 10 项 |
| PATCH | /api/me/top-list/order | 200 | 持久化完整 Top 10 顺序 |
| DELETE | /api/me/top-list/items/:songId | 200 | 删除 Top 10 项并压缩位置 |
| GET | /api/me/singing-list | 200 | 获取或按状态过滤演唱列表 |
| PUT | /api/me/singing-list/items/:songId | 200 | 新增或更新演唱项目 |
| DELETE | /api/me/singing-list/items/:songId | 204 | 删除演唱项目 |
| GET | /api/users/:username | 200 | 获取至少包含一个公开榜单的用户资料 |
| GET | /api/users/:username/top-list | 200 | 获取公开 Top 10 |
| GET | /api/users/:username/singing-list | 200 | 获取不含备注的公开 Singing List |

## 9. API 数据类型

### 9.1 Song

| 字段 | 类型 | 可空 |
| --- | --- | --- |
| id | UUID string | 否 |
| title | string | 否 |
| artist | string | 否 |
| releaseYear | integer | 是 |

### 9.2 Ranking

| 字段 | 类型 | 可空 |
| --- | --- | --- |
| id | UUID string | 否 |
| title | string | 否 |
| slug | string | 否 |
| era | string | 是 |
| decadeStart | integer | 是 |
| decade | 80s 或 90s | 是 |
| region | hk-tw 或 mainland | 是 |
| displayOrder | integer | 否 |
| sourceType | string | 否 |
| description | string | 是 |
| hasSource | boolean | 否 |

RankingDetail 在 Ranking 基础上增加 sourceUrl（string 或 null）、songCount（当前榜单未过滤的歌曲总数）、facets（artists 与 releaseYears）和 entries（按 rank 升序排列的 RankingEntry 数组）。songCount 与 Facet 从该榜单的全部条目生成，不受当前查询条件影响。RankingEntry 包含 Song 全部字段和非空 integer rank。

### 9.3 TopListEntry

包含 Song 全部字段和 position。position 是 1 到 10 的 integer，响应按 position 升序排列。

### 9.4 SingingListEntry

包含 Song 全部字段，以及非空 singing_status 类型的 status 和 string 或 null 类型的 note。

### 9.5 Auth 与公开类型

- AuthUser：id、username、displayName。
- AuthSession：`{ user: AuthUser | null }`。
- ListSettings：`{ topList: PRIVATE | PUBLIC, singingList: PRIVATE | PUBLIC }`。
- PublicProfile：username、displayName 和 ListSettings。
- PublicSingingListEntry：Song 与 status；刻意不定义 note。

## 10. API 详细参考

### 10.1 GET /api/health

用途：确认 API 可以连接数据库。

请求参数：无。

成功响应字段：status 当前为 ok；database 当前为 ok。

可能响应：

- 200：数据库 SELECT 1 成功。
- 500 INTERNAL_ERROR：数据库不可用或发生未知错误。

### 10.2 GET /api/rankings

用途：返回全部已发布榜单。

请求参数：无。

成功响应：Ranking 数组，按 displayOrder、title 升序排列。sourceUrl 不在列表响应中；hasSource 表示详情是否存在来源链接。前端直接按 slug 选择榜单；`/` 使用数组第一项作为默认榜单。

可能响应：

- 200：包括空数组。
- 500 INTERNAL_ERROR：数据库或未知错误。

### 10.3 GET /api/rankings/:slug

用途：获取单个已发布榜单及其过滤后的条目。

Path 参数：

| 参数 | 规则 |
| --- | --- |
| slug | 必填；小写字母、数字和单个连字符分隔的稳定标识，最长 120 字符 |

Query 参数：

| 参数 | 类型与规则 | 行为 |
| --- | --- | --- |
| q | trim 后最长 120 字符 | 对歌曲 title 和 artist 做不区分大小写的包含匹配 |
| artist | trim 后最长 120 字符 | 对 artist 做精确匹配 |
| releaseYear | 可转换为整数，1800 到 2100 | 对 release_year 做精确匹配 |

三个 Query 条件可以组合，并以 AND 连接；q 内部的标题与歌手条件以 OR 连接。空字符串经 trim 后不会添加对应筛选。

成功响应：RankingDetail。entries 按原榜单 rank 升序排列，rank 不因筛选重新编号；songCount 始终表示当前榜单未过滤的歌曲总数；facets 只包含当前榜单全部条目的歌手和非空年份，不包含仅存在于全局 songs 表的歌曲。

可能响应：

- 200：榜单存在，entries 可以为空。
- 400 INVALID_REQUEST：slug 或 Query 不符合 Schema。
- 404 RANKING_NOT_FOUND：榜单不存在或未发布。
- 500 INTERNAL_ERROR：数据库或未知错误。

### 10.4 GET /api/songs

用途：列出全部歌曲，或按标题/歌手搜索。

Query 参数 q：trim 后最长 120 字符，对 title 和 artist 做不区分大小写的包含匹配。

成功响应：Song 数组，按 title 升序排列。当前接口不分页。

可能响应：

- 200：包括空数组。
- 400 INVALID_REQUEST：q 超过长度限制或格式无效。
- 500 INTERNAL_ERROR：数据库或未知错误。

### 10.5 GET /api/me/top-list

用途：获取当前用户的完整 Top 10。

请求参数：无。

成功响应：TopListEntry 数组，按 position 升序排列。

可能响应：

- 200：包括空数组。
- 500 INTERNAL_ERROR：数据库或未知错误。

### 10.6 POST /api/me/top-list/items

用途：把一首歌曲追加到当前用户 Top 10 末尾。

Body：

| 字段 | 必填 | 规则 |
| --- | --- | --- |
| songId | 是 | UUID |

成功响应：更新后的完整 TopListEntry 数组。

操作语义：

- 在事务中读取当前列表。
- 新位置为当前列表长度加 1。
- 重复歌曲不视为幂等成功。

可能响应：

- 201：添加成功。
- 400 INVALID_REQUEST：Body 不符合 Schema。
- 404 SONG_NOT_FOUND：歌曲不存在。
- 409 TOP_LIST_DUPLICATE：歌曲已在 Top 10 中。
- 409 TOP_LIST_CAPACITY_REACHED：列表已有 10 首。
- 500 INTERNAL_ERROR：用户未被 Seed 创建、并发约束冲突或其他未知错误。

### 10.7 PATCH /api/me/top-list/order

用途：一次性提交当前 Top 10 的完整歌曲顺序。

Body：

| 字段 | 必填 | 规则 |
| --- | --- | --- |
| orderedSongIds | 是 | 1 到 10 个 UUID；数组内不得重复 |

成功响应：更新后的完整 TopListEntry 数组，按新 position 升序。

操作语义：

- 请求必须包含当前列表中的每一首歌曲且只能出现一次。
- 不能只提交局部移动。
- 在事务中延迟 position 唯一约束，再逐项更新。

可能响应：

- 200：重排成功。
- 400 INVALID_REQUEST：数组为空、超过 10 项、包含无效 UUID 或重复 UUID。
- 400 TOP_LIST_ORDER_MISMATCH：请求集合与当前列表不完全相同。
- 500 INTERNAL_ERROR：数据库或未知错误。

### 10.8 DELETE /api/me/top-list/items/:songId

用途：删除当前用户 Top 10 中的一首歌曲。

Path 参数 songId：必填 UUID。

成功响应：删除并压缩 position 后的完整 TopListEntry 数组。

可能响应：

- 200：删除成功。
- 400 INVALID_REQUEST：songId 不是 UUID。
- 404 TOP_LIST_ITEM_NOT_FOUND：歌曲不在当前用户 Top 10。
- 500 INTERNAL_ERROR：数据库或未知错误。

### 10.9 GET /api/me/singing-list

用途：获取当前用户演唱列表，可选按状态过滤。

Query 参数 status：CAN_SING、REGULARLY_SING、PRACTICING 或 WANT_TO_LEARN。

成功响应：SingingListEntry 数组，按 updated_at 倒序排列。

可能响应：

- 200：包括空数组。
- 400 INVALID_REQUEST：status 不是合法枚举值。
- 500 INTERNAL_ERROR：数据库或未知错误。

### 10.10 PUT /api/me/singing-list/items/:songId

用途：新增演唱项目，或更新已有项目的状态和备注。

Path 参数 songId：必填 UUID。

Body：

| 字段 | 必填 | 规则 |
| --- | --- | --- |
| status | 否 | singing_status；省略时默认为 WANT_TO_LEARN |
| note | 否 | string、null 或省略；string 最长 300 字符 |

成功响应：当前用户更新后的完整 SingingListEntry 数组，而不是单个项目。响应按 updated_at 倒序。

操作语义：

- user_id 与 song_id 冲突时执行更新。
- note 为 null 或省略时在数据库中保存为 null。
- Top 10 成员资格不受影响。

可能响应：

- 200：新增或更新成功。
- 400 INVALID_REQUEST：Path、status 或 note 不符合 Schema。
- 404 SONG_NOT_FOUND：歌曲不存在。
- 500 INTERNAL_ERROR：用户未被 Seed 创建或其他数据库错误。

### 10.11 DELETE /api/me/singing-list/items/:songId

用途：删除当前用户的一条演唱项目。

Path 参数 songId：必填 UUID。

成功响应：204，无响应 Body。

可能响应：

- 204：删除成功。
- 400 INVALID_REQUEST：songId 不是 UUID。
- 404 SINGING_LIST_ITEM_NOT_FOUND：歌曲不在当前用户演唱列表。

### 10.12 Authentication 与可见性

注册和登录 Body 均仅需 username；注册显示名默认为规范化 username。成功返回 `{ user: AuthUser }` 并设置七天 Cookie。未知用户名登录返回 404 USERNAME_NOT_REGISTERED，提示主动注册且不创建账号；重复注册返回 409 USERNAME_TAKEN，提示登录。用户名由 Contract trim 并转小写。退出始终清除 Cookie，有有效 token 时同时删除数据库 Session。

GET /api/auth/session 始终返回 200；未登录、过期或无效 Session 的 user 为 null。认证、个人数据与公开个人页/列表响应都禁用 HTTP 缓存，避免 Session 或可见性变更被旧缓存遮蔽。

GET /api/me/list-settings 返回两个有效设置。PATCH `/api/me/lists/top-list/visibility` 或 `/api/me/lists/singing-list/visibility` 的 Body 为 `{ "visibility": "PRIVATE" | "PUBLIC" }`，使用 upsert 并返回完整 ListSettings。

GET `/api/users/:username` 仅当至少一个列表公开时返回 PublicProfile。两个公开列表端点各自验证设置；Private 和不存在统一返回 404。公开 Singing List 的 SQL Projection 从源头排除 note，而不是先查询后在路由删除字段。
- 500 INTERNAL_ERROR：数据库或未知错误。

### 10.13 Default Group APIs

`GET /api/group-invitations/default` returns `{id,name,slug}` without a session
or membership write. `POST .../join` requires a real session and accepted Origin;
it returns the same summary after inserting or confirming membership.
`GET /api/me/groups` returns an array of the caller's summaries, including `[]`
for a nonmember.

`GET /api/me/groups/:groupId/members` checks actual membership and returns only
`{id,username,displayName}` rows, sorted by display name/username/ID. The sibling
`members/:username` endpoint checks both viewer and target membership and
returns `{username,displayName,lists:{topList,singingList}}`, even when both
lists are private. It never returns list contents or notes. Private endpoints
use `Cache-Control: private, no-store`. Public contents still come from the
existing `/api/users/:username/{top-list,singing-list}` endpoints.

Invalid group UUID/username returns `400 INVALID_REQUEST`, missing session
`401 AUTH_REQUIRED`, nonmember `403 GROUP_MEMBERSHIP_REQUIRED`, unknown group
`404 GROUP_NOT_FOUND`, and missing group member `404 GROUP_MEMBER_NOT_FOUND`.
Join failures are recoverable without destroying a valid authenticated session.

## 11. API 通用约定

### 11.1 请求和响应

- API 前缀统一为 /api。
- 请求和成功响应使用 JSON；204 响应没有 Body。
- 前端请求封装默认发送 Content-Type: application/json。
- Express JSON Body 上限为 32 KB。
- UUID 使用标准 UUID 字符串。
- 数据库 timestamp 字段当前没有暴露给这些 REST 响应。
- 当前没有 API 版本前缀或通用分页协议。

### 11.2 错误格式

已知业务错误包含 code 和 message。Zod 校验错误额外包含 details，值来自 ZodError.flatten()。未知错误包含 code、message 和用于关联服务端日志的 requestId。

当前没有把 requestId 放入所有成功响应或所有已知错误响应。

请求 Body 不是合法 JSON、Body 超过限制或请求了未知 API 路径时，目前不保证返回上述标准 JSON 错误格式：JSON Parser 错误会落入通用 500，未知路径使用 Express 默认 404。统一这两类响应属于待处理技术债。

### 11.3 完整错误码

| HTTP | code | 触发条件 |
| --- | --- | --- |
| 400 | INVALID_REQUEST | Zod 校验失败 |
| 400 | TOP_LIST_ORDER_MISMATCH | 重排集合与当前 Top 10 不一致 |
| 401 | AUTH_REQUIRED | /api/me 请求没有有效 Session |
| 404 | USERNAME_NOT_REGISTERED | 用户名不存在；提示主动注册且不创建账号 |
| 403 | INVALID_ORIGIN | Unsafe 请求 Origin 不匹配 APP_ORIGIN |
| 403 | GROUP_MEMBERSHIP_REQUIRED | Viewer is not a member of the requested group |
| 404 | GROUP_NOT_FOUND | Group does not exist |
| 404 | GROUP_MEMBER_NOT_FOUND | Target username is not a member of this group |
| 404 | RANKING_NOT_FOUND | 榜单不存在或未发布 |
| 404 | PUBLIC_PROFILE_NOT_FOUND | 用户没有任何公开榜单或不存在 |
| 404 | PUBLIC_LIST_NOT_FOUND | 指定榜单未公开或用户不存在 |
| 404 | SONG_NOT_FOUND | 写入目标歌曲不存在 |
| 404 | TOP_LIST_ITEM_NOT_FOUND | 删除不存在的 Top 10 项 |
| 404 | SINGING_LIST_ITEM_NOT_FOUND | 删除不存在的演唱项目 |
| 409 | TOP_LIST_DUPLICATE | 重复添加 Top 10 歌曲 |
| 409 | TOP_LIST_CAPACITY_REACHED | Top 10 已满 |
| 409 | USERNAME_TAKEN | 注册用户名冲突 |
| 429 | AUTH_RATE_LIMITED | 单进程窗口内认证尝试过多 |
| 500 | INTERNAL_ERROR | 未识别的运行时或数据库错误 |

### 11.4 身份和权限

所有 /api/me 请求必须携带有效的 HttpOnly Session Cookie。数据库 Session 只保存随机 token 的 SHA-256 哈希；过期或退出后的 Session 会被拒绝。Service 查询继续以服务端解析的 userId 限定，客户端不能提交替代 userId。

Unsafe 请求必须携带与 APP_ORIGIN 完全匹配的 Origin，显式 cross-site Fetch Metadata 也会被拒绝。注册和登录使用内存速率限制；多实例或公网部署前必须替换为共享限流存储，并补充 TLS、反向代理信任、安全响应头和运维秘密管理。

公开接口只在对应 user_list_settings 为 PUBLIC 时返回数据；Private 和不存在统一返回 404。公开 Singing List Projection 不包含 note。

### 11.5 并发和幂等性

- GET 请求只读。
- PUT Singing List 使用 upsert，对同一 userId/songId 可重复调用，但会更新 updated_at。
- POST Top 10 对重复歌曲返回 409，不是幂等成功。
- DELETE 不存在的个人列表项返回 404。
- Top 10 添加先读后写；数据库唯一约束是并发冲突的最终保护，未识别的约束错误当前会成为 500。

## 12. 前端工程说明

### 12.1 页面和数据流

前端使用 TanStack Router 的 Code-based 路由树，共五类页面路由：

| 路径 | 页面 | Tab 栏 | 需要 Session |
| --- | --- | --- | --- |
| `/` | 重定向到 displayOrder 最前的已发布榜单 | 有 | 否 |
| `/rankings/$slug` | The Ranking，全宽榜单与直接榜单标签 | 有 | 否 |
| `/personal` | Personal Ranking，My Top 10 | 有 | 是 |
| `/practice` | Practice Library | 有 | 是 |
| `/groups` | Default Group member directory or nonmember empty state | Yes | Yes |
| `/invite/default` | Anonymous invitation introduction or authenticated automatic join | Yes | No |
| `/u/$username` | 本人完整资料页 / 其他访客公开资料页 | 有（先解析 Session） | 否 |

`__root` holds Session, the auth dialog, Snackbar, and shared mutations through
AppShellProvider. The invitation page owns its join mutation. Public profiles
use `chrome={false}`; group-origin profiles have a validated group UUID in search
and a Back to group link, while ordinary public profiles return to ranking.

`/personal`, `/practice`, and `/groups` use
`ensureQueryData(sessionQueryOptions())` in beforeLoad; anonymous deep links
redirect home with `signin`. Guards and components share the same query options.
Profiles wait for session resolution before choosing owner or public data.
The matching owner reads both lists/settings from authenticated `/api/me/*`
endpoints with user-scoped personal query keys and cancellation signals,
regardless of visibility. Public / Private labels describe each list.
`?view=public` selects public-only preview with a return-to-owner button;
share URLs remain unchanged and recipients see only public lists.
Group-origin profiles of other members use the protected member endpoint
when authenticated and outside public preview; anonymous
visitors still use the existing public API.

beforeLoad 只在导航时执行，因此 Session 在页面内失效时需要显式 `router.invalidate()` 让守卫重新求值；这一步放在 loseAuthentication 里。主动登出走另一条路径：先导航回 `/` 再清除 Session，否则守卫会把刚选择登出的用户立刻重定向并要求登录。

登录、退出和认证失效会取消、清空并删除 `personal` 前缀缓存，避免跨用户复用。未登录时禁用的个人 Query 使用独立 `signed-out` 前缀，不能继续占用 `personal` 命名空间，否则 Query Observer 可能在退出后的重渲染中重新创建刚被删除的私人缓存项。写入成功后失效当前用户的 Top 10 和 Practice Library Query，并用 Snackbar 展示结果。

榜单页的搜索词、歌手、年份和页码保存在 URL Search 参数（`q`、`artist`、`year`、`page`），用 zod 校验，每个字段各自 `.catch(undefined)`，因此单个非法值只降级自身而不会丢弃其余筛选。筛选变更使用 `replace: true`，避免每敲一个字符压一条历史记录。空值与第 1 页以 undefined 写入，从 URL 中移除。切换榜单时保留 q、清除榜单特定的 artist/year，并回到第 1 页。

主要 Query Key：

- rankings
- songs
- ranking + slug + q + artist + releaseYear
- auth-session
- signed-out + resource + 可选 detail（仅未登录禁用查询的占位 Key）
- personal + userId + top-list
- personal + userId + singing-list + status
- personal + userId + list-settings
- personal + userId + groups (+ groupId + members)
- personal + userId + group-profile + groupId + username
- group-invitation + default (public introduction only)
- public-profile + username + 可选列表类型

Invitation intent is the current `/invite/default` route, preserved across
refresh, auth validation failures, and login/register switching. After session
resolution, join runs automatically once per account attempt, with explicit
retry after failure and navigation only on success. Ordinary registration
joins at the API and navigates home; ordinary login keeps its current behavior.
Groups, members, and member profiles use the protected `personal` cache prefix
with user-scoped keys; logout, expiry, and account switching clear old data.
Invitation metadata contains no member data and uses a public cache key.

ShareInvitation and VisibilityControl reuse ShareLinkDialog: a centered modal
with the standard dimmed MUI backdrop, a read-only selectable URL, adjacent Copy
button, and contextual hint. Opening it never copies or invokes native sharing.
Copy tries async clipboard, then `document.execCommand('copy')` with the link
selected for HTTP/permission failure. This legacy API may be blocked in some
browsers; if both methods fail, the dialog retains the selected link and explains
manual copying without claiming success. Successful copying updates the button
and status and notifies the caller. URLs use the current browser origin.

### 12.2 术语分界

DESIGN-002 起，用户可见文案统一使用 Practice Library：Tab 名称、页面标题、可见性控件、公开资料页分区，以及 API 错误消息文本。

数据契约保持 `singing`/`SINGING` 不变，本文档在描述这些位置时也沿用原名：`/api/me/singing-list/*` 与 `/api/users/:username/singing-list` 路径、`SINGING_LIST` 列表类型枚举、`singing_list_entries` 表、ListSettings 的 `singingList` 字段、`SINGING_LIST_ITEM_NOT_FOUND` 错误码，以及 SingingListPanel 组件标识符。改动这些是破坏性变更，不属于本次范围。

### 12.3 RankingPanel

- 页码由路由 URL 控制；搜索、歌手或年份变化时回到第 1 页。
- Clear 只清除歌手和年份，不清除搜索词。
- 对 API 返回的过滤后 entries 做每页 25 条的客户端分页。
- 页面级单行可滚动标签直接列出每个已发布榜单；不再生成 decade/region 组合。
- 头部仅在存在时以次要 Chip 显示 decade/region，并集中显示未过滤歌曲总数与来源标签；仅为合法 HTTP(S) sourceUrl 显示 `Watch source` 外链（无障碍名称仍说明原视频）。
- 搜索、歌手、年份和 Clear 收入同一浅色响应式工具栏；移动端纵向排列。
- Top 10 已满时禁用尚未加入歌曲的 Add Top 10。
- 行操作按钮位于正常文档流中，不使用 MUI `secondaryAction`。该插槽是绝对定位的，不占布局空间，行文字会直接渲染到按钮下面。
- `sm` 及以上：文字在左、按钮在右，两个按钮保持 144px / 164px 固定宽度以保证跨行对齐。
- 小于 `sm`：按钮整体下沉到文字下方，左缩进 46px（名次列 34px + 行间距 12px）与标题对齐，并用 `flex: 1` 等分行宽。
- 文字列使用 `minWidth: 0` 才能在 flex 容器内收缩；缺少它会让文字列保持内容宽度并把按钮挤出屏幕。
- Practice 按钮文案有长短两套（`Practice` / `Add Practice`、`In Library` / `In Practice Library`），用 `sx` 断点切换 `display`，与 TabNav 同一套做法。隐藏的一套不参与可访问名称计算。

### 12.4 RankingCatalogNav

- 使用页面级下划线 Tabs 显示 80s/90s 与 Hong Kong/Taiwan/Mainland China，不再使用独立 Paper 卡片。
- 只允许导航到 GET /api/rankings 返回的已发布组合；缺少数据的组合禁用。
- 更换年代时优先保留仍可用的地区，否则选择该年代第一个已发布地区。

### 12.5 TopListPanel

- 使用 dnd-kit PointerSensor 和 KeyboardSensor。
- PointerSensor 需要移动 6 像素才开始拖动。
- 支持拖放、键盘排序，以及独立的上移/下移按钮。
- 每次重排向 API 提交完整 orderedSongIds。
- 标题下方通过 statusLabel 插槽显示当前 Public/Private 小标签；右侧只保留数量和紧凑操作按钮。
- 小于 `sm` 时行拆成两段：第一段是名次、拖拽柄、歌名和歌手，第二段是上移/下移/移除三个按钮，缩进 28px 对齐文字。三个按钮约占 130px，不下沉会把 320px 下的文字列压到 100px 以内。
- 拖拽柄在所有断点都留在标题旁边，它是这一行的抓取点而不是对这一行的操作。
- 卡片内边距和标题栏方向随断点变化（`p: { xs: 1.75, sm: 2.5 }`、标题栏在 xs 竖排）。

### 12.5 SingingListPanel

- 顶部状态 Chip 控制服务端筛选。
- 折叠行显示状态色条、歌曲、歌手、可选备注预览、状态、编辑和删除。
- 编辑器使用本地 state 暂存 status 和 note。
- Cancel 恢复服务端最近一次数据。
- Save changes 通过 PUT upsert。
- 备注输入使用 multiline standard TextField，HTML maxLength 为 300。
- 状态和 Top 10 成员资格互相独立。
- 与 TopListPanel 一样，标题下方显示可见性标签，数量和操作按钮保持在标题区右侧。
- 行网格在小于 `sm` 时从 `4px minmax(0, 1fr) auto` 降为两列，状态 Chip 与编辑/删除按钮移到第二网格行并跨到文字列；状态色条用 `gridRow: '1 / -1'` 纵贯两行。
- 展开的编辑器在小于 `sm` 时去掉 `ml: 2` 缩进并收紧内边距。
- 行列表带 `aria-label="My Practice Library"`，与另外两个面板的列表标签一致。

### 12.6 认证与公开页

- 顶栏在匿名状态显示 Sign in/Register，在登录状态显示账户菜单。
- 登录注册共用 AuthDialog，均只有 username 输入；切换模式保留输入并清除错误，注册需主动提交，不自动创建账号。
- 每个个人榜单卡片使用独立 VisibilityStatus 和 VisibilityControl。标题下方的小标签明确显示 Public 或 Private；操作区的闭合锁表示 Private，打开锁表示 Public。
- 点击闭合锁切换到 Public 前必须确认；点击打开锁可直接恢复 Private。
- Public list share buttons open ShareLinkDialog for `/u/:username`, with contextual instructions and an explicit Copy button. Group invitations use the same dialog for `/invite/default`.
- `/u/:username` 的本人视角通过 session 保护的 `/api/me/*` 读取全部歌单并标明 Public / Private；其他访客和 `?view=public` 预览只读取公开 Projection。
- Practice Library 公开页显示状态但不支持编辑，也不接收 note 字段。

### 12.7 响应式布局

- 排名、个人列表和群组页面均为全宽单列。DESIGN-002 之前的 1.6fr / 0.85fr 两列布局已移除，个人列表改为独立路由。
- TabNav 始终使用 MUI `Tabs` 的 `fullWidth` 变体；`sm` 断点通过 `flex: '0 0 auto'` 让整行收缩为自然宽度并左对齐。同一个 Tabs 实例贯穿所有断点，不做变体切换，避免 Tab 列表重新挂载。
- Tab 文案有长短两套，同时存在于 DOM 中，由 `sx` 断点切换 `display`：小于 `sm` 显示 Ranking / Personal / Practice / Groups，`sm` 及以上显示 The Ranking / Personal Ranking / Practice Library / Groups。不使用 `useMediaQuery`，它首帧返回 false 会导致桌面端闪一下短文案。
- TabNav 容器高度固定为 52px，Session 解析完成后另外三个 Tab 出现时不会推动下方内容。
- 唯一断点是 MUI 的 `sm`（600px），全部通过 `sx` 的断点对象表达，不使用 `useMediaQuery`。
- 主导航有两套并存的实现，由同一个断点互斥显隐：`sm` 及以上显示顶部 TabNav，小于 `sm` 显示固定在视口底部的 BottomNav。两者都渲染在 DOM 里，靠 `sx` 的 `display` 切换，不做 JS 宽度判断。
- 目的地表是 `apps/web/src/navigation.ts` 的 `destinations`，TabNav 和 BottomNav 共用，同时导出 `bottomNavHeight`（56）。改导航目的地只改这一处。
- BottomNav 对匿名访客显示全部四项：受守卫的三项渲染成按钮而非链接，点击直接打开登录弹窗。渲染成链接会走到 `routes/personal.tsx` 的 `beforeLoad` 守卫、被重定向回 `/` 并闪过一个访客没要求的页面。守卫本身不变，它负责的是直接输入 URL 这个入口。
- TabNav 对匿名访客仍然过滤掉受守卫的三项，所以匿名访客在手机上看到四个目的地、在桌面上只看到一个。用户于 2026-09-15 接受该手机与桌面差异；2026-09-17 新增 Groups 后沿用同一匿名认证入口规则。
- BottomNav 是 `position: fixed`，不占布局空间，因此 AppShellContext 给内容区加了 `pb: calc(56px + env(safe-area-inset-bottom))`，Snackbar 也在 xs 下相应上移，否则列表最后一行和通知都会压在底栏下面。
- 断点行为只能由 Playwright 验证：jsdom 的 `getComputedStyle` 不把 emotion 注入的样式表计入 computed style，两个导航在单元测试里都表现为可见，而 `window.matchMedia` 在 jsdom 中未实现。
- 三个列表面板（RankingPanel / TopListPanel / SingingListPanel）遵循同一条规则：小于 `sm` 时，一行放不下的操作控件下沉到文字下方并缩进对齐文字列；`sm` 及以上保持原有的左文右操作布局。细节见 12.3–12.5。
- 行文字一律换行，不做省略号截断。操作控件进入正常流之后没有再隐藏歌名的理由。
- Practice Library 状态 Chip 允许换行。
- 顶栏（Brand）高度和字号随断点变化：`minHeight: { xs: 56, sm: 66 }`、`fontSize: { xs: '1.25rem', sm: '1.45rem' }`；副标题在小于 `sm` 时隐藏。
- 顶栏账户按钮必须限宽并省略号截断（`minWidth: 0` + `maxWidth: { xs: 150, sm: 320 }`）。用户名是任意长度且不可断行的文本，按钮作为 flex item 默认 `min-width: auto` 不会收缩，28 个字符的用户名就能把 320px 视口的 `scrollWidth` 顶到 331px。顶栏在每个页面都渲染，所以这一个元素会让**所有**页面横向滚动。截断只影响绘制的文本，可访问名称仍然是完整用户名。
- 断点行为由 `e2e/responsive.spec.ts` 验证，不由组件测试验证：Vitest 跑在 jsdom 上，不求值 media query，`sx` 断点对它不可见。

### 12.8 视觉与无障碍

- 只提供亮色主题和 Warm Archive 配色。
- 标题优先使用 Iowan Old Style / Palatino 系统衬线字体。
- 交互按钮具有可访问名称。
- 可见性锁按钮的名称同时包含列表、当前状态和目标动作；状态标签也有独立可访问名称。
- Top 10 提供非拖放排序按钮。
- 状态选择使用 aria-pressed。
- 编辑按钮使用 aria-expanded 和 aria-controls。
- 搜索结果数量使用 aria-live。
- 登录对话框具有关联标题、原生表单提交和 autocomplete 提示。
- Visibility Select 有可访问标签，公开确认说明公开字段范围。

## 13. 后端工程说明

### 13.1 app.ts

负责创建 Express 应用、设置 32 KB JSON Body 限制、生成 requestId、记录完成日志、执行 Origin 防护、注册认证/公开/私有路由、执行 Zod 校验并挂载统一错误处理。createApp 可接受 currentUserId、allowedOrigin、authRateLimit 和 enforceOrigin 测试选项；普通入口使用安全默认值。

### 13.2 auth.ts 与 current-user.ts

auth.ts 负责按 username 查找账号、含不可认证占位凭据的原子注册、Session 创建/查询/撤销；scrypt 工具保留，过渡版本登录不读取或验证密码。current-user.ts 只解析 Cookie 并把已认证内部用户写入 response.locals。二者不向日志或 API 返回哈希/token。

### 13.3 services.ts

负责数据库 Projection、榜单和歌曲读取、歌曲存在性检查、Top 10 容量与去重、事务重排、删除后位置压缩，以及 Singing List 状态过滤和 upsert。路由层不应复制这些业务规则。

services.ts 还负责列表可见性 upsert、缺失设置默认私密、公开资料门控，以及公开 Singing List 的无备注 Projection。

### 13.4 errors.ts

- ZodError 映射为 400 INVALID_REQUEST。
- AppError 使用自身 status、code 和 message。
- 其他错误只记录不含原始错误消息的结构化错误类型，并返回 500 INTERNAL_ERROR 和 requestId，防止数据库参数中的敏感哈希进入日志。
- asyncRoute 把异步异常交给 Express 错误 Middleware。

### 13.5 index.ts

- 默认监听 3001。
- production 模式提供 apps/web/dist。
- SIGINT 和 SIGTERM 时停止接受连接、关闭数据库池并退出。
- 当前没有实现超时强制退出或健康状态切换。

## 14. 测试策略

### 14.1 类型检查

npm run typecheck 会先构建 contracts 和 database，再执行所有 workspace 的 typecheck。

### 14.2 前端组件测试

The current Web suite has 17 files and 73 tests. It covers the existing ranking,
list/auth/privacy/navigation behavior plus groups, invitation refresh and mode
switching, failed authentication/cancellation, join retry, private-profile empty
states, protected-cache cleanup on logout/expiry/account switching, and sharing
with explicit button-triggered copying, native sharing never invoked, and
absent/rejected clipboard APIs handled without false success. Owner-profile
coverage checks direct/group visits, Public / Private labels, both-private
preview/return, ignored invalid view parameters, other/anonymous viewers,
account switching, and expired-session cleanup.

Vitest 保持文件级并行。`apps/web/vite.config.ts` 把单测试超时设为 10 秒；`apps/web/src/test/setup.ts` 将 Testing Library 异步等待默认设为 5 秒，与已有排名加载断言一致。该设置来自完整并行套件中不同页面加载/弹窗关闭超过默认 1 秒的复现；仅延长异步断言等待，不增加固定延迟或改变产品逻辑。调整并行度、测试运行器或查询初始化时，应连续运行完整 Web 套件至少三次确认稳定性，不要只验证单个测试文件。

### 14.3 API 集成测试

四个 API 测试实例（两个注入用户、真实认证、限流）在整套测试期间各自监听独立的本机随机端口，并在 teardown 关闭。不要退回每请求创建/关闭服务的方式：快速注册移除 scrypt 等待后，临时端口复用与 HTTP 连接复用可能使请求收到另一实例的响应，表现为公开榜单偶发 401 或错误的成员权限状态。此改动只影响测试，不改变生产服务监听方式。

There are 32 Supertest tests using real PostgreSQL, covering the existing
ranking/list/auth/privacy rules and the group access matrix, read-only GETs,
transactional registration membership, ordinary login without backfill,
concurrent/idempotent joining, safe member/profile projections,
username-only validation, missing-user registration prompts without writes,
unusable placeholders, preserved legacy hashes/display names/private data,
duplicate/concurrent registration, final-session-insert rollback, and private
lists/notes remaining inaccessible to other members and anonymous visitors.
Coverage also verifies both new-account PUBLIC defaults, the database column
default, missing legacy settings staying PRIVATE, and private choices surviving login.

既有业务规则测试通过 createApp 注入固定测试用户；认证测试使用真实 Cookie Agent 和动态账户。beforeEach/afterAll 只删除测试用户名和固定测试用户。测试不应读写 demo 用户的个人列表。

Database workspace has 10 importer integration tests, covering rank continuity,
dry-run 无写入、幂等导入、可空 decade/region、事务回滚、原子替换与孤儿
清理、Demo 保留式发布、重复歌曲和 slug 格式。

### 14.4 Playwright E2E

当前 7 条用例。第 1 条是关键流程覆盖：`/` 进入 displayOrder 最前的 `/rankings/:slug`、匿名时桌面顶部导航只显示 Ranking、注册、退出、仅 username 登录后个人目的地出现、搜索写入 URL Search 参数、添加 Top 10 与 Practice Library、经导航跳转到 `/personal` 和 `/practice`、设置状态与私密备注、刷新后仍停在 `/practice`、验证两个列表初始 Public、分别切换 Private 再确认公开、复制分享链接、登出后落在同一默认榜单、匿名深链接被重定向并弹出登录框，以及匿名读取公开页时看不到备注。

第 2 条是响应式回归 `e2e/responsive.spec.ts`：注册用户后把种子里最宽的一行（`纤夫的爱 / 尹相杰、于文华 · 1993`）放进两个个人列表并写入一条长备注，然后在 320 / 375 / 414 / 600 / 900 五个视口下依次访问 `/`、`/personal`、`/practice`，逐项断言页面无横向溢出、且行内没有任何文字压在控件下面。

它还验证小于 600px 的固定底部导航、600px 及以上的顶部导航、列表末行和 Snackbar 不被底栏遮挡。匿名访客在手机看到四个目的地、桌面只看到 Ranking，是产品已接受的差异。

第 3 条 `e2e/account-label.spec.ts` 使用像素级边界检查，防止账户按钮文字下伸部被裁切。

这条用例有两个容易写错的地方，实现时都踩过：

- **必须量文字的字形盒，不能量容器。** 用 `document.createRange()` 逐个 text node 取 `getClientRects()`。文字容器会铺满整行，即使里面的字已经钻到按钮底下，容器矩形看上去仍然是干净的，量容器会得到假阴性。
- **必须等列表行渲染出来再量。** `page.goto` 返回时 SPA 还没渲染任何 `li`，此时量到的是用户看不到的中间态：行数为 0 会让碰撞断言空过，横向溢出也会给出与最终布局无关的数值。用例因此先等首行可见，再做全部测量，并额外断言"量到的行数和文字盒数量大于 0"，让"什么都没量到"无法伪装成通过。

`e2e/groups.spec.ts` 的 4 条用例覆盖未知用户名提示主动注册、输入保留与模式错误清除、仅 username 请求体、重复注册后切回登录，以及普通注册/登录与邀请加入、邀请注册后浏览其他成员公开歌单、以及已有非成员通过邀请登录。本人 profile 回归在普通注册用例中添加真实歌曲，将两个列表设为 Private，再通过键盘从群组进入本人 profile，检查完整歌曲和 Private 标签、公开预览与返回、直接访问、退出后同 URL 不泄露私有歌单，以及 320px/1280px 布局。

playwright.config.ts 使用端口 3101、production 形态 Express 服务和 reuseExistingServer: false。启动前执行 build、Migration 和公共 Seed，并把 APP_ORIGIN 指向 3101。测试注册带时间戳的唯一用户，结束后级联删除该账户；不影响 demo 用户。

### 14.5 完整验证

~~~bash
npm run typecheck
npm run test
npm run build
npm run test:e2e
~~~

涉及 Vite 或 React 插件版本时，还必须启动开发服务器并验证 /@vite/client。

### 14.6 Default Group acceptance

The three cases in `e2e/groups.spec.ts` cover ordinary registration/home,
ordinary login without backfill, nonmember empty state, logged-in invitation
joining and member re-entry, invitation registration after refresh/mode
switching, invitation login for an existing nonmember, member/public-list
navigation, private-note exclusion, dialog copying, and 320/390/600/900px
layouts. Member links also support keyboard activation. Test-created accounts
are removed after each test; fixture cleanup failures propagate.

Clean/repeat migration and seed were checked on an isolated temporary database.
An intentionally failing final session insert verified complete registration
rollback including the newly added membership. Local TTT/AAA were not used as
automated test fixtures. See PLAN-007 for exact final commands and outcomes.

## 15. 安全与可靠性

当前已有：

- 过渡版本仅 username 注册登录；保留旧密码 hash，新账号存不可认证的统一占位标记。知道 username 即可访问该账号，用户明确接受这是中间版本使用方案，详见 [DESIGN-008](DESIGN_008_USERNAME_ONLY_TRANSITION.md)。
- 至少 256 位随机 Session token，数据库只保存 SHA-256 哈希，七天过期并支持退出撤销。
- HttpOnly、SameSite=Lax、host-only Cookie；HTTPS APP_ORIGIN 下使用 Secure 与 __Host- 前缀。
- /api/me 统一认证与 userId 授权边界，私有响应使用 Cache-Control: private, no-store。
- Unsafe 请求 Origin/Fetch Metadata 防护和注册/登录单进程速率限制。
- 未知 username 明确提示注册，登录不创建账号；日志不输出敏感原始错误消息。
- Public/Private 默认拒绝策略和公开 Singing List 无备注 Projection。
- Path、Query 和 Body 的 Zod 校验。
- 搜索词和筛选字符串最长 120 字符。
- 备注最长 300 字符。
- JSON Body 32 KB 限制。
- UUID、枚举、年份范围和重排数组校验。
- 参数化 Drizzle 查询。
- 数据库外键、唯一约束和 Check Constraint。
- Top 10 重排事务。
- 结构化请求日志和未知错误 requestId。
- 进程信号触发的数据库优雅关闭。

当前仍缺少分布式速率限制、完整安全响应头策略、登录审计日志、运行时指标、Tracing、告警、独立测试数据库，以及备份和恢复 Runbook。应用刻意不开放跨源认证请求：开发模式依靠 Vite 代理，生产形态使用同源请求。公网或多实例部署前必须补齐 TLS/代理配置和共享限流存储。

### 15.1 依赖审计基线

2026-09-11 在合并前后的 npm audit 对比结果均为 6 项：4 moderate、2 high；两个 PR 没有新增审计项。使用 --omit=dev 后只剩 drizzle-orm 的 1 项 high。

- drizzle-orm 0.44.x 受到 SQL 标识符转义问题影响，修复版本为 0.45.2 或以上。当前代码没有使用动态 SQL 标识符或 sql.raw，但仍应安排兼容性升级。
- Vite 7.2.1 的已知问题影响开发服务器。可修复版本与当前锁定组合需要单独验证，不能直接自动升级。
- drizzle-kit 的 moderate 链路来自旧 @esbuild-kit/esm-loader 和嵌套 esbuild，只在开发工具链使用。
- 不应直接运行 npm audit fix --force。

## 16. 故障排查

### 16.1 PostgreSQL 无法启动或连接

确认 Docker 正在运行、docker compose ps database 显示 healthy、5432 未被占用，并确认 DATABASE_URL 与 docker-compose.yml 一致。

### 16.2 Migration 或 Seed 失败

- 确认 PostgreSQL healthy。
- 确认 DATABASE_URL 指向预期数据库。
- 确认迁移 SQL 与 migrations/meta 同时存在。
- 确认 DEMO_USER_ID 是合法 UUID。
- 不要通过删除历史迁移绕过失败。

Seed 可重复执行，但不会恢复或覆盖个人列表。

### 16.3 Vite 返回 HTTP 500

若出现 Missing field moduleType，确认 Vite 为 7.2.1、@vitejs/plugin-react 为 5.1.1，并确认 package-lock.json 未被意外重算。重新安装后同时检查首页和 /@vite/client。

### 16.4 端口占用

- Web：5173。
- API：3001。
- E2E：3101。
- PostgreSQL：5432。

E2E 不复用已有服务器；3101 被占用时应先定位占用者。

### 16.5 E2E 启动失败

检查 PostgreSQL、Migration、Playwright Chromium、3101 端口和 E2E Seed。状态筛选 Chip 和歌曲状态 Chip 可能使用相同文本，定位时应先限定具体区域或歌曲行。

### 16.6 已知警告

- 前端测试会输出 React 插件旧 esbuild option 的兼容警告，但测试和构建能够完成。
- jsdom 当前未实现 `window.scrollTo()`，路由测试可能输出对应提示，但不代表浏览器运行失败。
- 年份 URL 参数测试在歌曲选项加载前可能输出 MUI select out-of-range 提示；断言仍通过，后续应通过测试数据同步消除噪声。
- 合并 TanStack Router 与 Web 端 Zod 后，前端单一 JavaScript 产物约 816.64 KB，gzip 约 254.80 KB，会触发 Vite 500 KB 警告。

不要只为消除警告解除已经验证的版本锁定。manualChunks 会改变分包，但不一定减少总传输量。

## 17. 工程变更 Checklist

### 17.1 API 变更

- 更新 packages/contracts。
- 更新 app.ts 路由校验。
- 更新 services.ts 业务规则。
- 明确成功状态、响应和错误码。
- 增加 API 集成测试。
- 按风险增加组件或 E2E 测试。
- 更新本文档第 8 至 11 节。

### 17.2 数据库变更

- 修改 schema.ts。
- 运行 npm run db:generate。
- 人工检查生成 SQL 和删除行为。
- 在干净数据库和已有数据数据库验证迁移。
- 重复运行 Seed 验证幂等性。
- 更新本文档第 7 节。

### 17.3 前端变更

- 保持前端 API 类型与真实响应一致。
- 检查 Query Key 和缓存失效范围。
- 检查桌面、移动布局和键盘操作。
- 更新组件测试和关键 E2E。
- 更新本文档第 12 节。

### 17.4 依赖升级

- 阅读迁移说明和安全公告。
- 不使用 --force 接受破坏性变更。
- 检查 package.json 和 package-lock.json。
- 运行完整验证。
- Vite 相关升级额外验证开发服务器。
- 更新第 3、15 和 16 节。

### 17.5 提交前

- npm run typecheck
- npm run test
- npm run build
- npm run test:e2e
- git diff --check
- 确认未提交 .env、dist、测试报告或本地数据库数据。
- 确认工程文档与代码一致。

## 18. 已知限制、技术债与决策记录

### 18.1 已知限制与技术债

| 项目 | 当前状态 | 建议 |
| --- | --- | --- |
| SSO 与账户恢复 | 当前为仅 username 过渡方案，无账号归属验证；未实现 SSO、邮箱验证或密码重置 | 按 AUTHENTICATION_DESIGN 的 issuer/sub 身份模型向前扩展 |
| ~~活动榜单选择~~ | 已解决：按稳定 slug 显式路由并按 displayOrder/title 排序 | — |
| ~~Singing 成员判断~~ | 已解决（DESIGN-002）：状态筛选随 Practice Library 移到 `/practice`，榜单页固定以 `ALL` 读取完整成员集合 | — |
| API 分页 | songs 与榜单详情没有服务端分页 | 数据规模扩大前设计统一分页 |
| 错误映射 | 未识别数据库约束错误返回 500 | 补充稳定业务错误映射 |
| 非标准请求错误 | malformed JSON、Body 过大和未知 API 路径未统一为 JSON 格式 | 增加解析错误和 API 404 Middleware |
| Request ID | 只在未知 500 响应中返回 | 需要完整追踪时加入响应 Header |
| 测试数据库 | 测试仍使用本地 PostgreSQL | CI 或多人开发前提供独立数据库 |
| 认证限流 | 当前为单进程内存窗口 | 多实例或公网部署前迁移到共享存储 |
| 依赖漏洞 | 6 项未自动修复 | 分别验证 Drizzle 与 Vite 升级 |
| 前端包体积 | 846.85 KB，gzip 263.54 KB（sharing-dialog build） | 优先评估路由级 lazy loading，再决定 vendor manualChunks |
| Web 测试日志噪声 | jsdom scrollTo 与 MUI out-of-range 提示不影响通过 | 用测试 setup polyfill 和完整筛选 fixture 消除噪声 |
| 跨平台 CI | 当前无 GitHub checks，跨平台改动依赖人工复核 | 增加 Node 24.21.0/npm 11.19.0 的 Linux 与 Windows 工作流 |
| 换行符策略 | 仓库尚无共享 .gitattributes | 为文本文件固定 LF，脚本类型按平台显式例外 |
| API 文档 | 当前为手工维护 | API 增长后考虑 OpenAPI |

### 18.2 关键工程决策

| 决策 | 原因 |
| --- | --- |
| 使用 npm workspaces | 维持包边界和单仓库开发体验 |
| 共享 Zod contracts | 统一请求输入校验和枚举类型 |
| Service 显式接收 userId | 为未来替换 demo 用户解析器保留迁移路径 |
| 账户、密码凭据和 Session 分表 | 支持凭据隔离，并让未来 SSO 复用内部用户与 Session |
| SSO 未来使用 issuer + subject | 避免把可变 email 当作外部身份主键 |
| 列表设置缺失时默认 Private | 迁移和异常状态下 fail closed，避免旧数据意外公开 |
| 公开 Singing List 排除 note | 公开歌曲/状态而不泄露用户私人记录 |
| Top 10 使用延迟唯一约束 | 允许事务内安全交换和压缩 position |
| Singing List 使用 upsert | 新增和编辑共享写入路径 |
| E2E 动态注册用户并使用专用端口 | 验证真实认证流程，结束后只删除自己创建的账户 |
| Vite 与 React 插件精确锁定 | 避免已复现的开发服务器 HTTP 500 |
| TanStack Router 使用 code-based 路由树 | 当前路由数量小，显式树便于守卫共享 QueryClient，暂不引入代码生成 |
| 个人路由守卫复用 queryOptions | `beforeLoad` 与组件读取同一个 Session Query 缓存，避免重复定义和状态漂移 |
| Production 环境变量使用 Node --env-file | 避免 npm script 中的 POSIX-only `VAR=value command` 语法，兼容 Windows |
| Web 测试保留并行并放宽合理超时 | 避免用全局串行掩盖负载敏感问题，同时让 CI 慢机有稳定余量 |
| 当前不拆分前端 Bundle | 本地 V1 暂时没有性能目标 |
| 榜单目录使用来源无关 slug 路径 | 路径可分享、刷新和历史恢复；平台、年代、地区不决定身份，内部仍以 UUID 关联数据 |
| decade/region 是可选元数据 | 语言榜、地区榜和年代榜可以重叠；多个已发布榜单可共享元数据 |
| 排名页 Facet 来自 ranking_entries | 全局歌曲和后续用户补录歌曲不会污染某一榜单的筛选项 |

### 18.3 近期文档变更

| 日期 | 代码基线 | 内容 |
| --- | --- | --- |
| 2026-09-18 | DESIGN-008 delivery on `main`, based on `be0efd9` | 实现 DESIGN-008：已有 username 直接登录，未知 username 提示主动注册，登录/注册只提交 username；新账号显示名默认 username，旧 hash 保留，新凭据存不可认证占位标记。其余 Session、group、profile、歌单和分享行为保持。typecheck、123 workspace tests（API 32 / Web 73 / config 8 / database 10）、production build、Playwright 7/7 及 320px/1280px 登录视觉验收通过。统一 Testing Library 5 秒异步等待后完整 Web 连续四次通过；API 测试改为独立持续监听端口后完整 API 连续两次通过。更新设计/认证/handoff 和文档链接/fences/diff；用户随后授权提交并推送到 origin/main，fetch 确认远端与基线一致；未部署，无 schema/migration/config/dependency 变更。 |
| 2026-09-18 | 当前工作树 on `main` at `a871406` | 本人 profile 通过受 Session 保护的 personal 查询展示全部歌单和 Public / Private 标签；增加公开预览/返回与分享接收者提示，分享 URL 不变。typecheck、116 workspace tests（API 26 / Web 72 / config 8 / database 10）、build、Playwright 6/6 与 320px/1280px 视觉验收通过。用户随后授权提交并推送到 origin/main；提交前再次通过 typecheck 和 116 项测试，fetch 确认远端与基线一致。本次后续文档整理检查链接、fences 和 diff；未重新部署。Default Group 原功能已通过 PR #11 合入。 |
| 2026-09-17 | Documentation refresh against `83ab826` | Updates current branch/commit, delivered group scope, four-item navigation, sharing/defaults, migration chain and latest verification. Document links/fences and diff checked; no application changes or tests rerun. Refresh saved in a subsequent local documentation commit; no GitHub push. |
| 2026-09-17 | Local commit `83ab826` | New registrations initialize both personal lists PUBLIC. Forward migration 0006 only changes the column default; existing visibility/membership and private notes are preserved. Full typecheck/build passed; API 26, Web 63, config 8, database 10, Playwright 6/6 passed. Local Git commit only; no GitHub push/deployment. |
| 2026-09-17 | Local commit `83ab826` | Sharing refinement: lists and invitations always open ShareLinkDialog with dimmed backdrop, URL, contextual hint, and explicit Copy. HTTP/rejected clipboard uses selection-based copying or manual instructions. Web typecheck/build passed; Web 63/63 and Playwright 6/6 with real clipboard reads and desktop/mobile visual QA. Local Git commit only; no GitHub push/deployment. |
| 2026-09-17 | Local commit `7053051`, based on `83b24f3` | Implements DESIGN-007: group tables/0005, transactional registration membership, fixed invitations, protected directory/profile reads, desktop/mobile Groups, and HTTP manual-copy fallback. Local TTT joined; AAA preserved outside. Typecheck/build passed; tests API 25/25, Web 59/59, config 8/8, database 10/10, Playwright 6/6. See PLAN-007 for details. Local Git commit only; no GitHub push/deployment. |
| 2026-09-17 | feature `b5507cc` / main merge `81a3e33` | 新增并发布 100 首 `80s Chinese Songs Top 100`；清单原样保留用户 JSON；导入器允许正式清单升级精确匹配的 Demo 歌曲并让 dry-run 同步检查年份冲突；E2E 不再假设默认榜单含 Demo 歌曲。typecheck、API 22/22、Web 44/44、config 8/8、database 10/10、build、Playwright 3/3 及桌面/手机验收通过；按用户授权直接合并并推送至 main。 |
| 2026-09-15 | feature `ecd1e45` / main `62292ba` | 合并多榜单目录与 DESIGN-004/006：保留来源无关 slug 路由、两份已发布真实榜单、移动底栏和响应式列表；更新 BottomNav 测试夹具与 Session 等待；typecheck、API 15/15、Web 40/40、database 8/8、build、Playwright 3/3 均通过。 |
| 2026-09-15 | `feature/90s-ranking-pilot` latest local commit after `6729972` | 新增 72 首 `90s Cantonese Songs Top 70`；导入器取消恰好 100 条的限制，改为支持任意正数的连续唯一名次；Cantonese 榜单不设置 region，来源 URL 仅用于 Watch source。 |
| 2026-09-15 | `feature/90s-ranking-pilot` working tree on `2b0a0a3` | 将榜单公开身份改为来源无关 slug；API/路由使用 `/rankings/:slug`，decade/region 改为可空元数据，UI 改为直接榜单标签，并保留跨榜共享歌曲的独立名次。 |
| 2026-09-15 | `feature/90s-ranking-pilot` working tree on `2b0a0a3` | Replaced the pilot from the user's authoritative 100-entry JSON, populated every release year, stored the exact Bilibili Watch source URL, and added atomic replacement plus safe orphan cleanup. |
| 2026-09-14 | `feature/90s-ranking-pilot` working tree on `2b0a0a3` | Added a version-controlled Bilibili 90s Mainland Top 100 manifest, transactional/idempotent import and publish tooling, rollback/idempotence tests, and a seed that preserves an intentionally unpublished Demo. The pilot is locally published with 100 entries; the Demo remains with 30 unpublished entries. |
| 2026-09-14 | `be345ae` 之后的工作树 | 按轻量编辑式草图重构榜单头部：页面级下划线分类 Tabs、集中元数据、响应式浅色筛选工具栏，并在详情 API 增加不受筛选影响的 songCount |
| 2026-09-14 | `feature/ranking-catalog-expansion` 当前工作树 | 实现多榜单 Task 1：年代/地区元数据与约束、稳定目录 API、榜单级 Facet、`/rankings/:decade/:region` 路由、两层选择器、URL 页码和安全来源链接；保留并重命名 Demo 榜单 |
| 2026-09-14 | 75424ee | 同步 PR #1/#2 合并后的真实基线：跨平台 production 启动、DESIGN-002 路由、28 项 Web 测试、测试超时策略、端口冲突说明、审计与 bundle 基线 |
| 2026-09-15 | PR #5 `8bafc41` / main `958b921` | 实现并验证 DESIGN-004：小于 600px 时主导航下沉为固定底栏，600px 及以上保持顶部 Tab；目的地表由两个导航共用；内容区与 Snackbar 为底栏让出空间；确认保留匿名手机三项、桌面仅 Ranking 的差异。 |
| 2026-09-15 | PR #3 branch after `aa479f9` | 使用隔离临时数据库重新验证 DESIGN-006：typecheck、API 11/11、Web 28/28、production build 和 Playwright 2/2 均通过。 |
| 2026-09-14 | 6b215be + 9717ff3 | 将 main 的跨平台启动、DESIGN-002、测试超时、端口、审计与 bundle 文档基线同步到 DESIGN-006 开发分支 |
| 2026-09-13 | 6b215be | 实现 DESIGN-006：三个列表面板的响应式布局；榜单行操作从 `secondaryAction` 改为正常流并在 xs 下沉到文字下方，两个个人面板补上断点，新增 `e2e/responsive.spec.ts` 响应式回归 |
| 2026-09-11 | 91bca4b / 75424ee | 实现 DESIGN-002：TanStack Router 客户端路由、三 Tab 响应式导航、受守卫的 `/personal` 与 `/practice`、榜单筛选进 URL Search 参数、Singing List 更名为 Practice Library；随后稳定并行 Web 测试 |
| 2026-09-10 | 40b8ff1 之后的工作树 | 将可见性选择框改为开/闭锁按钮与标题下状态标签，增加原生分享/复制降级，并隔离 signed-out 与 personal Query Key |
| 2026-09-10 | 40b8ff1 | 实现用户名/密码认证、数据库 Session、多用户隔离、Public/Private 个人榜单、公开资料页和未来 SSO 边界 |
| 2026-09-10 | 当前工作树 | 新增首次本地运行指南与认证开发交接入口，并将首次依赖安装统一为 npm ci |
| 2026-09-10 | 9ce4a1c | 创建工程师指南，记录 V1 架构、数据模型、API、测试、安全基线和维护规则 |
