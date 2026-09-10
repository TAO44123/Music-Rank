# Music Rank 首次本地运行指南

## 1. 目的

这份指南供首次接手 Music Rank 的工程师或自动化 Agent 使用。目标是在不破坏现有工作、不猜测环境状态的前提下，完成：

- 仓库状态检查。
- 本机依赖和端口检查。
- 本地环境配置。
- Node 依赖安装。
- PostgreSQL 启动、迁移和 Seed。
- Web 与 API 启动。
- 健康检查和只读冒烟检查。
- 完整自动化验证。
- 清晰的结果汇报。

本文档描述的是首次运行流程。系统架构、数据模型和完整 API 说明见 [ENGINEERING_GUIDE.md](ENGINEERING_GUIDE.md)。

## 2. 当前运行基线

| 项目 | 要求或默认值 |
| --- | --- |
| 已验证平台 | macOS；Linux 可使用等价命令，Windows 建议使用 WSL 2 |
| Node.js | 24.21.0 |
| npm | 11.19.0 |
| 数据库 | PostgreSQL 17.6 Alpine，由 Docker Compose 管理 |
| Web 开发端口 | 5173 |
| API 开发端口 | 3001 |
| E2E 临时端口 | 3101 |
| PostgreSQL 端口 | 5432 |
| 默认分支 | main |
| 依赖安装方式 | npm ci |

不要在没有验证的情况下放宽 Node、npm、Vite 或 React Vite 插件版本。Vite 7.2.1 与 @vitejs/plugin-react 5.1.1 是故障规避性锁定。

## 3. Agent 必须遵守的规则

自动化 Agent 读完本文档后，应遵守以下边界：

1. 先检查，后修改；不要假设仓库、Docker 或端口处于空闲状态。
2. 如果工作树有未提交修改，必须保留并报告；不要 reset、checkout 或覆盖这些修改。
3. 如果 .env 已存在，不要覆盖，也不要在日志或对话中输出其内容。
4. 不要提交 .env、node_modules、dist、测试报告或本地数据库文件。
5. 不要运行 npm audit fix --force。
6. 不要运行 docker compose down -v 或其他会删除数据库卷的命令，除非用户明确授权。
7. 不要终止占用端口的未知进程；先确认是否已经是本项目。
8. Docker、网络下载、浏览器安装或沙箱外 IPC 需要权限时，应请求授权，不要绕过权限。
9. 首次运行不授权创建 remote、push、部署或修改 GitHub 设置。
10. 遇到会改变实现方向、数据或安全边界的不确定项时，停止并询问，不要猜测。

## 4. 首次运行总流程

按以下顺序执行：

1. 确认位于仓库根目录。
2. 检查 Git 分支和工作树。
3. 阅读当前交接和工程师文档。
4. 检查 Node、npm、Docker、Compose 和端口。
5. 配置 .env。
6. 使用 npm ci 安装锁定依赖。
7. 启动数据库并等待 healthy。
8. 应用 Migration。
9. 执行 Seed。
10. 启动开发服务器。
11. 验证 API、Vite Client 和页面。
12. 运行完整自动化检查。
13. 汇报结果、警告和未解决问题。

## 5. 第一步：确认仓库与 Git 状态

进入仓库根目录。若从 GitHub 新 clone，目录名以实际 clone 结果为准。

~~~bash
cd "/path/to/Music-Rank"
pwd
git rev-parse --show-toplevel
git status --short --branch
git remote -v
git log -2 --oneline --decorate
~~~

预期：

- git rev-parse 输出当前仓库根目录。
- 当前分支通常为 main。
- 新 clone 应显示 main 正在跟踪 origin/main。
- 工作树应为空。

如果工作树不为空：

- 不要继续执行会改写文件的命令。
- 先列出状态并确认修改来自谁。
- npm ci、Migration 和启动服务通常仍可执行，但必须先评估是否会覆盖用户工作。

如果是已有 checkout 而不是新 clone，可以在工作树干净时更新：

~~~bash
git pull --ff-only
~~~

使用 --ff-only 可以避免首次环境准备期间意外创建 merge commit。若无法 fast-forward，停止并报告分支分叉情况。

## 6. 第二步：阅读项目状态

至少阅读：

- [SESSION_HANDOFF.md](SESSION_HANDOFF.md)
- [ENGINEERING_GUIDE.md](ENGINEERING_GUIDE.md)
- 根目录 README.md

需要确认：

- 当前已知问题。
- 最近通过的验证。
- 版本锁定。
- 是否有尚未完成的迁移或特殊恢复步骤。

不要把旧交接中的“上次通过”当作当前机器已经验证。

## 7. 第三步：检查基础工具

执行：

~~~bash
git --version
node --version
npm --version
docker --version
docker compose version
curl --version
~~~

Node 和 npm 预期：

~~~text
node: v24.21.0
npm: 11.19.0
~~~

### 7.1 Node 版本不正确

项目根目录包含 .nvmrc。已经安装 nvm 时执行：

~~~bash
nvm install
nvm use
node --version
npm --version
~~~

如果 nvm 不存在，不要自行安装全局工具。工程师应按团队约定安装 Node；Agent 应报告缺失并请求授权。

### 7.2 npm 版本不正确

不要直接忽略 npm 版本差异，因为 package-lock.json 由 npm 11.19.0 维护。升级或降级全局 npm 会影响其他项目，Agent 必须先请求授权。

### 7.3 Docker 不可用

执行：

~~~bash
docker info
~~~

常见情况：

- Docker Desktop 尚未启动。
- 当前用户不能访问 Docker socket。
- Agent 沙箱禁止连接本机 Docker API。

不要用 sudo 或修改 Docker socket 权限绕过问题。启动 Docker Desktop，或让 Agent 请求所需权限。

## 8. 第四步：检查端口

macOS 可以执行：

~~~bash
for port in 3001 3101 5173 5432; do
  lsof -nP -iTCP:$port -sTCP:LISTEN
done
~~~

端口用途：

| 端口 | 服务 |
| --- | --- |
| 3001 | Express API |
| 3101 | Playwright E2E 临时服务 |
| 5173 | Vite Web |
| 5432 | PostgreSQL |

没有输出通常表示端口空闲。有输出时不要直接 kill。

若 3001 和 5173 已被占用，先检查本项目是否已经运行：

~~~bash
curl --fail --silent --show-error http://localhost:3001/api/health
curl --fail --silent --show-error --output /dev/null --write-out "%{http_code}\n" http://localhost:5173/
curl --fail --silent --show-error --output /dev/null --write-out "%{http_code}\n" http://localhost:5173/@vite/client
~~~

若响应正确，可以复用已有开发服务器。若端口被其他应用占用，报告进程信息并让用户决定，不要擅自终止。

## 9. 第五步：配置环境变量

先检查，不要读取或打印已有 .env：

~~~bash
test -f .env && echo ".env exists" || echo ".env is missing"
test -f .env.example && echo ".env.example exists"
~~~

如果 .env 不存在：

~~~bash
cp .env.example .env
~~~

默认配置：

| 变量 | 默认值 |
| --- | --- |
| NODE_ENV | development |
| PORT | 3001 |
| APP_ORIGIN | http://localhost:5173 |
| DATABASE_URL | postgresql://music_rank:music_rank@localhost:5432/music_rank |
| DEMO_USER_ID | 7c5b5636-48f8-4e9b-89b0-06381d28496b |
| LOG_LEVEL | info；当前实现尚未读取 |

APP_ORIGIN 必须与浏览器地址的 Origin 完全一致；默认开发地址应使用 localhost 而不是 127.0.0.1。上述数据库凭据只用于本地 Docker demo。不要将相同凭据用于共享或公网数据库。

确认 .env 被忽略：

~~~bash
git check-ignore -v .env
git status --short
~~~

预期 git check-ignore 指向 .gitignore，git status 不显示 .env。

## 10. 第六步：安装 Node 依赖

新 clone 应使用：

~~~bash
npm ci
~~~

npm ci：

- 严格使用 package-lock.json。
- 不应修改 package.json 或 package-lock.json。
- 会重建 node_modules。

安装后检查：

~~~bash
git status --short
npm ls --depth=0
~~~

如果 npm ci 修改了受版本控制文件，停止并检查 Node/npm 版本，不要直接提交变化。

网络受限或 Agent 沙箱阻止下载时，应请求网络权限。不要切换到未知镜像源。

## 11. 第七步：启动数据库

执行：

~~~bash
npm run db:up
docker compose ps database
~~~

首次运行可能需要下载 postgres:17.6-alpine 镜像。

等待状态变为 healthy。若状态仍为 starting，可以短暂等待后再次运行 docker compose ps database；不要高频轮询。

预期服务名：

~~~text
database
~~~

预期容器名通常为：

~~~text
musicrank-database-1
~~~

容器名可能受 Compose project name 影响，因此自动化逻辑应优先使用服务名 database，而不是硬编码容器名。

## 12. 第八步：应用数据库迁移

执行：

~~~bash
npm run db:migrate
~~~

预期日志包含：

~~~text
Database migrations applied
~~~

Migration 失败时检查：

- PostgreSQL 是否 healthy。
- DATABASE_URL 是否与 docker-compose.yml 一致。
- 5432 是否连接到了另一个 PostgreSQL。
- packages/database/migrations 和 meta 文件是否完整。
- Node/tsx 是否被沙箱禁止创建临时 IPC。

不要删除 Migration、数据库卷或 Drizzle metadata 来绕过错误。

## 13. 第九步：执行 Seed

执行：

~~~bash
npm run db:seed
~~~

预期日志包含：

~~~text
Demo data seeded
~~~

当前 Seed 创建或更新：

- demo 用户。
- 一个已发布 demo 榜单。
- 30 首 demo 歌曲。
- 30 个榜单项。

Seed 是幂等的，不会创建、删除或覆盖 My Top 10 与 My Singing List。

首次环境验证时可以再次运行 Seed，并确认仍报告 30 首歌曲。不要用 Seed 作为清空个人列表的方法。

## 14. 第十步：启动开发服务器

如果 3001 和 5173 空闲，执行：

~~~bash
npm run dev
~~~

该命令在前台同时启动：

- Express API：localhost:3001
- Vite Web：localhost:5173

保持这个终端运行。需要继续执行健康检查时，打开另一个终端。

预期日志包含：

~~~text
API server started
VITE ready
Local: http://localhost:5173/
~~~

如果端口已经由健康的本项目实例占用，不要再启动第二份开发服务器。

## 15. 第十一步：健康检查

在另一个终端、仍位于仓库根目录时执行。

### 15.1 API 与数据库

~~~bash
curl --fail --silent --show-error http://localhost:3001/api/health
~~~

必须确认响应表示：

- status 为 ok。
- database 为 ok。

### 15.2 Vite Client

~~~bash
curl --fail --silent --show-error --output /dev/null --write-out "%{http_code}\n" http://localhost:5173/@vite/client
~~~

预期 HTTP 状态为 200。若返回 500 并出现 Missing field moduleType，检查 Vite 与 React 插件锁定版本。

### 15.3 Web 页面

~~~bash
curl --fail --silent --show-error --output /dev/null --write-out "%{http_code}\n" http://localhost:5173/
~~~

预期 HTTP 状态为 200。

## 16. 第十二步：只读 UI 冒烟检查

在浏览器打开：

http://localhost:5173

不修改个人列表的基础检查：

- 页面标题显示 Music Rank。
- 榜单明确标记 Demo Data。
- 榜单标题为 90s Mainland China Pop Songs。
- 无筛选时显示 30 results 和两页分页。
- 搜索可以按标题或歌手缩小结果。
- Artist 与 Release year 可以组合筛选。
- 匿名用户看到登录提示，不会请求 My Top 10 或 My Singing List。
- 注册和登录后，两个个人列表能加载且默认 Private。
- Public 列表可通过 /u/:username 匿名访问，Singing List 备注不出现在公开页。
- 浏览器控制台没有运行时错误。
- 桌面宽度显示双列；移动宽度显示单列。

如果需要验证写入、删除和持久化，优先运行隔离用户的 E2E，而不是修改 demo 用户数据。

## 17. 第十三步：完整自动化验证

确认数据库 healthy 且 Migration 已应用后，依次执行：

~~~bash
npm run typecheck
npm run test
npm run build
npm run test:e2e
~~~

预期基线：

| 检查 | 当前预期 |
| --- | --- |
| TypeScript | 所有 workspace 通过 |
| API 测试 | 11 项通过 |
| Web 测试 | 11 项通过 |
| Production build | 成功 |
| Playwright E2E | 1 项通过 |

测试说明：

- API 集成测试使用动态创建的认证用户和一个注入式旧功能测试用户，但连接本地 PostgreSQL。
- E2E 在端口 3101 使用页面注册的唯一用户。
- 测试不应清空 demo 用户个人列表。
- E2E 会自行构建、迁移、Seed 公共 fixtures、启动 production 形态服务，并只删除自己创建的账户。

### 17.1 Playwright 浏览器缺失

仅在错误明确指出 Chromium 尚未安装时执行：

~~~bash
npx playwright install chromium
~~~

这会下载浏览器软件。工程师应确认网络策略；Agent 必须先请求下载和安装权限。

### 17.2 当前允许的警告

以下警告已经记录，不代表检查失败：

- 前端测试关于 React 插件旧 esbuild option 的兼容警告。
- 前端 JavaScript 产物超过 Vite 默认 500 KB 阈值。
- NO_COLOR 被 FORCE_COLOR 覆盖的 Node 警告。

不应忽略新的 error、failed test、未处理异常或不同于上述内容的警告。

## 18. 停止服务

停止 npm run dev：

~~~text
在运行开发服务器的终端按 Control-C
~~~

如果暂时不需要数据库：

~~~bash
npm run db:down
~~~

db:down 会停止并移除 Compose 容器和网络，但保留命名卷中的数据库数据。

不要执行 docker compose down -v，除非用户明确要求删除本地数据库数据并理解不可恢复的影响。

## 19. 成功标准

满足以下条件才算首次本地运行完成：

- Git 工作树原有修改未被覆盖。
- Node 是 24.21.0，npm 是 11.19.0。
- Docker Compose 配置有效。
- PostgreSQL 为 healthy。
- Migration 成功。
- Seed 成功并保持个人列表。
- API health 返回数据库正常。
- Web 首页和 /@vite/client 返回 200。
- 页面可以读取 30 首 demo 榜单。
- typecheck、tests、build 和 E2E 全部通过。
- .env、dist、node_modules 和测试报告没有进入 Git 状态。

## 20. 常见失败与处理

| 症状 | 首先检查 | 不要做 |
| --- | --- | --- |
| docker socket permission denied | Docker 是否运行、Agent 是否需要权限 | 不要 chmod socket 或使用 sudo 绕过 |
| 5432 connection refused | Compose database 是否 healthy | 不要删除卷 |
| tsx 报临时 pipe EPERM | 沙箱临时目录或 IPC 权限 | 不要改写系统目录权限 |
| API health 500 | 数据库、Migration、DATABASE_URL | 不要只重启前端 |
| /@vite/client 500 | Vite 7.2.1 与 plugin-react 5.1.1 | 不要盲目升级 |
| 3001 或 5173 已占用 | 是否已有本项目健康实例 | 不要 kill 未确认进程 |
| E2E Web Server 启动失败 | 3101、PostgreSQL、Chromium | 不要改回并复用 3001 |
| npm ci 改变锁文件 | Node/npm 版本是否正确 | 不要直接提交锁文件变化 |
| 测试显示已知 Vite 警告 | 测试退出码和通过数量 | 不要为消警告解除版本锁定 |
| Git 出现用户修改 | git status 和 diff | 不要 reset 或 checkout |

## 21. Agent 汇报模板

完成首次运行后，Agent 应向用户报告：

~~~text
仓库：
- 分支与 upstream：
- 工作树是否干净：

环境：
- Node：
- npm：
- Docker / Compose：
- 使用的 .env：已有 / 从模板创建（不要输出内容）

数据库：
- 容器状态：
- Migration：
- Seed：

服务：
- API health：
- Vite Client：
- Web 首页：

验证：
- typecheck：
- API tests：
- Web tests：
- build：
- E2E：

已知警告：
- 无 / 列出警告

未解决问题或需要用户决定：
- 无 / 列出问题
~~~

不要在汇报中输出密码、Token、完整 DATABASE_URL、.env 内容或其他敏感信息。

## 22. 文档维护

以下变化必须同步更新本文档：

- Node、npm、Docker 或 PostgreSQL 基线。
- 端口、环境变量或启动方式。
- Migration 或 Seed 行为。
- 测试数量、测试用户隔离或 E2E 启动方式。
- 已知可忽略警告。
- 首次运行所需权限或平台差异。

更新后应验证本文中的本地链接、命令名称、package.json scripts 和端口与当前代码一致。
