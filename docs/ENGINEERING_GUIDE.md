# Music Rank 工程师指南

## 1. 文档信息

| 项目 | 值 |
| --- | --- |
| 文档性质 | 持续维护的工程实现说明 |
| 目标读者 | 负责开发、测试、排障和后续维护的工程师 |
| 当前产品版本 | Version 1 + 认证扩展，本地多用户应用 |
| 最后更新日期 | 2026-09-11（America/New_York） |
| 最后核对的代码提交 | 当前工作树（DESIGN-002 三 Tab 导航与客户端路由） |
| 事实来源 | 当前仓库代码、配置、迁移和自动化测试 |

这份文档描述系统现在如何工作。首次在本机配置和运行项目时，先执行 [LOCAL_FIRST_RUN_GUIDE.md](LOCAL_FIRST_RUN_GUIDE.md)；产品目标和范围以 [PROJECT_SPEC_ZH.md](PROJECT_SPEC_ZH.md) 与 [PROJECT_SPEC_EN.md](PROJECT_SPEC_EN.md) 为准；历史交接信息以 [IMPLEMENTATION_HANDOFF.md](IMPLEMENTATION_HANDOFF.md) 和 [SESSION_HANDOFF.md](SESSION_HANDOFF.md) 为准。若文档与代码不一致，应先核对代码和测试，再更新本文档。

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

## 2. 系统概览

Music Rank 是一个本地运行的全栈演示应用。用户可以浏览一份明确标记为 Demo Data 的 1990 年代中国大陆流行歌曲虚构榜单，维护个人 Top 10，并维护带演唱状态和备注的 Practice Library。

应用支持本地用户名/密码注册登录、PostgreSQL Session、多用户隔离，以及分别公开或隐藏 Top 10 和 Practice Library。匿名用户仍可浏览公共歌曲榜单。

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

- 一个已发布的 demo 榜单和 30 首种子歌曲。
- 按标题或歌手模糊搜索。
- 歌手精确筛选和发行年份精确筛选。
- 每页 25 首的前端分页。
- 最多 10 首、可持久化排序的 My Top 10。
- 独立于 Top 10 的 My Practice Library。
- 四种演唱状态和最长 300 字符的纯文本备注。
- 本地数据库迁移、幂等种子、组件测试、API 集成测试和 Playwright E2E。
- 用户注册、登录、七天持久 Session 和退出撤销。
- 默认私密且可独立公开的 Top 10 与 Practice Library；公开 Practice Library 不包含备注。

当前不包含：

- SSO、邮箱验证、密码重置和账户删除。
- 用户目录、关注和 Unlisted 分享。
- 远程仓库、部署或生产基础设施。
- 音频播放、歌词、视频采集、OCR 或 AI 提取。
- 社交能力和管理后台。

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
| 拖放 | dnd-kit | core ^6.3.1，sortable ^10.0.0 |
| API | Express | package.json 声明 ^5.1.0 |
| 校验 | Zod | package.json 声明 ^4.1.12 |
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
| apps/web/src/routes | 四个路由模块：`__root` 布局、`/`、`/personal`、`/practice`、`/u/$username` |
| apps/web/src/shell/AppShellContext.tsx | Session、认证对话框、Snackbar 和全部 Mutation 的唯一持有者 |
| apps/web/src/queries.ts | queryOptions 工厂，供组件与路由守卫共用同一份定义 |
| apps/web/src/api.ts | 前端 API 类型、请求封装和 ApiError |
| apps/web/src/components | Ranking、Top 10、Practice Library 和 TabNav UI |
| apps/web/src/theme.ts | Material UI 主题和状态颜色 |
| apps/api | Express API |
| apps/api/src/app.ts | Middleware、路由注册和请求校验入口 |
| apps/api/src/auth.ts | 密码哈希、凭据校验、Session 创建/解析/撤销 |
| apps/api/src/security.ts | Origin 防护与认证速率限制 |
| apps/api/src/services.ts | 数据访问和业务规则 |
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
- 本机端口 5173、3001 和 5432 可用

### 5.2 环境变量

| 变量 | 默认值或示例值 | 使用位置 | 说明 |
| --- | --- | --- | --- |
| NODE_ENV | development | API 入口 | production 时由 Express 提供前端静态文件 |
| PORT | 3001 | API 入口 | Express 监听端口 |
| APP_ORIGIN | http://localhost:5173 | API Origin 防护和 Cookie 配置 | 必须与浏览器 Origin 完全一致；HTTPS 时启用 Secure Cookie |
| DATABASE_URL | postgresql://music_rank:music_rank@localhost:5432/music_rank | 数据库客户端和 Drizzle Kit | PostgreSQL 连接字符串 |
| DEMO_USER_ID | 7c5b5636-48f8-4e9b-89b0-06381d28496b | Seed | 凭据为空的 demo fixture ID；变更后应重新运行 Seed |
| LOG_LEVEL | info | .env.example | 当前代码尚未读取该变量 |

本地 .env 不应提交；.env.example 是可提交模板。

### 5.3 首次启动

~~~bash
cp .env.example .env
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
| npm run dev | 并行启动 API watch 和 Vite |
| npm run typecheck | 构建共享包并检查所有 workspace 类型 |
| npm run test | 运行所有 Vitest 测试 |
| npm run build | 构建 contracts、database、API 和 Web |
| npm run test:e2e | 构建并运行 Playwright 关键流程 |
| npm run start | 启动已构建的 API，使用 .env 中的值 |
| npm run start:prod | 以生产形态启动已构建的 API，读取 config/production.env |

### 5.5 生产形态的本地运行

先执行 npm run build，再执行 npm run start:prod。生产模式下 Express 从 apps/web/dist 提供静态资源，并将非 API 路径回退到 index.html。APP_ORIGIN 应设置为最终浏览器访问 Origin，例如本地同源形态为 http://localhost:3001。

NODE_ENV、PORT 和 APP_ORIGIN 来自随仓库提交的 config/production.env，由 Node 的 --env-file 加载。这里刻意不使用 `VAR=value command` 这种 POSIX 前缀写法：它只有 POSIX shell 认识，在 Windows 的 cmd.exe 下会报 `'NODE_ENV' is not recognized`，PowerShell 下同样是解析错误。npm script 里不含任何 shell 特有语法，bash、zsh、PowerShell 和 cmd.exe 行为一致。

config/production.env 只放 NODE_ENV、PORT 和 APP_ORIGIN，不含机密；DATABASE_URL 等仍来自未跟踪的 .env，由 dotenv 在进程内加载。已存在的环境变量优先级高于 --env-file，因此临时改端口仍然可行。

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
| password_hash | text | 版本化 scrypt 哈希；不通过 API 或日志输出 |
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

以 `(user_id, list_type)` 为复合主键。visibility 默认为 PRIVATE；缺少记录时 Service 也按 PRIVATE 处理。注册事务会创建 TOP_LIST 和 SINGING_LIST 两条私密设置。

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
| era | text | 可空 |
| source_type | ranking_source_type | 非空 |
| source_url | text | 可空 |
| description | text | 可空 |
| is_published | boolean | 非空，默认 false |
| verified_at | timestamptz | 可空 |
| created_at / updated_at | timestamptz | 非空，默认 now() |

公开读取接口只返回 is_published 为 true 的榜单。删除榜单会级联删除 ranking_entries。

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
- 创建或更新一个已发布 demo 榜单。
- 创建或更新 30 首固定 UUID 的歌曲。
- 创建或更新 30 个固定榜单位置。
- 可以重复执行。
- 不创建、删除或覆盖 Top 10 和 Singing List 数据。
- 不为 demo 用户创建 username、密码凭据、Session 或公开设置。

DEMO_USER_ID 只控制 demo fixture，不再参与普通请求的当前用户解析。

## 8. REST API 总览

| 方法 | 路径 | 成功状态 | 作用 |
| --- | --- | --- | --- |
| GET | /api/health | 200 | API 和数据库健康检查 |
| GET | /api/rankings | 200 | 获取所有已发布榜单 |
| GET | /api/rankings/:rankingId | 200 | 获取榜单详情及过滤后的条目 |
| GET | /api/songs | 200 | 搜索或列出歌曲 |
| POST | /api/auth/register | 201 | 注册并创建 Session |
| POST | /api/auth/login | 200 | 密码登录并创建 Session |
| POST | /api/auth/logout | 204 | 撤销当前 Session 并清除 Cookie |
| GET | /api/auth/session | 200 | 获取当前用户或 null |
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
| era | string | 是 |
| sourceType | string | 否 |
| description | string | 是 |

RankingDetail 在 Ranking 基础上增加 sourceUrl（string 或 null）和 entries（按 rank 升序排列的 RankingEntry 数组）。RankingEntry 包含 Song 全部字段和非空 integer rank。

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

成功响应：Ranking 数组。当前没有显式分页或排序保证；调用方不应依赖数据库的隐式返回顺序。前端当前使用数组第一项作为活动榜单。

可能响应：

- 200：包括空数组。
- 500 INTERNAL_ERROR：数据库或未知错误。

### 10.3 GET /api/rankings/:rankingId

用途：获取单个已发布榜单及其过滤后的条目。

Path 参数：

| 参数 | 规则 |
| --- | --- |
| rankingId | 必填 UUID |

Query 参数：

| 参数 | 类型与规则 | 行为 |
| --- | --- | --- |
| q | trim 后最长 120 字符 | 对歌曲 title 和 artist 做不区分大小写的包含匹配 |
| artist | trim 后最长 120 字符 | 对 artist 做精确匹配 |
| releaseYear | 可转换为整数，1800 到 2100 | 对 release_year 做精确匹配 |

三个 Query 条件可以组合，并以 AND 连接；q 内部的标题与歌手条件以 OR 连接。空字符串经 trim 后不会添加对应筛选。

成功响应：RankingDetail。entries 按原榜单 rank 升序排列，rank 不因筛选重新编号。

可能响应：

- 200：榜单存在，entries 可以为空。
- 400 INVALID_REQUEST：UUID 或 Query 不符合 Schema。
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

注册 Body 为 username、displayName、password；成功返回 `{ user: AuthUser }` 并设置七天 Cookie。登录 Body 为 username、password，使用相同成功响应。用户名由 Contract trim 并转小写。退出始终清除 Cookie，有有效 token 时同时删除数据库 Session。

GET /api/auth/session 始终返回 200；未登录、过期或无效 Session 的 user 为 null。认证、个人数据与公开个人页/列表响应都禁用 HTTP 缓存，避免 Session 或可见性变更被旧缓存遮蔽。

GET /api/me/list-settings 返回两个有效设置。PATCH `/api/me/lists/top-list/visibility` 或 `/api/me/lists/singing-list/visibility` 的 Body 为 `{ "visibility": "PRIVATE" | "PUBLIC" }`，使用 upsert 并返回完整 ListSettings。

GET `/api/users/:username` 仅当至少一个列表公开时返回 PublicProfile。两个公开列表端点各自验证设置；Private 和不存在统一返回 404。公开 Singing List 的 SQL Projection 从源头排除 note，而不是先查询后在路由删除字段。
- 500 INTERNAL_ERROR：数据库或未知错误。

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
| 401 | INVALID_CREDENTIALS | 用户名不存在或密码错误；二者使用相同响应 |
| 403 | INVALID_ORIGIN | Unsafe 请求 Origin 不匹配 APP_ORIGIN |
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

前端使用 TanStack Router 的 Code-based 路由树，共四条路由：

| 路径 | 页面 | Tab 栏 | 需要 Session |
| --- | --- | --- | --- |
| `/` | The Ranking，全宽榜单 | 有 | 否 |
| `/personal` | Personal Ranking，My Top 10 | 有 | 是 |
| `/practice` | Practice Library | 有 | 是 |
| `/u/$username` | 公开资料页 | 无 | 否 |

`__root` 是布局路由，通过 AppShellProvider 持有 Session Query、认证对话框、Snackbar 和三个 Mutation，页面组件用 useAppShell 取用，避免穿过 Outlet 的 Prop 传递。公开资料页用 `chrome={false}` 跳过顶栏和 Tab 栏，保留自己的"Back to ranking"入口。

`/personal` 与 `/practice` 各自在 beforeLoad 里 `ensureQueryData(sessionQueryOptions())`，无用户则重定向到 `/` 并带上 `signin` Search 参数以弹出登录框。守卫只挂在这两条路由上，`/` 和 `/u/$username` 不等待 Session，匿名首屏不被认证往返拖慢。守卫与组件必须共用 queries.ts 的同一个 queryOptions 对象，否则守卫写入的缓存项组件读不到。

beforeLoad 只在导航时执行，因此 Session 在页面内失效时需要显式 `router.invalidate()` 让守卫重新求值；这一步放在 loseAuthentication 里。主动登出走另一条路径：先导航回 `/` 再清除 Session，否则守卫会把刚选择登出的用户立刻重定向并要求登录。

登录、退出和认证失效会取消、清空并删除 `personal` 前缀缓存，避免跨用户复用。未登录时禁用的个人 Query 使用独立 `signed-out` 前缀，不能继续占用 `personal` 命名空间，否则 Query Observer 可能在退出后的重渲染中重新创建刚被删除的私人缓存项。写入成功后失效当前用户的 Top 10 和 Practice Library Query，并用 Snackbar 展示结果。

榜单页的搜索词、歌手和年份筛选保存在 URL Search 参数（`q`、`artist`、`year`），用 zod 校验，每个字段各自 `.catch(undefined)`，因此单个非法值只降级自身而不会丢弃其余筛选。筛选变更使用 `replace: true`，避免每敲一个字符压一条历史记录。空值以 undefined 写入，从 URL 中移除而非序列化成空串。

主要 Query Key：

- rankings
- songs
- ranking + rankingId + q + artist + releaseYear
- auth-session
- signed-out + resource + 可选 detail（仅未登录禁用查询的占位 Key）
- personal + userId + top-list
- personal + userId + singing-list + status
- personal + userId + list-settings
- public-profile + username + 可选列表类型

### 12.2 术语分界

DESIGN-002 起，用户可见文案统一使用 Practice Library：Tab 名称、页面标题、可见性控件、公开资料页分区，以及 API 错误消息文本。

数据契约保持 `singing`/`SINGING` 不变，本文档在描述这些位置时也沿用原名：`/api/me/singing-list/*` 与 `/api/users/:username/singing-list` 路径、`SINGING_LIST` 列表类型枚举、`singing_list_entries` 表、ListSettings 的 `singingList` 字段、`SINGING_LIST_ITEM_NOT_FOUND` 错误码，以及 SingingListPanel 组件标识符。改动这些是破坏性变更，不属于本次范围。

### 12.3 RankingPanel

- 搜索、歌手或年份变化时回到第 1 页。
- Clear 只清除歌手和年份，不清除搜索词。
- 对 API 返回的过滤后 entries 做每页 25 条的客户端分页。
- Top 10 已满时禁用尚未加入歌曲的 Add Top 10。
- 操作按钮使用固定宽度保持行对齐。

### 12.4 TopListPanel

- 使用 dnd-kit PointerSensor 和 KeyboardSensor。
- PointerSensor 需要移动 6 像素才开始拖动。
- 支持拖放、键盘排序，以及独立的上移/下移按钮。
- 每次重排向 API 提交完整 orderedSongIds。
- 标题下方通过 statusLabel 插槽显示当前 Public/Private 小标签；右侧只保留数量和紧凑操作按钮。

### 12.5 SingingListPanel

- 顶部状态 Chip 控制服务端筛选。
- 折叠行显示状态色条、歌曲、歌手、可选备注预览、状态、编辑和删除。
- 编辑器使用本地 state 暂存 status 和 note。
- Cancel 恢复服务端最近一次数据。
- Save changes 通过 PUT upsert。
- 备注输入使用 multiline standard TextField，HTML maxLength 为 300。
- 状态和 Top 10 成员资格互相独立。
- 与 TopListPanel 一样，标题下方显示可见性标签，数量和操作按钮保持在标题区右侧。

### 12.6 认证与公开页

- 顶栏在匿名状态显示 Sign in/Register，在登录状态显示账户菜单。
- 登录注册共用 AuthDialog，关闭时清除密码 state。
- 每个个人榜单卡片使用独立 VisibilityStatus 和 VisibilityControl。标题下方的小标签明确显示 Public 或 Private；操作区的闭合锁表示 Private，打开锁表示 Public。
- 点击闭合锁切换到 Public 前必须确认；点击打开锁可直接恢复 Private。
- Public 状态显示弯曲箭头分享按钮。浏览器支持 Web Share API 时打开原生分享面板；不可用或调用失败时复制 `/u/:username` 链接。用户主动取消系统分享时不触发复制降级。
- `/u/:username` 只请求服务端已批准的公开 Projection。
- Practice Library 公开页显示状态但不支持编辑，也不接收 note 字段。

### 12.7 响应式布局

- 三个页面均为全宽单列。DESIGN-002 之前的 1.6fr / 0.85fr 两列布局已移除，个人列表改为独立路由。
- TabNav 始终使用 MUI `Tabs` 的 `fullWidth` 变体；`sm` 断点通过 `flex: '0 0 auto'` 让整行收缩为自然宽度并左对齐。同一个 Tabs 实例贯穿所有断点，不做变体切换，避免 Tab 列表重新挂载。
- Tab 文案有长短两套，同时存在于 DOM 中，由 `sx` 断点切换 `display`：小于 `sm` 显示 Ranking / Personal / Practice，`sm` 及以上显示 The Ranking / Personal Ranking / Practice Library。不使用 `useMediaQuery`，它首帧返回 false 会导致桌面端闪一下短文案。
- TabNav 容器高度固定为 52px，Session 解析完成后另外两个 Tab 出现时不会推动下方内容。
- Ranking 行操作在 xs 下纵向排列，在 sm 及以上横向排列。
- Practice Library 状态 Chip 允许换行。
- 375px 实测：三个 Tab 等宽各约 114px，三个页面横向溢出均为 0。

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

auth.ts 负责 scrypt 密码格式、等时校验、原子注册、Session 创建/查询/撤销。current-user.ts 只解析 Cookie 并把已认证内部用户写入 response.locals。二者不向日志或 API 返回哈希/token。

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

当前有 5 个测试文件、12 项测试，覆盖匿名/登录/退出缓存状态、公开路由、RankingPanel、SingingListPanel、登录注册对话框、紧凑可见性锁控件、公开前确认和备注私密提示。

### 14.3 API 集成测试

当前有 11 项 Supertest 测试并使用真实 PostgreSQL。除既有榜单和列表规则外，还覆盖注册、Session 恢复/退出/过期、用户名规范化与冲突、非枚举登录错误、Origin 防护、速率限制、用户隔离、默认私密、公开 Projection 和 demo fixture 保留。

既有业务规则测试通过 createApp 注入固定测试用户；认证测试使用真实 Cookie Agent 和动态账户。beforeEach/afterAll 只删除测试用户名和固定测试用户。测试不应读写 demo 用户的个人列表。

### 14.4 Playwright E2E

当前 1 条关键流程覆盖：匿名时两个个人 Tab 不存在、注册、退出、密码登录后 Tab 出现、搜索写入 URL Search 参数、添加 Top 10 与 Practice Library、经 Tab 跳转到 `/personal` 和 `/practice`、设置状态与私密备注、刷新后仍停在 `/practice`、通过锁按钮分别公开列表并验证标题下方 Public 标签、后退回 `/personal` 且选中态正确、登出后落在 `/` 且不弹登录框、匿名深链接 `/personal` 被重定向并弹出登录框，以及匿名读取公开页时无 Tab 栏且看不到备注。

playwright.config.ts 使用端口 3101、production 形态 Express 服务和 reuseExistingServer: false。启动前执行 build、Migration 和公共 Seed，并把 APP_ORIGIN 指向 3101。测试注册带时间戳的唯一用户，结束后级联删除该账户；不影响 demo 用户。

### 14.5 完整验证

~~~bash
npm run typecheck
npm run test
npm run build
npm run test:e2e
~~~

涉及 Vite 或 React 插件版本时，还必须启动开发服务器并验证 /@vite/client。

## 15. 安全与可靠性

当前已有：

- 用户名/密码注册登录，密码使用带独立 salt 的版本化 scrypt 哈希。
- 至少 256 位随机 Session token，数据库只保存 SHA-256 哈希，七天过期并支持退出撤销。
- HttpOnly、SameSite=Lax、host-only Cookie；HTTPS APP_ORIGIN 下使用 Secure 与 __Host- 前缀。
- /api/me 统一认证与 userId 授权边界，私有响应使用 Cache-Control: private, no-store。
- Unsafe 请求 Origin/Fetch Metadata 防护和注册/登录单进程速率限制。
- 非枚举登录错误、缺失用户 dummy scrypt 校验和不含敏感原始错误消息的日志。
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

2026-09-10 的 npm audit 结果为 6 项：4 moderate、2 high。使用 --omit=dev 后只剩 drizzle-orm 的 1 项 high。

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
- 前端单一 JavaScript 产物约 611.28 KB，gzip 约 190.82 KB，会触发 Vite 500 KB 警告。

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
| SSO 与账户恢复 | 当前只有本地用户名/密码，未实现 SSO、邮箱验证或密码重置 | 按 AUTHENTICATION_DESIGN 的 issuer/sub 身份模型向前扩展 |
| 活动榜单选择 | 前端直接使用榜单数组第一项 | 多榜单前增加显式选择和稳定排序 |
| ~~Singing 成员判断~~ | 已解决（DESIGN-002）：状态筛选随 Practice Library 移到 `/practice`，榜单页固定以 `ALL` 读取完整成员集合 | — |
| API 分页 | songs 与榜单详情没有服务端分页 | 数据规模扩大前设计统一分页 |
| 错误映射 | 未识别数据库约束错误返回 500 | 补充稳定业务错误映射 |
| 非标准请求错误 | malformed JSON、Body 过大和未知 API 路径未统一为 JSON 格式 | 增加解析错误和 API 404 Middleware |
| Request ID | 只在未知 500 响应中返回 | 需要完整追踪时加入响应 Header |
| 测试数据库 | 测试仍使用本地 PostgreSQL | CI 或多人开发前提供独立数据库 |
| 认证限流 | 当前为单进程内存窗口 | 多实例或公网部署前迁移到共享存储 |
| 依赖漏洞 | 6 项未自动修复 | 分别验证 Drizzle 与 Vite 升级 |
| 前端包体积 | 611.28 KB，gzip 190.82 KB | 有真实性能目标后再优化 |
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
| 当前不拆分前端 Bundle | 本地 V1 暂时没有性能目标 |

### 18.3 近期文档变更

| 日期 | 代码基线 | 内容 |
| --- | --- | --- |
| 2026-09-11 | 当前工作树 | 实现 DESIGN-002：TanStack Router 客户端路由、三 Tab 响应式导航、受守卫的 `/personal` 与 `/practice`、榜单筛选进 URL Search 参数、Singing List 更名为 Practice Library |
| 2026-09-10 | 40b8ff1 之后的工作树 | 将可见性选择框改为开/闭锁按钮与标题下状态标签，增加原生分享/复制降级，并隔离 signed-out 与 personal Query Key |
| 2026-09-10 | 40b8ff1 | 实现用户名/密码认证、数据库 Session、多用户隔离、Public/Private 个人榜单、公开资料页和未来 SSO 边界 |
| 2026-09-10 | 当前工作树 | 新增首次本地运行指南与认证开发交接入口，并将首次依赖安装统一为 npm ci |
| 2026-09-10 | 9ce4a1c | 创建工程师指南，记录 V1 架构、数据模型、API、测试、安全基线和维护规则 |
