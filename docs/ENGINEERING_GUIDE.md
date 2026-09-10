# Music Rank 工程师指南

## 1. 文档信息

| 项目 | 值 |
| --- | --- |
| 文档性质 | 持续维护的工程实现说明 |
| 目标读者 | 负责开发、测试、排障和后续维护的工程师 |
| 当前产品版本 | Version 1，本地单用户演示应用 |
| 最后更新日期 | 2026-09-10（America/New_York） |
| 最后核对的代码提交 | 9ce4a1c（feat: implement Music Rank v1） |
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

Music Rank 是一个本地运行的全栈演示应用。用户可以浏览一份明确标记为 Demo Data 的 1990 年代中国大陆流行歌曲虚构榜单，维护个人 Top 10，并维护带演唱状态和备注的 Singing List。

Version 1 只有一个由环境变量解析的 demo 用户，不提供登录、注册、会话或权限系统。个人列表保存在 PostgreSQL 中。

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
- 独立于 Top 10 的 My Singing List。
- 四种演唱状态和最长 300 字符的纯文本备注。
- 本地数据库迁移、幂等种子、组件测试、API 集成测试和 Playwright E2E。

当前不包含：

- 身份认证、多账号和权限模型。
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
| apps/web/src/App.tsx | 页面组合、查询、Mutation 和缓存失效 |
| apps/web/src/api.ts | 前端 API 类型、请求封装和 ApiError |
| apps/web/src/components | Ranking、Top 10、Singing List UI |
| apps/web/src/theme.ts | Material UI 主题和状态颜色 |
| apps/api | Express API |
| apps/api/src/app.ts | Middleware、路由注册和请求校验入口 |
| apps/api/src/services.ts | 数据访问和业务规则 |
| apps/api/src/errors.ts | AppError、Zod 错误和未知错误处理 |
| apps/api/src/current-user.ts | 当前 demo/test 用户解析器 |
| apps/api/src/index.ts | 监听端口、静态文件和优雅退出 |
| packages/contracts | 前后端共享的 Zod 请求 Schema 和类型 |
| packages/database | Drizzle Schema、客户端、迁移和种子 |
| packages/database/migrations | 已跟踪的 SQL 迁移与 Drizzle 元数据 |
| e2e | Playwright 关键流程 |
| docs | 产品、交接和工程文档 |
| docs/LOCAL_FIRST_RUN_GUIDE.md | 新成员或 Agent 的首次环境检查、配置、启动和验证 Runbook |
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
| DATABASE_URL | postgresql://music_rank:music_rank@localhost:5432/music_rank | 数据库客户端和 Drizzle Kit | PostgreSQL 连接字符串 |
| DEMO_USER_ID | 7c5b5636-48f8-4e9b-89b0-06381d28496b | Seed 与当前用户解析器 | 必须是 UUID；变更后应重新运行 Seed |
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
| npm run start | 启动已构建的 API |

### 5.5 生产形态的本地运行

先执行 npm run build，再使用 NODE_ENV=production 和 PORT 启动 npm run start。生产模式下 Express 从 apps/web/dist 提供静态资源，并将非 API 路径回退到 index.html。

当前项目没有正式部署配置、反向代理配置、TLS、进程守护或运行时监控。

## 6. 应用架构

### 6.1 请求链路

1. React 页面通过 apps/web/src/api.ts 的 request 函数发起同源 fetch。
2. 开发环境由 Vite 代理 /api；生产形态由 Express 同源处理。
3. app.ts 为每个请求生成 requestId，并在响应完成后输出结构化 JSON 日志。
4. /api/me 路由先经过当前用户解析器。
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

生产和普通开发调用 createApp() 时，createCurrentUserResolver 使用 DEMO_USER_ID。所有 /api/me 请求都被解析为同一个用户。

createApp 允许注入 currentUserId，仅用于测试隔离。未来接入认证时，优先替换当前用户 Middleware，同时继续让 Service 显式接收 userId，避免重写个人列表的数据访问接口。

## 7. 数据模型

### 7.1 公共枚举

| 枚举 | 值 |
| --- | --- |
| verification_status | DEMO、VERIFIED、UNVERIFIED |
| ranking_source_type | DEMO、OFFICIAL、MEDIA、COMMUNITY |
| singing_status | CAN_SING、REGULARLY_SING、PRACTICING、WANT_TO_LEARN |

### 7.2 users

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| id | uuid | 主键 |
| display_name | text | 非空 |
| created_at | timestamptz | 非空，默认 now() |
| updated_at | timestamptz | 非空，默认 now() |

删除用户会级联删除其 Top 10 和 Singing List 项。

### 7.3 songs

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

### 7.4 rankings

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

### 7.5 ranking_entries

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

### 7.6 user_top_list_entries

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

### 7.7 singing_list_entries

| 字段 | 类型 | 约束或用途 |
| --- | --- | --- |
| id | uuid | 主键 |
| user_id | uuid | 外键，删除用户时级联 |
| song_id | uuid | 外键，歌曲删除受限 |
| status | singing_status | 非空，默认 WANT_TO_LEARN |
| note | text | 可空；API 限制最长 300 字符 |
| created_at / updated_at | timestamptz | 非空，默认 now() |

同一用户和歌曲只能有一条记录。写入使用 upsert，冲突时更新 status、note 和 updated_at。列表按 updated_at 倒序返回。

### 7.8 Migration 与 Seed

Schema 源文件是 packages/database/src/schema.ts。修改后先生成迁移，再人工检查 SQL，最后应用迁移。不要手工修改已经在共享环境执行过的历史迁移。

当前 Seed：

- 创建或更新一个 demo 用户。
- 创建或更新一个已发布 demo 榜单。
- 创建或更新 30 首固定 UUID 的歌曲。
- 创建或更新 30 个固定榜单位置。
- 可以重复执行。
- 不创建、删除或覆盖 Top 10 和 Singing List 数据。

修改 DEMO_USER_ID 后必须重新运行 Seed，否则个人列表写入会因用户外键不存在而失败。

## 8. REST API 总览

| 方法 | 路径 | 成功状态 | 作用 |
| --- | --- | --- | --- |
| GET | /api/health | 200 | API 和数据库健康检查 |
| GET | /api/rankings | 200 | 获取所有已发布榜单 |
| GET | /api/rankings/:rankingId | 200 | 获取榜单详情及过滤后的条目 |
| GET | /api/songs | 200 | 搜索或列出歌曲 |
| GET | /api/me/top-list | 200 | 获取当前用户 Top 10 |
| POST | /api/me/top-list/items | 201 | 添加 Top 10 项 |
| PATCH | /api/me/top-list/order | 200 | 持久化完整 Top 10 顺序 |
| DELETE | /api/me/top-list/items/:songId | 200 | 删除 Top 10 项并压缩位置 |
| GET | /api/me/singing-list | 200 | 获取或按状态过滤演唱列表 |
| PUT | /api/me/singing-list/items/:songId | 200 | 新增或更新演唱项目 |
| DELETE | /api/me/singing-list/items/:songId | 204 | 删除演唱项目 |

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
| 404 | RANKING_NOT_FOUND | 榜单不存在或未发布 |
| 404 | SONG_NOT_FOUND | 写入目标歌曲不存在 |
| 404 | TOP_LIST_ITEM_NOT_FOUND | 删除不存在的 Top 10 项 |
| 404 | SINGING_LIST_ITEM_NOT_FOUND | 删除不存在的演唱项目 |
| 409 | TOP_LIST_DUPLICATE | 重复添加 Top 10 歌曲 |
| 409 | TOP_LIST_CAPACITY_REACHED | Top 10 已满 |
| 500 | INTERNAL_ERROR | 未识别的运行时或数据库错误 |

### 11.4 身份和权限

当前没有认证。所有 /api/me 请求都使用服务进程启动时解析到的 DEMO_USER_ID。任何能访问本地 API 的客户端都能读写该用户的个人列表。

在部署到非本地环境之前，必须增加认证、授权、跨站请求保护策略、速率限制、生产日志和秘密管理。

### 11.5 并发和幂等性

- GET 请求只读。
- PUT Singing List 使用 upsert，对同一 userId/songId 可重复调用，但会更新 updated_at。
- POST Top 10 对重复歌曲返回 409，不是幂等成功。
- DELETE 不存在的个人列表项返回 404。
- Top 10 添加先读后写；数据库唯一约束是并发冲突的最终保护，未识别的约束错误当前会成为 500。

## 12. 前端工程说明

### 12.1 页面和数据流

App.tsx 负责加载榜单列表、歌曲全集、活动榜单、Top 10 和当前筛选下的 Singing List；保存搜索词与筛选状态；集中发起写操作；写入成功后失效 top-list 和所有 singing-list Query；并用 Snackbar 展示结果。

主要 Query Key：

- rankings
- songs
- ranking + rankingId + q + artist + releaseYear
- top-list
- singing-list + status

### 12.2 RankingPanel

- 搜索、歌手或年份变化时回到第 1 页。
- Clear 只清除歌手和年份，不清除搜索词。
- 对 API 返回的过滤后 entries 做每页 25 条的客户端分页。
- Top 10 已满时禁用尚未加入歌曲的 Add Top 10。
- 操作按钮使用固定宽度保持行对齐。

### 12.3 TopListPanel

- 使用 dnd-kit PointerSensor 和 KeyboardSensor。
- PointerSensor 需要移动 6 像素才开始拖动。
- 支持拖放、键盘排序，以及独立的上移/下移按钮。
- 每次重排向 API 提交完整 orderedSongIds。

### 12.4 SingingListPanel

- 顶部状态 Chip 控制服务端筛选。
- 折叠行显示状态色条、歌曲、歌手、可选备注预览、状态、编辑和删除。
- 编辑器使用本地 state 暂存 status 和 note。
- Cancel 恢复服务端最近一次数据。
- Save changes 通过 PUT upsert。
- 备注输入使用 multiline standard TextField，HTML maxLength 为 300。
- 状态和 Top 10 成员资格互相独立。

### 12.5 响应式布局

- 小于 lg：主区域为单列，榜单在前，个人列表在后。
- lg 及以上：约 1.6fr / 0.85fr 的两列布局。
- Ranking 行操作在 xs 下纵向排列，在 sm 及以上横向排列。
- Singing 状态 Chip 允许换行。

### 12.6 视觉与无障碍

- 只提供亮色主题和 Warm Archive 配色。
- 标题优先使用 Iowan Old Style / Palatino 系统衬线字体。
- 交互按钮具有可访问名称。
- Top 10 提供非拖放排序按钮。
- 状态选择使用 aria-pressed。
- 编辑按钮使用 aria-expanded 和 aria-controls。
- 搜索结果数量使用 aria-live。

## 13. 后端工程说明

### 13.1 app.ts

负责创建 Express 应用、设置 32 KB JSON Body 限制、生成 requestId、记录完成日志、注册路由、执行 Zod 校验并挂载统一错误处理。createApp 可接受可选 currentUserId，用于测试隔离。

### 13.2 services.ts

负责数据库 Projection、榜单和歌曲读取、歌曲存在性检查、Top 10 容量与去重、事务重排、删除后位置压缩，以及 Singing List 状态过滤和 upsert。路由层不应复制这些业务规则。

### 13.3 errors.ts

- ZodError 映射为 400 INVALID_REQUEST。
- AppError 使用自身 status、code 和 message。
- 其他错误记录结构化日志，并返回 500 INTERNAL_ERROR 和 requestId。
- asyncRoute 把异步异常交给 Express 错误 Middleware。

### 13.4 index.ts

- 默认监听 3001。
- production 模式提供 apps/web/dist。
- SIGINT 和 SIGTERM 时停止接受连接、关闭数据库池并退出。
- 当前没有实现超时强制退出或健康状态切换。

## 14. 测试策略

### 14.1 类型检查

npm run typecheck 会先构建 contracts 和 database，再执行所有 workspace 的 typecheck。

### 14.2 前端组件测试

当前有 2 个测试文件、5 项测试，覆盖 RankingPanel 的搜索、筛选和添加按钮，以及 SingingListPanel 的展开编辑、状态 Chip、备注保存和列表筛选。

### 14.3 API 集成测试

当前有 4 项 Supertest 测试并使用真实 PostgreSQL，覆盖搜索与精确筛选、Top 10 重复和容量限制、原子重排与位置压缩，以及 Singing List 与 Top 10 的独立性。

API 测试通过 createApp 注入固定测试用户。beforeAll 创建该用户，beforeEach 清空该测试用户的列表，afterAll 删除该用户并关闭连接。测试不应读写 demo 用户的个人列表。

### 14.4 Playwright E2E

当前 1 条关键流程覆盖搜索、添加两首 Top 10、上移排序、添加 Singing List、展开 Compact Ledger 编辑器、选择 Practicing、保存，以及刷新后的持久化验证。

playwright.config.ts 使用独立固定 E2E 用户、端口 3101、production 形态 Express 服务和 reuseExistingServer: false。启动前使用该 E2E 用户 ID 执行 Seed。E2E 只清理该用户的个人列表，不应影响 demo 用户。

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

当前缺少认证、授权、CSRF、速率限制、安全响应头策略、生产 CORS 策略、审计日志、运行时指标、Tracing、告警、独立测试数据库，以及备份和恢复 Runbook。apps/api 虽声明了 cors 依赖，但当前 app.ts 没有挂载 CORS Middleware；开发模式依靠 Vite 代理，生产形态使用同源请求。

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
| 身份认证 | 所有请求映射到单一 demo 用户 | 非本地使用前必须实现 |
| 活动榜单选择 | 前端直接使用榜单数组第一项 | 多榜单前增加显式选择和稳定排序 |
| Singing 成员判断 | 状态筛选后，排行榜只知道当前筛选结果中的成员 | 将完整成员集合与筛选展示数据分开 |
| API 分页 | songs 与榜单详情没有服务端分页 | 数据规模扩大前设计统一分页 |
| 错误映射 | 未识别数据库约束错误返回 500 | 补充稳定业务错误映射 |
| 非标准请求错误 | malformed JSON、Body 过大和未知 API 路径未统一为 JSON 格式 | 增加解析错误和 API 404 Middleware |
| Request ID | 只在未知 500 响应中返回 | 需要完整追踪时加入响应 Header |
| 测试数据库 | 测试仍使用本地 PostgreSQL | CI 或多人开发前提供独立数据库 |
| E2E 用户记录 | Seed 保留固定 E2E 用户行 | 可接受；个人列表会被清理 |
| 依赖漏洞 | 6 项未自动修复 | 分别验证 Drizzle 与 Vite 升级 |
| 前端包体积 | 611.28 KB，gzip 190.82 KB | 有真实性能目标后再优化 |
| API 文档 | 当前为手工维护 | API 增长后考虑 OpenAPI |

### 18.2 关键工程决策

| 决策 | 原因 |
| --- | --- |
| 使用 npm workspaces | 维持包边界和单仓库开发体验 |
| 共享 Zod contracts | 统一请求输入校验和枚举类型 |
| Service 显式接收 userId | 为未来替换 demo 用户解析器保留迁移路径 |
| Top 10 使用延迟唯一约束 | 允许事务内安全交换和压缩 position |
| Singing List 使用 upsert | 新增和编辑共享写入路径 |
| E2E 使用专用用户和端口 | 防止清空 demo 数据或误复用开发服务器 |
| Vite 与 React 插件精确锁定 | 避免已复现的开发服务器 HTTP 500 |
| 当前不拆分前端 Bundle | 本地 V1 暂时没有性能目标 |

### 18.3 近期文档变更

| 日期 | 代码基线 | 内容 |
| --- | --- | --- |
| 2026-09-10 | 当前工作树 | 新增首次本地运行指南与认证开发交接入口，并将首次依赖安装统一为 npm ci |
| 2026-09-10 | 9ce4a1c | 创建工程师指南，记录 V1 架构、数据模型、API、测试、安全基线和维护规则 |
