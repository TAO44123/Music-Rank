# Music Rank 网页应用——第一版项目规格

## 1. 文档状态

- 状态：第一版规划基线
- 产品形态：本地优先的网页应用
- 预期规模：第一版为单个演示用户，后续为几十至一百多名用户
- 部署状态：第一版仅在本地开发和运行
- 未来云平台：AWS

本文档是第一版的实施基线。任何实质性的范围或架构调整，都应在继续实施前同步更新本文件和 PROJECT_SPEC_EN.md。

## 2. 产品概述

Music Rank 将歌曲排行榜转化为可操作的歌曲列表，用户可以从中建立个人 Top 10，并维护自己的演唱曲目。

第一版是一个聚焦核心功能的完整 Demo，用于验证以下闭环：

1. 浏览或搜索预置歌曲榜单。
2. 将歌曲加入“我的 Top 10”。
3. 调整 Top 10 顺序或移除歌曲。
4. 将歌曲加入“我的演唱曲目”。
5. 设置或更新演唱状态和备注。
6. 重新加载应用后，所有修改仍然保留。

## 3. 第一版目标

- 交付一个可在本地完整运行的全栈应用。
- 验证榜单发现、个人排序和演唱曲目管理组合在一起是否有价值。
- 使用真实 API 和数据库持久化，而不是只使用浏览器内的模拟状态。
- 为以后加入身份验证和 AWS 部署保留清晰接口，但第一版不实施它们。
- 有意控制代码规模，使项目容易理解和快速修改。

## 4. 第一版范围

### 4.1 包含

- 一个响应式单页面网页应用。
- 一个预置 Demo 榜单：“90 年代中国大陆流行歌曲”。
- 大约 30 条预置歌曲记录。
- 歌名和歌手名可以保留中文。
- 应用界面和系统消息使用英文。
- 按排名顺序浏览歌曲。
- 按歌名或歌手搜索，并可额外按歌手和发行年份筛选。
- “我的 Top 10”，最多包含 10 首不重复的歌曲。
- 添加、移除、拖拽排序，以及按钮排序。
- “我的演唱曲目”。
- 演唱状态：会唱、常唱、正在练、想学。
- 每条演唱曲目可以填写一条可选的简短备注。
- 按演唱状态筛选。
- 通过后端 API 持久化到 PostgreSQL。
- 用于创建 Demo 用户、榜单、歌曲和榜单条目的种子脚本。
- 使用 Node.js 和 Docker Compose 进行本地开发。
- 对关键前端和后端行为进行自动化测试。

### 4.2 不包含

- 注册、登录、退出、找回密码和多账号。
- 跨设备身份识别或同步。
- 公开用户主页、分享、社交和推荐。
- 运营或内容管理后台。
- 视频 URL 导入、字幕提取、OCR、AI 提取或人工审核队列。
- 真实或权威榜单声明。
- 音乐播放、音频托管、下载或歌词。
- 付费、订阅和广告。
- 正式环境部署、CI/CD、自定义域名、生产监控和生产备份。
- 语音输入和自然语言指令。

视频提取功能在第一版中明确废弃，不实现占位 API，也不在界面上放置不可用入口。

## 5. 内容规则

- 第一版榜单是用于验证产品功能的虚构 Demo 内容。
- 种子数据不得把该榜单描述为官方、权威或完整榜单。
- 榜单来源类型设为 DEMO。
- 第一版的来源 URL 为空。
- 界面必须清楚标注这是 Demo 数据。
- 歌名和歌手名属于专有名称，可以使用原始中文写法。
- 所有源代码、标识符、注释、文件名、界面文字、API 消息和测试描述必须使用英文。
- PROJECT_SPEC_ZH.md 是明确允许使用中文的文档例外。

## 6. 第一版用户模型

第一版作为单用户应用运行。

- 数据库中预置一个使用稳定 UUID 的 Demo 用户。
- 应用不显示登录页面，也不宣称用户已经完成身份验证。
- 服务端集中实现一个“当前用户解析器”，将所有 /api/me 请求映射到预置 Demo 用户。
- 业务逻辑和数据访问层必须从解析器接收用户 ID，不能在多处导入或重复写死固定 ID。
- 所有个人数据表从一开始就包含 user_id。
- 固定 Demo 用户 ID 只在一个服务端配置位置定义，并由种子脚本使用同一值。

### 6.1 第二版身份验证迁移

第二版将使用真实身份验证替换当前用户解析器，而不改变个人列表的资源模型：

1. 接入身份验证服务或实现自有身份验证流程。
2. 将通过验证的用户主体映射到 User 记录。
3. 用身份验证中间件替换 Demo 用户解析器。
4. 决定迁移还是删除第一版 Demo 用户的数据。
5. 增加授权测试，确保用户无法访问其他账号的数据。

## 7. 核心用户体验

### 7.1 页面结构

第一版只使用一个应用路由。

- 顶部：产品名称、简短说明和明显的“Demo Data”标识。
- 榜单区域：搜索框、结果数量和按排名排列的歌曲列表。
- My Top 10 区域：已选数量、有序条目、排序按钮和移除按钮。
- My Singing List 区域：状态筛选、歌曲条目、状态控件、备注和移除操作。

桌面端可以采用多栏工作区布局。移动端可以采用 Material UI 标签页或纵向区域，但必须保证核心操作容易触达。

### 7.2 榜单行为

- 每条结果显示排名、歌名和歌手。
- 默认按预置排名排列。
- 搜索不区分英文字母大小写，并匹配歌名或歌手。
- 歌手和发行年份筛选可以独立使用，也可以与文本搜索组合使用。
- 没有搜索结果时显示清晰的空状态。
- 每行提供加入 My Top 10 和 My Singing List 的操作。
- 已加入状态必须清楚可见，并阻止重复添加。

### 7.3 My Top 10 行为

- 用户可以保存 0 至 10 首歌曲。
- 同一首歌只能出现一次。
- 新歌曲添加到列表末尾。
- 已满 10 首时，继续添加必须失败并显示清晰提示。
- 同时支持拖拽排序和可访问的上移、下移按钮。
- 服务端保存的顺序是最终权威顺序。
- 重排作为一个原子操作持久化。
- 移除歌曲后自动补齐序号。
- 从 My Top 10 移除歌曲不会影响 My Singing List。

### 7.4 My Singing List 行为

- 同一用户的同一首歌只能出现一次。
- 每条歌曲同时只能有一个当前状态。
- 添加歌曲时默认状态为“想学”。
- 状态可以随时修改。
- 备注为可选纯文本，最多 300 个字符。
- 可以按状态筛选。
- 从 My Singing List 移除歌曲不会影响 My Top 10。

### 7.5 已确定的布局与视觉方向

第一版采用已经确认的“Concept C 布局 + Warm Archive 配色”，简称 C1 主题。

桌面端布局：

- 紧凑的应用顶部栏，展示产品名称和 Demo Data 标识。
- 左侧是较宽的榜单工作区。
- 右侧是较窄的个人内容工作区。
- My Top 10 和 My Singing List 在个人工作区中作为两个清晰区域展示。
- 首屏直接提供核心操作，不设置营销型大幅头图。

移动端布局：

- Ranking、Top 10 和 Singing List 通过适合触摸的导航访问。
- 保持与桌面端一致的信息层级和操作能力。
- 不使用拖拽也必须能够完成排序。

已确定的视觉特征：

- 采用现代 Material UI 结构，同时保留温暖的编辑感和音乐档案气质。
- 使用暖象牙白页面背景和奶油色内容表面。
- 砖红色作为主要操作色。
- 柔和金色作为辅助强调色。
- 深墨色文字搭配克制的浅棕色边框。
- 不使用渐变、专辑封面、摄影图片、玻璃拟态或多余装饰。
- 第一版只实现浅色主题，但 token 结构必须支持以后增加深色主题。

已确定的核心颜色 token：

| Token | 色值 |
| --- | --- |
| Page background | #F6F0E5 |
| Surface | #FFFCF6 |
| Primary | #A63D2F |
| Secondary | #C99A3D |
| Main text | #25221E |
| Border | #D8CCB9 |
| Selected row | #F2E6D5 |

实施时可以为了无障碍对比度进行小幅调整，但不得改变整体视觉性格。

## 8. 技术栈

### 8.1 运行环境和语言

- Node.js 24 LTS
- TypeScript 严格类型检查
- ECMAScript Modules
- npm 和 npm workspaces

开始实施时，在本地及未来部署配置中固定 Node.js 24 的具体次版本。创建 Git 仓库后，需要提交依赖锁文件。

### 8.2 前端

- React + TypeScript
- Vite
- Material UI 作为主要组件系统
- Material Icons
- 使用 React state 和 hooks 管理本地界面状态
- 使用 TanStack Query 处理服务端数据获取、缓存、更新和失效
- 使用 dnd-kit 实现兼容鼠标、触摸和键盘的拖拽排序
- 在适当位置使用基于 Zod 的共享请求与响应契约

第一版不引入全局状态管理库，除非实施过程中证明存在明确需要。

Material UI theme 是颜色、字体、间距、圆角、阴影、响应式断点和演唱状态颜色的唯一来源。产品专用的可复用组件保留在 apps/web 内；第一版不创建独立组件包，也不安装 Storybook。

### 8.3 后端

- Express 5
- TypeScript
- Zod 请求验证
- Drizzle ORM
- 兼容本地和未来托管 PostgreSQL 的数据库驱动
- 结构化 JSON 日志
- 集中式错误处理
- 优雅关闭服务器并清理数据库连接

### 8.4 数据库

- PostgreSQL
- 本地使用 Docker Compose
- 使用 Drizzle 生成和维护 SQL 迁移
- 使用 TypeScript 编写种子脚本

选择 PostgreSQL 而不是 MongoDB，是因为本产品依赖明确的关系、顺序、唯一约束和原子列表更新。同时，它可以直接迁移到未来 AWS 上的托管 PostgreSQL。

### 8.5 测试

- Vitest：单元测试
- Supertest：Express API 集成测试
- React Testing Library：前端组件行为测试
- Playwright：一条关键端到端流程

## 9. 仓库结构

项目采用小型 npm workspaces 单仓库结构：

    music-rank/
      apps/
        web/
          src/
        api/
          src/
      packages/
        contracts/
          src/
        database/
          src/
          migrations/
      scripts/
      docs/
        README.md
        IMPLEMENTATION_HANDOFF.md
        PROJECT_SPEC_EN.md
        PROJECT_SPEC_ZH.md
        PROJECT_MVP.md
      docker-compose.yml
      package.json
      tsconfig.base.json
      .env.example

各部分职责：

- apps/web：React 应用和浏览器端行为。
- apps/api：Express API、当前用户解析器、业务服务和 HTTP 相关逻辑。
- packages/contracts：共享 API schema 和 TypeScript 类型。
- packages/database：Drizzle schema、数据库客户端、迁移和种子数据。
- scripts：仓库级开发及维护脚本。

## 10. 应用架构

本地请求流程：

    浏览器
      -> React 应用
      -> /api REST 请求
      -> Express
      -> 当前用户解析器
      -> 应用服务
      -> Drizzle ORM
      -> PostgreSQL

开发环境中，Vite 和 Express 可以作为两个本地进程运行，由 Vite 将 /api 请求代理到后端。生产构建必须支持 Express 提供编译后的 React 静态文件，以便未来用一个容器、一个域名完成部署。

## 11. 数据模型

### 11.1 User

- id：UUID，主键
- display_name：文本
- created_at：时间戳
- updated_at：时间戳

第一版只有一条预置记录。

### 11.2 Song

- id：UUID，主键
- title：文本，必填
- artist：文本，必填
- release_year：整数，可为空
- verification_status：枚举 DEMO、VERIFIED、UNVERIFIED
- created_at：时间戳
- updated_at：时间戳

初始逻辑去重键为规范化后的歌名加歌手。种子脚本不得创建重复歌曲。

### 11.3 Ranking

- id：UUID，主键
- title：文本，必填
- era：文本，可为空
- source_type：枚举 DEMO、OFFICIAL、MEDIA、COMMUNITY
- source_url：文本，可为空
- description：文本，可为空
- is_published：布尔值
- verified_at：时间戳，可为空
- created_at：时间戳
- updated_at：时间戳

### 11.4 RankingEntry

- id：UUID，主键
- ranking_id：UUID，外键
- song_id：UUID，外键
- rank：大于零的整数
- source_timestamp_seconds：整数，可为空
- verification_status：枚举 DEMO、VERIFIED、UNVERIFIED

约束：

- ranking_id 与 rank 的组合唯一。
- ranking_id 与 song_id 的组合唯一。

### 11.5 UserTopListEntry

- id：UUID，主键
- user_id：UUID，外键
- song_id：UUID，外键
- position：1 至 10 的整数
- created_at：时间戳
- updated_at：时间戳

约束：

- user_id 与 song_id 的组合唯一。
- user_id 与 position 的组合唯一。
- 每名用户最多 10 条记录，由事务性业务逻辑保证，并通过测试验证。

### 11.6 SingingListEntry

- id：UUID，主键
- user_id：UUID，外键
- song_id：UUID，外键
- status：枚举 CAN_SING、REGULARLY_SING、PRACTICING、WANT_TO_LEARN
- note：文本，可为空；API 层限制最多 300 个字符
- created_at：时间戳
- updated_at：时间戳

约束：

- user_id 与 song_id 的组合唯一。

## 12. REST API

所有响应均使用 JSON。可预期的客户端错误使用稳定的英文错误代码和便于理解的英文消息。

### 12.1 系统

- GET /api/health：返回服务和数据库健康状态。

### 12.2 榜单和歌曲

- GET /api/rankings：返回已发布榜单。
- GET /api/rankings/:rankingId：返回榜单元数据及条目；可选查询参数 q 按歌名或歌手筛选，可选查询参数 artist 和 releaseYear 分别按精确歌手和发行年份筛选。
- GET /api/songs：可选查询参数 q 搜索现有歌曲。

### 12.3 My Top 10

- GET /api/me/top-list
- POST /api/me/top-list/items，请求体为 songId。
- PATCH /api/me/top-list/order，请求体为 orderedSongIds。
- DELETE /api/me/top-list/items/:songId

### 12.4 My Singing List

- GET /api/me/singing-list，可选查询参数 status。
- PUT /api/me/singing-list/items/:songId，请求体为 status 和可选 note。
- DELETE /api/me/singing-list/items/:songId

### 12.5 API 约定

- 验证路径参数、查询参数和请求体。
- 无效请求返回 400。
- 资源不存在返回 404。
- 重复添加或 Top 10 容量冲突返回 409。
- 意外服务端错误返回请求 ID。
- 响应中不得暴露堆栈或数据库细节。

## 13. 种子数据

种子流程创建：

- 一个稳定的 Demo 用户。
- 一个已发布的 Demo 榜单。
- 大约 30 首具有代表性的 90 年代中国大陆流行歌曲。
- 每首歌对应一条 RankingEntry。
- 初始 My Top 10 为空。
- 初始 My Singing List 为空。

种子脚本必须具备幂等性。重复执行时，应更新或保留已知 Demo 记录，不得产生重复数据。

准确的种子歌曲将在实施阶段选定。这些歌曲仅为产品演示数据，不构成经过研究或具有权威性的榜单。

## 14. 本地开发

### 14.1 前置条件

- Node.js 24 LTS
- npm
- 支持 Docker Compose 的 Docker

本地不需要预先存在 PostgreSQL 容器，也不需要单独安装 PostgreSQL。Docker Compose 将声明数据库服务，在首次启动时拉取固定版本的 PostgreSQL 镜像、创建容器，并挂载命名卷以持久保存本地数据。

### 14.2 环境变量

提交到仓库的 .env.example 至少记录：

- NODE_ENV
- PORT
- DATABASE_URL
- DEMO_USER_ID
- LOG_LEVEL

不得提交密钥和机器专用配置值。

### 14.3 预期命令

根工作区应提供等效命令，用于：

- 安装依赖。
- 启动 PostgreSQL。
- 执行数据库迁移。
- 写入种子数据。
- 启动前端和后端开发服务器。
- 对所有工作区进行类型检查。
- 运行测试。
- 构建所有工作区。
- 运行接近生产形态的本地服务器。

最终命令名称将在项目初始化后写入仓库 README。

## 15. 可靠性、安全性与无障碍

### 15.1 第一版基线

- 通过 ORM 使用参数化数据库查询。
- 严格验证请求。
- 集中式错误处理。
- 生产形态采用同源架构。
- 前端代码中不包含密钥。
- 提供健康检查接口。
- 支持服务器优雅关闭。
- 排序相关数据库操作使用事务。
- 提供用户可见的加载、空、成功和错误状态。

### 15.2 无障碍

- 所有控件都有可访问名称。
- 不使用拖拽也可以完整调整 Top 10 顺序。
- 键盘焦点始终清晰可见。
- 不只依赖颜色表达状态。
- 触摸控件尺寸适合移动设备。
- 使用 Material UI 组件时不得破坏其无障碍行为。

## 16. 测试计划

最低自动化测试范围：

- 按歌名和歌手搜索榜单。
- 向 My Top 10 添加不重复歌曲。
- 拒绝重复添加歌曲。
- 拒绝添加第 11 首歌曲。
- 原子化调整 Top 10 顺序。
- 移除歌曲并补齐位置。
- 创建和更新演唱曲目。
- 确保每首歌曲只有一个演唱状态。
- 按状态筛选演唱曲目。
- 确保 My Top 10 和 My Singing List 相互独立。
- 一条 Playwright 流程：打开榜单、搜索、添加歌曲、排序、设置演唱状态、重新加载并验证持久化。

## 17. 第一版验收标准

- 可以通过文档中的命令在本地启动应用。
- PostgreSQL 可以通过 Docker Compose 启动。
- 种子脚本创建一个包含约 30 首歌曲的 Demo 榜单。
- 榜单明确标注为 Demo 数据。
- 可以按歌名或歌手浏览和搜索歌曲，并可按歌手或发行年份筛选。
- 可以向 My Top 10 添加歌曲或移除歌曲。
- 不可能产生重复的 Top 10 条目。
- My Top 10 不会超过 10 首。
- Top 10 同时支持拖拽和按钮排序。
- 保存后的 Top 10 顺序在页面刷新和服务重启后仍然存在。
- 可以向 My Singing List 添加歌曲。
- 可以更新演唱状态和备注。
- 可以按状态筛选 My Singing List。
- Top 10 和演唱曲目成员关系相互独立。
- 关键自动化测试全部通过。
- 响应式界面支持当前桌面及移动浏览器。

## 18. 后续路线

### 第二版：账号

- 加入真实身份验证。
- 支持多个用户。
- 增加授权和数据隔离。
- 决定如何处理 Demo 用户数据。
- 支持跨设备持久化。

### 后续内容运营

- 增加多个榜单和经过核实的来源信息。
- 增加运营管理和审核流程。
- 如果重新考虑视频提取，再加入导入任务和人工审核。

视频导入必须作为独立的可行性项目处理。它可能需要针对特定平台的访问方式、字幕可用性、视频抽帧、OCR、AI 规范化、异步任务和人工核验。不能预设它是一个通用的“输入任意 URL 即生成榜单”功能。

### 后续 AWS 部署

应用保持“单容器 + 托管 PostgreSQL”的可部署形态。未来 AWS 方案可以包含：

- 容器镜像仓库。
- 托管容器运行环境。
- 托管 PostgreSQL。
- 密钥管理。
- HTTPS 和自定义域名。
- 集中式日志和健康监控。
- 数据库备份及恢复测试。
- 从未来 Git 仓库执行 CI/CD。

具体 AWS 服务和基础设施即代码工具留到部署阶段再决定。

## 19. 明确延后的决策

以下决策有意留待以后处理：

- 身份验证服务和登录方式。
- AWS 计算服务。
- 基础设施即代码工具。
- 域名和 DNS 配置。
- 生产数据库备份保留周期。
- 生产告警阈值。
- 视频来源平台和提取方式。
- 运营和内容审核工作流。

## 20. 变更控制

实施前，项目负责人应确认本规格。实施过程中：

- 不扩大范围的小型实现细节可以调整。
- 新增任何面向用户的功能都需要明确批准。
- 数据库或 API 契约发生变化时，必须同步更新中英文规格。
- 第一版不得在未确认的情况下吸收部署、身份验证或视频导入工作。
